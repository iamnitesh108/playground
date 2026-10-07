import { useState, type ReactNode } from 'react'
import { cx } from '@/shared/utils/cx'
import styles from './Tabs.module.css'

export interface TabItem {
  label: string
  content: ReactNode
}

export function Tabs({ items }: { items: readonly TabItem[] }) {
  const [active, setActive] = useState(0)
  return (
    <div className={styles.tabs}>
      <div className={styles.list} role="tablist">
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={cx(styles.tab, i === active && styles.active)}
            onClick={() => setActive(i)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{items[active].content}</div>
    </div>
  )
}
