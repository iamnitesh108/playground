import { useMemo, useState, type ReactNode } from 'react'
import { hue, type Hue } from '@/shared/figures/palette'
import { CodeBlock, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { misestimate, parsePlan, postOrder, stoppedEarly, type PlanNode } from '../simulation/queryPlanningPlan'
import styles from './QueryPlanning.module.css'

export interface RecordedPlan {
  label: string
  sql: string
  plan: readonly string[]
}

interface PlanTreeProps {
  plans: readonly RecordedPlan[]
  /** What each node type does, by type ("Hash Join", "Seq Scan"…). */
  describe: Readonly<Record<string, ReactNode>>
}

/** Colour by what a node touches: index (c7), table pages (c3), temp files on disk (c4), the rest neutral. */
function hueOf(n: PlanNode): Hue | undefined {
  if (n.details.some((d) => /Disk:|temp (read|written)|Batches: ([2-9]|\d\d)/.test(d))) return 4
  if (/Index|Bitmap Index/.test(n.type)) return 7
  if (/Seq Scan|Bitmap Heap/.test(n.type)) return 3
  return undefined
}

const fmtRows = (n: number) => (n >= 10000 ? `${Math.round(n / 1000).toLocaleString()}k` : Math.round(n).toLocaleString())

function NodeCard({ node, order, selected, early, onSelect }: { node: PlanNode; order: number; selected: boolean; early: boolean; onSelect: () => void }) {
  const off = misestimate(node)
  const bad = off !== null && !early && (off > 10 || off < 0.1)
  const target = node.name.slice(node.type.length).trim()
  return (
    <button type="button" className={cx(styles.planNode, selected && styles.planNodeOn)} style={hue(hueOf(node))} onClick={onSelect} aria-pressed={selected}>
      <span className={styles.planOrder} title="Reading order: after its inputs">{order}</span>
      <span className={styles.planType}>{node.type}</span>
      {target && <span className={styles.planTarget}>{target}</span>}
      <span className={styles.planRows}>
        {node.est && <span>est {fmtRows(node.est.rows)}</span>}
        {node.actual && (
          <span>
            actual {fmtRows(node.actual.rows)}
            {node.actual.loops > 1 ? ` × ${node.actual.loops}` : ''}
          </span>
        )}
        {node.actual?.last != null && <span>{node.actual.last.toFixed(2)} ms</span>}
        {bad && <span className={styles.planBad}>{off! > 1 ? `${Math.round(off!)}× more rows than estimated` : `${Math.round(1 / off!)}× fewer`}</span>}
      </span>
    </button>
  )
}

function Branch(props: { node: PlanNode; order: Map<number, number>; selected: number; early: Set<number>; onSelect: (id: number) => void }) {
  const { node, order, selected, early, onSelect } = props
  return (
    <li className={styles.planItem}>
      <NodeCard node={node} order={order.get(node.id)!} selected={selected === node.id} early={early.has(node.id)} onSelect={() => onSelect(node.id)} />
      {node.children.length > 0 && (
        <ul className={styles.planChildren}>
          {node.children.map((c) => (
            <Branch key={c.id} {...props} node={c} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Recorded EXPLAIN ANALYZE plans drawn as trees: click a node to see what it did. */
export function QueryPlanningPlanTree({ plans, describe }: PlanTreeProps) {
  const [which, setWhich] = useState(0)
  const [selected, setSelected] = useState(0)
  const rec = plans[which]
  const parsed = useMemo(() => parsePlan(rec.plan), [rec])
  const order = useMemo(() => new Map(postOrder(parsed.root).map((n, i) => [n.id, i + 1])), [parsed])
  const early = useMemo(() => stoppedEarly(parsed.root), [parsed])
  const all = useMemo(() => postOrder(parsed.root), [parsed])
  const node = all.find((n) => n.id === selected) ?? parsed.root
  const exec = parsed.summary.find((s) => s.startsWith('Execution Time'))

  return (
    <Demo
      title="EXPLAIN explorer: recorded plans as trees"
      hint="Pick a plan, then click a node. Rows flow upwards: each node consumes the rows of the nodes below it. The numbers give a reading order — every node after its inputs."
      controls={
        <Segmented
          label="plan"
          value={which}
          onChange={(v) => {
            setWhich(v)
            setSelected(0)
          }}
          options={plans.map((p, i) => ({ value: i, label: p.label }))}
        />
      }
    >
      <CodeBlock language="sql" code={rec.sql} />
      <div className={styles.planLayout}>
        <ul className={styles.planTree}>
          <Branch node={parsed.root} order={order} selected={node.id} early={early} onSelect={setSelected} />
        </ul>
        <aside className={styles.planDetail} aria-live="polite">
          <div className={styles.planDetailTitle}>{node.name}</div>
          <p className={styles.planDescribe}>{describe[node.type] ?? 'A plan node.'}</p>
          <dl className={styles.planFacts}>
            {node.est && (
              <>
                <dt>estimated cost</dt>
                <dd>
                  {node.est.startup.toLocaleString()} → {node.est.total.toLocaleString()} <span className={styles.muted}>(first row → all rows)</span>
                </dd>
                <dt>estimated rows</dt>
                <dd>{node.est.rows.toLocaleString()}</dd>
              </>
            )}
            {node.actual && (
              <>
                <dt>actual rows</dt>
                <dd>
                  {node.actual.rows.toLocaleString()}
                  {node.actual.loops > 1 && <span className={styles.muted}> per loop, {node.actual.loops} loops</span>}
                  {early.has(node.id) && <span className={styles.muted}> — stopped early by the Limit above</span>}
                </dd>
              </>
            )}
            {node.actual?.last != null && (
              <>
                <dt>actual time</dt>
                <dd>
                  {node.actual.first} → {node.actual.last} ms <span className={styles.muted}>(includes the nodes below)</span>
                </dd>
              </>
            )}
          </dl>
          {node.details.length > 0 && <pre className={styles.planLines}>{node.details.join('\n')}</pre>}
          {exec && node.id === parsed.root.id && <div className={styles.muted}>{exec}</div>}
        </aside>
      </div>
    </Demo>
  )
}
