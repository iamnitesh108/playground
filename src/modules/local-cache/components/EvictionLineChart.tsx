import { useState } from 'react'
import { hue, type Hue } from '@/shared/figures'
import styles from './EvictionLineChart.module.css'

export interface LineSeries {
  label: string
  hue: Hue
  points: readonly (readonly [number, number])[]
  /** Dashed: a model or a reference rather than a measured library. */
  dashed?: boolean
}

interface LineChartProps {
  title: string
  series: readonly LineSeries[]
  xLabel: string
  yLabel: string
  /** 'category': the x values are evenly spaced labels (cache sizes); 'linear': a numeric axis. */
  xScale?: 'category' | 'linear'
  formatX?: (x: number) => string
  formatY?: (y: number) => string
  yMax?: number
  caption?: string
}

const W = 600
const H = 250
const PAD = { left: 46, right: 118, top: 26, bottom: 34 }

/** Lines for one measure, each series in its own palette colour with a direct label; hover reads every value. */
export function EvictionLineChart({ title, series, xLabel, yLabel, xScale = 'category', formatX = String, formatY = (y) => `${y.toFixed(0)} %`, yMax, caption }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b)
  const highest = Math.max(...series.flatMap((s) => s.points.map((p) => p[1])))
  // a round step (5, 10, 20, 25) giving at most five gridlines, and a top that is a multiple of it
  const tickStep = [5, 10, 20, 25].find((st) => (yMax ?? highest) / st <= 5) ?? 25
  const top = yMax ?? Math.max(tickStep, Math.ceil(highest / tickStep) * tickStep)
  const innerW = W - PAD.left - PAD.right
  const x = (v: number) =>
    xScale === 'category'
      ? PAD.left + (xs.length === 1 ? innerW / 2 : (xs.indexOf(v) / (xs.length - 1)) * innerW)
      : PAD.left + ((v - xs[0]) / Math.max(1e-9, xs[xs.length - 1] - xs[0])) * innerW
  const y = (v: number) => H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom)
  const ticks = Array.from({ length: Math.floor(top / tickStep) + 1 }, (_, i) => i * tickStep)
  const xTicks = xScale === 'category' ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]]

  // direct labels at the right end, pushed apart so they never overlap
  const labelY = new Map<string, number>()
  series
    .map((s) => ({ label: s.label, y: y(s.points[s.points.length - 1][1]) }))
    .sort((a, b) => a.y - b.y)
    .forEach((l, i, arr) => labelY.set(l.label, Math.max(l.y, i ? labelY.get(arr[i - 1].label)! + 13 : -Infinity)))
  const overflow = Math.max(...labelY.values()) - (H - PAD.bottom + 4)
  if (overflow > 0) for (const [k, v] of labelY) labelY.set(k, v - overflow)

  const at = hover === null ? null : xs[hover]
  const valueAt = (s: LineSeries, xv: number) => s.points.find((p) => p[0] === xv)?.[1]
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.scroll}>
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
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={PAD.left - 6} y={y(t)} className={styles.tickY}>{formatY(t)}</text>
            </g>
          ))}
          {xTicks.map((t) => <text key={t} x={x(t)} y={H - PAD.bottom + 15} className={styles.tickX}>{formatX(t)}</text>)}
          <text x={PAD.left + innerW / 2} y={H - 3} className={styles.axisLabel}>{xLabel}</text>
          <text x={4} y={4} className={styles.axisLabelY}>{yLabel}</text>
          {series.map((s) => (
            <g key={s.label} style={hue(s.hue)}>
              <path d={s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])},${y(p[1])}`).join('')} className={s.dashed ? styles.dashed : styles.line} />
              {s.points.length <= 12 && s.points.map((p) => <circle key={p[0]} cx={x(p[0])} cy={y(p[1])} r={3.5} className={styles.dot} />)}
              <text x={W - PAD.right + 8} y={labelY.get(s.label)} className={styles.directLabel}>{s.label}</text>
            </g>
          ))}
          {at !== null && <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} className={styles.crosshair} />}
        </svg>
      </div>
      <div className={styles.readout} aria-live="polite">
        {at === null ? (
          <span className={styles.hint}>Hover the chart to read every value.</span>
        ) : (
          <>
            <strong>{xLabel} {formatX(at)}</strong>
            {series.map((s) => {
              const v = valueAt(s, at)
              return v === undefined ? null : <span key={s.label} style={hue(s.hue)} className={styles.readItem}><i className={styles.swatch} />{s.label}: {formatY(v)}</span>
            })}
          </>
        )}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
