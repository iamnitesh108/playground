import { hue, type Hue } from '@/shared/figures'
import styles from './HeapPageViewMap.module.css'

export interface MapTuple {
  lp: number
  /** lp_off: where the tuple starts. */
  off: number
  /** lp_len: its length in bytes. */
  len: number
  /** Header length (t_hoff); drawn in a lighter shade when given. */
  hoff?: number
  state?: 'live' | 'dead' | 'new'
}

interface HeapPageViewMapProps {
  title: string
  lower: number
  upper: number
  special?: number
  tuples: readonly MapTuple[]
  /** Line pointers that point to no tuple (redirect, unused, dead). */
  emptyPointers?: number
  pageSize?: number
  caption?: string
}

type Kind = 'header' | 'pointer' | 'free' | 'thead' | 'data' | 'dead' | 'new' | 'pad' | 'special'

const CELL = 8
const PER_ROW = 32

const KINDS: Record<Kind, { label: string; hue?: Hue }> = {
  header: { label: 'page header', hue: 7 },
  pointer: { label: 'line pointers', hue: 7 },
  free: { label: 'free space' },
  thead: { label: 'tuple headers', hue: 3 },
  data: { label: 'tuple data', hue: 3 },
  new: { label: 'new tuples', hue: 6 },
  dead: { label: 'dead tuples', hue: 8 },
  pad: { label: 'alignment padding' },
  special: { label: 'special space', hue: 5 },
}

/**
 * One page drawn to scale, 8 bytes per cell, 256 bytes per row: the header and line
 * pointers fill it from the start, tuples from the end, free space sits in between.
 */
export function HeapPageViewMap({ title, lower, upper, special, tuples, emptyPointers = 0, pageSize = 8192, caption }: HeapPageViewMapProps) {
  const end = special ?? pageSize
  const kinds: Kind[] = Array.from({ length: pageSize / CELL }, (_, i) => {
    const at = i * CELL
    if (at < 24) return 'header'
    if (at < lower) return 'pointer'
    if (at >= end) return 'special'
    if (at < upper) return 'free'
    return 'pad'
  })
  const owner: (MapTuple | null)[] = kinds.map(() => null)
  for (const t of tuples) {
    for (let at = t.off; at < t.off + t.len; at += 1) {
      const i = Math.floor(at / CELL)
      if (i >= kinds.length) break
      owner[i] = t
      kinds[i] = t.state === 'dead' ? 'dead' : t.state === 'new' ? 'new' : t.hoff !== undefined && at < t.off + t.hoff ? 'thead' : 'data'
    }
  }
  const bytes: Partial<Record<Kind, number>> = {
    header: 24,
    pointer: lower - 24,
    free: upper - lower,
    special: pageSize - end,
  }
  for (const t of tuples) {
    const k: Kind = t.state === 'dead' ? 'dead' : t.state === 'new' ? 'new' : 'data'
    if (k === 'data' && t.hoff !== undefined) {
      bytes.thead = (bytes.thead ?? 0) + t.hoff
      bytes.data = (bytes.data ?? 0) + t.len - t.hoff
    } else bytes[k] = (bytes[k] ?? 0) + t.len
  }
  const used = Object.values(bytes).reduce((n, b) => n + (b ?? 0), 0)
  if (pageSize - used > 0 && tuples.length) bytes.pad = pageSize - used
  const legend = (Object.keys(KINDS) as Kind[]).filter((k) => (bytes[k] ?? 0) > 0)

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.page}>
        <div className={styles.axis} aria-hidden="true">
          {Array.from({ length: pageSize / CELL / PER_ROW }, (_, r) => (
            <span key={r}>{r % 4 === 0 ? r * CELL * PER_ROW : ''}</span>
          ))}
        </div>
        <div className={styles.grid} role="img" aria-label={legend.map((k) => `${KINDS[k].label} ${bytes[k]} bytes`).join(', ')}>
          {kinds.map((k, i) => {
            const t = owner[i]
            const first = t && Math.floor(t.off / CELL) === i
            return (
              <span
                key={i}
                className={styles.cell}
                data-kind={k}
                data-first={first || undefined}
                style={hue(KINDS[k].hue)}
                title={t ? `lp ${t.lp}: bytes ${t.off}–${t.off + t.len - 1} (${t.len} B)` : `${KINDS[k].label}, byte ${i * CELL}`}
              />
            )
          })}
        </div>
      </div>
      <ul className={styles.legend}>
        {legend.map((k) => (
          <li key={k} style={hue(KINDS[k].hue)}>
            <span className={styles.swatch} data-kind={k} />
            {KINDS[k].label}
            <span className={styles.bytes}>
              {k === 'pointer' ? `${(lower - 24) / 4} × 4 = ${bytes[k]} B` : `${bytes[k]?.toLocaleString()} B`}
            </span>
          </li>
        ))}
        {emptyPointers > 0 && <li className={styles.note}>{emptyPointers} pointer(s) hold no tuple</li>}
      </ul>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
