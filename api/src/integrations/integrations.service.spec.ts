import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService', () => {
  let prisma: any;
  let cipher: any;
  let ledger: any;
  let provider: any;
  let service: IntegrationsService;

  beforeEach(() => {
    prisma = {
      withTenant: jest.fn((_tenantId: string, fn: (tx: unknown) => unknown) =>
        fn({ integrationConnection: { upsert: jest.fn() } }),
      ),
      $queryRaw: jest.fn(),
    };
    cipher = { encrypt: jest.fn(), decrypt: jest.fn() };
    ledger = { createFromIntegration: jest.fn() };
    provider = {
      providerName: 'generic-webhook',
      verifyWebhookSignature: jest.fn(),
      parseWebhookPayload: jest.fn(),
      fetchTransactions: jest.fn(),
    };
    service = new IntegrationsService(prisma, cipher, ledger, provider);
  });

  describe('handleWebhook', () => {
    it('404s on an unknown provider', async () => {
      await expect(
        service.handleWebhook('conn-1', 'nonexistent-provider', '{}', 'sig'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the connection lookup returns nothing', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.handleWebhook('conn-1', 'generic-webhook', '{}', 'sig'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the signature does not verify', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'conn-1',
          tenant_id: 't1',
          provider: 'generic-webhook',
          encrypted_credentials: Buffer.from('x'),
        },
      ]);
      cipher.decrypt.mockReturnValue({ webhookSecret: 'secret' });
      provider.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        service.handleWebhook('conn-1', 'generic-webhook', '{}', 'bad-sig'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(ledger.createFromIntegration).not.toHaveBeenCalled();
    });

    it('rejects when the connection has no webhookSecret stored', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'conn-1',
          tenant_id: 't1',
          provider: 'generic-webhook',
          encrypted_credentials: Buffer.from('x'),
        },
      ]);
      cipher.decrypt.mockReturnValue({ apiKey: 'only-this' });

      await expect(
        service.handleWebhook('conn-1', 'generic-webhook', '{}', 'sig'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('creates a ledger entry per transaction, using the connection tenant and each externalId as the idempotency key', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'conn-1',
          tenant_id: 't1',
          provider: 'generic-webhook',
          encrypted_credentials: Buffer.from('x'),
        },
      ]);
      cipher.decrypt.mockReturnValue({ webhookSecret: 'secret' });
      provider.verifyWebhookSignature.mockReturnValue(true);
      provider.parseWebhookPayload.mockReturnValue([
        {
          externalId: 'txn_1',
          entryType: 'revenue',
          amount: 10,
          occurredAt: new Date('2026-01-01'),
        },
        {
          externalId: 'txn_2',
          entryType: 'expense',
          amount: 5,
          occurredAt: new Date('2026-01-02'),
        },
      ]);

      const result = await service.handleWebhook(
        'conn-1',
        'generic-webhook',
        '{}',
        'sig',
      );

      expect(result).toEqual({ processed: 2 });
      expect(ledger.createFromIntegration).toHaveBeenCalledTimes(2);
      expect(ledger.createFromIntegration).toHaveBeenNthCalledWith(
        1,
        't1',
        'conn-1',
        expect.objectContaining({ entryType: 'revenue', amount: 10 }),
        'txn_1',
      );
      expect(ledger.createFromIntegration).toHaveBeenNthCalledWith(
        2,
        't1',
        'conn-1',
        expect.objectContaining({ entryType: 'expense', amount: 5 }),
        'txn_2',
      );
    });
  });

  describe('connect', () => {
    it('encrypts credentials before storing and never returns them', async () => {
      cipher.encrypt.mockReturnValue(Buffer.from('encrypted-bytes'));
      const tx = {
        integrationConnection: {
          upsert: jest.fn().mockResolvedValue({
            id: 'conn-1',
            provider: 'generic-webhook',
            status: 'active',
          }),
        },
      };
      prisma.withTenant.mockImplementation(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      );

      const result = await service.connect('t1', {
        provider: 'generic-webhook',
        credentials: { apiKey: 'plain-secret' },
      });

      expect(cipher.encrypt).toHaveBeenCalledWith({ apiKey: 'plain-secret' });
      expect(result).toEqual({
        id: 'conn-1',
        provider: 'generic-webhook',
        status: 'active',
      });
      expect(JSON.stringify(result)).not.toContain('plain-secret');
    });
  });
});
