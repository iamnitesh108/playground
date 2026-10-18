import { murmur2, toPositive } from './murmur2'

/*
 * Where keys land, for the key explorer: the Java client's murmur2 partitioner, and for comparison
 * the CRC-32 hash that librdkafka-based clients use by default. Pure functions, no React.
 */

export type KeyHash = 'murmur2' | 'crc32'

const encoder = new TextEncoder()

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** Standard CRC-32 (the one zlib and librdkafka use). */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const STRATEGIES: Record<KeyHash, (bytes: Uint8Array, partitions: number) => number> = {
  murmur2: (bytes, partitions) => toPositive(murmur2(bytes)) % partitions,
  crc32: (bytes, partitions) => crc32(bytes) % partitions,
}

export function partitionOf(key: string, partitions: number, hash: KeyHash = 'murmur2'): number {
  return STRATEGIES[hash](encoder.encode(key), partitions)
}

/** A key and how many records carry it (a status like PAID may carry most of the traffic). */
export interface WeightedKey {
  key: string
  weight: number
}

export interface Distribution {
  /** Records per partition. */
  records: number[]
  /** Distinct keys per partition. */
  keys: number[]
  /** Partition of each key, in input order. */
  partitionOfKey: number[]
  /** How much busier the busiest partition is than a perfectly even share, in percent (0 = even). */
  skewPercent: number
  /** Partitions that receive nothing. */
  idle: number
}

export function distribute(keys: readonly WeightedKey[], partitions: number, hash: KeyHash = 'murmur2'): Distribution {
  const records = new Array<number>(partitions).fill(0)
  const keyCount = new Array<number>(partitions).fill(0)
  const partitionOfKey = keys.map(({ key, weight }) => {
    const p = partitionOf(key, partitions, hash)
    records[p] += weight
    keyCount[p] += 1
    return p
  })
  const total = records.reduce((a, b) => a + b, 0)
  const even = total / partitions
  const skewPercent = total === 0 ? 0 : Math.round((Math.max(...records) / even - 1) * 100)
  return { records, keys: keyCount, partitionOfKey, skewPercent, idle: records.filter((r) => r === 0).length }
}

export interface Move {
  key: string
  from: number
  to: number
}

/** Partition of every key before and after a partition-count change. */
export function remap(keys: readonly string[], before: number, after: number, hash: KeyHash = 'murmur2'): Move[] {
  return keys.map((key) => ({ key, from: partitionOf(key, before, hash), to: partitionOf(key, after, hash) }))
}
