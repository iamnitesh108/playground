import { hue, type Hue } from '@/shared/figures'
import styles from './LargeFilesRanges.module.css'

export interface ByteRange {
  label: string
  from: number
  to: number
  hue: Hue
}

/** Where recorded range reads landed inside one object (positions to scale; tiny ranges get a minimum width). */
export function LargeFilesRanges({ title, size, ranges, parts }: { title: string; size: number; ranges: readonly ByteRange[]; parts: readonly number[] }) {
  const pct = (n: number) => (n / size) * 100
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.object}>
        {parts.map((p, i) => (
          <span key={i} className={styles.partLine} style={{ left: `${pct(p)}%` }} />
        ))}
        {ranges.map((r) => (
          <span key={r.label} className={styles.range} style={{ ...hue(r.hue), left: `${pct(r.from)}%`, width: `max(4px, ${pct(r.to - r.from + 1)}%)` }} />
        ))}
      </div>
      <div className={styles.scale}>
        <span>byte 0</span>
        {parts.map((p, i) => (
          <span key={i} style={{ left: `${pct(p)}%` }} className={styles.partLabel}>
            part {i + 2}
          </span>
        ))}
        <span>{size.toLocaleString()}</span>
      </div>
      <ul className={styles.legend}>
        {ranges.map((r) => (
          <li key={r.label} style={hue(r.hue)}>
            <span className={styles.swatch} />
            <span>{r.label}</span>
            <code>
              bytes {r.from.toLocaleString()}–{r.to.toLocaleString()}
            </code>
          </li>
        ))}
      </ul>
    </figure>
  )
}
