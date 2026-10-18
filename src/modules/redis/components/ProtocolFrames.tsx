import { hue, type ByteField } from '@/shared/figures'
import styles from './ProtocolFrames.module.css'

interface ProtocolFramesProps {
  title: string
  rows: readonly { label: string; fields: readonly ByteField[] }[]
  caption?: string
}

/** RESP frames drawn on one common byte scale, so a short reply really looks short. */
export function ProtocolFrames({ title, rows, caption }: ProtocolFramesProps) {
  const total = Math.max(...rows.map((r) => r.fields.reduce((n, f) => n + f.bytes, 0)), 1)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      {rows.map((r, i) => {
        const size = r.fields.reduce((n, f) => n + f.bytes, 0)
        return (
          <div key={i} className={styles.row}>
            <div className={styles.rowLabel}>
              {r.label} <span className={styles.size}>{size} bytes</span>
            </div>
            <div className={styles.fields}>
              {r.fields.map((f, j) => (
                <div key={j} className={styles.field} style={{ ...hue(f.hue ?? 1), width: `${(f.bytes / total) * 100}%` }} title={`${f.label}: ${f.content ?? ''} (${f.bytes} bytes with \\r\\n)`}>
                  <span className={styles.content}>{f.content}</span>
                  <span className={styles.fieldLabel}>{f.label}</span>
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
