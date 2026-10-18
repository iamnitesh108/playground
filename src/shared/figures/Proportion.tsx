import { hue, type Hue } from './palette'
import styles from './Proportion.module.css'

export interface Part {
  label: string
  value: number
  hue?: Hue
  display?: string
}

/** One 100% bar split into parts (memory use, slot ranges, a time budget), labelled below. */
export function Proportion({ title, parts, unit = '', caption }: { title: string; parts: readonly Part[]; unit?: string; caption?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.bar} role="img" aria-label={parts.map((p) => `${p.label} ${p.display ?? p.value}`).join(', ')}>
        {parts.map((p, i) => (
          <span key={p.label} className={styles.part} style={{ ...hue(p.hue ?? ((i % 8) + 1) as Hue), width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.display ?? `${p.value.toLocaleString()}${unit}`}`} />
        ))}
      </div>
      <ul className={styles.legend}>
        {parts.map((p, i) => (
          <li key={p.label} style={hue(p.hue ?? ((i % 8) + 1) as Hue)}>
            <span className={styles.swatch} />
            <span className={styles.legendLabel}>{p.label}</span>
            <span className={styles.legendValue}>{p.display ?? `${p.value.toLocaleString()}${unit}`}
              {/* a display that is already a percentage needs no second one */}
              {!p.display?.includes('%') && ` · ${p.value > 0 && (p.value / total) * 100 < 1 ? '<1' : Math.round((p.value / total) * 100)}%`}</span>
          </li>
        ))}
      </ul>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
