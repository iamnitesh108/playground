import { hue, type Hue } from './palette'
import styles from './StatTiles.module.css'

export interface Stat {
  label: string
  value: string | number
  sub?: string
  hue?: Hue
  /** Draws a small bar: value of max (e.g. 566 of 600 ms). */
  bar?: { value: number; max: number }
}

/** Big numbers worth remembering, each in its own coloured tile. */
export function StatTiles({ stats, title }: { stats: readonly Stat[]; title?: string }) {
  return (
    <figure className={styles.figure}>
      {title && <figcaption className={styles.title}>{title}</figcaption>}
      <div className={styles.grid}>
        {stats.map((s) => (
          <div key={s.label} className={styles.tile} style={hue(s.hue)}>
            <div className={styles.value}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
            <div className={styles.label}>{s.label}</div>
            {s.bar && (
              <div className={styles.bar} aria-hidden="true">
                <span style={{ width: `${Math.min(100, (s.bar.value / Math.max(1, s.bar.max)) * 100)}%` }} />
              </div>
            )}
            {s.sub && <div className={styles.sub}>{s.sub}</div>}
          </div>
        ))}
      </div>
    </figure>
  )
}
