import { useState, type PointerEvent } from 'react'
import { hue, type Hue } from '@/shared/figures'
import styles from './MonitoringLineChart.module.css'

export interface ChartPoint {
  readonly x: number
  readonly y: number
}

export interface ChartSeries {
  readonly label: string
  readonly hue: Hue
  readonly points: readonly ChartPoint[]
  readonly dashed?: boolean
}

/** A shaded stretch of the x axis, e.g. a load phase. */
export interface ChartBand {
  readonly from: number
  readonly to: number
  readonly label: string
}

interface LineChartProps {
  title: string
  series: readonly ChartSeries[]
  /** Unit of x, shown on the axis ("s", "clients"). */
  xUnit: string
  /** What y measures, shown at the top of the axis. */
  yLabel: string
  yMax?: number
  /** Stack the series (areas add up), e.g. sessions by state. */
  stacked?: boolean
  bands?: readonly ChartBand[]
  /** Spread x evenly by index instead of by value (for 1, 2, 4, 8… steps). */
  categorical?: boolean
  caption?: string
  format?: (y: number) => string
  /** Vertical reference lines, e.g. the chosen setting. */
  markers?: readonly { x: number; label: string }[]
}

const W = 600
const H = 220

/** Nice round axis steps: 1, 2 or 5 × 10ⁿ. */
function ticks(max: number): number[] {
  const raw = max / 4
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
}

/** Recorded values over time (or over a setting), several series, with a hover readout. */
export function MonitoringLineChart({ title, series, xUnit, yLabel, yMax, stacked = false, bands = [], categorical = false, caption, format, markers = [] }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const xs = series[0]?.points.map((p) => p.x) ?? []
  // stacked: each series sits on top of the ones before it
  const tops = stacked
    ? series.map((_, i) => xs.map((_x, k) => series.slice(0, i + 1).reduce((sum, s) => sum + (s.points[k]?.y ?? 0), 0)))
    : series.map((s) => s.points.map((p) => p.y))
  const top = yMax ?? Math.max(1, ...tops.flat()) * 1.05
  const grid = ticks(top).filter((t) => t <= top)
  const xMin = categorical ? 0 : Math.min(...series.flatMap((s) => s.points.map((p) => p.x)), ...bands.map((b) => b.from))
  const xMaxV = categorical ? Math.max(1, xs.length - 1) : Math.max(...series.flatMap((s) => s.points.map((p) => p.x)), ...bands.map((b) => b.to))
  const xPos = (x: number, k: number) => ((categorical ? k : x) - xMin) / (xMaxV - xMin || 1)
  const px = (x: number, k: number) => xPos(x, k) * W
  const py = (y: number) => H - (y / top) * H
  const fmt = format ?? ((y: number) => y.toLocaleString())

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - r.left) / r.width
    let best = 0
    xs.forEach((x, k) => {
      if (Math.abs(xPos(x, k) - f) < Math.abs(xPos(xs[best], best) - f)) best = k
    })
    setHover(best)
  }

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <ul className={styles.legend}>
        {series.map((s) => (
          <li key={s.label} style={hue(s.hue)}>
            <span className={s.dashed ? styles.swatchDashed : styles.swatch} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className={styles.frame}>
        <div className={styles.yAxis} aria-hidden="true">
          {grid.map((t) => (
            <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{fmt(t)}</span>
          ))}
        </div>
        <div className={styles.plot}>
          <span className={styles.yLabel}>{yLabel}</span>
          {bands.map((b) => (
            <span key={b.label} className={styles.band} style={{ left: `${xPos(b.from, 0) * 100}%`, width: `${(xPos(b.to, 0) - xPos(b.from, 0)) * 100}%` }}>
              <span className={styles.bandLabel}>{b.label}</span>
            </span>
          ))}
          {markers.map((m) => (
            <span key={m.label} className={styles.marker} style={{ left: `${xPos(m.x, xs.indexOf(m.x)) * 100}%` }}>
              <span className={xPos(m.x, xs.indexOf(m.x)) > 0.6 ? styles.markerLabelEnd : styles.markerLabel}>{m.label}</span>
            </span>
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svg} role="img" aria-label={title} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            {grid.map((t) => (
              <line key={t} x1={0} x2={W} y1={py(t)} y2={py(t)} className={styles.grid} />
            ))}
            {series.map((s, i) => {
              const line = s.points.map((p, k) => `${px(p.x, k).toFixed(1)},${py(tops[i][k]).toFixed(1)}`).join(' ')
              const below = stacked && i > 0 ? s.points.map((p, k) => `${px(p.x, k).toFixed(1)},${py(tops[i - 1][k]).toFixed(1)}`).reverse().join(' ') : null
              const first = s.points[0], last = s.points.at(-1)
              const area = below ?? (first && last ? `${px(last.x, s.points.length - 1).toFixed(1)},${H} ${px(first.x, 0).toFixed(1)},${H}` : '')
              return (
                <g key={s.label} style={hue(s.hue)}>
                  {stacked && <polygon points={`${line} ${area}`} className={styles.area} />}
                  <polyline points={line} className={s.dashed ? styles.lineDashed : styles.line} vectorEffect="non-scaling-stroke" />
                </g>
              )
            })}
            {hover !== null && <line x1={px(xs[hover], hover)} x2={px(xs[hover], hover)} y1={0} y2={H} className={styles.cursor} />}
          </svg>
          {!stacked &&
            series.map((s) =>
              s.points.length <= 12 ? (
                s.points.map((p, k) => <span key={`${s.label}-${k}`} className={styles.dot} style={{ ...hue(s.hue), left: `${xPos(p.x, k) * 100}%`, bottom: `${(p.y / top) * 100}%` }} />)
              ) : null,
            )}
          {hover !== null && (
            <div className={styles.readout} style={xPos(xs[hover], hover) > 0.6 ? { right: `${(1 - xPos(xs[hover], hover)) * 100 + 1}%` } : { left: `${xPos(xs[hover], hover) * 100 + 1}%` }}>
              <strong>{xs[hover].toLocaleString()} {xUnit}</strong>
              {series.map((s) => (
                <span key={s.label} style={hue(s.hue)}>
                  <span className={styles.swatch} /> {s.label}: {fmt(s.points[hover]?.y ?? 0)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={styles.xAxis}>
        {categorical
          ? xs.map((x, k) => (
              <span key={k} style={{ left: `${xPos(x, k) * 100}%` }}>{x.toLocaleString()}</span>
            ))
          : [xMin, (xMin + xMaxV) / 2, xMaxV].map((x) => (
              <span key={x} style={{ left: `${xPos(x, 0) * 100}%` }}>{Math.round(x).toLocaleString()}</span>
            ))}
        <span className={styles.xUnit}>{xUnit}</span>
      </div>
      {caption && <p className={styles.caption}>{caption}</p>}
    </figure>
  )
}
