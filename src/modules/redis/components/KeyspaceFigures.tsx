import { hue, type Hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import styles from './KeyspaceFigures.module.css'

/** One hash table as reported by DEBUG HTSTATS: bucket count and keys in it. */
export interface HtTable {
  size: number
  elements: number
}

interface RehashFigureProps {
  title: string
  snapshots: readonly { label: string; tables: readonly HtTable[] }[]
}

/**
 * Snapshots of the keyspace dict: each table drawn with a width proportional to its bucket count,
 * filled by the share of buckets' worth of keys it holds. During a rehash two tables exist.
 */
export function KeyspaceRehashFigure({ title, snapshots }: RehashFigureProps) {
  const biggest = Math.max(...snapshots.flatMap((s) => s.tables.map((t) => t.size)), 1)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.snapshots}>
        {snapshots.map((s) => (
          <div key={s.label} className={styles.snapshot}>
            <div className={styles.snapLabel}>{s.label}</div>
            <div className={styles.tables}>
              {s.tables.map((t, i) => (
                <div key={i} className={styles.tableRow} style={hue((i === 0 ? 3 : 5) as Hue)}>
                  <span className={styles.tableName}>{i === 0 ? 'table 0' : 'table 1 (new)'}</span>
                  <span className={styles.tableTrack} style={{ width: `${(t.size / biggest) * 100}%` }}>
                    <span className={styles.tableFill} style={{ width: `${Math.min(100, (t.elements / t.size) * 100)}%` }} />
                  </span>
                  <span className={styles.tableNumbers}>
                    {t.size.toLocaleString()} buckets · {t.elements.toLocaleString()} keys
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span style={hue(3)}><i /> table 0 — the current table</span>
        <span style={hue(5)}><i /> table 1 — twice as big, filled bucket by bucket</span>
        <span className={styles.note}>bar length = buckets, filled part = keys per bucket (1.0 = full)</span>
      </div>
    </figure>
  )
}

interface CursorFigureProps {
  title: string
  size: number
  /** Full reversed-bit visiting order (without the starting 0). */
  order: readonly number[]
  /** Cursors the recorded SCAN calls returned. */
  seen: readonly number[]
}

const bits = (n: number, size: number) => n.toString(2).padStart(Math.log2(size), '0')
const reverse = (s: string) => s.split('').reverse().join('')

/** The buckets in index order, numbered by when SCAN visits them; below, the cursor bits read backwards count up. */
export function KeyspaceCursorFigure({ title, size, order, seen }: CursorFigureProps) {
  const visits = [0, ...order.filter((c) => c !== 0)]
  const stepOf = new Map(visits.map((c, i) => [c, i + 1]))
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.label}>buckets in index order — the number is when SCAN visits each one</div>
      <div className={styles.buckets}>
        {Array.from({ length: size }, (_, b) => (
          <div key={b} className={cx(styles.bucket, (seen.includes(b) || b === 0) && styles.bucketSeen)} style={hue(3)}>
            <span className={styles.bucketIndex}>{b}</span>
            <span className={styles.bucketStep}>#{stepOf.get(b)}</span>
          </div>
        ))}
      </div>
      <div className={styles.label}>the cursor sequence: bits as returned, and read backwards</div>
      <div className={styles.cursorRow}>
        {visits.map((c, i) => (
          <div key={c} className={styles.cursor} style={hue((seen.includes(c) || c === 0 ? 1 : 7) as Hue)}>
            <span className={styles.cursorStep}>#{i + 1}</span>
            <span className={styles.cursorValue}>{c}</span>
            <code className={styles.cursorBits}>{bits(c, size)}</code>
            <code className={styles.cursorReversed}>{reverse(bits(c, size))}</code>
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span style={hue(1)}><i /> returned by a recorded SCAN call</span>
        <span style={hue(7)}><i /> visited inside a call (COUNT is a hint) — not returned as a cursor</span>
        <span className={styles.note}>last row: the bits reversed — 0, 1, 2, 3… in binary</span>
      </div>
    </figure>
  )
}
