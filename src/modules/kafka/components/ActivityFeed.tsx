import type { Activity } from '../simulation'
import styles from './ActivityFeed.module.css'

export function ActivityFeed({ items, empty = 'Nothing has happened yet.' }: { items: readonly Activity[]; empty?: string }) {
  return (
    <div className={styles.feed}>
      <div className={styles.title}>Activity</div>
      {items.length === 0 ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <ol className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item} data-kind={item.kind}>
              <span className={styles.kind}>{item.kind}</span>
              {item.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
