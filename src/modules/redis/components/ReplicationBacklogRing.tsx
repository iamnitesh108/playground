import { hue } from '@/shared/figures'
import styles from './ReplicationBacklogRing.module.css'

export interface BacklogCase {
  title: string
  /** repl-backlog-size in bytes */
  backlog: number
  /** bytes of the stream the replica missed while away */
  missed: number
}

const R = 58
const C = 2 * Math.PI * R
const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`)

/**
 * The replication backlog drawn as the ring buffer it is: the circle is its capacity, the arc is
 * what the replica missed. If the arc fits, the missing bytes are still there (partial resync);
 * if it wraps past the start, they have been overwritten (full resync).
 */
export function ReplicationBacklogRing({ cases, title }: { cases: readonly BacklogCase[]; title: string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.grid}>
        {cases.map((c) => {
          const share = c.missed / c.backlog
          const fits = share <= 1
          return (
            <div key={c.title} className={styles.case}>
              <svg viewBox="0 0 160 160" className={styles.svg} role="img" aria-label={`${c.title}: missed ${size(c.missed)} of a ${size(c.backlog)} backlog`}>
                <circle cx={80} cy={80} r={R} className={styles.track} />
                <circle
                  cx={80}
                  cy={80}
                  r={R}
                  className={fits ? styles.arc : styles.arcOver}
                  style={{ ...hue(fits ? 6 : 8), strokeDasharray: `${Math.max(2, Math.min(1, share) * C)} ${C}` }}
                  transform="rotate(-90 80 80)"
                />
                <text x={80} y={76} className={styles.big}>{fits ? `${Math.max(0.1, share * 100).toFixed(share < 0.01 ? 2 : 0)}%` : `${share.toFixed(1)}×`}</text>
                <text x={80} y={94} className={styles.small}>{fits ? 'of the ring' : 'the ring size'}</text>
              </svg>
              <div className={styles.caseTitle}>{c.title}</div>
              <div className={styles.line}>backlog {size(c.backlog)} · missed {size(c.missed)}</div>
              <div className={fits ? styles.ok : styles.bad}>{fits ? 'still in the ring → partial resync' : 'overwritten → full resync'}</div>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
