import { Observable } from '@/shared/utils/observable'

export type Acks = '0' | '1' | 'all'

export interface Broker {
  id: number
  alive: boolean
  log: string[]
}

export interface ProduceResult {
  ok: boolean
  message: string
}

/**
 * One partition replicated across brokers. Models leader/follower roles,
 * the in-sync replica set (ISR), the high watermark, `acks` and
 * `min.insync.replicas`.
 */
export class ReplicatedPartition extends Observable {
  readonly brokers: Broker[]
  leaderId: number | null
  isr: Set<number>
  acks: Acks = 'all'
  minInsyncReplicas = 2
  lastResult: ProduceResult | null = null
  /** The last ISR member standing; with clean elections only it may lead again. */
  private lastLeaderId: number | null = null
  private seq = 0

  constructor(brokerCount = 3) {
    super()
    this.brokers = Array.from({ length: brokerCount }, (_, i) => ({ id: i + 1, alive: true, log: [] }))
    this.leaderId = 1
    this.isr = new Set(this.brokers.map((b) => b.id))
  }

  get leader(): Broker | undefined {
    return this.brokers.find((b) => b.id === this.leaderId)
  }

  /** Offset up to which every in-sync replica has the data. Consumers read only below it. */
  get highWatermark(): number {
    const lengths = this.brokers.filter((b) => this.isr.has(b.id)).map((b) => b.log.length)
    return lengths.length ? Math.min(...lengths) : 0
  }

  setAcks(acks: Acks): void {
    this.acks = acks
    this.notify()
  }

  setMinInsyncReplicas(value: number): void {
    this.minInsyncReplicas = value
    this.notify()
  }

  produce(): ProduceResult {
    const leader = this.leader
    if (!leader) return this.finish({ ok: false, message: 'No leader: partition is offline. The producer retries until one is elected.' })

    if (this.acks === 'all' && this.isr.size < this.minInsyncReplicas) {
      return this.finish({
        ok: false,
        message: `NotEnoughReplicas: ISR has ${this.isr.size}, min.insync.replicas is ${this.minInsyncReplicas}. Write refused to protect durability.`,
      })
    }

    const value = `m${++this.seq}`
    leader.log.push(value)

    if (this.acks === 'all') {
      for (const follower of this.inSyncFollowers()) follower.log.push(value)
      return this.finish({ ok: true, message: `${value} acknowledged after all ${this.isr.size} in-sync replicas stored it.` })
    }
    if (this.acks === '1') {
      return this.finish({ ok: true, message: `${value} acknowledged once the leader stored it. Followers copy it later.` })
    }
    return this.finish({ ok: true, message: `${value} sent without waiting. The producer never learns if it arrived.` })
  }

  /** Followers fetch from the leader and rejoin the ISR once caught up. */
  replicate(): void {
    const leader = this.leader
    if (!leader) return
    for (const broker of this.brokers) {
      if (!broker.alive || broker === leader) continue
      broker.log = [...leader.log]
      this.isr.add(broker.id)
    }
    this.notify()
  }

  kill(brokerId: number): void {
    const broker = this.brokers.find((b) => b.id === brokerId)
    if (!broker || !broker.alive) return
    broker.alive = false
    this.isr.delete(brokerId)
    if (this.leaderId === brokerId) this.electLeader(brokerId)
    this.notify()
  }

  revive(brokerId: number): void {
    const broker = this.brokers.find((b) => b.id === brokerId)
    if (!broker || broker.alive) return
    broker.alive = true
    if (this.leaderId === null) {
      // Offline partition: only the last in-sync leader may take over, or data could be lost.
      if (brokerId === this.lastLeaderId) {
        this.leaderId = brokerId
        this.isr.add(brokerId)
      }
    } else {
      // A returning replica drops anything the current leader never had, then catches up.
      broker.log = broker.log.slice(0, this.highWatermark)
    }
    this.notify()
  }

  reset(): void {
    for (const broker of this.brokers) {
      broker.alive = true
      broker.log = []
    }
    this.leaderId = 1
    this.lastLeaderId = null
    this.isr = new Set(this.brokers.map((b) => b.id))
    this.lastResult = null
    this.seq = 0
    this.notify()
  }

  /** Clean leader election: only a member of the ISR may become leader. */
  private electLeader(previousLeader: number): void {
    const candidate = this.brokers.find((b) => b.alive && this.isr.has(b.id))
    this.leaderId = candidate?.id ?? null
    if (!candidate) this.lastLeaderId = previousLeader
    if (candidate) {
      // Followers that are ahead of the new leader truncate to match it.
      for (const broker of this.brokers) {
        if (broker.alive && broker.log.length > candidate.log.length) broker.log = [...candidate.log]
      }
    }
  }

  private inSyncFollowers(): Broker[] {
    return this.brokers.filter((b) => b.alive && b.id !== this.leaderId && this.isr.has(b.id))
  }

  private finish(result: ProduceResult): ProduceResult {
    this.lastResult = result
    this.notify()
    return result
  }
}
