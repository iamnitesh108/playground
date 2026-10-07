import { partitionForKey } from './murmur2'

/** Strategy that decides which partition a record goes to. */
export interface Partitioner {
  readonly name: string
  partition(key: string | null, partitionCount: number): number
}

/** Records per partition before a key-less "batch" is considered full in the simulator. */
const STICKY_BATCH = 3

/**
 * Kafka's default behaviour: hash the key so equal keys always share a partition.
 * Key-less records stick to one partition until a batch fills, then move on
 * (the real client switches after roughly batch.size bytes; here, every 3 records).
 */
export class DefaultPartitioner implements Partitioner {
  readonly name = 'default (key hash, sticky without key)'
  private stickyPartition = 0
  private stickyCount = 0

  partition(key: string | null, partitionCount: number): number {
    if (key !== null && key !== '') return partitionForKey(key, partitionCount)
    if (this.stickyCount >= STICKY_BATCH) {
      this.stickyPartition = (this.stickyPartition + 1) % partitionCount
      this.stickyCount = 0
    }
    this.stickyCount++
    return this.stickyPartition % partitionCount
  }
}

/** Ignores keys entirely. Even spread, but no per-key ordering. */
export class RoundRobinPartitioner implements Partitioner {
  readonly name = 'round robin'
  private next = 0

  partition(_key: string | null, partitionCount: number): number {
    return this.next++ % partitionCount
  }
}
