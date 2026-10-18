import { useMemo, useState, type CSSProperties } from 'react'
import styles from './Charts.module.css'

export interface LineSeries {
  label: string
  points: readonly (readonly [number, number])[]
  /** The series the chart is about: drawn in the accent colour. Others are grey and dashed. */
  emphasis?: boolean
}

interface LineChartProps {
  title: string
  series: readonly LineSeries[]
  xLabel: string
  yLabel: string
  formatX?: (x: number) => string
  formatY?: (y: number) => string
  /** Draw a step line (values hold until the next point). */
  step?: boolean
  height?: number
  yMin?: number
}

/** Each series gets a palette colour (by position, so it never changes with emphasis). */
const seriesColor = (i: number) => ({ '--line': `var(--c${(i % 8) + 1})` }) as CSSProperties

const W = 640
const PAD = { left: 56, right: 112, top: 26, bottom: 36 }

const niceTicks = (max: number, count = 4) => {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
}

/** Lines for one measure over one x axis; hover shows every series' value at the nearest x. */
export function LineChart({ title, series, xLabel, yLabel, formatX = String, formatY = (y) => y.toLocaleString(), step = false, height = 220, yMin = 0 }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const all = series.flatMap((s) => s.points)
  const xMin = Math.min(...all.map((p) => p[0]))
  // a single x value (e.g. before a simulation runs) still gets a usable axis
  const xMax = Math.max(xMin + 1, ...all.map((p) => p[0]))
  const yMax = Math.max(...all.map((p) => p[1])) * 1.05 || 1
  const H = height
  const x = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => H - PAD.bottom - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)
  const xs = useMemo(() => [...new Set(all.map((p) => p[0]))].sort((a, b) => a - b), [all])
  const ordered = [...series].sort((a, b) => Number(!!a.emphasis) - Number(!!b.emphasis))
  const path = (pts: LineSeries['points']) =>
    pts.map((p, i) => (i === 0 ? `M${x(p[0])},${y(p[1])}` : step ? `H${x(p[0])}V${y(p[1])}` : `L${x(p[0])},${y(p[1])}`)).join('')
  const at = hover === null ? null : xs[hover]
  // direct labels at the end of each line, pushed apart so they never overlap
  const labelY = new Map<string, number>()
  ;[...series]
    .map((s) => ({ label: s.label, y: y(s.points[s.points.length - 1][1]) }))
    .sort((a, b) => a.y - b.y)
    .forEach((l, i, arr) => {
      const prev = i > 0 ? labelY.get(arr[i - 1].label)! : -Infinity
      labelY.set(l.label, Math.max(l.y, prev + 13))
    })
  const overflow = Math.max(0, ...labelY.values()) - (H - PAD.bottom)
  if (overflow > 0) for (const [k, v] of labelY) labelY.set(k, v - overflow)
  const valueAt = (s: LineSeries, xv: number) => {
    const before = s.points.filter((p) => p[0] <= xv)
    return before.length ? before[before.length - 1][1] : null
  }

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.title}>{title}</figcaption>
      {series.length > 1 && (
        <div className={styles.legend}>
          {series.map((s) => (
            <span key={s.label} className={styles.legendItem}>
              <svg width="22" height="8" aria-hidden="true" style={seriesColor(series.indexOf(s))}><line x1="0" y1="4" x2="22" y2="4" className={s.emphasis ? styles.lineMain : styles.lineOther} /></svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          let best = 0
          xs.forEach((v, i) => { if (Math.abs(x(v) - px) < Math.abs(x(xs[best]) - px)) best = i })
          setHover(best)
        }}
      >
        {niceTicks(yMax).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.left - 6} y={y(t)} className={styles.tickY}>{formatY(t)}</text>
          </g>
        ))}
        {[xMin, (xMin + xMax) / 2, xMax].map((t) => (
          <text key={t} x={x(t)} y={H - PAD.bottom + 16} className={styles.tickX}>{formatX(t)}</text>
        ))}
        <text x={PAD.left} y={H - 4} className={styles.axisLabel}>{xLabel}</text>
        <text x={8} y={4} className={styles.axisLabelY}>{yLabel}</text>
        {ordered.map((s) => (
          <g key={s.label} style={seriesColor(series.indexOf(s))}>
            <path d={path(s.points)} className={s.emphasis || series.length === 1 ? styles.lineMain : styles.lineOther} />
            {s.points.length <= 12 && s.points.map((p) => <circle key={p[0]} cx={x(p[0])} cy={y(p[1])} r={4} className={s.emphasis || series.length === 1 ? styles.dotMain : styles.dotOther} />)}
            {series.length > 1 && <text x={x(s.points[s.points.length - 1][0]) + 8} y={labelY.get(s.label)} className={styles.directLabel}>{s.label}</text>}
          </g>
        ))}
        {at !== null && (
          <g>
            <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} className={styles.crosshair} />
            {series.map((s) => { const v = valueAt(s, at); return v === null ? null : <circle key={s.label} cx={x(at)} cy={y(v)} r={4} className={styles.hoverDot} /> })}
          </g>
        )}
      </svg>
      <div className={styles.readout} aria-live="polite">
        {at === null ? <span className={styles.hint}>Hover the chart to read values.</span> : (
          <>
            <strong>{xLabel} {formatX(at)}</strong>
            {series.map((s) => { const v = valueAt(s, at); return v === null ? null : <span key={s.label}>{s.label}: {formatY(v)}</span> })}
          </>
        )}
      </div>
    </figure>
  )
}
