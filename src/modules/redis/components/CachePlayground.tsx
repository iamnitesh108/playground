import { useMemo, useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { simulateCache, type Strategy } from '../simulation/cache'
import { LineChart } from './LineChart'
import { Slider } from './Slider'
import styles from './play.module.css'

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'none', label: 'plain cache-aside' },
  { value: 'lock', label: 'rebuild lock' },
  { value: 'early-refresh', label: 'early refresh' },
  { value: 'stale-while-revalidate', label: 'serve stale' },
]

/** One hot key, read 2,000 times a second, cached for 5 s, rebuilt in 300 ms. */
export function CachePlayground() {
  const [strategy, setStrategy] = useState<Strategy>('none')
  const [rebuild, setRebuild] = useState(300)
  const [rps, setRps] = useState(2000)
  const r = useMemo(() => simulateCache({ strategy, requestsPerSecond: rps, ttlSeconds: 5, rebuildMs: rebuild, durationSeconds: 12, beta: 1 }), [strategy, rebuild, rps])
  return (
    <Demo
      title="The stampede when a hot key expires"
      hint="With plain cache-aside, every request that misses goes to the database until the first rebuild finishes. The other strategies let only one request rebuild."
      controls={
        <>
          <Segmented label="strategy" value={strategy} options={STRATEGIES} onChange={setStrategy} />
          <Slider label="requests/s" value={rps} min={100} max={10_000} step={100} format={(v) => v.toLocaleString()} onChange={setRps} />
          <Slider label="rebuild time" value={rebuild} min={20} max={2000} step={20} format={(v) => `${v} ms`} onChange={setRebuild} />
        </>
      }
    >
      <LineChart
        title="Database queries per 100 ms"
        series={[{ label: 'queries', points: r.dbPerBucket.map((v, i) => [i * 100, v] as const), emphasis: true }]}
        xLabel="ms"
        yLabel="queries"
        step
        height={180}
      />
      <dl className={styles.stats}>
        <div className={r.dbQueries > 10 ? styles.bad : styles.good}><dt>database queries in 12 s</dt><dd>{r.dbQueries.toLocaleString()}</dd></div>
        <div><dt>requests that waited</dt><dd>{r.waited.toLocaleString()}</dd></div>
        <div><dt>served a stale value</dt><dd>{r.servedStale.toLocaleString()}</dd></div>
        <div><dt>requests</dt><dd>{r.requests.toLocaleString()}</dd></div>
      </dl>
    </Demo>
  )
}
