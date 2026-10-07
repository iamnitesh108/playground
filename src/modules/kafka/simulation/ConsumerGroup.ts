import type { Assignment, PartitionAssignor } from './assignor'
import type { Topic } from './Topic'
import type { KafkaRecord, OffsetReset } from './types'

export interface GroupMember {
  id: string
  /** Number of records this member has processed. */
  processed: number
}

/**
 * A set of consumers sharing the work of reading one topic.
 * Tracks two offsets per partition:
 *  - position:  the next offset the owning consumer will fetch (in memory)
 *  - committed: the progress saved in Kafka, survives crashes and rebalances
 */
export class ConsumerGroup {
  private readonly memberList: GroupMember[] = []
  private assignment: Assignment = new Map()
  private readonly committed = new Map<number, number>()
  private readonly position = new Map<number, number>()
  private generationId = 0
  private memberSeq = 0

  readonly id: string
  readonly topic: Topic
  readonly offsetReset: OffsetReset
  private assignor: PartitionAssignor

  constructor(id: string, topic: Topic, assignor: PartitionAssignor, offsetReset: OffsetReset = 'earliest') {
    this.id = id
    this.topic = topic
    this.assignor = assignor
    this.offsetReset = offsetReset
  }

  get members(): readonly GroupMember[] {
    return this.memberList
  }

  get generation(): number {
    return this.generationId
  }

  get assignorName(): string {
    return this.assignor.name
  }

  setAssignor(assignor: PartitionAssignor): void {
    this.assignor = assignor
    this.rebalance()
  }

  addMember(): GroupMember {
    const member = { id: `${this.id}-c${++this.memberSeq}`, processed: 0 }
    this.memberList.push(member)
    this.rebalance()
    return member
  }

  removeMember(memberId: string): void {
    const index = this.memberList.findIndex((m) => m.id === memberId)
    if (index < 0) return
    this.memberList.splice(index, 1)
    this.rebalance()
  }

  partitionsOf(memberId: string): number[] {
    return this.assignment.get(memberId) ?? []
  }

  ownerOf(partition: number): string | undefined {
    for (const [member, partitions] of this.assignment) {
      if (partitions.includes(partition)) return member
    }
    return undefined
  }

  committedOffset(partition: number): number | undefined {
    return this.committed.get(partition)
  }

  positionOf(partition: number): number {
    return this.position.get(partition) ?? this.startingOffset(partition)
  }

  lag(partition: number): number {
    return this.topic.endOffset(partition) - (this.committed.get(partition) ?? this.startingOffset(partition))
  }

  totalLag(): number {
    return this.topic.partitionIds.reduce((sum, p) => sum + this.lag(p), 0)
  }

  /** Fetches the next record from one of the member's partitions, if any. */
  poll(memberId: string): KafkaRecord | undefined {
    const partitions = this.partitionsOf(memberId)
    const ready = partitions
      .map((p) => ({ p, at: this.positionOf(p) }))
      .filter(({ p, at }) => at < this.topic.endOffset(p))
      .sort((a, b) => this.topic.read(a.p, a.at)!.timestamp - this.topic.read(b.p, b.at)!.timestamp)[0]
    if (!ready) return undefined

    const record = this.topic.read(ready.p, ready.at)!
    this.position.set(ready.p, ready.at + 1)
    const member = this.memberList.find((m) => m.id === memberId)
    if (member) member.processed++
    return record
  }

  /** Saves the member's current positions as committed offsets. */
  commit(memberId: string): void {
    for (const partition of this.partitionsOf(memberId)) {
      this.committed.set(partition, this.positionOf(partition))
    }
  }

  /**
   * A crash loses in-memory positions. The partitions move to other members,
   * who resume from the last committed offset, so uncommitted work is redone.
   */
  crash(memberId: string): void {
    for (const partition of this.partitionsOf(memberId)) {
      this.position.delete(partition)
    }
    this.removeMember(memberId)
  }

  private startingOffset(partition: number): number {
    const committed = this.committed.get(partition)
    if (committed !== undefined) return committed
    return this.offsetReset === 'earliest' ? 0 : this.topic.endOffset(partition)
  }

  private rebalance(): void {
    // Every member gives up its partitions; progress restarts from committed offsets.
    for (const partition of this.topic.partitionIds) {
      const committed = this.committed.get(partition)
      if (committed === undefined) {
        // 'latest' pins a brand-new group to the current end of the log.
        if (this.offsetReset === 'latest') this.committed.set(partition, this.topic.endOffset(partition))
        this.position.delete(partition)
      } else {
        this.position.set(partition, committed)
      }
    }
    this.assignment = this.assignor.assign(
      this.topic.partitionIds,
      this.memberList.map((m) => m.id),
    )
    this.generationId++
  }
}
