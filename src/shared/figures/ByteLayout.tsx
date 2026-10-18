import { hue, type Hue } from './palette'
import styles from './ByteLayout.module.css'

export interface ByteField {
  label: string
  /** Size in bytes (decides the width). */
  bytes: number
  hue?: Hue
  /** Content shown inside the field, e.g. "SET" or "0x03". */
  content?: string
}

interface ByteLayoutProps {
  title: string
  rows: readonly { label?: string; fields: readonly ByteField[] }[]
  /** Width (in bytes) of a full row; defaults to the longest row. */
  scale?: number
  caption?: string
}

/** Fields of a byte layout drawn to scale: a record, a frame, an object in memory. */
export function ByteLayout({ title, rows, scale, caption }: ByteLayoutProps) {
  const total = scale ?? Math.max(...rows.map((r) => r.fields.reduce((n, f) => n + f.bytes, 0)), 1)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      {rows.map((r, i) => {
        const rowBytes = r.fields.reduce((n, f) => n + f.bytes, 0) || 1
        return (
        <div key={i} className={styles.row}>
          {r.label && <div className={styles.rowLabel}>{r.label}</div>}
          {/* each row is as wide as its bytes, relative to the scale, so rows can be compared */}
          <div className={styles.fields} style={{ width: `${Math.min(100, (rowBytes / total) * 100)}%` }}>
            {r.fields.map((f, j) => (
              <div key={j} className={styles.field} style={{ ...hue(f.hue ?? ((j % 8) + 1) as Hue), flexGrow: f.bytes, flexBasis: 0 }} title={`${f.label}: ${f.bytes} bytes`}>
                <span className={styles.content}>{f.content ?? ''}</span>
                <span className={styles.fieldLabel}>{f.label}</span>
                <span className={styles.bytes}>{f.bytes} B</span>
              </div>
            ))}
          </div>
        </div>
        )
      })}
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
