import { createHmac } from 'crypto';
import { GenericWebhookProvider } from './generic-webhook.provider';

function sign(body: string, secret: string) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

describe('GenericWebhookProvider', () => {
  const provider = new GenericWebhookProvider();
  const secret = 'whsec_test';

  describe('verifyWebhookSignature', () => {
    it('accepts a correctly signed payload', () => {
      const body = JSON.stringify({ transactions: [] });
      expect(
        provider.verifyWebhookSignature(body, sign(body, secret), secret),
      ).toBe(true);
    });

    it('rejects a payload signed with the wrong secret', () => {
      const body = JSON.stringify({ transactions: [] });
      expect(
        provider.verifyWebhookSignature(
          body,
          sign(body, 'wrong-secret'),
          secret,
        ),
      ).toBe(false);
    });

    it('rejects a tampered payload (signature was computed for different bytes)', () => {
      const originalBody = JSON.stringify({
        transactions: [
          { id: '1', type: 'sale', amount: 10, timestamp: '2026-01-01' },
        ],
      });
      const signature = sign(originalBody, secret);
      const tamperedBody = JSON.stringify({
        transactions: [
          { id: '1', type: 'sale', amount: 999999, timestamp: '2026-01-01' },
        ],
      });

      expect(
        provider.verifyWebhookSignature(tamperedBody, signature, secret),
      ).toBe(false);
    });

    it('rejects a missing signature header', () => {
      expect(provider.verifyWebhookSignature('{}', undefined, secret)).toBe(
        false,
      );
    });
  });

  describe('parseWebhookPayload', () => {
    it('maps a sale to a revenue transaction', () => {
      const body = JSON.stringify({
        transactions: [
          {
            id: 'txn_1',
            type: 'sale',
            amount: 42.5,
            note: 'Lunch',
            timestamp: '2026-08-20T12:00:00Z',
          },
        ],
      });

      const [txn] = provider.parseWebhookPayload(body);

      expect(txn).toEqual({
        externalId: 'txn_1',
        entryType: 'revenue',
        amount: 42.5,
        description: 'Lunch',
        occurredAt: new Date('2026-08-20T12:00:00Z'),
      });
    });

    it('maps a refund to an expense transaction with a positive amount', () => {
      const body = JSON.stringify({
        transactions: [
          {
            id: 'txn_2',
            type: 'refund',
            amount: -15,
            timestamp: '2026-08-20T12:00:00Z',
          },
        ],
      });

      const [txn] = provider.parseWebhookPayload(body);

      expect(txn.entryType).toBe('expense');
      expect(txn.amount).toBe(15);
    });

    it('handles multiple transactions in one payload', () => {
      const body = JSON.stringify({
        transactions: [
          {
            id: 't1',
            type: 'sale',
            amount: 10,
            timestamp: '2026-08-20T12:00:00Z',
          },
          {
            id: 't2',
            type: 'sale',
            amount: 20,
            timestamp: '2026-08-20T13:00:00Z',
          },
        ],
      });

      expect(provider.parseWebhookPayload(body)).toHaveLength(2);
    });
  });
});
