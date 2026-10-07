import type { ReactNode } from 'react'
import styles from './TermList.module.css'

export interface TermItem {
  term: string
  definition: ReactNode
}

/** Compact definition list for the key words a lesson introduces. */
export function TermList({ items }: { items: readonly TermItem[] }) {
  return (
    <dl className={styles.list}>
      {items.map((item) => (
        <div key={item.term} className={styles.row}>
          <dt className={styles.term}>{item.term}</dt>
          <dd className={styles.definition}>{item.definition}</dd>
        </div>
      ))}
    </dl>
  )
}
