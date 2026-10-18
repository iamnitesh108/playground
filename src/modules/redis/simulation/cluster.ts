/*
 * How Redis Cluster maps a key to one of 16384 hash slots, and a slot to a node.
 * CRC16 is the XMODEM variant (polynomial 0x1021, initial value 0), as in the
 * cluster specification; tools/redis-capture/check-simulator.mjs compares it
 * with CLUSTER KEYSLOT on a real cluster.
 */

export const SLOTS = 16384

const TABLE = (() => {
  const t = new Uint16Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    t[i] = crc
  }
  return t
})()

export function crc16(bytes: Uint8Array): number {
  let crc = 0
  for (const b of bytes) crc = ((crc << 8) & 0xffff) ^ TABLE[((crc >> 8) ^ b) & 0xff]
  return crc
}

/** The part of the key that is hashed: the content of the first {…} if it is not empty, else the whole key. */
export function hashedPart(key: string): { part: string; tagged: boolean } {
  const open = key.indexOf('{')
  if (open >= 0) {
    const close = key.indexOf('}', open + 1)
    if (close > open + 1) return { part: key.slice(open + 1, close), tagged: true }
  }
  return { part: key, tagged: false }
}

export function keySlot(key: string): number {
  return crc16(new TextEncoder().encode(hashedPart(key).part)) % SLOTS
}

export interface SlotRange {
  readonly from: number
  readonly to: number
}

/** The ranges `redis-cli --cluster create` gives n primaries: equal parts, the remainder spread from the first. */
export function initialRanges(primaries: number): SlotRange[] {
  const per = SLOTS / primaries
  return Array.from({ length: primaries }, (_, i) => ({ from: Math.round(i * per), to: i === primaries - 1 ? SLOTS - 1 : Math.round((i + 1) * per) - 1 }))
}

export function ownerOf(slot: number, ranges: readonly SlotRange[]): number {
  return ranges.findIndex((r) => slot >= r.from && slot <= r.to)
}

/** Whether a multi-key command can run: every key must hash to the same slot. */
export function sameSlot(keys: readonly string[]): boolean {
  return new Set(keys.map(keySlot)).size <= 1
}
