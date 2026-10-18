/*
 * OFFSET versus keyset pagination, reduced to what decides their cost: how many index entries
 * the server walks to return one page. Recorded points (from EXPLAIN ANALYZE on one million
 * rows) are interpolated for offsets in between. Pure TS, no React.
 */

export interface PagePoint {
  readonly offset: number
  readonly offsetMs: number
  readonly keysetMs: number
  readonly offsetBuffers: number
  readonly keysetBuffers: number
}

export type PageMethod = 'offset' | 'keyset'

/** Rows the executor reads to return one page that starts after `skip` rows. */
export function rowsRead(method: PageMethod, skip: number, pageSize: number): number {
  // OFFSET n reads and throws away n rows first; keyset jumps straight to the last seen key
  return method === 'offset' ? skip + pageSize : pageSize
}

/** Linear interpolation of a recorded measure between the two nearest recorded offsets. */
export function interpolate(points: readonly PagePoint[], skip: number, measure: keyof Omit<PagePoint, 'offset'>): number {
  const sorted = [...points].sort((a, b) => a.offset - b.offset)
  if (skip <= sorted[0].offset) return sorted[0][measure]
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i]
    if (skip <= b.offset) return a[measure] + ((b[measure] - a[measure]) * (skip - a.offset)) / (b.offset - a.offset)
  }
  return sorted[sorted.length - 1][measure]
}
