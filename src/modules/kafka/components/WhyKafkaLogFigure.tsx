import { hue } from '@/shared/figures'
import styles from './WhyKafkaLogFigure.module.css'

const CELL = 46
const GAP = 6
const X0 = 30
const COUNT = 8
const cx = (o: number) => X0 + o * (CELL + GAP)

/** The log: records only ever added at the end; each reader keeps its own bookmark. */
export function WhyKafkaLogFigure() {
  const readers = [
    { name: 'email reads next', offset: 3, hue: 1 as const },
    { name: 'analytics reads next', offset: 6, hue: 2 as const },
  ]
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>The log: append at the end, read from anywhere</figcaption>
      <svg viewBox="0 0 760 170" className={styles.svg} role="img" aria-label="An append-only log with two readers at different offsets">
        <text x={X0} y={22} className={styles.label}>topic orders — offsets 0, 1, 2, … (oldest left)</text>
        {Array.from({ length: COUNT }, (_, o) => (
          <g key={o} style={hue(3)}>
            <rect x={cx(o)} y={40} width={CELL} height={40} rx={6} className={styles.cell} />
            <text x={cx(o) + CELL / 2} y={58} className={styles.cellText}>order</text>
            <text x={cx(o) + CELL / 2} y={73} className={styles.offset}>{o}</text>
          </g>
        ))}
        {/* the next record arriving at the end, over and over */}
        <g style={hue(7)} className={styles.arriving}>
          <rect x={cx(COUNT)} y={40} width={CELL} height={40} rx={6} className={styles.cellNew} />
          <text x={cx(COUNT) + CELL / 2} y={58} className={styles.cellText}>new</text>
          <text x={cx(COUNT) + CELL / 2} y={73} className={styles.offset}>{COUNT}</text>
        </g>
        <g style={hue(7)}>
          <rect x={620} y={36} width={124} height={48} rx={24} className={styles.producer} />
          <text x={682} y={57} className={styles.producerText}>producer</text>
          <text x={682} y={72} className={styles.small}>only appends</text>
        </g>
        {readers.map((r) => (
          <g key={r.name} style={hue(r.hue)}>
            <path d={`M${cx(r.offset) + CELL / 2},88 l-7,11 h14 z`} className={styles.marker} />
            <text x={cx(r.offset) + CELL / 2} y={116} className={styles.readerText}>{r.name}</text>
            <text x={cx(r.offset) + CELL / 2} y={131} className={styles.small}>offset {r.offset}</text>
          </g>
        ))}
        <text x={X0} y={160} className={styles.note}>Reading moves a reader’s bookmark; it never removes the record. Old records leave only through retention.</text>
      </svg>
    </figure>
  )
}
