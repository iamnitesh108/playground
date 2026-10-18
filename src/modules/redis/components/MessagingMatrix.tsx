import { hue, type Hue } from '@/shared/figures'
import styles from './MessagingMatrix.module.css'

export type Verdict = 'yes' | 'no' | 'partial'

export interface MatrixRow {
  label: string
  cells: readonly { text: string; verdict: Verdict }[]
}

interface MessagingMatrixProps {
  title: string
  columns: readonly { label: string; hue: Hue }[]
  rows: readonly MatrixRow[]
}

const MARK: Record<Verdict, string> = { yes: '✓', no: '✕', partial: '~' }
const VERDICT_HUE: Record<Verdict, Hue> = { yes: 6, no: 8, partial: 4 }

/** Options side by side, each cell marked yes / no / partly — with its words, never colour alone. */
export function MessagingMatrix({ title, columns, rows }: MessagingMatrixProps) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.grid} style={{ gridTemplateColumns: `minmax(120px, 1.1fr) repeat(${columns.length}, minmax(0, 1fr))` }}>
        <span />
        {columns.map((c) => (
          <span key={c.label} className={styles.head} style={hue(c.hue)}>{c.label}</span>
        ))}
        {rows.map((r) => (
          <div key={r.label} className={styles.row} style={{ display: 'contents' }}>
            <span className={styles.rowLabel}>{r.label}</span>
            {r.cells.map((c, i) => (
              <span key={i} className={styles.cell} style={hue(VERDICT_HUE[c.verdict])}>
                <span className={styles.mark} aria-label={c.verdict}>{MARK[c.verdict]}</span>
                <span>{c.text}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </figure>
  )
}
