import { hue, type Hue } from '@/shared/figures'
import styles from './ExpiryLegend.module.css'

export interface LegendItem {
  hue: Hue
  label: string
  shape: 'dot' | 'bar' | 'striped'
}

/** The key to a timeline's colours, so every colour also has words. */
export function ExpiryLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((i) => (
        <li key={i.label} style={hue(i.hue)}>
          <span className={styles[i.shape]} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
