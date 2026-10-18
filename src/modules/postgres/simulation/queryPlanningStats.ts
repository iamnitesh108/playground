/**
 * The planner's row-count arithmetic for simple conditions, from the
 * statistics ANALYZE stores in pg_stats. Mirrors the idea of PostgreSQL's
 * selectivity functions (eqsel, scalarineqsel), without their special cases.
 */
export interface ColumnStats {
  nullFrac: number
  /** Positive: number of distinct values. Negative: minus the fraction of rows that are distinct. */
  nDistinct: number
  mcv: readonly string[]
  mcf: readonly number[]
  histogram: readonly number[]
}

/** Parses a pg_stats array literal such as {DELIVERED,SHIPPED} or {0.05,5.17}. */
export function parseArray(text: string | null): string[] {
  if (!text) return []
  return text
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((s) => s.replace(/^"|"$/g, ''))
}

export function distinctValues(s: ColumnStats, rows: number): number {
  return s.nDistinct >= 0 ? s.nDistinct : -s.nDistinct * rows
}

/** WHERE col = value */
export function equalSelectivity(s: ColumnStats, value: string, rows: number): { sel: number; how: string } {
  const i = s.mcv.indexOf(value)
  if (i >= 0) return { sel: s.mcf[i], how: `in most_common_vals with frequency ${s.mcf[i]}` }
  // not a common value: spread the remaining rows evenly over the remaining distinct values
  const rest = 1 - s.nullFrac - s.mcf.reduce((a, b) => a + b, 0)
  const others = Math.max(1, distinctValues(s, rows) - s.mcv.length)
  return { sel: rest / others, how: `not a common value: ${rest.toFixed(4)} of rows ÷ ${Math.round(others).toLocaleString()} other distinct values` }
}

/** Fraction of the histogram below x: whole buckets plus a linear share of the bucket x falls in. */
export function histogramFraction(hist: readonly number[], x: number): { fraction: number; bucket: number; within: number } {
  const n = hist.length - 1
  if (n < 1 || x <= hist[0]) return { fraction: 0, bucket: 0, within: 0 }
  if (x >= hist[n]) return { fraction: 1, bucket: n - 1, within: 1 }
  let i = 0
  while (hist[i + 1] < x) i++
  const within = (x - hist[i]) / (hist[i + 1] - hist[i] || 1)
  return { fraction: (i + within) / n, bucket: i, within }
}

/** WHERE col < x */
export function lessThanSelectivity(s: ColumnStats, x: number): number {
  const mcvPart = s.mcv.reduce((sum, v, i) => (Number(v) < x ? sum + s.mcf[i] : sum), 0)
  const histShare = 1 - s.nullFrac - s.mcf.reduce((a, b) => a + b, 0)
  return mcvPart + histogramFraction(s.histogram, x).fraction * histShare
}

/** Two conditions on independent columns: the planner multiplies. */
export const andSelectivity = (a: number, b: number) => a * b
