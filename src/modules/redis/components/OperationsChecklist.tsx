import { hue, type Hue } from '@/shared/figures'
import styles from './OperationsChecklist.module.css'

interface OperationsChecklistProps {
  title: string
  areas: readonly { area: string; hue: Hue; checks: readonly string[] }[]
}

/** A checklist laid out as cards, one per area, each item with a box to tick in your head. */
export function OperationsChecklist({ title, areas }: OperationsChecklistProps) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.grid}>
        {areas.map((a) => (
          <section key={a.area} className={styles.card} style={hue(a.hue)}>
            <h5 className={styles.area}>{a.area}</h5>
            <ul className={styles.list}>
              {a.checks.map((c) => (
                <li key={c}>
                  <span className={styles.box} aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </figure>
  )
}
