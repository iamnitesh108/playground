import { useState } from 'react'
import { hue } from '@/shared/figures/palette'
import { Demo } from '@/shared/ui'
import { histogramFraction, lessThanSelectivity, type ColumnStats } from '../simulation/queryPlanningStats'
import { QueryPlanningSlider } from './QueryPlanningSlider'
import styles from './QueryPlanning.module.css'

interface HistogramProps {
  column: string
  stats: ColumnStats
  rows: number
  /** The recorded estimate for one value of x, to compare with. */
  recorded: { x: number; est: number; actual: number }
}

/**
 * An equal-frequency histogram from pg_stats: every bucket holds the same share of rows,
 * so narrow buckets mean dense values. Drag x to estimate WHERE column < x.
 */
export function QueryPlanningHistogram({ column, stats, rows, recorded }: HistogramProps) {
  const h = stats.histogram
  const lo = h[0]
  const hi = h[h.length - 1]
  const [x, setX] = useState(recorded.x)
  const sel = lessThanSelectivity(stats, x)
  const { bucket, within } = histogramFraction(h, x)
  const buckets = h.length - 1
  const W = 720
  const pos = (v: number) => ((v - lo) / (hi - lo)) * W

  return (
    <Demo
      title={`Estimating WHERE ${column} < x from the histogram`}
      hint={`ANALYZE stored ${h.length} bounds: ${buckets} buckets, each holding 1/${buckets} of the rows. Whole buckets left of x count fully; the bucket x falls in counts in proportion.`}
      controls={
        <QueryPlanningSlider label="x" value={x} min={Math.ceil(lo)} max={Math.floor(hi)} format={(v) => v.toFixed(0)} onChange={setX} />
      }
    >
      <svg viewBox={`-4 0 ${W + 8} 92`} className={styles.histSvg} role="img" aria-label={`histogram of ${column}, ${buckets} buckets`}>
        {h.slice(0, -1).map((b, i) => {
          const x0 = pos(b)
          const x1 = pos(h[i + 1])
          const full = i < bucket || (i === bucket && within >= 1)
          const part = i === bucket && !full
          return (
            <g key={i} style={hue(7)}>
              <rect x={x0} y={20} width={Math.max(0.5, x1 - x0)} height={40} className={full ? styles.histFull : styles.histEmpty} />
              {part && <rect x={x0} y={20} width={(x1 - x0) * within} height={40} className={styles.histFull} />}
            </g>
          )
        })}
        <line x1={pos(x)} x2={pos(x)} y1={10} y2={68} className={styles.histMarker} />
        <text x={Math.min(W - 40, Math.max(40, pos(x)))} y={10} className={styles.histLabel}>
          x = {x}
        </text>
        <text x={0} y={84} className={styles.histAxis}>
          {lo}
        </text>
        <text x={W} y={84} className={styles.histAxis} textAnchor="end">
          {hi}
        </text>
        <text x={W / 2} y={84} className={styles.histAxis} textAnchor="middle">
          {column} — bucket boundaries (histogram_bounds)
        </text>
      </svg>
      <div className={styles.histResult}>
        <span className={styles.counterTile}>
          {bucket} whole buckets + {(within * 100).toFixed(0)} % of one = {(sel * 100).toFixed(2)} % of rows
        </span>
        <span className={styles.counterTile}>
          estimate: {Math.round(sel * rows).toLocaleString()} of {rows.toLocaleString()} rows
        </span>
      </div>
      <p className={styles.muted}>
        Recorded: for <code>{column} &lt; {recorded.x}</code> the planner estimated {recorded.est.toLocaleString()} rows and there were{' '}
        {recorded.actual.toLocaleString()}. Each bucket is drawn as wide as the range of values it covers.
      </p>
    </Demo>
  )
}
