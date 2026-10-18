import { useState } from 'react'
import { hue } from '@/shared/figures/palette'
import { Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { CUSTOMERS, ENTRIES, evaluate, type CompositeQuery } from '../simulation/indexesComposite'
import styles from './Indexes.module.css'

const QUERIES: { value: CompositeQuery; label: string }[] = [
  { value: 'both', label: 'both columns' },
  { value: 'leading', label: 'first column' },
  { value: 'second', label: 'second column only' },
  { value: 'sorted', label: 'first + ORDER BY second' },
  { value: 'secondOrder', label: 'ORDER BY second' },
]

const VERDICT = { yes: 'index used', skip: 'skip scan (PG 18) or no index', no: 'index cannot help' } as const

/** The leaf level of an index on (customer_id, created_at), and what each query reads from it. */
export function IndexesCompositeView() {
  const [q, setQ] = useState<CompositeQuery>('leading')
  const r = evaluate(q)
  const hit = new Set(r.matches)
  return (
    <Demo
      title="The leaf level of an index on (customer_id, created_at)"
      hint="Entries are sorted by customer first, then by date within each customer — like a phone book sorted by surname, then first name. Pick a query."
      controls={<Segmented label="query" value={q} onChange={setQ} options={QUERIES} />}
    >
      <code className={styles.compositeSql}>{r.sql}</code>
      <div className={styles.compositeLeaf} style={hue(7)}>
        {CUSTOMERS.map((c) => (
          <div key={c} className={styles.compositeGroup}>
            <div className={styles.compositeCustomer}>customer {c}</div>
            <div className={styles.compositeEntries}>
              {ENTRIES.map((e, i) =>
                e.customer === c ? (
                  <span key={i} className={cx(styles.compositeEntry, hit.has(i) && styles.compositeHit)}>
                    {e.date}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.compositeStats}>
        <span className={cx(styles.badge, r.usable === 'yes' ? styles.badgeOk : r.usable === 'skip' ? styles.badgeMaybe : styles.badgeNo)}>{VERDICT[r.usable]}</span>
        <span className={styles.badge}>matching entries: {r.matches.length}</span>
        <span className={styles.badge}>separate stretches: {r.ranges}</span>
        {r.ordered !== null && <span className={styles.badge}>{r.ordered ? 'already in ORDER BY order: no sort' : 'not in ORDER BY order: needs a sort'}</span>}
      </div>
      <p className={styles.compositeText}>{r.text}</p>
    </Demo>
  )
}
