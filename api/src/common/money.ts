// BigInt cents -> decimal-string major unit (e.g. "42.50"). Never a JS `number` for money —
// float precision isn't safe for financial amounts. Shared by any response crossing the HTTP
// boundary that carries a monetary value.
export function centsToAmount(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}
