import { useState } from 'react'
import { hue, type Hue } from '@/shared/figures'
import { useInterval } from '@/shared/hooks/useInterval'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { STATEMENTS, arrive, blockers, emptyQueue, pileUp, setLockTimeout, tick, waited, type QueueSession, type QueueState } from '../simulation/locksQueue'
import styles from './LocksQueuePlayground.module.css'

const STATE_HUE: Record<QueueSession['state'], Hue | undefined> = { running: 6, waiting: 8, done: undefined, 'timed out': 8 }

type Timeout = 'off' | '2' | '5'
const toSeconds = (t: Timeout) => (t === 'off' ? null : Number(t))

/** One session's bar: waiting (striped) then running (solid), on a shared time axis. */
function Bar({ s, now, span }: { s: QueueSession; now: number; span: number }) {
  const end = s.ended ?? now
  const startRun = s.started
  const pct = (t: number) => `${(t / span) * 100}%`
  return (
    <span className={styles.track} aria-hidden="true">
      {(startRun ?? end) > s.arrived && <span className={styles.wait} style={{ left: pct(s.arrived), width: pct((startRun ?? end) - s.arrived) }} />}
      {startRun !== null && <span className={styles.run} style={{ left: pct(startRun), width: pct(Math.max(0.15, (s.state === 'running' ? now : end) - startRun)) }} />}
      <span className={styles.now} style={{ left: pct(now) }} />
    </span>
  )
}

/** A table's lock queue: add statements, let time pass, and watch who waits for whom. */
export function LocksQueuePlayground() {
  const [timeout, setTimeoutOpt] = useState<Timeout>('off')
  const [state, setState] = useState<QueueState>(() => pileUp(null))
  const [playing, setPlaying] = useState(false)
  useInterval(() => setState((s) => tick(s)), playing ? 700 : null)

  const span = Math.max(16, state.time + 2)
  const waiting = state.sessions.filter((s) => s.state === 'waiting')
  const longest = Math.max(0, ...state.sessions.filter((s) => s.kind.id !== 'report').map((s) => waited(state, s)))

  return (
    <Demo
      title="Lock queue on table orders"
      hint="Starts with the pile-up: a 10 s report holds ACCESS SHARE, an ALTER TABLE waits for ACCESS EXCLUSIVE, and ordinary queries queue behind the ALTER. Play, add statements, or give the migration a lock_timeout."
      controls={
        <>
          <Segmented
            label="migration lock_timeout"
            value={timeout}
            options={[
              { value: 'off', label: '0 (wait forever)' },
              { value: '2', label: '2 s' },
              { value: '5', label: '5 s' },
            ]}
            onChange={(t) => {
              setTimeoutOpt(t)
              setState((s) => setLockTimeout(s, toSeconds(t)))
            }}
          />
          <Button size="sm" variant="primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button size="sm" disabled={playing} onClick={() => setState((s) => tick(s))}>
            +1 s
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setPlaying(false); setState(pileUp(toSeconds(timeout))) }}>
            Pile-up
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setPlaying(false); setState(emptyQueue(toSeconds(timeout))) }}>
            Empty
          </Button>
        </>
      }
    >
      <div className={styles.add}>
        <span className={styles.addLabel}>Run a new statement:</span>
        {STATEMENTS.map((k) => (
          <button key={k.id} type="button" className={styles.addButton} onClick={() => setState((s) => arrive(s, k))} title={`${k.sql} — takes ${k.mode}, runs ${k.seconds} s`}>
            + {k.label}
          </button>
        ))}
      </div>

      <div className={styles.scroll}>
        <div className={styles.table} role="table" aria-label="sessions and their locks">
          <div className={cx(styles.row, styles.headRow)} role="row">
            <span>#</span>
            <span>statement · lock mode</span>
            <span>state</span>
            <span>waits for</span>
            <span>0 s … {span} s</span>
          </div>
          {state.sessions.length === 0 && <div className={styles.empty}>No statements yet. Add one above.</div>}
          {state.sessions.map((s) => {
            const by = blockers(state, s)
            return (
              <div key={s.id} className={cx(styles.row, s.state === 'done' && styles.finished)} role="row">
                <span className={styles.id}>#{s.id}</span>
                <span className={styles.stmt}>
                  <span className={styles.sql}>{s.kind.sql}</span>
                  <span className={styles.mode}>{s.kind.mode}</span>
                </span>
                <span className={styles.state} style={hue(STATE_HUE[s.state])}>
                  {s.state}
                  {s.state === 'waiting' && ` ${waited(state, s)} s`}
                </span>
                <span className={styles.by}>
                  {by.length ? by.map((b) => <span key={b.id} className={styles.blocker}>#{b.id}</span>) : <span className={styles.faint}>—</span>}
                </span>
                <Bar s={s} now={state.time} span={span} />
              </div>
            )
          })}
        </div>
      </div>

      <dl className={styles.stats}>
        <div>
          <dt>time</dt>
          <dd>{state.time} s</dd>
        </div>
        <div>
          <dt>waiting now</dt>
          <dd>{waiting.length}</dd>
        </div>
        <div>
          <dt>longest wait (not counting the report)</dt>
          <dd>{longest} s</dd>
        </div>
        <div>
          <dt>timed out</dt>
          <dd>{state.sessions.filter((s) => s.state === 'timed out').length}</dd>
        </div>
      </dl>
      <div className={styles.legend}>
        <span><i className={styles.legendWait} /> waiting for a lock</span>
        <span><i className={styles.legendRun} /> holding its lock, running</span>
      </div>
    </Demo>
  )
}
