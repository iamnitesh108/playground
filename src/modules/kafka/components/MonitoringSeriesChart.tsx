import { hue, type Hue } from '@/shared/figures'
import styles from './MonitoringSeriesChart.module.css'

export interface SeriesPoint {
  readonly t: number
  readonly v: number
}

export interface SeriesEvent {
  readonly t: number
  readonly label: string
}

interface SeriesChartProps {
  title: string
  points: readonly SeriesPoint[]
  events?: readonly SeriesEvent[]
  /** Unit of the measured value, shown with the axis maximum. */
  unit: string
  hue: Hue
  max?: number
  caption?: string
}

const W = 600
const H = 200
const PAD = 8

/** A recorded value over time (seconds), with numbered markers for what happened when. */
export function MonitoringSeriesChart({ title, points, events = [], unit, hue: h, max, caption }: SeriesChartProps) {
  const end = Math.max(...points.map((p) => p.t), ...events.map((e) => e.t), 1)
  const top = max ?? Math.max(...points.map((p) => p.v), 1)
  const x = (t: number) => PAD + (t / end) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - (v / top) * (H - 2 * PAD)
  const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${x(points[0]?.t ?? 0).toFixed(1)},${H - PAD} ${line} ${x(points.at(-1)?.t ?? 0).toFixed(1)},${H - PAD}`
  return (
    <figure className={styles.figure} style={hue(h)}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.plot}>
        <span className={styles.yMax}>{top.toLocaleString()} {unit}</span>
        <span className={styles.yMin}>0</span>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svg} role="img" aria-label={title}>
          <line x1={PAD} x2={W - PAD} y1={y(top)} y2={y(top)} className={styles.grid} />
          <line x1={PAD} x2={W - PAD} y1={y(top / 2)} y2={y(top / 2)} className={styles.grid} />
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className={styles.axis} />
          {events.map((e, i) => (
            <line key={i} x1={x(e.t)} x2={x(e.t)} y1={PAD} y2={H - PAD} className={styles.event} />
          ))}
          <polygon points={area} className={styles.area} />
          <polyline points={line} className={styles.line} vectorEffect="non-scaling-stroke" />
        </svg>
        {events.map((e, i) => (
          <span key={i} className={styles.marker} style={{ left: `${(x(e.t) / W) * 100}%` }}>{i + 1}</span>
        ))}
      </div>
      <div className={styles.xAxis}>
        <span>0 s</span>
        <span>{Math.round(end)} s</span>
      </div>
      {events.length > 0 && (
        <ol className={styles.legend}>
          {events.map((e, i) => (
            <li key={i}><span className={styles.dot}>{i + 1}</span> {e.t} s — {e.label}</li>
          ))}
        </ol>
      )}
      {caption && <p className={styles.caption}>{caption}</p>}
    </figure>
  )
}
