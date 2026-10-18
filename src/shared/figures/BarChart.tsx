import { useState, type CSSProperties } from 'react'
import { hue, type Hue } from './palette'
import styles from './BarChart.module.css'

export interface BarDatum {
  label: string
  value: number
  hue?: Hue
  /** Text shown instead of the number. */
  display?: string
  note?: string
}

interface BarChartProps {
  title: string
  bars: readonly BarDatum[]
  max?: number
  unit?: string
  /** Optional reference line, e.g. a limit. */
  marker?: { value: number; label: string }
}

/** Horizontal bars, one measure, each bar labelled with its value. */
export function BarChart({ title, bars, max, unit = '', marker }: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const top = max ?? Math.max(...bars.map((b) => b.value), marker?.value ?? 0, 1)
  const valueText = (b: BarDatum) => b.display ?? `${b.value.toLocaleString()}${unit}`
  // one value column as wide as the longest value, so every track has the same length and bars compare fairly
  const valueWidth = `min(${Math.max(7, ...bars.map((b) => valueText(b).length)) + 1}ch, 45%)`
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.rows} style={{ '--value-width': valueWidth } as CSSProperties}>
        {bars.map((b, i) => (
          <div key={b.label} className={styles.row} style={hue(b.hue ?? 1)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover((h) => (h === i ? null : i))}>
            <span className={styles.label}>{b.label}</span>
            <span className={styles.track}>
              <span className={styles.bar} style={{ width: `${Math.max(0.6, (b.value / top) * 100)}%` }} />
              {marker && <span className={styles.marker} style={{ left: `${(marker.value / top) * 100}%` }} />}
            </span>
            <span className={styles.value}>{valueText(b)}</span>
            {hover === i && b.note && <span className={styles.note}>{b.note}</span>}
          </div>
        ))}
      </div>
      {marker && <div className={styles.markerLegend}><span className={styles.markerSwatch} /> {marker.label}</div>}
    </figure>
  )
}
