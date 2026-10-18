/*
 * A Count-Min sketch of 4-bit counters: TinyLFU's memory of how often every key was requested — including keys
 * that are not in the cache. Each key bumps one counter in each of four rows; its estimated frequency is the
 * smallest of those four (collisions can only add, so the minimum is the least wrong).
 *
 * Simplified from Caffeine's FrequencySketch (3.1.8), on purpose:
 *  - four separate rows of `width` counters, one byte each, instead of sixteen 4-bit counters packed per 64-bit
 *    word in cache-line-sized blocks;
 *  - aging halves every counter after `sampleSize` (10 × capacity) increments and halves the increment count;
 *    Caffeine also subtracts the counters that were odd (the error of halving);
 *  - the sketch starts at once; Caffeine and moka allocate it when the cache is first half full.
 */

const MAX_COUNT = 15

/** Murmur3's finaliser: spreads a key's bits so neighbouring keys land on unrelated counters. */
function mix(x: number): number {
  x ^= x >>> 16
  x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return x >>> 0
}

const SEEDS = [0x9e3779b9, 0x7f4a7c15, 0x6a09e667, 0x3c6ef372]

export class FrequencySketch {
  readonly width: number
  readonly sampleSize: number
  private readonly table: Uint8Array
  private readonly mask: number
  /** Increments since the last aging. */
  additions = 0
  /** How many times the counters were halved. */
  resets = 0

  constructor(capacity: number) {
    let width = 16
    while (width < capacity) width *= 2
    this.width = width
    this.mask = width - 1
    this.table = new Uint8Array(width * 4)
    this.sampleSize = Math.max(10, 10 * capacity)
  }

  private index(key: number, row: number): number {
    return row * this.width + (mix(key ^ SEEDS[row]) & this.mask)
  }

  /** Estimated requests for `key` since aging last halved the counters (0…15). */
  frequency(key: number): number {
    let min = MAX_COUNT
    for (let row = 0; row < 4; row++) min = Math.min(min, this.table[this.index(key, row)])
    return min
  }

  /** Where a key's four counters are (column in each row) and their values, for showing how the estimate is formed. */
  cellsOf(key: number): { col: number; value: number }[] {
    return [0, 1, 2, 3].map((row) => {
      const i = this.index(key, row)
      return { col: i - row * this.width, value: this.table[i] }
    })
  }

  /** One row of counters (for drawing a small sketch). */
  row(row: number): number[] {
    return Array.from(this.table.subarray(row * this.width, (row + 1) * this.width))
  }

  increment(key: number): void {
    let added = false
    for (let row = 0; row < 4; row++) {
      const i = this.index(key, row)
      if (this.table[i] < MAX_COUNT) {
        this.table[i]++
        added = true
      }
    }
    if (added && ++this.additions >= this.sampleSize) this.age()
  }

  /** Halves every counter: old popularity fades, so yesterday’s hot keys do not stay hot forever. */
  age(): void {
    for (let i = 0; i < this.table.length; i++) this.table[i] >>= 1
    this.additions >>= 1
    this.resets++
  }
}
