import { useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Demo, Segmented } from '@/shared/ui'
import { ExpirySimulator } from '../simulation/expiry'
import { LineChart } from './LineChart'
import styles from './play.module.css'

/** 10,000 keys with a TTL; some share of them has just expired. Watch the active cycle clean up. */
export function ExpiryPlayground() {
  const sim = useObservable(() => new ExpirySimulator({ keys: 10_000, expiringShare: 1, hz: 10, keysPerRound: 20, acceptableStale: 0.1, maxRoundsPerCycle: 16, readsPerSecond: 0 }))
  const [playing, setPlaying] = useState(false)
  // five cycles per frame: up to a minute of simulated time
  useInterval(() => { for (let i = 0; i < 5; i++) { if (sim.stale === 0 || sim.timeMs >= 60_000) { setPlaying(false); return } sim.tick() } }, playing ? 60 : null)
  const o = sim.options
  return (
    <Demo
      title="The active expire cycle"
      hint="10,000 keys with a TTL. Each cycle, a cursor walks on through the keys with a TTL, 20 per round, deleting the expired ones; it does another round only while more than 10% of a round had expired, up to a time budget. Lazy expiry deletes a key when a command touches it."
      controls={
        <>
          <Segmented label="keys that expired" value={o.expiringShare} options={[{ value: 1, label: 'all' }, { value: 0.5, label: '50%' }, { value: 0.1, label: '10%' }, { value: 0.05, label: '5%' }]} onChange={(v) => { setPlaying(false); sim.configure({ expiringShare: v }) }} />
          <Segmented label="hz" value={o.hz} options={[{ value: 10, label: '10' }, { value: 100, label: '100' }]} onChange={(v) => { setPlaying(false); sim.configure({ hz: v }) }} />
          <Segmented label="reads/s (lazy)" value={o.readsPerSecond} options={[{ value: 0, label: '0' }, { value: 1000, label: '1,000' }]} onChange={(v) => { setPlaying(false); sim.configure({ readsPerSecond: v }) }} />
          <Button size="sm" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Run'}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setPlaying(false); sim.reset() }}>Reset</Button>
        </>
      }
    >
      <LineChart
        title="Expired keys still in memory"
        series={[{ label: 'expired, not yet deleted', points: sim.history.map((h) => [Math.round(h.ms), h.stale] as const), emphasis: true }]}
        xLabel="ms"
        yLabel="keys"
        height={180}
      />
      <dl className={styles.stats}>
        <div><dt>simulated time</dt><dd>{(sim.timeMs / 1000).toFixed(1)} s</dd></div>
        <div className={sim.stale ? styles.bad : styles.good}><dt>expired, still in memory</dt><dd>{sim.stale.toLocaleString()}</dd></div>
        <div><dt>deleted by the cycle</dt><dd>{sim.deletedActive.toLocaleString()}</dd></div>
        <div><dt>deleted lazily</dt><dd>{sim.deletedLazy.toLocaleString()}</dd></div>
      </dl>
    </Demo>
  )
}
