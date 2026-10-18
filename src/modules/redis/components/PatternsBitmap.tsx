import { cx } from '@/shared/utils/cx'
import styles from './PatternsBitmap.module.css'

interface PatternsBitmapProps {
  title: string
  /** Rows of bits, e.g. two days and their AND. */
  rows: readonly { label: string; bits: readonly (0 | 1)[]; result?: boolean }[]
  caption?: string
}

/** A bitmap drawn bit by bit: position n = user id n, filled = 1. */
export function PatternsBitmap({ title, rows, caption }: PatternsBitmapProps) {
  const n = rows[0]?.bits.length ?? 0
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.grid} style={{ gridTemplateColumns: `minmax(110px, auto) repeat(${n}, minmax(14px, 1fr)) auto` }}>
        <span />
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={styles.index}>{i}</span>
        ))}
        <span className={styles.index}>BITCOUNT</span>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <span className={cx(styles.label, r.result && styles.resultLabel)}>{r.label}</span>
            {r.bits.map((b, i) => (
              <span key={i} className={cx(styles.bit, b === 1 && (r.result ? styles.onResult : styles.on))}>{b}</span>
            ))}
            <span className={styles.count}>{r.bits.filter(Boolean).length}</span>
          </div>
        ))}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
