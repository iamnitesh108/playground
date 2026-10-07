import type { KafkaRecord } from './types'

/** A named, partitioned, append-only log. */
export class Topic {
  readonly name: string
  private readonly logs: KafkaRecord[][]

  constructor(name: string, partitionCount: number) {
    this.name = name
    if (partitionCount < 1) throw new Error('A topic needs at least one partition')
    this.logs = Array.from({ length: partitionCount }, () => [])
  }

  get partitionCount(): number {
    return this.logs.length
  }

  get partitionIds(): number[] {
    return this.logs.map((_, i) => i)
  }

  append(partition: number, record: Omit<KafkaRecord, 'offset' | 'partition' | 'topic'>): KafkaRecord {
    const log = this.logs[partition]
    const stored: KafkaRecord = { ...record, topic: this.name, partition, offset: log.length }
    log.push(stored)
    return stored
  }

  records(partition: number): readonly KafkaRecord[] {
    return this.logs[partition]
  }

  read(partition: number, offset: number): KafkaRecord | undefined {
    return this.logs[partition][offset]
  }

  /** Offset the next record in this partition will receive. */
  endOffset(partition: number): number {
    return this.logs[partition].length
  }
}
