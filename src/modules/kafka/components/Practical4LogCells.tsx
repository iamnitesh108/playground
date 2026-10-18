import type { ReactNode } from 'react'
import { hue, type Hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import styles from './Practical4LogCells.module.css'

export interface LogCellSpec {
  offset: number
  /** Main text of the cell (a value, or COMMIT / ABORT for a marker). */
  text: string
  /** Small text under it (a kind, a worker, a delivery count). */
  note?: string
  hue: Hue
  /** Hatched: a control record, or something that is never delivered. */
  striped?: boolean
}

export interface LogReader {
  label: string
  hue: Hue
  /** Offset → what this reader got there (absent: nothing). */
  got: Readonly<Record<number, string>>
}

interface Props {
  title: string
  partition: string
  cells: readonly LogCellSpec[]
  readers?: readonly LogReader[]
  caption?: ReactNode
}

/** One partition as numbered cells, with rows underneath showing what each reader received at each offset. */
export function Practical4LogCells({ title, partition, cells, readers = [], caption }: Props) {
  const cols = { gridTemplateColumns: `max-content repeat(${cells.length}, minmax(72px, 1fr))` }
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.scroll}>
        <div className={styles.grid} style={cols}>
          <div className={styles.rowLabel}>offset</div>
          {cells.map((c) => (
            <div key={`o${c.offset}`} className={styles.offset}>{c.offset}</div>
          ))}
          <div className={styles.rowLabel}>{partition}</div>
          {cells.map((c) => (
            <div key={`c${c.offset}`} className={cx(styles.cell, c.striped && styles.striped)} style={hue(c.hue)}>
              <span className={styles.text}>{c.text}</span>
              {c.note && <span className={styles.note}>{c.note}</span>}
            </div>
          ))}
          {readers.map((r) => (
            <div key={r.label} className={styles.contents}>
              <div className={styles.rowLabel} style={hue(r.hue)}>
                <span className={styles.swatch} aria-hidden="true" />
                {r.label}
              </div>
              {cells.map((c) => {
                const got = r.got[c.offset]
                return (
                  <div key={c.offset} className={cx(styles.read, got ? styles.yes : styles.no)} style={got ? hue(r.hue) : undefined}>
                    {got ?? '—'}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {caption && <p className={styles.caption}>{caption}</p>}
    </figure>
  )
}
