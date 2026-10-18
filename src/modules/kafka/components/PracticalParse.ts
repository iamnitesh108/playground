/* Parses the recorded CLI outputs of the practicals into data for figures. */

export interface OffsetRow {
  group: string
  topic: string
  partition: number
  current: number | null
  end: number
  lag: number | null
  client: string
}

/** Rows of `kafka-consumer-groups.sh --describe` (one or several groups). */
export function parseOffsets(out: string): OffsetRow[] {
  return out
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((f) => f.length >= 6 && f[0] !== 'GROUP' && /^\d+$/.test(f[2]))
    .map((f) => ({
      group: f[0],
      topic: f[1],
      partition: Number(f[2]),
      current: f[3] === '-' ? null : Number(f[3]),
      end: Number(f[4]),
      lag: f[5] === '-' ? null : Number(f[5]),
      client: f[8] ?? '-',
    }))
}

export interface MemberRow {
  group: string
  member: string
  client: string
  partitions: number[]
}

/** Rows of `kafka-consumer-groups.sh --describe --members --verbose`. */
export function parseMembers(out: string): MemberRow[] {
  return out
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((f) => f.length >= 7 && f[0] !== 'GROUP')
    .map((f) => ({
      group: f[0],
      member: f[1],
      client: f[3],
      partitions: f[6] === '-' ? [] : f[6].split(':')[1].split(',').map(Number),
    }))
}

export interface ConsumedRecord {
  partition: number
  offset: number
  key: string
  value: string
}

/** Console-consumer lines printed with partition, offset and key: "Partition:0\tOffset:1\tbob\torder-1002". */
export function parseRecords(lines: readonly string[]): ConsumedRecord[] {
  return lines
    .map((l) => l.split('\t'))
    .filter((f) => f[0].startsWith('Partition:') && f.length >= 4)
    .map((f) => ({ partition: Number(f[0].split(':')[1]), offset: Number(f[1].split(':')[1]), key: f[2], value: f[3] }))
}
