export interface LogEntry {
  offset: number
  key: string
  /** `null` is a tombstone: "this key was deleted". */
  value: string | null
  /** Age in hours, used by time-based retention. */
  ageHours: number
}

export interface Segment {
  index: number
  entries: LogEntry[]
  active: boolean
}

/** Splits a log into fixed-size segment files; the last one is the active segment. */
export function toSegments(entries: readonly LogEntry[], segmentSize: number): Segment[] {
  const segments: Segment[] = []
  for (let i = 0; i < entries.length; i += segmentSize) {
    segments.push({ index: segments.length, entries: entries.slice(i, i + segmentSize), active: false })
  }
  if (segments.length) segments[segments.length - 1].active = true
  return segments
}

/**
 * cleanup.policy=delete: whole segments are removed, oldest first, while their newest record is older
 * than the retention period; the first segment that is still young stops the deletion. The active
 * segment goes only when every record has expired (Kafka then rolls a new, empty one first).
 */
export function applyRetention(segments: readonly Segment[], retentionHours: number): Segment[] {
  const expired = (segment: Segment) => Math.min(...segment.entries.map((e) => e.ageHours)) > retentionHours
  const firstKept = segments.findIndex((segment) => !expired(segment))
  return firstKept === -1 ? [] : segments.slice(firstKept)
}

/**
 * cleanup.policy=compact: keep only the latest record per key. Offsets never
 * change; tombstones survive a while so consumers can see the delete.
 */
export function compact(entries: readonly LogEntry[], dropTombstones: boolean): LogEntry[] {
  const latest = new Map<string, number>()
  for (const entry of entries) latest.set(entry.key, entry.offset)
  return entries.filter((entry) => {
    if (latest.get(entry.key) !== entry.offset) return false
    return !(dropTombstones && entry.value === null)
  })
}
