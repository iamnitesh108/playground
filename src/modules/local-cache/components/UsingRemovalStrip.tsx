import { hue } from '@/shared/figures'
import { CAUSE_HUE, type ParsedRemoval } from './UsingCauses'
import styles from './UsingFigures.module.css'

interface Props {
  title: string
  ops: readonly string[]
  rows: readonly { label: string; removals: readonly ParsedRemoval[] }[]
  caption?: string
}

/** The same operations on each library, and the removals each one reported, in order. */
export function UsingRemovalStrip({ title, ops, rows, caption }: Props) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.ops} aria-label="operations">
        {ops.map((op, i) => <span key={i} className={styles.op}>{op}</span>)}
      </div>
      <div className={styles.rows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <strong>{row.label}</strong>
            <div className={styles.chips}>
              {row.removals.map((r, i) => (
                <span key={i} className={styles.chip} style={hue(CAUSE_HUE[r.cause])} title={`library name: ${r.native}`}>
                  <span className={styles.chipKey}>{r.key}={r.value}</span>
                  <span className={styles.chipCause}>{r.cause}{r.native !== r.cause ? ` (${r.native})` : ''}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
