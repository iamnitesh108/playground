import { hue, type Hue } from '@/shared/figures'
import styles from './ExpiryHistogram.module.css'

interface Row {
  label: string
  values: readonly number[]
  hue: Hue
}

interface Props {
  title: string
  rows: readonly Row[]
  unit: string
  /** What one column is, e.g. "s". */
  step: string
  caption?: string
}

/** One column per time step, one row per variant, on the same scale: spikes against a spread. */
export function ExpiryHistogram({ title, rows, unit, step, caption }: Props) {
  const top = Math.max(1, ...rows.flatMap((r) => r.values))
  const length = Math.max(...rows.map((r) => r.values.length))
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      {rows.map((r) => {
        const peak = Math.max(...r.values)
        return (
          <div key={r.label} className={styles.row} style={hue(r.hue)}>
            <div className={styles.rowHead}>
              <span>{r.label}</span>
              <span className={styles.peak}>peak {peak.toLocaleString()} {unit} in one {step}</span>
            </div>
            <div className={styles.bars} role="img" aria-label={`${r.label}: peak ${peak} ${unit}`}>
              {r.values.map((v, i) => (
                <span key={i} className={styles.bar} style={{ height: `${(v / top) * 100}%` }} title={`${i} ${step}: ${v} ${unit}`} />
              ))}
            </div>
          </div>
        )
      })}
      <div className={styles.axis}>
        <span>0 {step}</span>
        <span>{Math.round((length - 1) / 2)} {step}</span>
        <span>{length - 1} {step}</span>
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
