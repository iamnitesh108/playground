import { useMemo, useState } from 'react'
import { hue, Proportion, StatTiles } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { hitCurve, sizeCache } from '../simulation/memorySizing'
import { LoadingSlider } from './LoadingSlider'
import styles from './LoadingFigures.module.css'
import { MemoryLineChart } from './MemoryLineChart'

export interface LibraryOverhead {
  id: string
  label: string
  /** Recorded bytes the cache adds per entry, on top of key and value. */
  overhead: number
}

const pow10 = (e: number) => Math.round(Math.pow(10, e))
const count = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)} k` : String(n))
const mb = (v: number) => (v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : v >= 10 ? `${Math.round(v)} MB` : `${v.toFixed(1)} MB`)
const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)} %`

/** Entries × bytes × instances against a heap budget, and the hit ratio a Zipf workload would give that size. */
export function MemorySizingCalculator({ libraries }: { libraries: readonly LibraryOverhead[] }) {
  const [lib, setLib] = useState(libraries[0].id)
  const [keysExp, setKeysExp] = useState(6)
  const [skew, setSkew] = useState(0.9)
  const [entriesExp, setEntriesExp] = useState(4.5)
  const [keyBytes, setKeyBytes] = useState(56)
  const [valueExp, setValueExp] = useState(3)
  const [instances, setInstances] = useState(6)
  const [heapMb, setHeapMb] = useState(2048)
  const [rps, setRps] = useState(2000)

  const overhead = libraries.find((l) => l.id === lib)!.overhead
  const keyspace = pow10(keysExp)
  const entries = Math.min(pow10(entriesExp), keyspace)
  const valueBytes = pow10(valueExp)
  const r = useMemo(
    () => sizeCache({ keyspace, skew, entries, keyBytes, valueBytes, overheadBytes: overhead, instances, heapMb, requestsPerSecond: rps }),
    [keyspace, skew, entries, keyBytes, valueBytes, overhead, instances, heapMb, rps],
  )
  const curve = useMemo(() => hitCurve(keyspace, skew, 18), [keyspace, skew])
  const tight = r.heapShare > 0.3
  return (
    <Demo
      title="Size a cache"
      hint="Pick the library (its per-entry overhead is the recorded one), describe your keys, values and traffic, and see the memory it costs and the hit ratio a Zipf workload would give."
      controls={
        <>
          <Segmented label="library" value={lib} options={libraries.map((l) => ({ value: l.id, label: l.label }))} onChange={setLib} />
          <LoadingSlider label="distinct keys" value={keysExp} min={3} max={7} step={0.25} format={(v) => count(pow10(v))} onChange={setKeysExp} />
          <LoadingSlider label="popularity skew" value={skew} min={0.5} max={1.3} step={0.05} format={(v) => v.toFixed(2)} onChange={setSkew} />
          <LoadingSlider label="max entries" value={entriesExp} min={2} max={7} step={0.25} format={(v) => count(Math.min(pow10(v), keyspace))} onChange={setEntriesExp} />
          <LoadingSlider label="key size" value={keyBytes} min={16} max={256} step={8} format={(v) => `${v} B`} onChange={setKeyBytes} />
          <LoadingSlider label="value size" value={valueExp} min={1.5} max={5} step={0.1} format={(v) => (pow10(v) >= 1000 ? `${+(pow10(v) / 1000).toFixed(1)} KB` : `${pow10(v)} B`)} onChange={setValueExp} />
          <LoadingSlider label="instances" value={instances} min={1} max={20} onChange={setInstances} />
          <LoadingSlider label="heap per instance" value={heapMb} min={256} max={8192} step={256} format={mb} onChange={setHeapMb} />
          <LoadingSlider label="requests/s per instance" value={rps} min={100} max={20000} step={100} format={(v) => v.toLocaleString()} onChange={setRps} />
        </>
      }
    >
      <StatTiles
        stats={[
          { label: 'cache per instance', value: mb(r.cacheMbPerInstance), sub: `${count(entries)} × ${r.bytesPerEntry.toLocaleString()} B (key ${keyBytes} + value ${valueBytes.toLocaleString()} + cache ${overhead})`, hue: 3, bar: { value: r.cacheMbPerInstance, max: heapMb } },
          { label: 'across all instances', value: mb(r.totalMb), sub: `${instances} copies of the same hot data`, hue: 3 },
          { label: 'hit ratio, frequency-based', value: pct(r.frequencyHit), sub: `LRU: ${pct(r.lruHit)}`, hue: 6, bar: { value: r.frequencyHit, max: 1 } },
          { label: 'loads per second', value: Math.round(r.missesPerSecond).toLocaleString(), sub: `per instance; ${Math.round(r.missesPerSecond * instances).toLocaleString()}/s in total reach the source`, hue: 5 },
        ]}
      />
      <Proportion
        title={`Heap of one instance (${mb(heapMb)})`}
        parts={[
          { label: 'cache', value: Math.min(r.cacheMbPerInstance, heapMb), display: mb(r.cacheMbPerInstance), hue: 3 },
          { label: 'everything else', value: Math.max(0, heapMb - r.cacheMbPerInstance), display: mb(Math.max(0, heapMb - r.cacheMbPerInstance)), hue: 1 },
        ]}
      />
      <div className={styles.verdict} style={hue(tight ? 8 : 6)}>
        {r.cacheMbPerInstance > heapMb
          ? 'Does not fit: the cache alone is bigger than the heap.'
          : tight
            ? `The cache takes ${pct(r.heapShare)} of the heap: expect longer GC pauses and less room for request objects. Shrink entries or values, or move the bulk to Redis.`
            : `The cache takes ${pct(r.heapShare)} of the heap: comfortable.`}
      </div>
      <MemoryLineChart
        title={`Hit ratio by cache size, ${count(keyspace)} keys, skew ${skew.toFixed(2)} (model)`}
        xLabel="max entries (log scale)"
        yLabel="hit ratio"
        logX
        yMax={1}
        formatX={count}
        formatY={(y) => `${Math.round(y * 100)} %`}
        xTicks={curve.filter((_, i) => i % 6 === 0).map((c) => c.entries)}
        series={[
          { label: 'frequency-based (best case, W-TinyLFU gets close)', hue: 6, points: curve.map((c) => [c.entries, c.frequency] as const) },
          { label: 'LRU (Che’s approximation)', hue: 2, dashed: true, points: curve.map((c) => [c.entries, c.lru] as const) },
        ]}
        markers={[{ x: entries, label: `you: ${count(entries)}`, hue: 3 }]}
      />
    </Demo>
  )
}
