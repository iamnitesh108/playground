/*
 * Shared buffers with the clock-sweep replacement PostgreSQL uses.
 * Every buffer has a usage count (0–5). A hit raises it by one; a miss needs a
 * victim: the clock hand walks the buffers, lowering each count it passes,
 * and takes the first buffer whose count is already 0.
 */

export const MAX_USAGE = 5

export interface Buffer {
  page: string | null
  usage: number
}

export interface Access {
  page: string
  hit: boolean
  slot: number
  /** The page that was thrown out, if any. */
  evicted: string | null
  /** Buffers the hand passed (and lowered) before it found the victim. */
  swept: number[]
}

export interface Pool {
  buffers: readonly Buffer[]
  hand: number
  hits: number
  reads: number
  evictions: number
  last: Access | null
}

export function createPool(size: number): Pool {
  return { buffers: Array.from({ length: size }, () => ({ page: null, usage: 0 })), hand: 0, hits: 0, reads: 0, evictions: 0, last: null }
}

/** Reads one page through the pool and returns the new pool (the old one is not changed). */
export function access(pool: Pool, page: string): Pool {
  const buffers = pool.buffers.map((b) => ({ ...b }))
  const found = buffers.findIndex((b) => b.page === page)
  if (found >= 0) {
    buffers[found].usage = Math.min(MAX_USAGE, buffers[found].usage + 1)
    return { ...pool, buffers, hits: pool.hits + 1, last: { page, hit: true, slot: found, evicted: null, swept: [] } }
  }
  // a never-used buffer is taken first (PostgreSQL's free list)
  const empty = buffers.findIndex((b) => b.page === null)
  if (empty >= 0) {
    buffers[empty] = { page, usage: 1 }
    return { ...pool, buffers, reads: pool.reads + 1, last: { page, hit: false, slot: empty, evicted: null, swept: [] } }
  }
  let hand = pool.hand
  const swept: number[] = []
  // terminates: every pass lowers each count by one, and counts start at most MAX_USAGE
  while (buffers[hand].usage > 0) {
    buffers[hand].usage -= 1
    swept.push(hand)
    hand = (hand + 1) % buffers.length
  }
  const evicted = buffers[hand].page
  buffers[hand] = { page, usage: 1 }
  return {
    buffers,
    hand: (hand + 1) % buffers.length,
    hits: pool.hits,
    reads: pool.reads + 1,
    evictions: pool.evictions + 1,
    last: { page, hit: false, slot: hand, evicted, swept },
  }
}

/** Runs a sequence of page reads. */
export const run = (pool: Pool, pages: readonly string[]): Pool => pages.reduce(access, pool)
