import { hue } from '@/shared/figures'
import type { WeightEvent } from '../data/runtimeTypes'
import styles from './MemoryWeightTrace.module.css'

const kb = (b: number) => `${Math.round(b / 1000)} KB`

/**
 * A recorded weight-bounded cache, step by step: the entries present drawn to scale inside the byte budget,
 * the entry just written, and what left (evicted, rejected or replaced).
 */
export function MemoryWeightTrace({ title, steps, budget }: { title: string; steps: readonly WeightEvent[]; budget: number }) {
  const sizes = new Map<string, number>()
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.rows}>
        {steps.map((s, i) => {
          if (s.op === 'put') sizes.set(s.key, s.bytes)
          const left = s.evicted.map((e) => e.replace(/ \(.*\)$/, ''))
          const newcomerRejected = s.op === 'put' && !s.present.includes(s.key)
          return (
            <div key={i} className={styles.row}>
              <div className={styles.op}>
                <code>{s.op} {s.key}</code>
                {s.op === 'put' && <span className={styles.bytes}>{kb(s.bytes)}</span>}
              </div>
              <div className={styles.track} aria-label={`present: ${s.present.join(', ') || 'none'}; ${s.weightedSize.toLocaleString()} of ${budget.toLocaleString()} bytes`}>
                {s.present.map((k) => (
                  <span
                    key={k}
                    className={styles.block}
                    style={{ ...hue(k === s.key && s.op === 'put' ? 6 : 3), width: `${((sizes.get(k) ?? 0) / budget) * 100}%` }}
                    title={`${k}: ${kb(sizes.get(k) ?? 0)}`}
                  >
                    {k}
                  </span>
                ))}
              </div>
              <div className={styles.outcome}>
                <span className={styles.used}>{kb(s.weightedSize)}</span>
                {s.evicted.map((e, j) => (
                  <span key={e} className={styles.left} style={hue(8)}>
                    {left[j] === s.key && newcomerRejected ? `${left[j]} rejected` : e.includes('(set)') || e.includes('REPLACED') ? `${left[j]} replaced` : `${left[j]} evicted`}
                  </span>
                ))}
                {newcomerRejected && s.evicted.length === 0 && <span className={styles.left} style={hue(8)}>{s.key} not stored</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className={styles.legend}>
        <span style={hue(3)}><i /> entry in the cache</span>
        <span style={hue(6)}><i /> just written and kept</span>
        <span style={hue(8)}><i /> left the cache (or never got in)</span>
        <span>track = the {budget >= 1e6 ? `${budget / 1e6} MB` : kb(budget)} budget</span>
      </div>
    </figure>
  )
}
