import { useState, type ReactNode } from 'react'
import { hue, type Hue } from '@/shared/figures'
import { Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { SessionPlayer, type PlayerFrame } from './SessionPlayer'
import styles from './IsolationExplorer.module.css'

/** One recorded run of an anomaly scenario at one isolation level. */
export interface IsolationRun<F extends PlayerFrame = PlayerFrame> {
  readonly frames: readonly F[]
  /** Did the anomaly show up in the recorded outcome? */
  readonly happened: boolean
  /** One line, from the recorded values, that shows it. */
  readonly evidence: string
  readonly error: { readonly code: string; readonly session: string; readonly step: number } | null
}

export interface Anomaly {
  id: string
  label: string
  /** A sentence: what goes wrong. */
  what: string
}

type Verdict = 'happens' | 'prevented' | 'aborted'
const verdictOf = (run: IsolationRun): Verdict => (run.happened ? 'happens' : run.error ? 'aborted' : 'prevented')
const LOOK: Record<Verdict, { hue: Hue; mark: string; text: (run: IsolationRun) => string }> = {
  happens: { hue: 8, mark: '✕', text: () => 'happens' },
  prevented: { hue: 6, mark: '✓', text: () => 'prevented' },
  aborted: { hue: 6, mark: '↻', text: (r) => `prevented: ${r.error?.code} for ${r.error?.session}` },
}

interface IsolationExplorerProps<F extends PlayerFrame> {
  anomalies: readonly Anomaly[]
  levels: readonly { value: string; label: string }[]
  run: (anomaly: string, level: string) => IsolationRun<F>
  notes: (anomaly: string, level: string) => readonly ReactNode[]
  aside?: (anomaly: string, level: string) => ((frame: F, index: number) => ReactNode) | undefined
}

/**
 * The anomaly × level matrix, every cell decided by a recorded run — and the replay of the
 * cell you pick, so the verdict can be checked statement by statement.
 */
export function IsolationExplorer<F extends PlayerFrame>({ anomalies, levels, run, notes, aside }: IsolationExplorerProps<F>) {
  const [anomaly, setAnomaly] = useState(anomalies[1].id)
  const [level, setLevel] = useState(levels[1].value)
  const current = run(anomaly, level)
  const a = anomalies.find((x) => x.id === anomaly)!
  const levelLabel = levels.find((l) => l.value === level)!.label
  return (
    <section className={styles.explorer}>
      <figure className={styles.figure}>
        <figcaption className={styles.title}>Recorded on PostgreSQL 18: does the anomaly happen? Pick a cell to replay it.</figcaption>
        <div className={styles.scroll}>
          <div className={styles.grid} style={{ gridTemplateColumns: `minmax(130px, 1.2fr) repeat(${levels.length}, minmax(96px, 1fr))` }} role="grid">
            <span />
            {levels.map((l) => (
              <span key={l.value} className={cx(styles.head, l.value === level && styles.headOn)}>
                {l.label}
              </span>
            ))}
            {anomalies.map((an) => (
              <div key={an.id} className={styles.row} role="row">
                <span className={cx(styles.rowLabel, an.id === anomaly && styles.rowOn)}>{an.label}</span>
                {levels.map((l) => {
                  const r = run(an.id, l.value)
                  const v = verdictOf(r)
                  const on = an.id === anomaly && l.value === level
                  return (
                    <button
                      key={l.value}
                      type="button"
                      className={cx(styles.cell, on && styles.cellOn)}
                      style={hue(LOOK[v].hue)}
                      onClick={() => {
                        setAnomaly(an.id)
                        setLevel(l.value)
                      }}
                      aria-pressed={on}
                      title={r.evidence}
                    >
                      <span className={styles.mark} aria-hidden="true">{LOOK[v].mark}</span>
                      <span>{LOOK[v].text(r)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </figure>

      <div className={styles.controls}>
        <Segmented label="Anomaly" value={anomaly} options={anomalies.map((x) => ({ value: x.id, label: x.label }))} onChange={setAnomaly} />
        <Segmented label="Level" value={level} options={levels} onChange={setLevel} />
      </div>
      <p className={styles.what}>
        <strong>{a.label}:</strong> {a.what} <span className={styles.evidence}>Recorded outcome at {levelLabel}: {current.evidence}.</span>
      </p>
      <SessionPlayer
        key={`${anomaly}|${level}`}
        title={`${a.label} under ${levelLabel}`}
        frames={current.frames}
        notes={notes(anomaly, level)}
        showPage={false}
        aside={aside?.(anomaly, level)}
        intro="Start: no session has run anything yet. Press Next to step through the recorded statements."
      />
    </section>
  )
}
