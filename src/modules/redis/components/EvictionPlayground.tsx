import { useMemo, useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import { runEviction, type Policy } from '../simulation/eviction'
import { BarList } from './BarList'
import styles from './play.module.css'

const REAL = CAPTURE.eviction.hotCold.filter((r) => !('maxmemory-samples' in r))

/** Operations per second: how many keys share one tick of the one-second LRU clock. */
const PACES = [
  { value: 200, label: 'slow (spread out)' },
  { value: 15_000, label: 'busy' },
  { value: 30_000, label: 'burst' },
]

/**
 * The recorded workload at a tenth of its size (100 hot keys read constantly, 20,000 cold keys
 * written once, room for 12,000), so it runs instantly; results are shown as shares.
 */
export function EvictionPlayground() {
  const [samples, setSamples] = useState(5)
  const [pace, setPace] = useState(30_000)
  const results = useMemo(
    () => (['allkeys-random', 'allkeys-lru', 'allkeys-lfu', 'exact-lru'] as Policy[]).map((policy) => ({ policy, ...runEviction({ policy, capacity: 12_000, hotKeys: 100, coldWrites: 20_000, hotReadsPer1000: 200, samples, opsPerSecond: pace }) })),
    [samples, pace],
  )
  return (
    <Demo
      title="Which keys survive when memory is full?"
      hint="Redis does not keep keys in an LRU list. To evict, it samples maxmemory-samples keys and removes the best candidate. Its LRU clock ticks once per second, so the faster keys are written, the more of them look equally old. LFU counts accesses instead."
      controls={
        <>
          <Segmented label="pace" value={pace} options={PACES} onChange={setPace} />
          <Segmented label="maxmemory-samples" value={samples} options={[1, 5, 10].map((v) => ({ value: v, label: String(v) }))} onChange={setSamples} />
        </>
      }
    >
      <BarList
        title="Hot keys still cached"
        max={100}
        unit="%"
        bars={results.map((r) => ({ label: r.policy === 'exact-lru' ? 'exact LRU (not in Redis)' : r.policy, value: r.hotSurvived, emphasis: r.policy === 'allkeys-lfu', note: `hit rate on hot keys ${(r.hitRate * 100).toFixed(0)}%` }))}
      />
      <p className={styles.mono}>
        A model of the recorded workload. The real server (one burst, maxmemory-samples 5) kept: {REAL.map((r) => `${r.policy} ${r.hotSurvived.toLocaleString()} of 1,000`).join(', ')}.
      </p>
    </Demo>
  )
}
