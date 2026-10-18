/*
 * The lock queue of one table, reduced to what decides waiting: each statement asks for one
 * table-level lock mode, holds it while it runs, and releases it when it ends.
 *
 * A request is granted only if it conflicts neither with a granted lock nor with a request that
 * is already waiting ahead of it. The second rule keeps an ALTER TABLE from starving — and is why
 * everything queues up behind it. Time advances in whole seconds.
 */

export type LockMode =
  | 'ACCESS SHARE'
  | 'ROW SHARE'
  | 'ROW EXCLUSIVE'
  | 'SHARE UPDATE EXCLUSIVE'
  | 'SHARE'
  | 'SHARE ROW EXCLUSIVE'
  | 'EXCLUSIVE'
  | 'ACCESS EXCLUSIVE'

/** Weakest first. */
export const LOCK_MODES: readonly LockMode[] = [
  'ACCESS SHARE',
  'ROW SHARE',
  'ROW EXCLUSIVE',
  'SHARE UPDATE EXCLUSIVE',
  'SHARE',
  'SHARE ROW EXCLUSIVE',
  'EXCLUSIVE',
  'ACCESS EXCLUSIVE',
]

/** The table-level conflict table of the PostgreSQL documentation (and of the recorded matrix). */
const CONFLICTS: Record<LockMode, readonly LockMode[]> = {
  'ACCESS SHARE': ['ACCESS EXCLUSIVE'],
  'ROW SHARE': ['EXCLUSIVE', 'ACCESS EXCLUSIVE'],
  'ROW EXCLUSIVE': ['SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
  'SHARE UPDATE EXCLUSIVE': ['SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
  SHARE: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
  'SHARE ROW EXCLUSIVE': ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
  EXCLUSIVE: ['ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
  'ACCESS EXCLUSIVE': LOCK_MODES,
}

export const conflicts = (a: LockMode, b: LockMode): boolean => CONFLICTS[a].includes(b)

/** A kind of statement a session can run against the table. */
export interface StatementKind {
  readonly id: string
  readonly label: string
  readonly sql: string
  readonly mode: LockMode
  /** Seconds it runs once it has its lock. */
  readonly seconds: number
  /** Schema changes are the statements a migration would run with lock_timeout. */
  readonly migration: boolean
}

export const STATEMENTS: readonly StatementKind[] = [
  { id: 'select', label: 'SELECT', sql: 'SELECT … WHERE id = $1', mode: 'ACCESS SHARE', seconds: 1, migration: false },
  { id: 'report', label: 'long report', sql: 'SELECT … (a 10 s report)', mode: 'ACCESS SHARE', seconds: 10, migration: false },
  { id: 'update', label: 'UPDATE', sql: 'UPDATE … WHERE id = $1', mode: 'ROW EXCLUSIVE', seconds: 1, migration: false },
  { id: 'vacuum', label: 'VACUUM', sql: 'VACUUM orders', mode: 'SHARE UPDATE EXCLUSIVE', seconds: 5, migration: false },
  { id: 'cic', label: 'CREATE INDEX CONCURRENTLY', sql: 'CREATE INDEX CONCURRENTLY …', mode: 'SHARE UPDATE EXCLUSIVE', seconds: 6, migration: true },
  { id: 'index', label: 'CREATE INDEX', sql: 'CREATE INDEX …', mode: 'SHARE', seconds: 6, migration: true },
  { id: 'alter', label: 'ALTER TABLE', sql: 'ALTER TABLE orders ADD COLUMN …', mode: 'ACCESS EXCLUSIVE', seconds: 1, migration: true },
]

export type SessionState = 'waiting' | 'running' | 'done' | 'timed out'

export interface QueueSession {
  readonly id: number
  readonly kind: StatementKind
  readonly state: SessionState
  readonly arrived: number
  readonly started: number | null
  readonly ended: number | null
  /** Seconds of work left while running. */
  readonly left: number
}

export interface QueueState {
  readonly time: number
  readonly sessions: readonly QueueSession[]
  /** lock_timeout (s) that migrations set; null = wait forever (the default 0). */
  readonly lockTimeout: number | null
}

export const emptyQueue = (lockTimeout: number | null = null): QueueState => ({ time: 0, sessions: [], lockTimeout })

/** Sessions that hold a lock or are ahead in the queue with a conflicting request (what pg_blocking_pids reports). */
export function blockers(state: QueueState, s: QueueSession): QueueSession[] {
  if (s.state !== 'waiting') return []
  return state.sessions.filter(
    (o) => o.id !== s.id && conflicts(o.kind.mode, s.kind.mode) && (o.state === 'running' || (o.state === 'waiting' && o.id < s.id)),
  )
}

/** Grants every waiting request that can run now, in queue order. */
function grant(state: QueueState): QueueState {
  let sessions = state.sessions
  for (const s of sessions) {
    if (s.state !== 'waiting') continue
    const current: QueueState = { ...state, sessions }
    if (blockers(current, s).length === 0) {
      sessions = sessions.map((o) => (o.id === s.id ? { ...o, state: 'running', started: state.time, left: o.kind.seconds } : o))
    }
  }
  return { ...state, sessions }
}

/** A new statement arrives and asks for its lock. */
export function arrive(state: QueueState, kind: StatementKind): QueueState {
  const id = state.sessions.reduce((m, s) => Math.max(m, s.id), 0) + 1
  const session: QueueSession = { id, kind, state: 'waiting', arrived: state.time, started: null, ended: null, left: kind.seconds }
  return grant({ ...state, sessions: [...state.sessions, session] })
}

/** One second passes: running statements progress and release, waiting migrations may time out. */
export function tick(state: QueueState): QueueState {
  const time = state.time + 1
  const sessions = state.sessions.map((s): QueueSession => {
    if (s.state === 'running') return s.left <= 1 ? { ...s, state: 'done', left: 0, ended: time } : { ...s, left: s.left - 1 }
    if (s.state === 'waiting' && s.kind.migration && state.lockTimeout !== null && time - s.arrived >= state.lockTimeout) return { ...s, state: 'timed out', ended: time }
    return s
  })
  return grant({ ...state, time, sessions })
}


/** Seconds a session has waited so far (or in total, once it got its lock). */
export const waited = (state: QueueState, s: QueueSession): number => (s.started ?? s.ended ?? state.time) - s.arrived

/** The pile-up: a long report, then a migration, then ordinary traffic. */
export function pileUp(lockTimeout: number | null): QueueState {
  const kind = (id: string) => STATEMENTS.find((k) => k.id === id)!
  let s = arrive(emptyQueue(lockTimeout), kind('report'))
  s = tick(s)
  s = arrive(s, kind('alter'))
  s = tick(s)
  s = arrive(s, kind('select'))
  s = arrive(s, kind('update'))
  s = tick(s)
  s = arrive(s, kind('select'))
  return s
}
