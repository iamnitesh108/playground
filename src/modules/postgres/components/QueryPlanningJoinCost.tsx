import { useState } from 'react'
import { BarChart } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { priceJoins } from '../simulation/queryPlanningJoins'
import { QueryPlanningSlider } from './QueryPlanningSlider'
import styles from './QueryPlanning.module.css'

const SIZES = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000]
const MEM = [64, 1024, 4096, 65536]
const HUES = { 'nested loop': 1, 'nested loop + index': 7, 'hash join': 2, 'merge join': 5 } as const
const fmt = (n: number) => (n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}k` : String(n))
const kb = (n: number) => (n >= 1024 ? `${n / 1024} MB` : `${n} kB`)

/** The planner's choice as a price comparison: change the inputs, watch the cheapest join change. */
export function QueryPlanningJoinCost() {
  const [outer, setOuter] = useState(2)
  const [inner, setInner] = useState(4)
  const [indexed, setIndexed] = useState(true)
  const [sorted, setSorted] = useState(false)
  const [mem, setMem] = useState(2)
  const prices = priceJoins({ outerRows: SIZES[outer], innerRows: SIZES[inner], innerIndexed: indexed, sorted, workMemKb: MEM[mem] })
  const best = prices.reduce((a, b) => (b.cost < a.cost ? b : a))

  return (
    <Demo
      title="Which join is cheapest?"
      hint="A simplified version of the planner’s arithmetic with its default constants. The planner prices every option and keeps the cheapest; drag the sizes and see the winner change."
      controls={
        <>
          <QueryPlanningSlider label="outer rows" value={outer} min={0} max={SIZES.length - 1} format={(i) => fmt(SIZES[i])} onChange={setOuter} />
          <QueryPlanningSlider label="inner rows" value={inner} min={0} max={SIZES.length - 1} format={(i) => fmt(SIZES[i])} onChange={setInner} />
          <Segmented label="index on inner key" value={indexed ? 1 : 0} onChange={(v) => setIndexed(v === 1)} options={[{ value: 1, label: 'yes' }, { value: 0, label: 'no' }]} />
          <Segmented label="inputs already sorted" value={sorted ? 1 : 0} onChange={(v) => setSorted(v === 1)} options={[{ value: 1, label: 'yes' }, { value: 0, label: 'no' }]} />
          <Segmented label="work_mem" value={mem} onChange={setMem} options={MEM.map((m, i) => ({ value: i, label: kb(m) }))} />
        </>
      }
    >
      <BarChart
        title={`Estimated cost (lower wins) — winner: ${best.algorithm}`}
        bars={prices.map((p) => ({
          label: p.algorithm,
          value: p.cost,
          display: `${Math.round(p.cost).toLocaleString()}${p.algorithm === best.algorithm ? ' ✓' : ''}`,
          hue: HUES[p.algorithm],
          note: p.formula,
        }))}
      />
      <ul className={styles.priceList}>
        {prices.map((p) => (
          <li key={p.algorithm}>
            <strong>{p.algorithm}</strong>: {p.formula}
            {p.spillKb > 0 && <span className={styles.spill}> · spills ≈ {p.spillKb.toLocaleString()} kB to temp files</span>}
          </li>
        ))}
      </ul>
    </Demo>
  )
}
