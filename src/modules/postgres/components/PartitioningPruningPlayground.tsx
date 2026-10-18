import { useMemo, useState } from 'react'
import { StatTiles, hue } from '@/shared/figures'
import { CodeBlock, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { DURABILITY } from '../data/durability'
import { monthName, partitionsOf, prune, whereOf, type Predicate, type Strategy } from '../simulation/partitionPruning'
import styles from './PartitioningPruningPlayground.module.css'

const P = DURABILITY.part
// row counts recorded on the real tables
const ROWS = new Map<string, number>([
  ...P.sizes.map((s) => [s.name, s.rows] as const),
  ...P.listCounts.map((s) => [s.name, s.rows] as const),
  ...P.hashCounts.map((s) => [s.name, s.rows] as const),
])
const HASH = new Map<number, string>(P.hashOf.map((h) => [h.user_id, h.name]))
const REGIONS = ['de', 'fr', 'nl', 'us', 'ca', 'br', 'jp']
const TABLE: Record<Strategy, string> = { range: 'events', list: 'customers', hash: 'carts' }

type RangeFilter = 'range' | 'param' | 'expression' | 'other-column'

const STAGE = {
  planner: { label: 'pruned by the planner', hue: 7 },
  executor: { label: 'pruned at execution start', hue: 5 },
  none: { label: 'nothing pruned', hue: 8 },
} as const

/** Pick a partitioning and a WHERE clause; see which partitions the plan keeps. */
export function PartitioningPruningPlayground() {
  const [strategy, setStrategy] = useState<Strategy>('range')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('range')
  const [from, setFrom] = useState(3)
  const [to, setTo] = useState(3)
  const [regions, setRegions] = useState<readonly string[]>(['fr'])
  const [hashFilter, setHashFilter] = useState<'eq' | 'range'>('eq')
  const [userId, setUserId] = useState(7)

  const predicate: Predicate = useMemo(() => {
    if (strategy === 'range') {
      if (rangeFilter === 'range') return { kind: 'range', from: Math.min(from, to), to: Math.max(from, to) }
      if (rangeFilter === 'param') return { kind: 'param', month: from }
      if (rangeFilter === 'expression') return { kind: 'expression', month: from }
      return { kind: 'other-column' }
    }
    if (strategy === 'list') return { kind: 'list', values: regions }
    return hashFilter === 'eq' ? { kind: 'hash-eq', userId } : { kind: 'hash-range' }
  }, [strategy, rangeFilter, from, to, regions, hashFilter, userId])

  const result = prune(strategy, predicate, (id) => HASH.get(id))
  const parts = partitionsOf(strategy)
  const scannedRows = result.scanned.reduce((n, s) => n + (ROWS.get(s) ?? 0), 0)
  const totalRows = parts.reduce((n, p) => n + (ROWS.get(p.name) ?? 0), 0)
  const stage = STAGE[result.stage]
  const where = strategy === 'list' && regions.length === 0 ? '' : whereOf(predicate)

  const toggleRegion = (r: string) => setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

  return (
    <Demo
      title="Which partitions does the query read?"
      hint="Choose how the table is split and what the query filters on. Lit partitions are scanned; the others never appear in the plan."
      controls={
        <div className={styles.controls}>
          <Segmented label="partitioned by" value={strategy} options={[{ value: 'range', label: 'RANGE (created_at)' }, { value: 'list', label: 'LIST (region)' }, { value: 'hash', label: 'HASH (user_id)' }]} onChange={setStrategy} />
          {strategy === 'range' && (
            <>
              <Segmented
                label="filter"
                value={rangeFilter}
                options={[
                  { value: 'range', label: 'range on created_at' },
                  { value: 'param', label: '$1 in a prepared query' },
                  { value: 'expression', label: 'date_trunc(created_at)' },
                  { value: 'other-column', label: 'user_id = 42' },
                ]}
                onChange={setRangeFilter}
              />
              {rangeFilter !== 'other-column' && (
                <label className={styles.slider}>
                  {rangeFilter === 'range' ? 'from' : 'month'}
                  <input type="range" min={1} max={12} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
                  <output>{monthName(from)}</output>
                </label>
              )}
              {rangeFilter === 'range' && (
                <label className={styles.slider}>
                  to
                  <input type="range" min={1} max={12} value={to} onChange={(e) => setTo(Number(e.target.value))} />
                  <output>{monthName(to)}</output>
                </label>
              )}
            </>
          )}
          {strategy === 'list' && (
            <div className={styles.chips} role="group" aria-label="region values">
              <span className={styles.chipsLabel}>region IN</span>
              {REGIONS.map((r) => (
                <button key={r} type="button" aria-pressed={regions.includes(r)} className={cx(styles.chip, regions.includes(r) && styles.chipOn)} onClick={() => toggleRegion(r)}>
                  {r}
                </button>
              ))}
            </div>
          )}
          {strategy === 'hash' && (
            <>
              <Segmented label="filter" value={hashFilter} options={[{ value: 'eq', label: 'user_id = n' }, { value: 'range', label: 'user_id < 100' }]} onChange={setHashFilter} />
              {hashFilter === 'eq' && (
                <label className={styles.slider}>
                  n
                  <input type="range" min={1} max={12} value={userId} onChange={(e) => setUserId(Number(e.target.value))} />
                  <output>{userId}</output>
                </label>
              )}
            </>
          )}
        </div>
      }
    >
      <CodeBlock language="sql" title="query" code={`SELECT count(*) FROM ${TABLE[strategy]}${where ? `\nWHERE ${where}` : ''};`} />
      <div className={cx(styles.grid, strategy !== 'range' && styles.gridFew)}>
        {parts.map((p) => {
          const on = result.scanned.includes(p.name)
          return (
            <div key={p.name} className={cx(styles.part, on ? styles.scanned : styles.pruned)} style={hue(on ? 3 : undefined)}>
              <span className={styles.partName}>{p.name}</span>
              <span className={styles.partBounds}>{p.bounds}</span>
              <span className={styles.partState}>{on ? `scanned · ${(ROWS.get(p.name) ?? 0).toLocaleString()} rows` : 'pruned'}</span>
            </div>
          )
        })}
      </div>
      <p className={styles.stage} style={hue(stage.hue)}>
        <span className={styles.badge}>{stage.label}</span> {result.why}
      </p>
      <StatTiles
        stats={[
          { label: 'partitions scanned', value: `${result.scanned.length} of ${parts.length}`, hue: 3, bar: { value: result.scanned.length, max: parts.length } },
          { label: 'rows in those partitions', value: scannedRows.toLocaleString(), sub: `of ${totalRows.toLocaleString()} (recorded counts)`, hue: result.scanned.length === parts.length ? 8 : 6, bar: { value: scannedRows, max: totalRows } },
        ]}
      />
    </Demo>
  )
}
