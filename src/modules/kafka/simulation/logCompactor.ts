/**
 * A model of Kafka's log cleaner for one compacted partition, following Cleaner/LogCleanerManager in Kafka 4.3:
 * the clean / dirty / uncleanable sections, the key → last-offset map of the dirty section, recopying from the
 * start of the log, tombstones kept until a delete horizon set by the first cleaning that copies them, and the
 * cleaner checkpoint. Records stand in for bytes (one record = one unit of size).
 */

export interface CompactedRecord {
  readonly offset: number
  readonly key: string
  /** null is a tombstone. */
  readonly value: string | null
  readonly time: number
  /** Set the first time a cleaning copies this tombstone: now + delete.retention.ms. */
  readonly deleteHorizon?: number
}

export interface CompactedSegment {
  readonly base: number
  readonly records: readonly CompactedRecord[]
}

export type Removal = 'superseded' | 'tombstone expired'

export interface CleaningReport {
  /** The dirty section the map was built from: [from, to). */
  readonly dirtyFrom: number
  readonly dirtyTo: number
  /** key → last offset in the dirty section, in the order keys were first seen. */
  readonly map: ReadonlyMap<string, number>
  readonly removed: readonly { readonly record: CompactedRecord; readonly why: Removal }[]
  /** Tombstones that got their delete horizon in this cleaning. */
  readonly horizonsSet: readonly CompactedRecord[]
  /** How many segments were merged into how many. */
  readonly segmentsBefore: number
  readonly segmentsAfter: number
}

export interface CompactionConfig {
  /** delete.retention.ms */
  readonly deleteRetentionMs: number
  /** segment.bytes, in records: cleaned segments are merged up to this size. */
  readonly segmentSize: number
  /** min.cleanable.dirty.ratio */
  readonly minCleanableRatio: number
}

export class CompactedLog {
  segments: CompactedSegment[] = [{ base: 0, records: [] }]
  logEnd = 0
  /** The cleaner checkpoint: everything before it has been cleaned (the clean section). */
  cleanedTo = 0
  readonly config: CompactionConfig

  constructor(config: CompactionConfig) {
    this.config = config
  }

  get active(): CompactedSegment {
    return this.segments[this.segments.length - 1]
  }

  append(key: string, value: string | null, now: number): CompactedRecord {
    const record: CompactedRecord = { offset: this.logEnd++, key, value, time: now }
    const seg = this.active
    this.segments[this.segments.length - 1] = { ...seg, records: [...seg.records, record] }
    return record
  }

  /** Closes the active segment (in Kafka: by segment.bytes or segment.ms, on the next write). */
  roll() {
    if (this.active.records.length) this.segments.push({ base: this.logEnd, records: [] })
  }

  /** The first offset the cleaner may not touch: the active segment (no transactions or compaction lag here). */
  get firstUncleanable(): number {
    return this.active.base
  }

  private size(from: number, to: number) {
    return this.segments.flatMap((s) => s.records).filter((r) => r.offset >= from && r.offset < to).length
  }

  /** cleanable / (clean + cleanable), as LogToClean computes it; the active segment counts in neither. */
  get dirtyRatio(): number {
    const clean = this.size(0, this.cleanedTo)
    const dirty = this.size(this.cleanedTo, this.firstUncleanable)
    return clean + dirty === 0 ? 0 : dirty / (clean + dirty)
  }

  get cleanable(): boolean {
    return this.firstUncleanable > this.cleanedTo && this.dirtyRatio > this.config.minCleanableRatio
  }

  /** One cleaning pass at time `now`, or null when there is nothing dirty to clean. */
  clean(now: number): CleaningReport | null {
    const dirtyFrom = this.cleanedTo
    const dirtyTo = this.firstUncleanable
    if (dirtyTo <= dirtyFrom) return null

    // 1. key → last offset, for the dirty section only
    const map = new Map<string, number>()
    for (const r of this.segments.flatMap((s) => s.records)) if (r.offset >= dirtyFrom && r.offset < dirtyTo) map.set(r.key, r.offset)

    // 2. recopy every segment before the uncleanable one, from the start of the log
    const removed: { record: CompactedRecord; why: Removal }[] = []
    const horizonsSet: CompactedRecord[] = []
    const keep = (r: CompactedRecord): CompactedRecord | null => {
      // a key the dirty section never wrote (only in the clean section) is kept: Kafka's map returns -1 for it
      if (r.offset < (map.get(r.key) ?? -1)) {
        removed.push({ record: r, why: 'superseded' })
        return null
      }
      if (r.value !== null) return r
      if (r.deleteHorizon === undefined) {
        const marked = { ...r, deleteHorizon: now + this.config.deleteRetentionMs }
        horizonsSet.push(marked)
        return marked
      }
      if (now < r.deleteHorizon) return r
      removed.push({ record: r, why: 'tombstone expired' })
      return null
    }
    const cleanable = this.segments.filter((s) => s.base < dirtyTo)
    const rest = this.segments.filter((s) => s.base >= dirtyTo)
    const copied = cleanable.map((s) => ({ base: s.base, records: s.records.map(keep).filter((r): r is CompactedRecord => r !== null) }))

    // 3. merge neighbours while they fit in one segment, so segments do not shrink forever
    const groups: CompactedSegment[] = []
    for (const seg of copied) {
      const last = groups[groups.length - 1]
      if (last && last.records.length + seg.records.length <= this.config.segmentSize) groups[groups.length - 1] = { base: last.base, records: [...last.records, ...seg.records] }
      else groups.push(seg)
    }

    // 4. swap the cleaned segments in and move the checkpoint
    this.segments = [...groups, ...rest]
    this.cleanedTo = dirtyTo
    return { dirtyFrom, dirtyTo, map, removed, horizonsSet, segmentsBefore: cleanable.length, segmentsAfter: groups.length }
  }

  /** What a consumer reading from the beginning gets. */
  read(): CompactedRecord[] {
    return this.segments.flatMap((s) => s.records)
  }
}

/** The offset map is a hash table of MD5(key) → offset: 16 + 8 bytes per entry (SkimpyOffsetMap). */
export const OFFSET_MAP_ENTRY_BYTES = 16 + 8

/** How many distinct keys one cleaning pass can map with a dedupe buffer and load factor. */
export const keysPerPass = (bufferBytes: number, threads: number, loadFactor: number) => Math.floor(Math.floor(bufferBytes / threads / OFFSET_MAP_ENTRY_BYTES) * loadFactor)
