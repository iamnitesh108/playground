import { hue, type Hue } from '@/shared/figures'
import styles from './WhyFigures.module.css'

export interface Series {
  label: string
  hue: Hue
  points: readonly (readonly [number, number])[]
}

interface Props {
  title: string
  series: readonly Series[]
  xLabel: string
  yLabel: string
  formatX?: (x: number) => string
  formatY?: (y: number) => string
  caption?: string
}

const W = 640
const H = 240
const PAD = { left: 56, right: 80, top: 14, bottom: 40 }

const niceStep = (max: number, count = 4) => {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
}

/** Lines from recorded points, each labelled at its end (colour never carries the meaning alone). */
export function WhyLineChart({ title, series, xLabel, yLabel, formatX = String, formatY = String, caption }: Props) {
  const all = series.flatMap((s) => s.points)
  const xMax = Math.max(...all.map((p) => p[0]))
  const step = niceStep(Math.max(...all.map((p) => p[1])))
  const yMax = Math.ceil(Math.max(...all.map((p) => p[1])) / step) * step || 1
  const x = (v: number) => PAD.left + (v / xMax) * (W - PAD.left - PAD.right)
  const y = (v: number) => H - PAD.bottom - (v / yMax) * (H - PAD.top - PAD.bottom)
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step)
  // end labels, pushed apart so they never overlap
  const ends = series.map((s) => ({ s, y: y(s.points[s.points.length - 1][1]) })).sort((a, b) => a.y - b.y)
  ends.forEach((e, i) => { if (i > 0) e.y = Math.max(e.y, ends[i - 1].y + 15) })
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.legend}>
        {series.map((s) => (
          <span key={s.label} className={styles.legendItem} style={hue(s.hue)}>
            <svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" className={styles.line} /></svg>
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${title}; ${yLabel} against ${xLabel}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.left - 6} y={y(t)} className={styles.tickY}>{formatY(t)}</text>
          </g>
        ))}
        {[0, xMax / 2, xMax].map((t) => (
          <text key={t} x={x(t)} y={H - PAD.bottom + 16} className={styles.tickX}>{formatX(t)}</text>
        ))}
        <text x={PAD.left} y={H - 4} className={styles.axis}>{xLabel}</text>
        {series.map((s) => (
          <g key={s.label} style={hue(s.hue)}>
            <path className={styles.line} d={[[0, 0] as const, ...s.points].map((p, i) => `${i ? 'L' : 'M'}${x(p[0])},${y(p[1])}`).join('')} />
            {s.points.map((p) => <circle key={p[0]} cx={x(p[0])} cy={y(p[1])} r={3} className={styles.dot} />)}
          </g>
        ))}
        {ends.map(({ s, y: ly }) => (
          <text key={s.label} x={W - PAD.right + 10} y={ly} className={styles.endLabel} style={hue(s.hue)}>
            {formatY(s.points[s.points.length - 1][1])}
          </text>
        ))}
      </svg>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
