import { hue, type Hue } from '@/shared/figures'
import styles from './OffsetsTape.module.css'

export interface TapeMarker {
  /** Offset the marker points at (it may equal the log-end offset: "the next record"). */
  at: number
  label: string
  hue: Hue
  /** Draw above the tape instead of below. */
  above?: boolean
}

export interface TapeRow {
  label: string
  /** Log-end offset: cells 0 … end-1 exist. */
  end: number
  /** Log-start offset: cells before it were deleted by retention. */
  start?: number
  markers?: readonly TapeMarker[]
  /** A bracket above the tape between two offsets, e.g. the lag. */
  span?: { from: number; to: number; label: string; hue: Hue }
}

interface OffsetsTapeProps {
  title: string
  rows: readonly TapeRow[]
  caption?: string
}

const W = 760
const LABEL_W = 104
const LINE = 13

/** Marker labels on one side: a label moves one line further out only when it would touch the previous one. */
function levels(markers: readonly TapeMarker[], x: (o: number) => number): number[] {
  const order = markers.map((_, i) => i).sort((a, b) => markers[a].at - markers[b].at)
  const out = markers.map(() => 0)
  let prev: { x: number; level: number; width: number } | null = null
  for (const i of order) {
    const mx = x(markers[i].at)
    const level: number = prev && mx - prev.x < prev.width + 10 ? prev.level + 1 : 0
    out[i] = level
    prev = { x: mx, level, width: markers[i].label.length * 6 + 14 }
  }
  return out
}

/** Partitions drawn as tapes of offsets, with the pointers that matter (committed, position, log-end, lag). */
export function OffsetsTape({ title, rows, caption }: OffsetsTapeProps) {
  const maxCells = Math.max(...rows.map((r) => r.end + 1), 4)
  const cell = Math.min(46, (W - LABEL_W - 90) / maxCells)
  const x = (o: number) => LABEL_W + o * cell
  const layout = rows.map((r) => {
    const below = (r.markers ?? []).filter((m) => !m.above)
    const above = (r.markers ?? []).filter((m) => m.above)
    const lb = levels(below, x), la = levels(above, x)
    const top = 22 + (above.length ? (Math.max(...la) + 1) * LINE + 8 : 0) + (r.span ? 20 : 0)
    const bottom = 18 + (below.length ? (Math.max(...lb) + 1) * LINE + 10 : 0)
    return { below, above, lb, la, top, bottom }
  })
  // each row starts where the previous one's bottom margin ends
  const ys = layout.reduce<number[]>((acc, l, i) => [...acc, (i ? acc[i - 1] + layout[i - 1].bottom : 6) + l.top], [])
  const H = (ys.length ? ys[ys.length - 1] + layout[layout.length - 1].bottom : 6) + 4
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={title}>
        {rows.map((r, ri) => {
          const y = ys[ri]
          const L = layout[ri]
          const marker = (m: TapeMarker, level: number, above: boolean) => {
            const cx = x(m.at) + cell / 2 - 0.5
            const tip = above ? y - 15 : y + 15
            const ty = above ? y - 27 - level * LINE : y + 31 + level * LINE
            return (
              <g key={m.label} style={hue(m.hue)}>
                <path d={above ? `M${cx},${tip} l-5,-8 h10 z` : `M${cx},${tip} l-5,8 h10 z`} className={styles.markerHead} />
                {level > 0 && <line x1={cx} x2={cx} y1={above ? tip - 8 : tip + 8} y2={above ? ty + 3 : ty - 9} className={styles.leader} />}
                <text x={cx + 6} y={ty} className={styles.markerLabel}>{m.label}</text>
              </g>
            )
          }
          return (
            <g key={r.label}>
              <text x={8} y={y + 4} className={styles.rowLabel}>{r.label}</text>
              {Array.from({ length: r.end }, (_, o) => {
                const deleted = o < (r.start ?? 0)
                return (
                  <g key={o} style={hue(deleted ? 8 : 3)}>
                    <rect x={x(o) + 1} y={y - 13} width={cell - 3} height={26} rx={4} className={deleted ? styles.deleted : styles.cell} />
                    <text x={x(o) + cell / 2 - 0.5} y={y + 4} className={styles.offset}>{o}</text>
                  </g>
                )
              })}
              {/* the empty slot where the next record will go: the log-end offset */}
              <rect x={x(r.end) + 1} y={y - 13} width={cell - 3} height={26} rx={4} className={styles.next} />
              {r.span && r.span.to > r.span.from && (
                <g style={hue(r.span.hue)}>
                  <path d={`M${x(r.span.from) + 2},${y - 17 - (L.above.length ? (Math.max(...L.la) + 1) * LINE + 8 : 0)} v-5 H${x(r.span.to) - 2} v5`} className={styles.bracket} />
                  <text x={(x(r.span.from) + x(r.span.to)) / 2} y={y - 27 - (L.above.length ? (Math.max(...L.la) + 1) * LINE + 8 : 0)} className={styles.bracketLabel}>{r.span.label}</text>
                </g>
              )}
              {L.above.map((m, i) => marker(m, L.la[i], true))}
              {L.below.map((m, i) => marker(m, L.lb[i], false))}
            </g>
          )
        })}
      </svg>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
