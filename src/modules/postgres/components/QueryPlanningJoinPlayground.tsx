import { useMemo, useState } from 'react'
import { hue } from '@/shared/figures/palette'
import { useInterval } from '@/shared/hooks/useInterval'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { traceJoin, type JoinAlgorithm } from '../simulation/queryPlanningJoins'
import styles from './QueryPlanning.module.css'

const ALGORITHMS: { value: JoinAlgorithm; label: string }[] = [
  { value: 'nested', label: 'nested loop' },
  { value: 'indexed', label: 'nested loop + index' },
  { value: 'hash', label: 'hash join' },
  { value: 'merge', label: 'merge join' },
]

/** Steps through one join of orders and customers with each algorithm, counting the work. */
export function QueryPlanningJoinPlayground() {
  const [alg, setAlg] = useState<JoinAlgorithm>('nested')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const reduced = useReducedMotion()
  const trace = useMemo(() => traceJoin(alg), [alg])
  const s = trace.steps[Math.min(step, trace.steps.length - 1)]
  const last = step >= trace.steps.length - 1

  useInterval(
    () => {
      if (last) setPlaying(false)
      else setStep((n) => n + 1)
    },
    playing ? (reduced ? 1600 : 700) : null,
  )

  const choose = (a: JoinAlgorithm) => {
    setAlg(a)
    setStep(0)
    setPlaying(false)
  }
  const emitted = new Set(s.output.map(([o]) => o))
  const outerLabel = alg === 'merge' ? 'orders, sorted by customer_id' : 'orders (outer)'
  const innerLabel = alg === 'merge' ? 'customers, sorted by id' : alg === 'indexed' ? 'customers via customers_pkey' : 'customers (inner)'

  return (
    <Demo
      title="Three ways to join orders to customers"
      hint="SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id — six orders, five customers. Step through and watch the comparison counter."
      controls={
        <>
          <Segmented label="algorithm" value={alg} onChange={choose} options={ALGORITHMS} />
          <Button size="sm" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0}>
            Back
          </Button>
          <Button size="sm" variant="primary" onClick={() => setStep((n) => n + 1)} disabled={last}>
            Next
          </Button>
          <Button size="sm" onClick={() => (last ? (setStep(0), setPlaying(true)) : setPlaying((p) => !p))}>
            {playing ? 'Pause' : 'Play'}
          </Button>
        </>
      }
    >
      <div className={styles.joinGrid}>
        <div className={styles.joinCol} style={hue(3)}>
          <div className={styles.joinHead}>{outerLabel}</div>
          {trace.outer.map((o, i) => (
            <div key={o.id} className={cx(styles.joinRow, s.outer === i && styles.joinCurrent, emitted.has(i) && styles.joinDone)}>
              <span>#{o.id}</span>
              <span>customer {o.customerId}</span>
            </div>
          ))}
        </div>

        {alg === 'hash' && (
          <div className={styles.joinCol} style={hue(7)}>
            <div className={styles.joinHead}>hash table (in work_mem)</div>
            {(s.buckets ?? [[], [], [], []]).map((b, k) => (
              <div key={k} className={cx(styles.bucket, s.bucket === k && styles.joinCurrent)}>
                <span className={styles.bucketNo}>bucket {k}</span>
                {b.map((j) => (
                  <span key={j} className={cx(styles.bucketItem, s.phase === 'probe' && s.inner === j && styles.joinMatch)}>
                    {trace.inner[j].id}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className={styles.joinCol} style={hue(3)}>
          <div className={styles.joinHead}>{innerLabel}</div>
          {trace.inner.map((c, j) => (
            <div
              key={c.id}
              className={cx(styles.joinRow, s.inner === j && (s.match ? styles.joinMatch : styles.joinCurrent), s.inner === j && !s.match && s.phase !== 'build' && styles.joinMiss)}
            >
              <span>id {c.id}</span>
              <span>{c.name}</span>
            </div>
          ))}
        </div>

        <div className={styles.joinCol} style={hue(6)}>
          <div className={styles.joinHead}>output</div>
          {s.output.map(([o, j]) => (
            <div key={`${o}-${j}`} className={cx(styles.joinRow, styles.joinOut)}>
              <span>#{trace.outer[o].id}</span>
              <span>{trace.inner[j].name}</span>
            </div>
          ))}
          {s.output.length === 0 && <div className={styles.muted}>nothing yet</div>}
        </div>
      </div>
      <div className={styles.joinStatus} aria-live="polite">
        <span className={styles.counterTile}>
          step {Math.min(step, trace.steps.length - 1) + 1}/{trace.steps.length}
        </span>
        <span className={styles.counterTile}>{alg === 'indexed' ? `${s.comparisons} index pages read` : `${s.comparisons} key comparison${s.comparisons === 1 ? '' : 's'}`}</span>
        <span className={styles.joinNote}>{s.note}</span>
      </div>
    </Demo>
  )
}
