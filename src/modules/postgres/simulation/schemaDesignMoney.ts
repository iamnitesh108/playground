/*
 * Adding 0.10 again and again, the way sum() does it: in binary floating point (float8, the same
 * IEEE 754 double a JavaScript number is) and in exact decimal (numeric). The capture checks this
 * model against the server's own sum(0.1::float8). Pure TS, no React.
 */

export interface MoneySum {
  readonly n: number
  /** float8 result as PostgreSQL prints it (shortest exact round-trip form). */
  readonly float8: string
  /** numeric result: exact. */
  readonly numeric: string
  /** float8 minus the exact value. */
  readonly error: number
}

export function addTenCents(n: number): MoneySum {
  let f = 0
  for (let i = 0; i < n; i++) f += 0.1
  // numeric adds decimal digits exactly: n tenths, printed with the scale of 0.1 (one digit)
  const numeric = `${BigInt(n) / 10n}.${BigInt(n) % 10n}`
  return { n, float8: String(f), numeric, error: f - n / 10 }
}
