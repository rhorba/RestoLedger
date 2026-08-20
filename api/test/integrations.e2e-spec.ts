import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

function sign(body: string, secret: string) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

describe('POS webhook integration (e2e)', () => {
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
    app = moduleRef.createNestApplication({ rawBody: true });
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

  async function connectIntegration(
    ownerToken: string,
    tenantId: string,
    webhookSecret: string,
  ) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/integrations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        provider: 'generic-webhook',
        credentials: { webhookSecret, apiKey: 'irrelevant' },
      })
      .expect(201);
    return res.body.id as string;
  }

  it('a validly signed webhook creates a ledger entry attributed to the system, not a user', async () => {
    const ownerToken = await registerAndLogin(
      `owner-webhook-${unique}@test.com`,
    );
    const tenantId = await createTenant(ownerToken, 'Tenant Webhook');
    const secret = 'whsec_test_1';
    const connectionId = await connectIntegration(ownerToken, tenantId, secret);

    const body = JSON.stringify({
      transactions: [
        {
          id: `ext-${unique}-1`,
          type: 'sale',
          amount: 88.5,
          note: 'POS sale',
          timestamp: '2026-08-20T12:00:00Z',
        },
      ],
    });

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/pos/generic-webhook/${connectionId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body, secret))
      .send(body)
      .expect(201);

    const entries = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(entries.body).toHaveLength(1);
    expect(entries.body[0].amount).toBe('88.50');
    expect(entries.body[0].createdByUserId).toBeNull();

    const audit = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/audit-log`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(audit.body[0].action).toBe('ledger_entry.create.integration');
    expect(audit.body[0].actorUserId).toBeNull();
  });

  it('rejects a webhook with an invalid signature and creates no entry', async () => {
    const ownerToken = await registerAndLogin(
      `owner-webhook2-${unique}@test.com`,
    );
    const tenantId = await createTenant(ownerToken, 'Tenant Webhook2');
    const connectionId = await connectIntegration(
      ownerToken,
      tenantId,
      'whsec_test_2',
    );

    const body = JSON.stringify({
      transactions: [
        {
          id: `ext-${unique}-2`,
          type: 'sale',
          amount: 50,
          timestamp: '2026-08-20T12:00:00Z',
        },
      ],
    });

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/pos/generic-webhook/${connectionId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body, 'wrong-secret'))
      .send(body)
      .expect(401);

    const entries = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(entries.body).toHaveLength(0);
  });

  it('404s for an unknown connection id (does not leak whether it exists)', async () => {
    const body = JSON.stringify({ transactions: [] });
    await request(app.getHttpServer())
      .post(
        `/api/v1/webhooks/pos/generic-webhook/00000000-0000-0000-0000-000000000000`,
      )
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body, 'whatever'))
      .send(body)
      .expect(404);
  });

  it('replaying the same webhook does not create a duplicate entry', async () => {
    const ownerToken = await registerAndLogin(
      `owner-webhook3-${unique}@test.com`,
    );
    const tenantId = await createTenant(ownerToken, 'Tenant Webhook3');
    const secret = 'whsec_test_3';
    const connectionId = await connectIntegration(ownerToken, tenantId, secret);

    const body = JSON.stringify({
      transactions: [
        {
          id: `ext-${unique}-3`,
          type: 'sale',
          amount: 30,
          timestamp: '2026-08-20T12:00:00Z',
        },
      ],
    });
    const signature = sign(body, secret);

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/pos/generic-webhook/${connectionId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signature)
      .send(body)
      .expect(201);

    // Provider retries webhooks — replaying the identical payload must not double-post.
    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/pos/generic-webhook/${connectionId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signature)
      .send(body)
      .expect(201);

    const entries = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/ledger-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(entries.body).toHaveLength(1);
  });
});
