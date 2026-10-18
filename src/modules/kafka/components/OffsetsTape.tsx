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

interface Placement {
  level: number
  /** Text runs to the left of the marker instead of to the right. */
  left: boolean
}

const MAX_LEVEL = 3

/**
 * Marker labels on one side. Each label goes right of its marker on the nearest line; when that would touch
 * another label it may run to the left, or move a line further out — but never so that a leader line crosses a
 * label nearer the tape. A small exhaustive search: rows carry at most a handful of markers.
 */
function place(markers: readonly TapeMarker[], x: (o: number) => number, cell: number): Placement[] {
  const order = markers.map((_, i) => i).sort((a, b) => markers[a].at - markers[b].at)
  const cx = (i: number) => x(markers[i].at) + cell / 2
  const width = (i: number) => markers[i].label.length * 6.2 + 4
  const range = (i: number, p: Placement): [number, number] =>
    p.left ? [cx(i) - 6 - width(i), cx(i) + 2] : [cx(i) - 2, cx(i) + 6 + width(i)]
  let best: { cost: number; out: Placement[] } | null = null
  const out: Placement[] = markers.map(() => ({ level: 0, left: false }))
  const visit = (k: number, cost: number) => {
    if (best && cost >= best.cost) return
    if (k === order.length) {
      best = { cost, out: out.map((p) => ({ ...p })) }
      return
    }
    const i = order[k]
    for (let level = 0; level <= MAX_LEVEL; level++) {
      for (const left of [false, true]) {
        const p = { level, left }
        const [a, b] = range(i, p)
        if (a < 2 || b > W - 2) continue
        const clash = order.slice(0, k).some((j) => {
          const [c, d] = range(j, out[j])
          const sameLine = out[j].level === level && a < d + 8 && c < b + 8
          // a leader line from this marker would cut through a nearer label, or the other's through ours
          const cutsNearer = out[j].level < level && cx(i) > c - 2 && cx(i) < d + 2
          const cutByOther = level < out[j].level && cx(j) > a - 2 && cx(j) < b + 2
          return sameLine || cutsNearer || cutByOther
        })
        if (clash) continue
        out[i] = p
        visit(k + 1, cost + level * 10 + (left ? 1 : 0))
      }
    }
  }
  visit(0, 0)
  return best ? (best as { out: Placement[] }).out : out
}

/** Partitions drawn as tapes of offsets, with the pointers that matter (committed, position, log-end, lag). */
export function OffsetsTape({ title, rows, caption }: OffsetsTapeProps) {
  const maxCells = Math.max(...rows.map((r) => r.end + 1), 4)
  const cell = Math.min(46, (W - LABEL_W - 90) / maxCells)
  const x = (o: number) => LABEL_W + o * cell
  const layout = rows.map((r) => {
    const below = (r.markers ?? []).filter((m) => !m.above)
    const above = (r.markers ?? []).filter((m) => m.above)
    const pb = place(below, x, cell), pa = place(above, x, cell)
    const lb = pb.map((p) => p.level), la = pa.map((p) => p.level)
    const top = 22 + (above.length ? (Math.max(...la) + 1) * LINE + 8 : 0) + (r.span ? 20 : 0)
    const bottom = 18 + (below.length ? (Math.max(...lb) + 1) * LINE + 10 : 0)
    return { below, above, pb, pa, lb, la, top, bottom }
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
          const marker = (m: TapeMarker, { level, left }: Placement, above: boolean) => {
            const cx = x(m.at) + cell / 2 - 0.5
            const tip = above ? y - 15 : y + 15
            const ty = above ? y - 27 - level * LINE : y + 31 + level * LINE
            return (
              <g key={m.label} style={hue(m.hue)}>
                <path d={above ? `M${cx},${tip} l-5,-8 h10 z` : `M${cx},${tip} l-5,8 h10 z`} className={styles.markerHead} />
                {level > 0 && <line x1={cx} x2={cx} y1={above ? tip - 8 : tip + 8} y2={above ? ty + 3 : ty - 9} className={styles.leader} />}
                <text x={left ? cx - 6 : cx + 6} y={ty} textAnchor={left ? 'end' : 'start'} className={styles.markerLabel}>{m.label}</text>
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
              {L.above.map((m, i) => marker(m, L.pa[i], true))}
              {L.below.map((m, i) => marker(m, L.pb[i], false))}
            </g>
          )
        })}
      </svg>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
