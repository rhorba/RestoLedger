import { centsToAmount } from '../common/money';

// BigInt doesn't serialize to JSON — every response crossing the HTTP boundary must go
// through this mapper.
export function toLedgerEntryResponse<T extends { amountCents: bigint }>(entry: T) {
  const { amountCents, ...rest } = entry;
  return { ...rest, amount: centsToAmount(amountCents) };
}
