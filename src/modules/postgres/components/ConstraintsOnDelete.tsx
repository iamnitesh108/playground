import { hue, type Hue } from '@/shared/figures'
import styles from './ConstraintsOnDelete.module.css'

interface Line {
  readonly id: number
  readonly order_id: number | null
}

interface Outcome {
  readonly del: { readonly kind: string; readonly tag?: string; readonly code?: string; readonly message?: string }
  readonly left: readonly Line[]
}

interface ConstraintsOnDeleteProps {
  /** The child rows before the DELETE. */
  before: readonly Line[]
  /** Recorded result of DELETE FROM orders WHERE id = 1, per ON DELETE action. */
  outcomes: Readonly<Record<string, Outcome>>
}

type Fate = 'kept' | 'deleted' | 'set null' | 'untouched'
const FATE_HUE: Record<Fate, Hue> = { kept: 3, untouched: 3, deleted: 8, 'set null': 4 }

/** What DELETE of a parent did to its child rows, one card per ON DELETE action, from the recorded rows. */
export function ConstraintsOnDelete({ before, outcomes }: ConstraintsOnDeleteProps) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>
        DELETE FROM orders WHERE id = 1 — order 1 has three lines, order 2 has one (recorded per ON DELETE action)
      </figcaption>
      <div className={styles.grid}>
        {Object.entries(outcomes).map(([action, o]) => {
          const failed = o.del.kind === 'error'
          return (
            <div key={action} className={styles.card} style={hue(failed ? 8 : 6)}>
              <div className={styles.head}>
                <span className={styles.action}>ON DELETE {action}</span>
                <span className={styles.result}>{failed ? `ERROR ${o.del.code}` : o.del.tag}</span>
              </div>
              <ul className={styles.lines}>
                {before.map((line) => {
                  const after = o.left.find((l) => l.id === line.id)
                  const fate: Fate = line.order_id !== 1 ? 'untouched' : !after ? 'deleted' : after.order_id === null ? 'set null' : 'kept'
                  return (
                    <li key={line.id} className={styles.line} style={hue(FATE_HUE[fate])} data-fate={fate}>
                      <span className={styles.lineId}>
                        line {line.id} <span className={styles.ref}>→ {after ? (after.order_id === null ? 'NULL' : `order ${after.order_id}`) : `order ${line.order_id}`}</span>
                      </span>
                      <span className={styles.fate}>{fate}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
