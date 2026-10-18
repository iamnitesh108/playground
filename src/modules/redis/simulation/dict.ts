import { Observable } from '@/shared/utils/observable'

/*
 * The main dictionary of a Redis database: a hash table whose size is a power of
 * two, that grows into a second table and moves its buckets over a little at a
 * time (incremental rehashing). And SCAN, whose cursor counts with the bits
 * reversed so that a full scan returns every key that existed throughout,
 * even if the table grows in the middle.
 */

export interface Table {
  buckets: string[][]
}

const hash = (key: string): number => {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return h >>> 0
}

const reverseBits = (v: number, bits: number): number => {
  let r = 0
  for (let i = 0; i < bits; i++) r = (r << 1) | ((v >>> i) & 1)
  return r
}

/** The next SCAN cursor for a table of `size` buckets: increment the reversed bits. */
export function nextCursor(cursor: number, size: number): number {
  const bits = Math.log2(size)
  return reverseBits((reverseBits(cursor, bits) + 1) % size, bits)
}

/** Every cursor value of one full scan, starting and ending at 0. */
export function cursorOrder(size: number): number[] {
  const out = [0]
  let c = 0
  do {
    c = nextCursor(c, size)
    out.push(c)
  } while (c !== 0)
  return out
}

export class Dict extends Observable {
  tables: Table[] = [{ buckets: [[], [], [], []] }]
  /** Next bucket of tables[0] to move, or -1 when not rehashing. */
  rehashIndex = -1
  lastMoved: number | null = null

  get rehashing(): boolean {
    return this.rehashIndex >= 0
  }

  get size(): number {
    return this.tables.reduce((n, t) => n + t.buckets.reduce((m, b) => m + b.length, 0), 0)
  }

  bucketOf(key: string, table: Table): number {
    return hash(key) & (table.buckets.length - 1)
  }

  has(key: string): boolean {
    return this.tables.some((t) => t.buckets[this.bucketOf(key, t)].includes(key))
  }

  /** Moves one bucket (Redis does this on every lookup or write while rehashing). */
  step(): void {
    if (!this.rehashing) return
    const [from, to] = this.tables
    while (this.rehashIndex < from.buckets.length && from.buckets[this.rehashIndex].length === 0) this.rehashIndex++
    if (this.rehashIndex < from.buckets.length) {
      for (const key of from.buckets[this.rehashIndex]) to.buckets[this.bucketOf(key, to)].push(key)
      from.buckets[this.rehashIndex] = []
      this.lastMoved = this.rehashIndex
      this.rehashIndex++
    }
    if (this.rehashIndex >= from.buckets.length) {
      this.tables = [to]
      this.rehashIndex = -1
    }
  }

  add(key: string): void {
    if (this.has(key)) return
    this.step()
    const main = this.tables[0]
    // Grow when the table is full (load factor 1): a new table twice as big
    if (!this.rehashing && this.size >= main.buckets.length) {
      this.tables.push({ buckets: Array.from({ length: main.buckets.length * 2 }, () => []) })
      this.rehashIndex = 0
    }
    const target = this.tables[this.tables.length - 1]
    target.buckets[this.bucketOf(key, target)].push(key)
    this.notify()
  }

  touch(): void {
    this.step()
    this.notify()
  }

  /**
   * One SCAN call: returns the keys in the bucket(s) the cursor points at and the next cursor.
   * While rehashing it reads the small table's bucket and every bucket of the big table that
   * bucket expands into, as dictScan does.
   */
  scan(cursor: number): { keys: string[]; next: number; buckets: { table: number; index: number }[] } {
    const tables = [...this.tables].sort((a, b) => a.buckets.length - b.buckets.length)
    const small = tables[0]
    const keys: string[] = []
    const buckets: { table: number; index: number }[] = []
    const smallIndex = cursor & (small.buckets.length - 1)
    keys.push(...small.buckets[smallIndex])
    buckets.push({ table: this.tables.indexOf(small), index: smallIndex })
    if (tables.length > 1) {
      const big = tables[1]
      for (let i = smallIndex; i < big.buckets.length; i += small.buckets.length) {
        keys.push(...big.buckets[i])
        buckets.push({ table: this.tables.indexOf(big), index: i })
      }
    }
    return { keys, next: nextCursor(cursor, small.buckets.length), buckets }
  }
}
