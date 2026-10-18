import { useState } from 'react'
import styles from './Charts.module.css'

export interface Bar {
  label: string
  value: number
  /** Shown instead of the number, e.g. "1,000 of 1,000". */
  display?: string
  emphasis?: boolean
  note?: string
}

interface BarListProps {
  title: string
  bars: readonly Bar[]
  max?: number
  unit?: string
}

/** Horizontal bars for comparing one measure across a few items, labelled directly. */
export function BarList({ title, bars, max, unit = '' }: BarListProps) {
  const [hover, setHover] = useState<number | null>(null)
  const top = max ?? Math.max(...bars.map((b) => b.value), 1)
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.bars}>
        {bars.map((b, i) => (
          <div key={b.label} className={styles.barRow} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className={styles.barLabel}>{b.label}</span>
            <span className={styles.barTrack}>
              <span className={b.emphasis ? styles.barMain : styles.barOther} style={{ width: `${Math.max(0.5, (b.value / top) * 100)}%` }} />
            </span>
            <span className={styles.barValue}>{b.display ?? `${b.value.toLocaleString()}${unit}`}</span>
            {hover === i && b.note && <span className={styles.barNote}>{b.note}</span>}
          </div>
        ))}
      </div>
    </figure>
  )
}
