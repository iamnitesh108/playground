import { hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import { formatBytes, type SegmentFiles } from './SegmentsParse'
import styles from './SegmentsFigures.module.css'

const PREALLOCATED = 10 * 1024 * 1024 - 4

/** A segment file name with its leading zeros faint, so the base offset stands out. */
function BaseName({ base }: { base: number }) {
  const digits = String(base)
  return (
    <span className={styles.baseName}>
      <span className={styles.zeros}>{'0'.repeat(20 - digits.length)}</span>
      {digits}
    </span>
  )
}

function IndexFile({ ext, size }: { ext: string; size?: number }) {
  if (size === undefined) return <span className={cx(styles.chip, styles.chipMissing)}>{ext}: not created yet</span>
  return (
    <span className={styles.chip}>
      {ext} {size >= PREALLOCATED ? `${formatBytes(size)} preallocated` : formatBytes(size)}
    </span>
  )
}

interface SegmentsDirProps {
  segments: readonly SegmentFiles[]
  /** segment.bytes: the .log bar is drawn against it. */
  segmentBytes: number
  /** The log end offset, so the last card can say which offsets it holds. */
  logEnd: number
}

/** A recorded partition directory: one card per segment, coloured by state, each with its .log fill and index files. */
export function SegmentsDir({ segments, segmentBytes, logEnd }: SegmentsDirProps) {
  const live = segments.filter((s) => !s.deleted)
  const active = live.at(-1)
  return (
    <div className={styles.dir}>
      {segments.map((seg, i) => {
        const next = segments[i + 1]?.base ?? logEnd
        const state = seg.deleted ? '.deleted — waiting to be removed' : seg === active ? 'active — new writes go here' : 'closed — read-only'
        const records = next > seg.base ? `offsets ${seg.base} … ${next - 1}` : 'empty'
        return (
          <div key={seg.base} className={cx(styles.card, seg.deleted && styles.cardDeleted, seg === active && styles.cardActive)} style={hue(seg.deleted ? 8 : 3)}>
            <div className={styles.cardHead}>
              <BaseName base={seg.base} />
              <span className={styles.badge}>{state}</span>
            </div>
            <div className={styles.fill} aria-hidden>
              <div className={styles.fillBar} style={{ width: `${Math.min(100, (seg.log / segmentBytes) * 100)}%` }} />
            </div>
            <div className={styles.cardMeta}>
              <span>.log {formatBytes(seg.log)} of {formatBytes(segmentBytes)}</span>
              <span>{records}</span>
            </div>
            <div className={styles.chips}>
              <IndexFile ext=".index" size={seg.index} />
              <IndexFile ext=".timeindex" size={seg.timeindex} />
              {seg.snapshot !== undefined && <span className={styles.chip}>.snapshot {formatBytes(seg.snapshot)}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
