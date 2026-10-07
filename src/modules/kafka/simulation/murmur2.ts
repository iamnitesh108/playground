/**
 * Kafka's murmur2 hash, ported from org.apache.kafka.common.utils.Utils.
 * Using the real algorithm means keys land on the same partitions here
 * as they would on a real cluster with the default partitioner.
 */
export function murmur2(data: Uint8Array): number {
  const length = data.length
  const m = 0x5bd1e995
  const r = 24
  let h = 0x9747b28c ^ length

  const length4 = length >>> 2
  for (let i = 0; i < length4; i++) {
    const i4 = i * 4
    let k = data[i4] | (data[i4 + 1] << 8) | (data[i4 + 2] << 16) | (data[i4 + 3] << 24)
    k = Math.imul(k, m)
    k ^= k >>> r
    k = Math.imul(k, m)
    h = Math.imul(h, m)
    h ^= k
  }

  const tail = length & ~3
  const remaining = length % 4
  if (remaining >= 3) h ^= data[tail + 2] << 16
  if (remaining >= 2) h ^= data[tail + 1] << 8
  if (remaining >= 1) {
    h ^= data[tail]
    h = Math.imul(h, m)
  }

  h ^= h >>> 13
  h = Math.imul(h, m)
  h ^= h >>> 15
  return h | 0
}

export const toPositive = (n: number): number => n & 0x7fffffff

const encoder = new TextEncoder()

export function partitionForKey(key: string, partitionCount: number): number {
  return toPositive(murmur2(encoder.encode(key))) % partitionCount
}
