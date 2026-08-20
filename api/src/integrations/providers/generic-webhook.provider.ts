import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { LedgerEntryType } from '../../../generated/prisma/enums';
import {
  PosProviderAdapter,
  ProviderTransaction,
} from '../pos-provider-adapter.interface';

interface GenericWebhookPayload {
  transactions: Array<{
    id: string;
    type: 'sale' | 'refund';
    amount: number;
    note?: string;
    timestamp: string;
  }>;
}

/**
 * Reference implementation for ADR-4 — no real POS vendor is under contract yet (PRD
 * constraints: "provider TBD"). This adapter defines the *shape* every future provider
 * (Stripe Terminal, Yoco, a local Moroccan POS vendor, etc.) will conform to: HMAC-signed
 * webhooks with a `transactions` array. A real provider gets its own class implementing the
 * same interface — nothing outside this file changes.
 */
@Injectable()
export class GenericWebhookProvider implements PosProviderAdapter {
  readonly providerName = 'generic-webhook';

  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | undefined,
    secret: string,
  ): boolean {
    if (!signatureHeader) return false;

    const expected = createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(signatureHeader, 'hex');

    // Different lengths would make timingSafeEqual throw — treat as "not equal", not an error.
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  parseWebhookPayload(rawBody: string): ProviderTransaction[] {
    const payload = JSON.parse(rawBody) as GenericWebhookPayload;
    return payload.transactions.map((t) => ({
      externalId: t.id,
      entryType:
        t.type === 'refund' ? LedgerEntryType.expense : LedgerEntryType.revenue,
      amount: Math.abs(t.amount),
      description: t.note,
      occurredAt: new Date(t.timestamp),
    }));
  }

  // Params are required by the PosProviderAdapter interface but unused until a real
  // provider exists — see the body comment. Block (not next-line) disable: prettier wraps
  // this signature across lines, and each wrapped param gets its own lint error.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async fetchTransactions(
    credentials: Record<string, string>,
    since: Date,
  ): Promise<ProviderTransaction[]> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // No real provider is connected yet — reconciliation pull is wired up (system design §3,
    // "periodic REST pull as fallback") but has nothing to call until a real vendor exists.
    return Promise.resolve([]);
  }
}
