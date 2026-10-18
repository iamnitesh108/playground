/**
 * A BRIN index over an append-only events table: one summary (min..max of
 * created_at) per range of 128 heap pages. A query reads every range whose
 * summary overlaps it — all 128 pages of it — and rechecks each row.
 */
export interface BrinRange {
  /** First heap page of the range. */
  page: number
  min: number
  max: number
}

export interface BrinTable {
  rows: number
  pages: number
  /** Seconds between consecutive rows. */
  step: number
  pagesPerRange: number
}

/** Summaries for a table whose rows arrived in time order, or in random order. */
export function summaries(t: BrinTable, ordered: boolean): BrinRange[] {
  const rowsPerPage = t.rows / t.pages
  const rowsPerRange = rowsPerPage * t.pagesPerRange
  const end = t.rows * t.step
  const ranges: BrinRange[] = []
  for (let page = 0, i = 0; page < t.pages; page += t.pagesPerRange, i++) {
    if (ordered) {
      ranges.push({ page, min: i * rowsPerRange * t.step, max: Math.min(end, (i + 1) * rowsPerRange * t.step) })
    } else {
      // ~12,000 random timestamps per range: the smallest lands near the start, the largest near the end
      const spread = end / rowsPerRange
      ranges.push({ page, min: spread * (0.2 + ((i * 7) % 10) / 10), max: end - spread * (0.2 + ((i * 3) % 10) / 10) })
    }
  }
  return ranges
}

export function matching(ranges: readonly BrinRange[], from: number, to: number): BrinRange[] {
  return ranges.filter((r) => r.max >= from && r.min < to)
}
