/*
 * Erasure coding as RustFS uses it: an object is cut into `data` shards and `parity` shards are computed, one
 * per drive of an erasure set. Any `data` shards rebuild the object. Reads need `data` drives (the read
 * quorum); writes need `data` drives, one more when data == parity (the write quorum).
 */

export function defaultParity(drives: number): number {
  if (drives <= 1) return 0
  if (drives <= 3) return 1
  if (drives <= 5) return 2
  if (drives <= 7) return 3
  return 4
}

export function quorums(data: number, parity: number) {
  return { read: data, write: data + (data === parity ? 1 : 0) }
}

export interface SetStatus {
  online: number
  readable: boolean
  writable: boolean
  /** Fraction of raw capacity that holds data. */
  usable: number
  /** Raw bytes stored per byte of data. */
  overhead: number
}

export function setStatus(data: number, parity: number, failed: number): SetStatus {
  const total = data + parity
  const online = total - failed
  const q = quorums(data, parity)
  return { online, readable: online >= q.read, writable: online >= q.write, usable: data / total, overhead: total / data }
}

/** Replication for comparison: n full copies survive n - 1 losses and keep 1/n of the raw space for data. */
export function replication(copies: number) {
  return { tolerates: copies - 1, usable: 1 / copies, overhead: copies }
}

/* ---------- the simplest erasure code: one parity shard = XOR of the data shards (real bytes) ---------- */

export function splitShards(bytes: Uint8Array, k: number): Uint8Array[] {
  const size = Math.ceil(bytes.length / k)
  return Array.from({ length: k }, (_, i) => {
    const shard = new Uint8Array(size)
    shard.set(bytes.subarray(i * size, Math.min(bytes.length, (i + 1) * size)))
    return shard
  })
}

export function xorAll(shards: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(shards[0]?.length ?? 0)
  for (const s of shards) for (let i = 0; i < out.length; i++) out[i] ^= s[i]
  return out
}

/** Rebuilds the one missing shard (data or parity) from all the others. */
export function rebuild(shards: readonly (Uint8Array | null)[]): Uint8Array {
  return xorAll(shards.filter((s): s is Uint8Array => s !== null))
}
