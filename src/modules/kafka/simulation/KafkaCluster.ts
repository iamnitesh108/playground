import { Observable } from '@/shared/utils/observable'
import { RangeAssignor, type PartitionAssignor } from './assignor'
import { ConsumerGroup } from './ConsumerGroup'
import { DefaultPartitioner, type Partitioner } from './partitioner'
import { Topic } from './Topic'
import type { KafkaRecord, OffsetReset } from './types'

export type ActivityKind = 'produce' | 'consume' | 'commit' | 'rebalance' | 'info'

export interface Activity {
  id: number
  kind: ActivityKind
  text: string
}

export interface ClusterOptions {
  topic: string
  partitions: number
  partitioner?: Partitioner
}

const MAX_ACTIVITY = 40

/**
 * In-memory Kafka: one topic, any number of consumer groups.
 * A facade over Topic, Partitioner and ConsumerGroup that notifies the UI.
 */
export class KafkaCluster extends Observable {
  topic: Topic
  private partitioner: Partitioner
  private readonly groupMap = new Map<string, ConsumerGroup>()
  private activityLog: Activity[] = []
  private activitySeq = 0
  private clock = 0

  private readonly options: ClusterOptions

  constructor(options: ClusterOptions) {
    super()
    this.options = options
    this.topic = new Topic(options.topic, options.partitions)
    this.partitioner = options.partitioner ?? new DefaultPartitioner()
  }

  get groups(): ConsumerGroup[] {
    return [...this.groupMap.values()]
  }

  get activity(): readonly Activity[] {
    return this.activityLog
  }

  get partitionerName(): string {
    return this.partitioner.name
  }

  setPartitioner(partitioner: Partitioner): void {
    this.partitioner = partitioner
    this.log('info', `Partitioner set to ${partitioner.name}`)
    this.notify()
  }

  /** Recreates the topic; partition count can only change on an empty playground. */
  reset(partitions = this.topic.partitionCount): void {
    this.topic = new Topic(this.options.topic, partitions)
    this.groupMap.clear()
    this.activityLog = []
    this.clock = 0
    this.notify()
  }

  produce(key: string | null, value: string): KafkaRecord {
    const partition = this.partitioner.partition(key, this.topic.partitionCount)
    const record = this.topic.append(partition, { key, value, timestamp: ++this.clock })
    this.log('produce', `Produced key=${key ?? 'null'} → partition ${partition} @ offset ${record.offset}`)
    this.notify()
    return record
  }

  addGroup(id: string, offsetReset: OffsetReset = 'earliest', assignor: PartitionAssignor = new RangeAssignor()): ConsumerGroup {
    const group = new ConsumerGroup(id, this.topic, assignor, offsetReset)
    this.groupMap.set(id, group)
    this.log('info', `Group "${id}" created (auto.offset.reset=${offsetReset})`)
    this.notify()
    return group
  }

  removeGroup(id: string): void {
    this.groupMap.delete(id)
    this.log('info', `Group "${id}" deleted`)
    this.notify()
  }

  group(id: string): ConsumerGroup | undefined {
    return this.groupMap.get(id)
  }

  addConsumer(groupId: string): void {
    const group = this.require(groupId)
    const member = group.addMember()
    this.log('rebalance', `${member.id} joined → rebalance (generation ${group.generation})`)
    this.notify()
  }

  removeConsumer(groupId: string, memberId: string): void {
    const group = this.require(groupId)
    group.removeMember(memberId)
    this.log('rebalance', `${memberId} left → rebalance (generation ${group.generation})`)
    this.notify()
  }

  crashConsumer(groupId: string, memberId: string): void {
    const group = this.require(groupId)
    group.crash(memberId)
    this.log('rebalance', `${memberId} crashed → partitions reassigned from committed offsets`)
    this.notify()
  }

  setAssignor(groupId: string, assignor: PartitionAssignor): void {
    this.require(groupId).setAssignor(assignor)
    this.log('rebalance', `Group "${groupId}" now uses the ${assignor.name} assignor`)
    this.notify()
  }

  /** One consumer fetches and processes one record, optionally committing. */
  consume(groupId: string, memberId: string, autoCommit = true): KafkaRecord | undefined {
    const group = this.require(groupId)
    const record = group.poll(memberId)
    if (!record) return undefined
    this.log('consume', `${memberId} read p${record.partition}@${record.offset} (key=${record.key ?? 'null'})`)
    if (autoCommit) group.commit(memberId)
    this.notify()
    return record
  }

  commit(groupId: string, memberId: string): void {
    this.require(groupId).commit(memberId)
    this.log('commit', `${memberId} committed its offsets`)
    this.notify()
  }

  /** Every consumer in every group processes up to one record. */
  tick(): boolean {
    let progressed = false
    for (const group of this.groupMap.values()) {
      for (const member of group.members) {
        if (this.consumeQuietly(group, member.id)) progressed = true
      }
    }
    if (progressed) this.notify()
    return progressed
  }

  private consumeQuietly(group: ConsumerGroup, memberId: string): boolean {
    const record = group.poll(memberId)
    if (!record) return false
    group.commit(memberId)
    this.log('consume', `${memberId} read p${record.partition}@${record.offset}`)
    return true
  }

  private require(groupId: string): ConsumerGroup {
    const group = this.groupMap.get(groupId)
    if (!group) throw new Error(`Unknown group "${groupId}"`)
    return group
  }

  private log(kind: ActivityKind, text: string): void {
    this.activityLog = [{ id: ++this.activitySeq, kind, text }, ...this.activityLog].slice(0, MAX_ACTIVITY)
  }
}
