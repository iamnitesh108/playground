import { useMemo, useState } from 'react'
import { hue } from '@/shared/figures'
import { Button, CodeBlock, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { normalise, resultKey, run, toSql, type QuerySpec, type Row, type Stage } from '../simulation/usingPostgresQuery'
import styles from './UsingPostgresPipeline.module.css'

interface Props {
  /** SQL text → result rows ("a|b|c") recorded on a real server for every combination. */
  recorded: Readonly<Record<string, readonly string[]>>
}

const START: QuerySpec = { from: 'inner', where: 'none', group: 'none', having: 'none', order: 'amount', limit: 'none' }

/** Rows of the previous stage that this stage keeps, for clauses that only filter. */
function keptSet(stage: Stage): Set<Row> {
  return new Set(stage.rows)
}

function StageTable({ stage, before }: { stage: Stage; before: Stage | null }) {
  // filters (WHERE, HAVING, LIMIT) show what they removed, struck through
  const filters = before && (stage.clause === 'WHERE' || stage.clause === 'HAVING' || stage.clause === 'LIMIT') && stage.sql !== null
  const rows = filters ? before.rows : stage.rows
  const kept = keptSet(stage)
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {stage.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            {stage.groupSizes && <th>rows in group</th>}
            {filters && <th aria-label="kept or removed" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const removed = filters && !kept.has(r)
            return (
              <tr key={i} className={cx(removed && styles.removed)} style={hue(removed ? 8 : undefined)}>
                {stage.columns.map((c) => (
                  <td key={c} className={cx(r[c] === null && styles.null)}>{r[c] ?? 'NULL'}</td>
                ))}
                {stage.groupSizes && <td>{stage.groupSizes[i]}</td>}
                {filters && <td className={styles.tag}>{removed ? 'removed' : 'kept'}</td>}
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={stage.columns.length + 1} className={styles.empty}>(0 rows)</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Choose the parts of a SELECT and watch the sample rows pass through each clause in evaluation order. */
export function UsingPostgresPipeline({ recorded }: Props) {
  const [spec, setSpec] = useState<QuerySpec>(START)
  const [at, setAt] = useState(0)
  const s = useMemo(() => normalise(spec), [spec])
  const stages = useMemo(() => run(s), [s])
  const sql = toSql(s)
  const server = recorded[sql]
  const same = server !== undefined && JSON.stringify(server) === JSON.stringify(resultKey(stages))
  const set = (patch: Partial<QuerySpec>) => setSpec({ ...spec, ...patch })
  const usedAt = (i: number) => stages[i].sql !== null || stages[i].clause === 'FROM' || stages[i].clause === 'SELECT'
  // Back and Next step over clauses the query does not use, so the stage shown always did something
  const used = stages.map((_, i) => i).filter(usedAt)
  const current = usedAt(at) ? at : (used.find((i) => i > at) ?? used[used.length - 1])
  const prev = [...used].reverse().find((i) => i < current)
  const next = used.find((i) => i > current)
  const stage = stages[current]

  return (
    <Demo
      title="Run a SELECT clause by clause"
      hint="Pick the parts of the query. PostgreSQL evaluates them in this order — not in the order you write them. Click a clause (or use Next) to see the rows after it; clauses the query does not use are skipped."
      controls={
        <div className={styles.controls}>
          <Segmented label="FROM" value={s.from} onChange={(from) => set({ from })} options={[{ value: 'orders', label: 'orders only' }, { value: 'inner', label: 'customers JOIN orders' }, { value: 'left', label: 'customers LEFT JOIN orders' }]} />
          <Segmented label="WHERE" value={s.where} onChange={(where) => set({ where })} options={[{ value: 'none', label: 'none' }, { value: 'paid', label: "status = 'paid'" }, { value: 'big', label: 'amount >= 40' }]} />
          <Segmented label="GROUP BY" value={s.group} onChange={(group) => set({ group })} options={[{ value: 'none', label: 'none' }, { value: 'customer', label: 'customer' }]} />
          {s.group === 'customer' && (
            <Segmented label="HAVING" value={s.having} onChange={(having) => set({ having })} options={[{ value: 'none', label: 'none' }, { value: 'two', label: 'count >= 2' }]} />
          )}
          <Segmented label="ORDER BY" value={s.order} onChange={(order) => set({ order })} options={[{ value: 'amount', label: s.group === 'customer' ? 'total, high first' : 'amount, high first' }, { value: 'key', label: s.group === 'customer' ? (s.from === 'orders' ? 'customer_id' : 'name') : 'id' }]} />
          <Segmented label="LIMIT" value={s.limit} onChange={(limit) => set({ limit })} options={[{ value: 'none', label: 'none' }, { value: '3', label: '3' }]} />
        </div>
      }
    >
      <CodeBlock title="the query" language="sql" code={sql} />

      <ol className={styles.pipeline} aria-label="clauses in evaluation order">
        {stages.map((st, i) => {
          const isUsed = usedAt(i)
          return (
            <li key={st.clause} className={styles.step}>
              <button
                type="button"
                className={cx(styles.chip, i === current && styles.current, !isUsed && styles.unused)}
                style={hue(isUsed ? (i === current ? 7 : 3) : undefined)}
                onClick={() => setAt(i)}
                disabled={!isUsed}
                aria-pressed={i === current}
              >
                <span className={styles.order}>{i + 1}</span>
                <span className={styles.clause}>{st.clause}</span>
                <span className={styles.count}>{isUsed ? `${st.rows.length} row${st.rows.length === 1 ? '' : 's'}` : 'not used'}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className={styles.stageHead}>
        <div>
          <strong>
            {current + 1}. {stage.clause}
          </strong>{' '}
          {stage.sql && <code className={styles.sql}>{stage.sql.replace(/\n\s*/g, ' ')}</code>}
          <p className={styles.note}>{stage.note}</p>
        </div>
        <div className={styles.nav}>
          <Button size="sm" onClick={() => prev !== undefined && setAt(prev)} disabled={prev === undefined}>Back</Button>
          <Button size="sm" variant="primary" onClick={() => next !== undefined && setAt(next)} disabled={next === undefined}>Next</Button>
        </div>
      </div>
      <StageTable stage={stage} before={prev !== undefined ? stages[prev] : null} />

      <p className={styles.verdict} style={hue(same ? 6 : 8)}>
        <span className={styles.dot} aria-hidden="true" />
        {same
          ? `Same ${server.length} row${server.length === 1 ? '' : 's'}, in the same order, as PostgreSQL 18 returned for this exact query (recorded).`
          : 'No recording for this query.'}
      </p>
    </Demo>
  )
}
