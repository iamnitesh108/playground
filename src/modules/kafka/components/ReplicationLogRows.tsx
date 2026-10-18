import { hue, type Hue } from '@/shared/figures'
import styles from './ReplicationLogRows.module.css'

export interface LogCell {
  /** Big text inside the cell, e.g. an offset or key=value. */
  content: string
  /** Small text under it, e.g. "replicated" or "deleted". */
  label: string
  hue: Hue
  /** Relative width (default 1). */
  weight?: number
}

/** Rows of log cells (records or segments), coloured by state and labelled — no byte sizes implied. */
export function ReplicationLogRows({ title, rows, caption }: { title: string; rows: readonly { label: string; cells: readonly LogCell[] }[]; caption?: string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      {rows.map((r) => (
        <div key={r.label} className={styles.row}>
          <div className={styles.rowLabel}>{r.label}</div>
          <div className={styles.cells}>
            {r.cells.map((c, i) => (
              <div key={i} className={styles.cell} style={{ ...hue(c.hue), flexGrow: c.weight ?? 1 }}>
                <span className={styles.content}>{c.content}</span>
                <span className={styles.label}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
