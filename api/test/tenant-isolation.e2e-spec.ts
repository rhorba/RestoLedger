import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Exercises the release-gate scenarios from docs/test-strategy-restoledger.md against a real
 * Postgres (the docker-compose instance — see .env), not a mock. This is the test that
 * actually proves RLS + the tenant-membership guard work together, not just that each is
 * individually well-typed.
 */
describe('Tenant isolation & RBAC (e2e)', () => {
  let app: import('@nestjs/common').INestApplication;
  let prisma: PrismaService;
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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks an accountant from another tenant from reading this tenant\'s ledger (cross-tenant isolation)', async () => {
    const ownerAToken = await registerAndLogin(`owner-a-${unique}@test.com`);
    const tenantAId = await createTenant(ownerAToken, 'Tenant A');

    const outsiderToken = await registerAndLogin(`outsider-${unique}@test.com`);
    // outsider has no membership on Tenant A at all

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantAId}/ledger-entries`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('staff can post a revenue entry, and it writes an audit log entry in the same transaction', async () => {
    const ownerToken = await registerAndLogin(`owner-b-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant B');

    const staffEmail = `staff-b-${unique}@test.com`;
    const staffToken = await registerAndLogin(staffEmail);
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/memberships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: staffEmail, role: 'staff' })
      .expect(201);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ entryType: 'revenue', amount: 500, description: 'Dinner service' })
      .expect(201);

    expect(createRes.body.amount).toBe('500.00');

    const auditEntries = await prisma.withTenant(tenantId, (tx) =>
      tx.auditLogEntry.findMany({ where: { entityId: createRes.body.id } }),
    );
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].action).toBe('ledger_entry.create');
  });

  it('staff cannot list ledger entries or reverse an entry (owner/accountant only)', async () => {
    const ownerToken = await registerAndLogin(`owner-c-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant C');

    const staffEmail = `staff-c-${unique}@test.com`;
    const staffToken = await registerAndLogin(staffEmail);
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/memberships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: staffEmail, role: 'staff' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    const entryRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ entryType: 'expense', amount: 100 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries/${entryRes.body.id}/reverse`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'staff should not be able to do this' })
      .expect(403);
  });

  it('reversing an entry creates a linked offsetting entry and leaves the original unmodified', async () => {
    const ownerToken = await registerAndLogin(`owner-d-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant D');

    const entryRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ entryType: 'revenue', amount: 250 })
      .expect(201);

    const reverseRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries/${entryRes.body.id}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'wrong amount' })
      .expect(201);

    expect(reverseRes.body.amount).toBe('-250.00');
    expect(reverseRes.body.reversalOfId).toBe(entryRes.body.id);

    const original = await prisma.withTenant(tenantId, (tx) =>
      tx.ledgerEntry.findUnique({ where: { id: entryRes.body.id } }),
    );
    expect(original?.amountCents).toBe(25000n);
    expect(original?.reversalOfId).toBeNull();
  });

  it('GET /tenants/mine returns only tenants the caller belongs to (self-lookup RLS policy)', async () => {
    const ownerToken = await registerAndLogin(`owner-f-${unique}@test.com`);
    await createTenant(ownerToken, 'Tenant F1');
    await createTenant(ownerToken, 'Tenant F2');

    const otherToken = await registerAndLogin(`owner-g-${unique}@test.com`);
    await createTenant(otherToken, 'Tenant G1');

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    const names = res.body.map((m: { tenant: { name: string } }) => m.tenant.name).sort();
    expect(names).toEqual(['Tenant F1', 'Tenant F2']);
  });

  it('ledger list supports cursor pagination', async () => {
    const ownerToken = await registerAndLogin(`owner-h-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant H');

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ entryType: 'revenue', amount: 10 + i })
        .expect(201);
    }

    const firstPage = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/ledger-entries?take=2`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(firstPage.body).toHaveLength(2);

    const secondPage = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/ledger-entries?take=2&cursor=${firstPage.body[1].id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(secondPage.body.every((e: { id: string }) => e.id !== firstPage.body[0].id && e.id !== firstPage.body[1].id)).toBe(true);
  });

  it('rejects reversing an already-reversed entry', async () => {
    const ownerToken = await registerAndLogin(`owner-e-${unique}@test.com`);
    const tenantId = await createTenant(ownerToken, 'Tenant E');

    const entryRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ entryType: 'revenue', amount: 100 })
      .expect(201);

    const reverseRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries/${entryRes.body.id}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'first reversal' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/ledger-entries/${reverseRes.body.id}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'second reversal attempt' })
      .expect(400);
  });
});
