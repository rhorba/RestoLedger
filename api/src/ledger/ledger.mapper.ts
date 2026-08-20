// BigInt doesn't serialize to JSON — every response crossing the HTTP boundary must go
// through this mapper. amountCents is exposed as a decimal string in the tenant's currency
// major unit (e.g. "42.50"), never as a raw cents integer or a JS `number` (float precision
// is not safe for money).
export function toLedgerEntryResponse<T extends { amountCents: bigint }>(entry: T) {
  const { amountCents, ...rest } = entry;
  const sign = amountCents < 0n ? '-' : '';
  const abs = amountCents < 0n ? -amountCents : amountCents;
  const major = abs / 100n;
  const minor = (abs % 100n).toString().padStart(2, '0');

  return { ...rest, amount: `${sign}${major}.${minor}` };
}
