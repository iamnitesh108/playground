import { hue } from '@/shared/figures'
import styles from './TopicsPartitionsSegments.module.css'

/** Inside one partition directory: closed segments, the active segment, and their index files (schematic). */
export function TopicsPartitionsSegments() {
  const segments = [
    { base: '00000000000000000000', range: 'offsets 0 … 41 230', state: 'closed · full (segment.bytes, 1 GB by default)', active: false, width: 300 },
    { base: '00000000000000041231', range: 'offsets 41 231 …', state: 'active · new writes go here', active: true, width: 180 },
  ]
  let x = 36
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>A partition on disk: a directory of segment files</figcaption>
      <svg viewBox="0 0 760 210" className={styles.svg} role="img" aria-label="Partition directory with a closed segment and an active segment">
        <g style={hue(3)}>
          <rect x={16} y={14} width={728} height={182} rx={10} className={styles.dir} />
          <text x={32} y={36} className={styles.dirName}>/var/lib/kafka/orders-0/</text>
        </g>
        {segments.map((seg) => {
          const sx = x
          x += seg.width + 24
          return (
            <g key={seg.base}>
              <g style={hue(3)}>
                <rect x={sx} y={54} width={seg.width} height={48} rx={6} className={seg.active ? styles.active : styles.segment} />
                {/* records as ticks; the active segment keeps growing to the right */}
                {Array.from({ length: Math.floor(seg.width / 12) }, (_, i) => (
                  <line key={i} x1={sx + 8 + i * 12} x2={sx + 8 + i * 12} y1={84} y2={96} className={styles.tick} />
                ))}
                <text x={sx + 10} y={72} className={styles.fileName}>{seg.base}.log</text>
              </g>
              <text x={sx} y={118} className={styles.small}>{seg.range}</text>
              <text x={sx} y={132} className={styles.small}>{seg.state}</text>
              <g style={hue(5)}>
                <rect x={sx} y={144} width={Math.min(150, seg.width - 10)} height={20} rx={4} className={styles.index} />
                <text x={sx + 6} y={158} className={styles.indexText}>.index: offset → position</text>
                <rect x={sx} y={168} width={Math.min(150, seg.width - 10)} height={20} rx={4} className={styles.index} />
                <text x={sx + 6} y={182} className={styles.indexText}>.timeindex: time → offset</text>
              </g>
              {seg.active && (
                <g style={hue(7)}>
                  <path d={`M${sx + seg.width + 50},78 h-38`} className={styles.write} markerEnd="url(#tp-arrow)" />
                  <text x={sx + seg.width + 54} y={82} className={styles.writeText}>appends</text>
                </g>
              )}
            </g>
          )
        })}
        <defs>
          <marker id="tp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--c7)" />
          </marker>
        </defs>
      </svg>
      <div className={styles.caption}>Schematic (file names follow the real naming: the base offset, zero-padded to 20 digits). Retention deletes old data a whole closed segment at a time; the active segment is never deleted.</div>
    </figure>
  )
}
