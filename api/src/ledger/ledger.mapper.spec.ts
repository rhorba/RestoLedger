import { toLedgerEntryResponse } from './ledger.mapper';

describe('toLedgerEntryResponse', () => {
  it('formats a positive amount with two decimal places', () => {
    const result = toLedgerEntryResponse({ id: '1', amountCents: 42050n });
    expect(result.amount).toBe('420.50');
  });

  it('formats a negative amount (reversal) preserving the sign', () => {
    const result = toLedgerEntryResponse({ id: '1', amountCents: -42050n });
    expect(result.amount).toBe('-420.50');
  });

  it('pads single-digit cents', () => {
    const result = toLedgerEntryResponse({ id: '1', amountCents: 500n });
    expect(result.amount).toBe('5.00');
  });

  it('formats zero without a sign', () => {
    const result = toLedgerEntryResponse({ id: '1', amountCents: 0n });
    expect(result.amount).toBe('0.00');
  });

  it('removes amountCents from the response', () => {
    const result = toLedgerEntryResponse({ id: '1', amountCents: 100n });
    expect(result).not.toHaveProperty('amountCents');
  });
});
