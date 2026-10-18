import type { CompactedRecord, CompactedSegment } from '../simulation/logCompactor'

/** One batch header from a shortened recorded `kafka-dump-log --print-data-log`. */
export interface DumpBatch {
  readonly base: number
  readonly last: number
  readonly count: number
  /** The delete horizon (epoch ms) the cleaner wrote into the batch, if any. */
  readonly horizon: number | null
}

/** A recorded dump of every .log file → segments of records (value null = tombstone) and their batch headers. */
export function parseDumps(dumps: readonly { readonly out: string }[]): { segments: CompactedSegment[]; batches: DumpBatch[] } {
  const segments: CompactedSegment[] = []
  const batches: DumpBatch[] = []
  for (const { out } of dumps) {
    const base = Number(/(\d{20})\.log/.exec(out)?.[1])
    const records: CompactedRecord[] = []
    for (const line of out.split('\n')) {
      const b = /^batch baseOffset: (\d+) lastOffset: (\d+) count: (\d+) deleteHorizonMs: OptionalLong(?:\[(\d+)\]|\.empty)/.exec(line)
      if (b) batches.push({ base: Number(b[1]), last: Number(b[2]), count: Number(b[3]), horizon: b[4] ? Number(b[4]) : null })
      const r = /\| offset: (\d+) key: (\S+)(?: payload: (.*))?$/.exec(line)
      if (r) records.push({ offset: Number(r[1]), key: r[2], value: r[3] ?? null, time: 0 })
    }
    segments.push({ base, records })
  }
  return { segments, batches }
}

/** "Offset:3	user-1	Anna" lines → what a consumer read. */
export const parseRead = (out: string) =>
  out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [, offset, key, value] = /^Offset:(\d+)\t(\S+)\t(.*)$/.exec(l) ?? []
      return { offset: Number(offset), key, value: value === 'null' ? null : value }
    })
