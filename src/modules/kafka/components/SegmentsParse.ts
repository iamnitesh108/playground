/** The files of one segment, read from a recorded `ls -l` of a partition directory (sizes in bytes). */
export interface SegmentFiles {
  readonly base: number
  readonly log: number
  readonly index?: number
  readonly timeindex?: number
  readonly snapshot?: number
  /** Renamed to *.deleted by retention, waiting for file.delete.delay.ms. */
  readonly deleted: boolean
}

/** `ls -l` lines → one entry per segment, oldest first. Files that are not segment files are skipped. */
export function parseSegmentDir(out: string): SegmentFiles[] {
  const byBase = new Map<number, Record<string, number | boolean>>()
  for (const line of out.split('\n')) {
    const cols = line.trim().split(/\s+/)
    const m = /^(\d{20})\.(log|index|timeindex|snapshot)(\.deleted)?$/.exec(cols.at(-1) ?? '')
    if (!m) continue
    const base = Number(m[1])
    const seg = byBase.get(base) ?? { deleted: false }
    seg[m[2]] = Number(cols[4])
    if (m[3]) seg.deleted = true
    byBase.set(base, seg)
  }
  return [...byBase.entries()]
    .sort(([a], [b]) => a - b)
    .map(([base, f]) => ({ base, log: (f.log as number) ?? 0, index: f.index as number | undefined, timeindex: f.timeindex as number | undefined, snapshot: f.snapshot as number | undefined, deleted: f.deleted as boolean }))
}

/** Bytes as people read them: 504 B, 1 012.8 KB, 10.0 MB. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** "payments:0:2048" → 2048. */
export const offsetOf = (out: string) => Number(out.trim().split(':').at(-1))
