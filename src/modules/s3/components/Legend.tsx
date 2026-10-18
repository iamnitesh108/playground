import { hue } from '@/shared/figures'
import { LEGEND } from './legend'
import styles from './Legend.module.css'

/** The module's colour legend: every colour with its meaning in words. */
export function Legend() {
  return (
    <ul className={styles.legend} aria-label="Colour legend of this module">
      {LEGEND.map((l) => (
        <li key={l.label} style={hue(l.hue)}>
          <span className={styles.swatch} />
          {l.label}
        </li>
      ))}
    </ul>
  )
}
