/*
 * Which internal encoding Redis picks for a value, given its size. The limits are
 * the ones the recorded server reported (CONFIG GET), and check-simulator.mjs
 * compares these rules with OBJECT ENCODING on a real server.
 */

export type ValueType = 'string' | 'list' | 'hash' | 'set' | 'zset'

export interface EncodingLimits {
  hashEntries: number
  hashValue: number
  setIntsetEntries: number
  setListpackEntries: number
  setValue: number
  zsetEntries: number
  zsetValue: number
  /** list-max-listpack-size -2 = 8 KB per listpack node. */
  listNodeBytes: number
  /** key + value bytes that still fit an embedded string (one 64-byte allocation). */
  embstrKeyPlusValue: number
}

export interface ValueShape {
  /** Elements (fields for a hash, members for a set or sorted set, items for a list). */
  count: number
  /** Longest element, field or value, in bytes. */
  longest: number
  /** Every element is an integer (sets; strings use `isInteger`). */
  integers: boolean
  /** Key length in bytes (strings only). */
  keyBytes?: number
}

/** Bytes a listpack needs for `count` string entries of `bytes` each (≤ 63 bytes: 1 header + data + 1 back-length). */
export function listpackBytes(count: number, bytes: number): number {
  const entry = bytes <= 63 ? bytes + 2 : bytes <= 4095 ? bytes + 2 + (bytes + 2 < 128 ? 1 : 2) : bytes + 5 + 3
  return 6 + count * entry + 1
}

export function encodingOf(type: ValueType, shape: ValueShape, limits: EncodingLimits): string {
  switch (type) {
    case 'string': {
      if (shape.integers && shape.longest <= 20) return 'int'
      return (shape.keyBytes ?? 0) + shape.longest <= limits.embstrKeyPlusValue ? 'embstr' : 'raw'
    }
    case 'list':
      return listpackBytes(shape.count, shape.longest) <= limits.listNodeBytes ? 'listpack' : 'quicklist'
    case 'hash':
      return shape.count <= limits.hashEntries && shape.longest <= limits.hashValue ? 'listpack' : 'hashtable'
    case 'set':
      if (shape.integers && shape.count <= limits.setIntsetEntries) return 'intset'
      return shape.count <= limits.setListpackEntries && shape.longest <= limits.setValue ? 'listpack' : 'hashtable'
    case 'zset':
      return shape.count <= limits.zsetEntries && shape.longest <= limits.zsetValue ? 'listpack' : 'skiplist'
  }
}
