import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Dashboard & audit-log endpoints (e2e)', () => {
  let app: import('@nestjs/common').INestApplication;
  const unique = Date.now();

  async function registerAndLogin(email: string) {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correcthorsebattery', fullName: 'Test User' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'correcthorsebattery' })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createTenant(ownerToken: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('dashboard reflects posted revenue and expense entries', async () => {
    const ownerToken = await registerAndLogin(`owner-dash-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant Dash');

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ entryType: 'revenue', amount: 300 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ entryType: 'expense', amount: 50 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/dashboard`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.today).toEqual({
      revenue: '300.00',
      expenses: '50.00',
      cashPosition: '250.00',
    });
    expect(res.body.week.revenue).toBe('300.00');
    expect(res.body.month.revenue).toBe('300.00');
  });

  it('staff cannot access the dashboard or audit log (owner/accountant only)', async () => {
    const ownerToken = await registerAndLogin(`owner-dash2-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant Dash2');

    const staffEmail = `staff-dash2-${unique}@test.com`;
    const staffToken = await registerAndLogin(staffEmail);
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/memberships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: staffEmail, role: 'staff' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/dashboard`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/audit-log`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
  });

  it('an outsider (no membership) cannot read the dashboard or audit log for a tenant', async () => {
    const ownerToken = await registerAndLogin(`owner-dash3-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant Dash3');
    const outsiderToken = await registerAndLogin(
      `outsider-dash3-${unique}@test.com`,
    );

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/dashboard`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/audit-log`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('audit log records both the create and the reverse action, most recent first', async () => {
    const ownerToken = await registerAndLogin(`owner-audit-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant Audit');

    const entryRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ entryType: 'revenue', amount: 75 })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/ledger-entries/${entryRes.body.id}/reverse`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'mistake' })
      .expect(201);

    const auditRes = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/audit-log`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(auditRes.body).toHaveLength(2);
    expect(auditRes.body[0].action).toBe('ledger_entry.reverse');
    expect(auditRes.body[1].action).toBe('ledger_entry.create');
  });

  it('audit log respects the take query param', async () => {
    const ownerToken = await registerAndLogin(
      `owner-audit2-${unique}@test.com`,
    );
    const tenantId = await createTenant(ownerToken, 'Tenant Audit2');

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ entryType: 'revenue', amount: 20 + i })
        .expect(201);
    }

    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/audit-log?take=2`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
  });

  it('ledger list with no query params returns entries using the default page size', async () => {
    const ownerToken = await registerAndLogin(`owner-list-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant List');

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ entryType: 'revenue', amount: 15 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  it('unauthenticated requests are rejected on both endpoints', async () => {
    const ownerToken = await registerAndLogin(`owner-dash4-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant Dash4');

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/dashboard`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/audit-log`)
      .expect(401);
  });
});
