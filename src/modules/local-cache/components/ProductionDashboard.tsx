import { useMemo, useState } from 'react'
import { hue, StatTiles, type Hue } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { EVENTS, POLICIES, runWorkload, type PolicyName, type WorkloadEvent } from '../simulation/productionWorkload'
import { LoadingSlider } from './LoadingSlider'
import { MemoryLineChart } from './MemoryLineChart'
import styles from './ProductionDashboard.module.css'

const EVENT_HUE: Record<WorkloadEvent, Hue> = { scan: 8, shift: 4, slow: 5, deploy: 1 }
const ALL_EVENTS = Object.keys(EVENTS) as WorkloadEvent[]
const pct = (v: number) => `${(v * 100).toFixed(1)} %`

/** A minute of simulated traffic through one cache, shown the way a metrics dashboard shows it. */
export function ProductionDashboard() {
  const [policy, setPolicy] = useState<PolicyName>('tinylfu')
  const [capacity, setCapacity] = useState(1000)
  const [skew, setSkew] = useState(0.9)
  const [events, setEvents] = useState<WorkloadEvent[]>(ALL_EVENTS)
  const toggle = (e: WorkloadEvent) => setEvents((xs) => (xs.includes(e) ? xs.filter((x) => x !== e) : [...xs, e]))

  const result = useMemo(
    () => runWorkload({ policy, capacity, keys: 10_000, skew, requestsPerSecond: 1_000, loadMs: 5, seconds: 60, events }),
    [policy, capacity, skew, events],
  )
  const t = result.totals
  const normal = [...result.ticks.map((k) => k.hitRate)].sort((a, b) => a - b)[Math.floor(result.ticks.length / 2)]
  // alerts: runs of seconds whose hit rate fell below 70 % of the median
  const alerts: { from: number; to: number; worst: number }[] = []
  for (const k of result.ticks) {
    if (k.hitRate >= normal * 0.7) continue
    const last = alerts[alerts.length - 1]
    if (last && last.to === k.second - 1) {
      last.to = k.second
      last.worst = Math.min(last.worst, k.hitRate)
    } else alerts.push({ from: k.second, to: k.second, worst: k.hitRate })
  }
  const bands = ALL_EVENTS.filter((e) => events.includes(e)).map((e) => ({ from: EVENTS[e].from, to: EVENTS[e].to, label: EVENTS[e].label, hue: EVENT_HUE[e] }))
  return (
    <Demo
      title="Hit-rate dashboard"
      hint="One minute of traffic (1,000 requests/s, 10,000 products, Zipf popularity) through one cache. Turn the events on and off, switch the eviction policy, and watch the numbers a real dashboard would show."
      controls={
        <>
          <Segmented label="policy" value={policy} options={(Object.keys(POLICIES) as PolicyName[]).map((p) => ({ value: p, label: p === 'lru' ? 'LRU' : 'TinyLFU admission' }))} onChange={setPolicy} />
          <LoadingSlider label="max entries" value={capacity} min={100} max={4000} step={100} format={(v) => v.toLocaleString()} onChange={setCapacity} />
          <LoadingSlider label="popularity skew" value={skew} min={0.6} max={1.3} step={0.05} format={(v) => v.toFixed(2)} onChange={setSkew} />
          <fieldset className={styles.events}>
            <legend>events</legend>
            {ALL_EVENTS.map((e) => (
              <label key={e} className={styles.event} style={hue(EVENT_HUE[e])} title={EVENTS[e].describe}>
                <input type="checkbox" checked={events.includes(e)} onChange={() => toggle(e)} />
                {EVENTS[e].label} <span className={styles.when}>{EVENTS[e].from} s</span>
              </label>
            ))}
          </fieldset>
        </>
      }
    >
      <StatTiles
        stats={[
          { label: 'hitRate', value: pct(t.hitRate), sub: policy === 'lru' ? 'LRU' : 'TinyLFU admission', hue: 6, bar: { value: t.hitRate, max: 1 } },
          { label: 'misses = loads', value: t.missCount.toLocaleString(), sub: `of ${(t.hitCount + t.missCount).toLocaleString()} requests`, hue: 8 },
          { label: 'evictionCount', value: t.evictionCount.toLocaleString(), sub: policy === 'tinylfu' ? 'includes newcomers turned away' : 'oldest entries removed', hue: 7 },
          { label: 'average load penalty', value: `${t.averageLoadPenaltyMs.toFixed(1)} ms`, sub: events.includes('slow') ? 'raised by the slow database' : 'the database’s normal speed', hue: 5 },
        ]}
      />
      <MemoryLineChart
        title="hitRate per second (simulated)"
        xLabel="seconds"
        yLabel="hit rate"
        yMax={1}
        formatY={(y) => `${Math.round(y * 100)} %`}
        formatX={(x) => `${x}`}
        xTicks={[0, 10, 20, 30, 40, 50, 59]}
        bands={bands}
        series={[{ label: 'hit rate', hue: 6, points: result.ticks.map((k) => [k.second, k.hitRate] as const) }]}
      />
      <MemoryLineChart
        title="Loads and evictions per second (simulated)"
        xLabel="seconds"
        yLabel="per second"
        formatX={(x) => `${x}`}
        formatY={(y) => Math.round(y).toLocaleString()}
        xTicks={[0, 10, 20, 30, 40, 50, 59]}
        bands={bands}
        series={[
          { label: 'loads (misses)', hue: 5, points: result.ticks.map((k) => [k.second, k.misses] as const) },
          { label: 'evictions', hue: 7, dashed: true, points: result.ticks.map((k) => [k.second, k.evictions] as const) },
        ]}
      />
      <div className={styles.alerts} style={hue(alerts.length ? 8 : 6)}>
        <strong>Alert rule: hit rate below 70 % of normal ({pct(normal)}) — </strong>
        {alerts.length === 0
          ? 'no alerts.'
          : alerts.map((a) => `${a.from === a.to ? `${a.from} s` : `${a.from}–${a.to} s`} (down to ${pct(a.worst)})`).join(' · ')}
      </div>
    </Demo>
  )
}
