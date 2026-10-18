import { cx } from '@/shared/utils/cx'
import styles from './KeysFigures.module.css'

export interface KeyMove {
  key: string
  from: number
  to: number
}

interface KeysMoveListProps {
  moves: readonly KeyMove[]
  /** Hide the second chip when nothing is being compared. */
  compare?: boolean
}

/** Each key with its partition, and, when comparing, the partition after a change ("moves" when they differ). */
export function KeysMoveList({ moves, compare = true }: KeysMoveListProps) {
  return (
    <div className={styles.moves}>
      {moves.map((m, i) => {
        const moved = compare && m.from !== m.to
        return (
          <div key={`${m.key}-${i}`} className={cx(styles.move, moved && styles.moved)}>
            <span className={styles.moveKey} title={m.key}>{m.key}</span>
            <span className={styles.chip}>P{m.from}</span>
            {compare && (
              <>
                <span aria-hidden="true">→</span>
                <span className={cx(styles.chip, moved && styles.chipMoved)}>P{m.to}</span>
                <span className={styles.tag}>{moved ? 'moves' : 'stays'}</span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
