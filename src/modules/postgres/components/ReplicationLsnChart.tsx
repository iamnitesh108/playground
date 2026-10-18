import { useState, type CSSProperties } from 'react'
import type { Hue } from '@/shared/figures'
import styles from './ReplicationLsnChart.module.css'

export interface LsnSeries {
  label: string
  hue: Hue
  points: readonly (readonly [number, number])[]
  dashed?: boolean
}

export interface LsnBand {
  from: number
  to: number
  label: string
}

interface Props {
  title: string
  series: readonly LsnSeries[]
  bands?: readonly LsnBand[]
  xUnit?: string
  formatY?: (y: number) => string
  caption?: string
  height?: number
}

const W = 680
const PAD = { left: 58, right: 128, top: 18, bottom: 34 }
const color = (h: Hue) => ({ '--line': `var(--c${h})` }) as CSSProperties

const ticks = (max: number, n = 4) => {
  const raw = max / n || 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
}

/** WAL positions over time: how far the primary wrote and how far a standby got (each line labelled at its end). */
export function ReplicationLsnChart({ title, series, bands = [], xUnit = 's', formatY = (y) => `${Math.round(y)} MB`, caption, height = 230 }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const all = series.flatMap((s) => s.points)
  const xMax = Math.max(1, ...all.map((p) => p[0]))
  const yMax = Math.max(1, ...all.map((p) => p[1])) * 1.06
  const x = (v: number) => PAD.left + (v / xMax) * (W - PAD.left - PAD.right)
  const y = (v: number) => height - PAD.bottom - (v / yMax) * (height - PAD.top - PAD.bottom)
  const path = (pts: LsnSeries['points']) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
  // end labels pushed apart so they never overlap
  const ends = series.map((s) => ({ s, y: y(s.points.at(-1)?.[1] ?? 0) })).sort((a, b) => a.y - b.y)
  ends.forEach((e, i) => { if (i > 0) e.y = Math.max(e.y, ends[i - 1].y + 14) })
  const xs = series[0]?.points.map((p) => p[0]) ?? []
  const at = hover === null ? null : xs[hover]
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className={styles.svg}
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const vx = ((e.clientX - r.left) / r.width) * W
          const t = ((vx - PAD.left) / (W - PAD.left - PAD.right)) * xMax
          let best = 0
          xs.forEach((v, i) => { if (Math.abs(v - t) < Math.abs(xs[best] - t)) best = i })
          setHover(xs.length ? best : null)
        }}
      >
        {bands.map((b) => (
          <g key={b.label + b.from}>
            <rect x={x(b.from)} y={PAD.top} width={Math.max(1, x(b.to) - x(b.from))} height={height - PAD.top - PAD.bottom} className={styles.band} />
            <text x={(x(b.from) + x(b.to)) / 2} y={PAD.top + 12} className={styles.bandLabel}>{b.label}</text>
          </g>
        ))}
        {ticks(yMax / 1.06).map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={styles.grid} />
            <text x={PAD.left - 6} y={y(v) + 4} className={styles.yTick}>{formatY(v)}</text>
          </g>
        ))}
        {ticks(xMax, 5).map((v) => (
          <text key={v} x={x(v)} y={height - PAD.bottom + 16} className={styles.xTick}>{v}{xUnit}</text>
        ))}
        {series.map((s) => (
          <path key={s.label} d={path(s.points)} className={s.dashed ? styles.dashed : styles.line} style={color(s.hue)} />
        ))}
        {ends.map(({ s, y: ly }) => (
          <text key={s.label} x={W - PAD.right + 8} y={ly + 4} className={styles.endLabel} style={color(s.hue)}>{s.label}</text>
        ))}
        {at !== null && hover !== null && (
          <g>
            <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={height - PAD.bottom} className={styles.cursor} />
            <text x={x(at) + (x(at) > W / 2 ? -6 : 6)} y={height - PAD.bottom - 6} className={x(at) > W / 2 ? styles.readoutEnd : styles.readout}>
              {at}{xUnit}: {series.map((s) => `${s.label.split(' ').at(-1)} ${formatY(s.points[hover]?.[1] ?? 0)}`).join(' · ')}
            </text>
          </g>
        )}
      </svg>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
