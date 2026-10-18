import { hue, type Hue } from '@/shared/figures'
import styles from './MemoryLineChart.module.css'

export interface LineSeries {
  label: string
  hue: Hue
  points: readonly (readonly [number, number])[]
  dashed?: boolean
}

interface LineChartProps {
  title: string
  series: readonly LineSeries[]
  xLabel: string
  yLabel: string
  formatX?: (x: number) => string
  formatY?: (y: number) => string
  /** Values shown on the x axis; defaults to the x of the first series. */
  xTicks?: readonly number[]
  yMax?: number
  logX?: boolean
  /** Vertical lines with a label, e.g. the size you picked. */
  markers?: readonly { x: number; label: string; hue?: Hue }[]
  /** Shaded x ranges with a label, e.g. an event. */
  bands?: readonly { from: number; to: number; label: string; hue?: Hue }[]
  caption?: string
}

const W = 560, L = 62, R = 16, B = 40

/** The smallest of 1, 2, 2.5, 5 or 10 × a power of ten that is at least v, so axis ticks are round numbers. */
function niceMax(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v) ?? 10 * p
}

/** Lines over x built from data; every series is named in the legend, and every point has a tooltip. */
export function MemoryLineChart({ title, series, xLabel, yLabel, formatX = String, formatY = String, xTicks, yMax, logX, markers = [], bands = [], caption }: LineChartProps) {
  // bands get two staggered rows of labels above the plot, so neighbouring labels never overlap
  const T = bands.length ? 44 : 26
  const H = 224 + T
  const xs = series.flatMap((s) => s.points.map((p) => p[0]))
  const ticks = xTicks ?? series[0]?.points.map((p) => p[0]) ?? []
  const tx = (x: number) => (logX ? Math.log10(Math.max(x, 1e-9)) : x)
  const x0 = tx(Math.min(...xs)), x1 = tx(Math.max(...xs))
  const top = yMax ?? niceMax(Math.max(...series.flatMap((s) => s.points.map((p) => p[1])), 1) * 1.04)
  const px = (x: number) => L + ((tx(x) - x0) / (x1 - x0 || 1)) * (W - L - R)
  const py = (y: number) => T + (1 - y / top) * (H - T - B)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${title}: ${series.map((s) => s.label).join(', ')}`}>
        {bands.map((b, i) => (
          <g key={b.label} style={hue(b.hue ?? 4)}>
            <rect x={px(b.from)} y={T} width={Math.max(2, px(b.to) - px(b.from))} height={H - T - B} className={styles.band} />
            <text x={(px(b.from) + px(b.to)) / 2} y={i % 2 ? T - 22 : T - 6} className={styles.bandLabel}>{b.label}</text>
          </g>
        ))}
        {yTicks.map((y) => (
          <g key={y}>
            <line x1={L} x2={W - R} y1={py(y)} y2={py(y)} className={styles.grid} />
            <text x={L - 6} y={py(y) + 4} className={styles.yTick}>{formatY(y)}</text>
          </g>
        ))}
        {ticks.map((x) => (
          <text key={x} x={px(x)} y={H - B + 16} className={styles.xTick}>{formatX(x)}</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} className={styles.axisLabel}>{xLabel}</text>
        <text x={12} y={(T + H - B) / 2} className={styles.axisLabel} transform={`rotate(-90 12 ${(T + H - B) / 2})`}>{yLabel}</text>
        {markers.map((m) => (
          <g key={m.label} style={hue(m.hue ?? 7)}>
            <line x1={px(m.x)} x2={px(m.x)} y1={T} y2={H - B} className={styles.marker} />
            <text x={px(m.x) + (px(m.x) > W * 0.7 ? -4 : 4)} y={T + 12} className={px(m.x) > W * 0.7 ? styles.markerLabelEnd : styles.markerLabel}>{m.label}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.label} style={hue(s.hue)}>
            <polyline points={s.points.map((p) => `${px(p[0])},${py(p[1])}`).join(' ')} className={s.dashed ? `${styles.line} ${styles.dashed}` : styles.line} />
            {s.points.length <= 40 &&
              s.points.map((p) => (
                <circle key={p[0]} cx={px(p[0])} cy={py(p[1])} r={3.2} className={styles.dot}>
                  <title>{`${s.label}: ${formatX(p[0])} → ${formatY(p[1])}`}</title>
                </circle>
              ))}
          </g>
        ))}
      </svg>
      <ul className={styles.legend}>
        {series.map((s) => (
          <li key={s.label} style={hue(s.hue)}>
            <span className={s.dashed ? `${styles.swatch} ${styles.swatchDashed}` : styles.swatch} />
            {s.label}
          </li>
        ))}
      </ul>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
