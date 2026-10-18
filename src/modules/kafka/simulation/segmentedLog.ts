/** Topic settings that shape a partition's files (names as in Kafka, times in ms, sizes in bytes). */
export interface SegmentConfig {
  /** segment.bytes: roll when the next batch would make the active segment larger than this. */
  readonly segmentBytes: number
  /** segment.ms: roll when the active segment's first batch is older than this. */
  readonly segmentMs: number
  /** index.interval.bytes: add an offset index entry after at least this many bytes. */
  readonly indexIntervalBytes: number
}

/** One record batch as it sits in a .log file. */
export interface StoredBatch {
  readonly base: number
  readonly last: number
  /** Byte position of the batch inside its segment's .log file. */
  readonly position: number
  readonly size: number
  readonly time: number
}

/** One .index entry: the last offset of the batch that starts at `position`. */
export interface IndexEntry {
  readonly offset: number
  readonly position: number
}

export interface LogSegment {
  /** The first offset the segment can hold; also its file name, zero-padded to 20 digits. */
  readonly base: number
  readonly batches: StoredBatch[]
  readonly index: IndexEntry[]
  bytes: number
  /** Bytes appended since the last index entry. */
  sinceIndex: number
}

export interface Lookup {
  /** Index into the segment list of the segment that holds the offset. */
  readonly segment: number
  /** The index entry the search lands on, or null when the read starts at position 0. */
  readonly entry: IndexEntry | null
  /** Batches read from the entry's position up to and including the one holding the offset. */
  readonly scanned: readonly StoredBatch[]
}

export const fileName = (base: number, ext: string) => `${String(base).padStart(20, '0')}.${ext}`

const emptySegment = (base: number): LogSegment => ({ base, batches: [], index: [], bytes: 0, sinceIndex: 0 })

/**
 * A partition's log as Kafka stores it: a list of segments, only the last (active) one written to.
 * Follows Kafka's rules for rolling, sparse indexing, offset lookup and time-based retention.
 */
export class SegmentedLog {
  readonly segments: LogSegment[] = [emptySegment(0)]
  logEnd = 0
  readonly config: SegmentConfig

  constructor(config: SegmentConfig) {
    this.config = config
  }

  get active(): LogSegment {
    return this.segments[this.segments.length - 1]
  }

  get logStart(): number {
    return this.segments[0].base
  }

  /** Appends one batch of `count` records taking `size` bytes, written at time `now`. */
  append(count: number, size: number, now: number): StoredBatch {
    if (this.shouldRoll(size, now)) this.roll()
    const seg = this.active
    const batch: StoredBatch = { base: this.logEnd, last: this.logEnd + count - 1, position: seg.bytes, size, time: now }
    // like LogSegment.append: an entry for this batch once enough bytes went by since the last one
    if (seg.sinceIndex > this.config.indexIntervalBytes) {
      seg.index.push({ offset: batch.last, position: batch.position })
      seg.sinceIndex = 0
    }
    seg.sinceIndex += size
    seg.batches.push(batch)
    seg.bytes += size
    this.logEnd += count
    return batch
  }

  /** Why the next append of `size` bytes at `now` would roll, or null if it would not. */
  rollReason(size: number, now: number): 'size' | 'time' | null {
    const seg = this.active
    if (!seg.batches.length) return null
    if (seg.bytes + size > this.config.segmentBytes) return 'size'
    if (now - seg.batches[0].time > this.config.segmentMs) return 'time'
    return null
  }

  private shouldRoll(size: number, now: number) {
    return this.rollReason(size, now) !== null
  }

  /** Closes the active segment and starts a new one at the log end offset. */
  roll() {
    this.segments.push(emptySegment(this.logEnd))
  }

  /** Where a read of `offset` starts: the segment, the index entry, and the batches scanned. */
  lookup(offset: number): Lookup | null {
    if (offset < this.logStart || offset >= this.logEnd) return null
    const segment = this.segments.findLastIndex((s) => s.base <= offset)
    const seg = this.segments[segment]
    const entry = seg.index.findLast((e) => e.offset <= offset) ?? null
    const from = entry?.position ?? 0
    const scanned: StoredBatch[] = []
    for (const b of seg.batches) {
      if (b.position < from) continue
      scanned.push(b)
      if (b.last >= offset) break
    }
    return { segment, entry, scanned }
  }

  /**
   * retention.ms: deletes segments from the oldest while their newest record is older than the limit.
   * If that would delete every segment, a new empty one is rolled first, so the old active one can go too.
   * Returns the base offsets of the deleted segments.
   */
  expire(now: number, retentionMs: number): number[] {
    const expired = (s: LogSegment) => s.batches.length > 0 && now - s.batches[s.batches.length - 1].time > retentionMs
    let n = 0
    while (n < this.segments.length && expired(this.segments[n])) n++
    if (n === 0) return []
    if (n === this.segments.length) this.roll()
    return this.segments.splice(0, n).map((s) => s.base)
  }
}
