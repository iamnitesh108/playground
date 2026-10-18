import { Observable } from '@/shared/utils/observable'
import { seeded } from './random'

/*
 * How keys with a TTL disappear. Lazily: a command that touches an expired key
 * deletes it first. Actively: `hz` times per second Redis walks the table of keys
 * that have a TTL with a cursor (since Redis 6), looking at 20 keys per round and
 * deleting the expired ones; if more than 10% of a round had expired it does
 * another round, within a time budget. The cursor continues where it stopped, so
 * every key is reached by a full sweep — but when few keys have expired, one
 * round per cycle is all it does, and a full sweep of a large table takes minutes.
 */

export interface ExpiryOptions {
  keys: number
  /** Share of keys that have expired at time 0 (the rest expire much later). */
  expiringShare: number
  hz: number
  keysPerRound: number
  /** Do another round only when more than this share of a round had expired. */
  acceptableStale: number
  /** Rounds allowed per cycle (stands for the CPU time budget). */
  maxRoundsPerCycle: number
  /** Lazy expiry: reads per second of random keys. */
  readsPerSecond: number
}

export class ExpirySimulator extends Observable {
  options: ExpiryOptions
  /** Keys in table order (the hash order is effectively random). */
  private order: number[] = []
  private expired: boolean[] = []
  private alive: boolean[] = []
  private cursor = 0
  private random = seeded(3)
  remaining = 0
  stale = 0
  timeMs = 0
  deletedActive = 0
  deletedLazy = 0
  history: { ms: number; stale: number }[] = []

  constructor(options: ExpiryOptions) {
    super()
    this.options = options
    this.reset()
  }

  configure(change: Partial<ExpiryOptions>): void {
    this.options = { ...this.options, ...change }
    this.reset()
  }

  reset(): void {
    const { keys, expiringShare } = this.options
    this.random = seeded(3)
    this.expired = Array.from({ length: keys }, (_, i) => i < Math.round(keys * expiringShare))
    this.alive = Array.from({ length: keys }, () => true)
    this.order = Array.from({ length: keys }, (_, i) => i)
    for (let i = keys - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[this.order[i], this.order[j]] = [this.order[j], this.order[i]]
    }
    this.cursor = 0
    this.remaining = keys
    this.stale = Math.round(keys * expiringShare)
    this.timeMs = 0
    this.deletedActive = 0
    this.deletedLazy = 0
    this.history = [{ ms: 0, stale: this.stale }]
    this.notify()
  }

  private remove(key: number): void {
    this.alive[key] = false
    this.remaining--
    if (this.expired[key]) this.stale--
  }

  /** One active expire cycle (what happens every 1000/hz ms). */
  cycle(): { rounds: number; deleted: number } {
    const o = this.options
    let rounds = 0, deleted = 0
    while (this.remaining > 0 && rounds < o.maxRoundsPerCycle) {
      let looked = 0, roundExpired = 0
      // the cursor visits the next keys still in the table
      for (let steps = 0; looked < o.keysPerRound && steps < this.order.length; steps++) {
        const key = this.order[this.cursor]
        this.cursor = (this.cursor + 1) % this.order.length
        if (!this.alive[key]) continue
        looked++
        if (this.expired[key]) { this.remove(key); roundExpired++; deleted++ }
      }
      rounds++
      if (roundExpired / o.keysPerRound <= o.acceptableStale) break
    }
    this.deletedActive += deleted
    return { rounds, deleted }
  }

  /** Advances one cycle period: active expiry plus the lazy deletions of random reads. */
  tick(): void {
    const period = 1000 / this.options.hz
    this.cycle()
    const reads = Math.round((this.options.readsPerSecond * period) / 1000)
    for (let r = 0; r < reads && this.remaining; r++) {
      const key = Math.floor(this.random() * this.order.length)
      if (this.alive[key] && this.expired[key]) { this.remove(key); this.deletedLazy++ }
    }
    this.timeMs += period
    this.history.push({ ms: this.timeMs, stale: this.stale })
    this.notify()
  }
}
