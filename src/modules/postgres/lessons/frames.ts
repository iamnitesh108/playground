import type { Frame, SessionId } from '../data/types'
import type { PlayerFrame, PlayerResult } from '../components/SessionPlayer'
import { SCENARIOS } from '../data/scenarios'

/** A recorded scenario by name. */
export const scenario = (name: string): readonly Frame[] => SCENARIOS[name]

/** The transaction id a session held after the given step, as recorded. */
export const xidAt = (frames: readonly Frame[], step: number, session: SessionId): string => frames[step].sessions[session].xid ?? '?'

/** The xmin of the tuple at a line pointer after the given step, as recorded. */
export const xminAt = (frames: readonly Frame[], step: number, lp: number): string => frames[step].page.find((t) => t.lp === lp)?.xmin ?? '?'

/** The xmax of the tuple at a line pointer after the given step, as recorded. */
export const xmaxAt = (frames: readonly Frame[], step: number, lp: number): string => frames[step].page.find((t) => t.lp === lp)?.xmax ?? '?'

// ---------------------------------------------------------------------------
// Helpers for any recorded multi-session scenario (SessionPlayer's PlayerFrame)
// ---------------------------------------------------------------------------

/** What a session's statement at `step` returned — also when the answer came later because it waited. */
export function resultAt(frames: readonly PlayerFrame[], step: number, session: string): PlayerResult | undefined {
  const r = frames[step]?.results[session]
  if (r && r.kind !== 'blocked') return r
  for (let i = step + 1; i < frames.length; i++) {
    const later = frames[i].results[session]
    if (later && 'unblocked' in later && later.unblocked) return later
  }
  return r
}

/** The first column of the first row a statement returned, as text ('' when it returned no rows). */
export function valueAt(frames: readonly PlayerFrame[], step: number, session: string): string {
  const r = resultAt(frames, step, session)
  return r?.kind === 'rows' ? String(r.rows[0]?.[0] ?? '') : ''
}

/** A one-line summary of a result: the value, the command tag or the SQLSTATE. */
export function outcomeAt(frames: readonly PlayerFrame[], step: number, session: string): string {
  const r = resultAt(frames, step, session)
  if (!r) return '—'
  if (r.kind === 'rows') return r.rows.map((row) => row.join(', ')).join('; ') || '(0 rows)'
  if (r.kind === 'tag') return r.tag
  if (r.kind === 'error') return `ERROR ${r.code}`
  return 'waiting'
}

/** The step at which a session's statement finished (the step itself, or the step that unblocked it). */
export function finishedAt(frames: readonly PlayerFrame[], step: number, session: string): number {
  if (frames[step]?.results[session]?.kind !== 'blocked') return step
  for (let i = step + 1; i < frames.length; i++) if (frames[i].results[session]?.kind && frames[i].results[session]?.kind !== 'blocked') return i
  return frames.length - 1
}
