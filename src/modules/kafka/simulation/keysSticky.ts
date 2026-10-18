/*
 * A model of what the Java producer (3.3+, KIP-794) does with records that have no key:
 * it sticks to one partition until at least batch.size bytes went there and the batch is full,
 * then picks the next partition at random. With adaptive partitioning on, the pick is weighted
 * so partitions with shorter queues of unsent batches are more likely (the same cumulative
 * frequency table as BuiltInPartitioner). Sizes are counted in records here, not bytes.
 */

export interface StickyOptions {
  partitions: number
  /** Records that fit in one batch. */
  batchRecords: number
  adaptive: boolean
  /** Partition whose leader is slow: its batches leave at a sixth of the speed. */
  slowPartition: number | null
  /** Source of randomness in [0, 1), injectable for tests. */
  random?: () => number
}

export interface StickyState {
  sticky: number
  /** Records in the current (open) batch of each partition. */
  open: number[]
  /** Closed batches waiting to be sent, per partition. */
  queued: number[]
  /** Records ever sent to each partition. */
  total: number[]
  /** Partition of every record so far, oldest first. */
  history: number[]
  /** Weight of each partition for the next switch (equal when not adaptive). */
  weights: number[]
}

export class StickyPartitionerModel {
  private readonly opts: Required<StickyOptions>
  private state: StickyState
  private produced = 0
  private ticks = 0

  constructor(opts: StickyOptions) {
    this.opts = { random: Math.random, ...opts }
    const zeros = () => new Array<number>(opts.partitions).fill(0)
    this.state = { sticky: 0, open: zeros(), queued: zeros(), total: zeros(), history: [], weights: zeros().map(() => 1) }
    this.state.sticky = this.pick()
  }

  get snapshot(): StickyState {
    return this.state
  }

  /** One key-less record goes through the accumulator. */
  send(): number {
    const s = this.state
    const p = s.sticky
    s.open[p] += 1
    s.total[p] += 1
    s.history.push(p)
    this.produced += 1
    const batchFull = s.open[p] >= this.opts.batchRecords
    if (batchFull) {
      s.open[p] = 0
      s.queued[p] += 1
    }
    // switch after "batch.size" worth of records, but only on a batch boundary (or at twice the size)
    if ((this.produced >= this.opts.batchRecords && batchFull) || this.produced >= this.opts.batchRecords * 2) {
      this.produced = 0
      s.sticky = this.pick()
    }
    this.drain()
    return p
  }

  /** Brokers send queued batches: one per partition per tick, the slow one every sixth tick. */
  private drain() {
    const s = this.state
    this.ticks += 1
    if (this.ticks % this.opts.batchRecords !== 0) return
    s.queued = s.queued.map((q, p) => (q > 0 && (p !== this.opts.slowPartition || this.ticks % (this.opts.batchRecords * 6) === 0) ? q - 1 : q))
  }

  /** Next sticky partition: uniform, or weighted by (longest queue + 1 − own queue) when adaptive. */
  private pick(): number {
    const s = this.state
    const max = Math.max(...s.queued) + 1
    s.weights = s.queued.map((q) => (this.opts.adaptive ? max - q : 1))
    const sum = s.weights.reduce((a, b) => a + b, 0)
    let r = this.opts.random() * sum
    for (let p = 0; p < s.weights.length; p++) {
      r -= s.weights[p]
      if (r < 0) return p
    }
    return s.weights.length - 1
  }
}
