import { Observable } from '@/shared/utils/observable'

/*
 * A stream with one consumer group: entries are appended with growing ids, the
 * group remembers the last id it delivered, and every delivered entry sits in the
 * pending entries list (PEL) of its consumer until it is acknowledged. A crashed
 * consumer's pending entries can be claimed by another once they are idle long enough.
 */

export interface PendingEntry {
  id: number
  consumer: string
  deliveredAt: number
  deliveries: number
}

export class StreamGroupModel extends Observable {
  entries: number[] = []
  lastDelivered = 0
  pending: PendingEntry[] = []
  acked = new Set<number>()
  crashed = new Set<string>()
  now = 0
  log: string[] = []
  readonly consumers: string[]

  constructor(consumers: string[]) {
    super()
    this.consumers = consumers
  }

  reset(): void {
    this.entries = []
    this.lastDelivered = 0
    this.pending = []
    this.acked = new Set()
    this.crashed = new Set()
    this.now = 0
    this.log = []
    this.notify()
  }

  add(n = 1): void {
    for (let i = 0; i < n; i++) this.entries.push(this.entries.length + 1)
    this.log.unshift(`XADD ×${n} → ${this.entries.length} entries`)
    this.notify()
  }

  /** XREADGROUP … COUNT n STREAMS s > */
  read(consumer: string, count: number): void {
    if (this.crashed.has(consumer)) return
    const fresh = this.entries.filter((id) => id > this.lastDelivered).slice(0, count)
    for (const id of fresh) this.pending.push({ id, consumer, deliveredAt: this.now, deliveries: 1 })
    if (fresh.length) this.lastDelivered = fresh[fresh.length - 1]
    this.log.unshift(`${consumer}: XREADGROUP > → ${fresh.length ? fresh.map((x) => `#${x}`).join(' ') : 'nothing new'}`)
    this.notify()
  }

  ack(consumer: string): void {
    if (this.crashed.has(consumer)) return
    const mine = this.pending.filter((p) => p.consumer === consumer)
    mine.forEach((p) => this.acked.add(p.id))
    this.pending = this.pending.filter((p) => p.consumer !== consumer)
    this.log.unshift(`${consumer}: XACK → ${mine.length}`)
    this.notify()
  }

  crash(consumer: string): void {
    this.crashed.add(consumer)
    this.log.unshift(`${consumer} crashes — its pending entries stay in the PEL`)
    this.notify()
  }

  wait(ms: number): void {
    this.now += ms
    this.log.unshift(`… ${ms} ms pass`)
    this.notify()
  }

  /** XAUTOCLAIM … <consumer> <minIdle> 0-0 */
  claim(consumer: string, minIdle: number): void {
    let n = 0
    for (const p of this.pending) {
      // any idle entry, including the claiming consumer's own (XAUTOCLAIM re-delivers those too)
      if (this.now - p.deliveredAt >= minIdle) {
        p.consumer = consumer
        p.deliveredAt = this.now
        p.deliveries++
        n++
      }
    }
    this.log.unshift(`${consumer}: XAUTOCLAIM min-idle ${minIdle} → ${n} claimed`)
    this.notify()
  }

  get lag(): number {
    return this.entries.filter((id) => id > this.lastDelivered).length
  }
}
