import type { ReactNode } from 'react'
import { useStepper } from '@/shared/hooks/useStepper'
import { Button } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import type { Frame, SessionId, StepResult } from '../data/types'
import { HeapPageView } from './HeapPageView'
import styles from './SessionPlayer.module.css'

interface SessionPlayerProps {
  title: string
  frames: readonly Frame[]
  /** Data columns of the table shown in the page view. */
  columns: readonly string[]
  /** One caption per step (frames.length - 1). */
  notes: readonly ReactNode[]
  showPage?: boolean
}

interface Entry {
  sql: string
  step: number
  result: StepResult
  waitedFrom?: number
}

/** Rebuilds what each session's terminal shows after `upTo` steps. */
function history(frames: readonly Frame[], session: SessionId, upTo: number): Entry[] {
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

function Result({ result }: { result: StepResult }) {
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

function Terminal({ session, frames, index }: { session: SessionId; frames: readonly Frame[]; index: number }) {
  const entries = history(frames, session, index)
  const state = frames[index].sessions[session]
  return (
    <div className={styles.terminal}>
      <div className={styles.termHead}>
        <span className={styles.termName}>Session {session}</span>
        <span className={styles.termState}>
          {state.waiting ? 'waiting for lock' : state.state ?? '—'}
          {state.xid && <> · xid {state.xid}</>}
        </span>
      </div>
      <div className={styles.lines}>
        {entries.length === 0 && <div className={styles.idle}>—</div>}
        {entries.map((e) => (
          <div key={`${e.step}-${e.sql}`} className={cx(styles.entry, e.step === index && styles.current)}>
            <div className={styles.sql}>
              <span className={styles.prompt}>{session.toLowerCase()}=#</span> {e.sql};
            </div>
            {e.waitedFrom !== undefined && <div className={styles.waited}>(waited since step {e.waitedFrom})</div>}
            <Result result={e.result} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Replays a recorded two-session scenario, step by step. */
export function SessionPlayer({ title, frames, columns, notes, showPage = true }: SessionPlayerProps) {
  const stepper = useStepper(frames.length, 2600)
  const i = stepper.index
  const frame = frames[i]

  return (
    <section className={styles.player}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Replay · recorded on PostgreSQL 18</div>
        <h4 className={styles.title}>{title}</h4>
      </header>

      <div className={styles.terminals}>
        <Terminal session="A" frames={frames} index={i} />
        <Terminal session="B" frames={frames} index={i} />
      </div>

      <div className={styles.caption} aria-live="polite">
        <span className={styles.counter}>
          {i}/{frames.length - 1}
        </span>
        {i === 0 ? 'Start: the table as it is before either session does anything. Press Next.' : notes[i - 1]}
      </div>

      {showPage && (
        <div className={styles.page}>
          <div className={styles.pageTitle}>The table’s page (pageinspect)</div>
          <HeapPageView tuples={frame.page} previous={i > 0 ? frames[i - 1].page : undefined} xids={frame.xids} columns={columns} />
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
