import { useState } from 'react'
import { hue } from '@/shared/figures'
import { CodeBlock, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import styles from './SchemaDesignFigures.module.css'

const BEFORE: [string, string][] = [['10', '1'], ['11', '1'], ['12', '2']]

/** Rows "id | customer_id" from a recorded psql result. */
function rowsOf(transcript: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of transcript.matchAll(/^\s*(\d+)\s*\|\s*(\d*)\s*$/gm)) out.set(m[1], m[2])
  return out
}

/** Delete customer 1 under each ON DELETE choice: the recorded result, and the orders table after it. */
export function SchemaDesignOnDelete({ runs }: { runs: Readonly<Record<string, string>> }) {
  const actions = Object.keys(runs)
  const [action, setAction] = useState(actions.includes('CASCADE') ? 'CASCADE' : actions[0])
  const after = rowsOf(runs[action])
  const failed = /ERROR:/.test(runs[action])
  return (
    <Demo
      title="DELETE FROM customers WHERE id = 1"
      hint="Customer 1 has orders 10 and 11; customer 2 has order 12. The foreign key on orders.customer_id decides what the delete does."
      controls={<Segmented label="ON DELETE" value={action} onChange={setAction} options={actions.map((a) => ({ value: a, label: a }))} />}
    >
      <div className={styles.rowsFigure}>
        {BEFORE.map(([id, customer]) => {
          const now = after.get(id)
          const state = now === undefined ? 'deleted' : now === '' ? 'set to NULL' : customer === '1' && failed ? 'kept — delete refused' : 'unchanged'
          const h = state === 'deleted' ? 8 : state === 'set to NULL' ? 4 : customer === '1' ? 7 : undefined
          return (
            <div key={id} className={cx(styles.rowCard, state === 'deleted' && styles.gone)} style={hue(h)}>
              <code>order {id}</code>
              <span>
                customer_id {customer} → {now === undefined ? '—' : now === '' ? 'NULL' : now}
              </span>
              <strong>{state}</strong>
            </div>
          )
        })}
      </div>
      <CodeBlock title={`recorded: ON DELETE ${action}`} language="text" code={runs[action]} />
    </Demo>
  )
}
