import { partitionForKey } from './murmur2'

/** Strategy that decides which partition a record goes to. */
export interface Partitioner {
  readonly name: string
  partition(key: string | null, partitionCount: number): number
}

/**
 * Kafka's default behaviour: hash the key so equal keys always share a
 * partition; spread key-less records around.
 */
export class DefaultPartitioner implements Partitioner {
  readonly name = 'default (key hash)'
  private next = 0

  partition(key: string | null, partitionCount: number): number {
    if (key !== null && key !== '') return partitionForKey(key, partitionCount)
    return this.next++ % partitionCount
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
