import { LedgerEntryType } from '../../generated/prisma/enums';

/**
 * A single sale/refund as reported by a POS/payment provider, already normalized to the
 * shape the ledger needs — provider-specific parsing happens entirely inside the adapter.
 */
export interface ProviderTransaction {
  /** Provider's own transaction id — becomes the ledger entry's idempotency key. */
  externalId: string;
  entryType: typeof LedgerEntryType.revenue | typeof LedgerEntryType.expense;
  /** MAD, decimal major unit (matches CreateLedgerEntryDto.amount — never cents here). */
  amount: number;
  description?: string;
  occurredAt: Date;
}

/**
 * Every POS/payment integration implements this — the ledger/webhook code never talks to a
 * provider's SDK or API shape directly (ADR-4, architecture-restoledger.md). Swapping
 * providers means writing a new class here, not touching LedgerService or the webhook
 * controller.
 */
export interface PosProviderAdapter {
  readonly providerName: string;

  /** Verifies an inbound webhook actually came from the provider before any payload is trusted. */
  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | undefined,
    secret: string,
  ): boolean;

  /** Parses a verified webhook payload into zero or more normalized transactions. */
  parseWebhookPayload(rawBody: string): ProviderTransaction[];

  /** REST pull fallback for reconciliation if a webhook was missed (system design §3). */
  fetchTransactions(
    credentials: Record<string, string>,
    since: Date,
  ): Promise<ProviderTransaction[]>;
}
