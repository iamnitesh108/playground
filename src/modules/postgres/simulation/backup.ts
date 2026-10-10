/*
 * Point-in-time recovery as a pure function. A day of activity is a list of
 * events on a clock; base backups are snapshots, and the WAL archive holds one
 * segment per time slot. Restoring to a target time means: take the newest
 * base backup at or before it, then replay archived WAL up to the target.
 * Simplified: whole minutes, one segment per slot, commits apply instantly.
 */

export type BackupKind = 'full' | 'incremental'

export type TimelineEvent =
  | { at: number; kind: 'backup'; backup: BackupKind; label: string }
  | { at: number; kind: 'insert'; ids: number[]; label: string }
  | { at: number; kind: 'drop'; label: string }

export interface Scenario {
  events: readonly TimelineEvent[]
  /** Rows the table already had before the first event. */
  initialRows: readonly number[]
  /** Minutes covered by one WAL segment. */
  segmentMinutes: number
  end: number
}

export interface RestorePlan {
  ok: boolean
  /** Base backups to restore, oldest first (an incremental needs its full backup). */
  backups: TimelineEvent[]
  /** WAL segments replayed, by index. */
  replay: number[]
  /** Segment that recovery needed but the archive did not have. */
  missing: number | null
  /** Rows of the table after recovery, or null if the table does not exist. */
  rows: number[] | null
  /** Events whose changes are part of the restored database. */
  applied: TimelineEvent[]
  reason: string
}

export const segmentOf = (minute: number, scenario: Scenario): number => Math.floor(minute / scenario.segmentMinutes)

export const segmentCount = (scenario: Scenario): number => Math.ceil(scenario.end / scenario.segmentMinutes)

/** Applies data events in time order. */
export function rowsAfter(events: readonly TimelineEvent[], initial: readonly number[]): number[] | null {
  let rows: number[] | null = [...initial]
  for (const e of events) {
    if (e.kind === 'insert' && rows) rows = [...rows, ...e.ids]
    if (e.kind === 'drop') rows = null
  }
  return rows
}

/**
 * Plans a recovery to `target` (inclusive, like recovery_target_inclusive = on).
 * `lost` is the set of WAL segments missing from the archive.
 */
export function planRestore(scenario: Scenario, target: number, lost: ReadonlySet<number>): RestorePlan {
  const backups = scenario.events.filter((e): e is Extract<TimelineEvent, { kind: 'backup' }> => e.kind === 'backup' && e.at <= target)
  const base = backups.at(-1)
  if (!base) {
    return { ok: false, backups: [], replay: [], missing: null, rows: null, applied: [], reason: 'No base backup was taken before this time, so there is nothing to start from.' }
  }
  const full = [...backups].reverse().find((b) => b.backup === 'full')!
  const chain = base.backup === 'full' ? [base] : [full, base]

  const replay: number[] = []
  for (let s = segmentOf(base.at, scenario); s <= segmentOf(target, scenario); s++) {
    if (lost.has(s)) {
      return {
        ok: false,
        backups: chain,
        replay,
        missing: s,
        rows: null,
        applied: [],
        reason: `WAL segment ${s} is missing from the archive. Replay cannot skip it, so recovery stops before the target: “recovery ended before configured recovery target was reached”.`,
      }
    }
    replay.push(s)
  }

  const applied = scenario.events.filter((e) => e.kind !== 'backup' && e.at <= target)
  const rows = rowsAfter(applied, scenario.initialRows)
  return {
    ok: true,
    backups: chain,
    replay,
    missing: null,
    rows,
    applied,
    reason:
      chain.length > 1
        ? 'pg_combinebackup merges the full and incremental backups; WAL is replayed from the incremental backup’s start.'
        : 'The full backup is restored; WAL is replayed from the backup’s start.',
  }
}
