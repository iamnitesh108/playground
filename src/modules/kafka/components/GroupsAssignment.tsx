import { hue } from '@/shared/figures'
import styles from './GroupsAssignment.module.css'

export interface AssignmentRow {
  label: string
  sub?: string
  members: readonly { name: string; partitions: readonly string[] }[]
}

/** Who owns which partition: one row per situation, one box per group member (idle members dashed). */
export function GroupsAssignment({ title, rows, caption }: { title: string; rows: readonly AssignmentRow[]; caption?: string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.rows}>
        {rows.map((r) => (
          <div key={r.label} className={styles.row}>
            <div className={styles.rowHead}>
              <span className={styles.rowLabel}>{r.label}</span>
              {r.sub && <span className={styles.rowSub}>{r.sub}</span>}
            </div>
            <div className={styles.members}>
              {r.members.map((m) => (
                <div key={m.name} className={m.partitions.length ? styles.member : styles.idle} style={{ ...hue(m.partitions.length ? 1 : 8), flexGrow: Math.max(1, m.partitions.length) }}>
                  <span className={styles.name}>{m.name}</span>
                  <span className={styles.parts}>
                    {m.partitions.length ? m.partitions.map((p) => <span key={p} className={styles.chip} style={hue(3)}>{p}</span>) : <span className={styles.idleText}>no partition</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
