import type { CSSProperties, ReactNode } from 'react'
import { useStepper } from '@/shared/hooks/useStepper'
import { hue } from '@/shared/figures'
import { Button } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import type { HeapTuple } from '../data/types'
import { HeapPageView } from './HeapPageView'
import { SESSION_HUE } from './SessionPlayerColours'
import styles from './SessionPlayer.module.css'
import { Highlighted } from '@/shared/code'

/** What one statement returned, as recorded (readonly so recorded `as const` data fits). */
export type PlayerResult =
  | { readonly kind: 'rows'; readonly columns: readonly string[]; readonly rows: readonly (readonly unknown[])[]; readonly unblocked?: boolean }
  | { readonly kind: 'tag'; readonly tag: string; readonly unblocked?: boolean }
  | { readonly kind: 'error'; readonly code: string; readonly message: string; readonly detail: string | null; readonly hint?: string; readonly unblocked?: boolean }
  | { readonly kind: 'blocked' }

/**
 * One recorded step of a multi-session scenario. The shared `Frame` (two sessions, with a heap page)
 * fits this shape, and so do the 2–4 session recordings without a page.
 */
export interface PlayerFrame {
  /** The statement run in this step; `s: '*'` marks a step where only time passes. */
  readonly step: { readonly s: string; readonly sql: string } | null
  readonly results: { readonly [session: string]: PlayerResult | undefined }
  readonly sessions: { readonly [session: string]: { readonly xid: string | null; readonly state: string | null; readonly waiting: boolean } }
  readonly page?: readonly HeapTuple[] | null
  readonly xids?: Record<string, string>
}

interface SessionPlayerProps<F extends PlayerFrame> {
  title: string
  frames: readonly F[]
  /** Data columns of the table shown in the page view. */
  columns?: readonly string[]
  /** One caption per step (frames.length - 1). */
  notes: readonly ReactNode[]
  showPage?: boolean
  /** Sessions shown, in order (default: those recorded in the first frame). */
  sessions?: readonly string[]
  /** Optional panel under the caption for the current step (e.g. pg_locks). */
  aside?: (frame: F, index: number) => ReactNode
  /** Caption shown before the first step. */
  intro?: ReactNode
}

interface Entry {
  sql: string
  step: number
  result: PlayerResult
  waitedFrom?: number
}

/** Rebuilds what each session's terminal shows after `upTo` steps. */
function history(frames: readonly PlayerFrame[], session: string, upTo: number): Entry[] {
  const entries: Entry[] = []
  for (let i = 1; i <= upTo; i++) {
    const frame = frames[i]
    const result = frame.results[session]
    if (frame.step?.s === session && result) {
      entries.push({ sql: frame.step.sql, step: i, result })
    } else if (result && 'unblocked' in result && result.unblocked) {
      const waiting = [...entries].reverse().find((e) => e.result.kind === 'blocked')
      if (waiting) {
        waiting.waitedFrom = waiting.step
        waiting.result = result
        waiting.step = i
      }
    }
  }
  return entries
}

function Result({ result }: { result: PlayerResult }) {
  switch (result.kind) {
    case 'blocked':
      return <div className={styles.waiting}>waiting for a lock…</div>
    case 'tag':
      return <div className={styles.tag}>{result.tag}</div>
    case 'error':
      return (
        <div className={styles.error}>
          <div>ERROR: {result.message}</div>
          {result.detail && <div className={styles.detail}>DETAIL: {result.detail}</div>}
          <div className={styles.detail}>SQLSTATE {result.code}</div>
        </div>
      )
    case 'rows':
      return (
        <table className={styles.rows}>
          <thead>
            <tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>{row.map((v, j) => <td key={j}>{String(v)}</td>)}</tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={result.columns.length}>(0 rows)</td>
              </tr>
            )}
          </tbody>
        </table>
      )
  }
}

function Terminal({ session, frames, index }: { session: string; frames: readonly PlayerFrame[]; index: number }) {
  const entries = history(frames, session, index)
  const state = frames[index].sessions[session] ?? { xid: null, state: null, waiting: false }
  return (
    <div className={cx(styles.terminal, state.waiting && styles.blocked)} style={hue(SESSION_HUE[session])}>
      <div className={styles.termHead}>
        <span className={styles.termName}>Session {session}</span>
        <span className={styles.termState}>
          {state.waiting ? 'waiting for a lock' : state.state ?? '—'}
          {state.xid && <> · xid {state.xid}</>}
        </span>
      </div>
      <div className={styles.lines}>
        {entries.length === 0 && <div className={styles.idle}>—</div>}
        {entries.map((e) => (
          <div key={`${e.step}-${e.sql}`} className={cx(styles.entry, e.step === index && styles.current)}>
            <div className={styles.sql}>
              <span className={styles.prompt}>{session.toLowerCase()}=#</span> <Highlighted code={`${e.sql};`} language="sql" />
            </div>
            {e.waitedFrom !== undefined && <div className={styles.waited}>(waited since step {e.waitedFrom})</div>}
            <Result result={e.result} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Replays a recorded scenario of two or more sessions, step by step. */
export function SessionPlayer<F extends PlayerFrame>({ title, frames, columns = [], notes, showPage = true, sessions, aside, intro }: SessionPlayerProps<F>) {
  const stepper = useStepper(frames.length, 2600)
  const i = stepper.index
  const frame = frames[i]
  const shown = sessions ?? Object.keys(frames[0].sessions)
  const page = showPage ? frame.page : null

  return (
    <section className={styles.player}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Replay · recorded on PostgreSQL 18</div>
        <h4 className={styles.title}>{title}</h4>
      </header>

      <div className={styles.terminals} style={{ '--sessions': shown.length } as CSSProperties} data-sessions={shown.length}>
        {shown.map((s) => (
          <Terminal key={s} session={s} frames={frames} index={i} />
        ))}
      </div>

      <div className={styles.caption} aria-live="polite">
        <span className={styles.counter}>
          {i}/{frames.length - 1}
        </span>
        {i === 0 ? (intro ?? (page ? 'Start: the table as it is before either session does anything. Press Next.' : 'Start: no session has run anything yet. Press Next.')) : notes[i - 1]}
      </div>

      {aside && <div className={styles.aside}>{aside(frame, i)}</div>}

      {page && (
        <div className={styles.page}>
          <div className={styles.pageTitle}>The table’s page (pageinspect)</div>
          <HeapPageView tuples={page} previous={i > 0 ? (frames[i - 1].page ?? undefined) : undefined} xids={frame.xids ?? {}} columns={columns} />
        </div>
      )}

      <footer className={styles.controls}>
        <div className={styles.dots}>
          {frames.map((_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`Go to step ${k}`}
              className={cx(styles.dot, k === i && styles.dotActive, k < i && styles.dotDone)}
              onClick={() => stepper.goTo(k)}
            />
          ))}
        </div>
        <div className={styles.buttons}>
          <Button size="sm" variant="ghost" onClick={stepper.reset} disabled={stepper.isFirst}>
            Reset
          </Button>
          <Button size="sm" onClick={stepper.previous} disabled={stepper.isFirst}>
            Back
          </Button>
          <Button size="sm" onClick={stepper.togglePlay}>
            {stepper.playing ? 'Pause' : 'Play'}
          </Button>
          <Button size="sm" variant="primary" onClick={stepper.next} disabled={stepper.isLast}>
            Next
          </Button>
        </div>
      </footer>
    </section>
  )
}
