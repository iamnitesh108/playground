import { useMemo, useState } from 'react'
import { BarChart, Proportion, StatTiles } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { simulateTiered, type Strategy, type TieredInput } from '../simulation/tiered'
import { Slider } from './Slider'

const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: 'none', label: 'no cache' },
  { id: 'redis', label: 'Redis only' },
  { id: 'tiered', label: 'L1 + Redis' },
]
const ms = (v: number) => (v < 0.01 ? `${(v * 1000).toFixed(1)} µs` : v < 10 ? `${v.toFixed(2)} ms` : `${v.toFixed(0)} ms`)
const ON_OFF = [
  { value: 'on', label: 'on' },
  { value: 'off', label: 'off' },
] as const

/**
 * The same traffic through no cache, Redis only and an in-process L1 in front of Redis, side by side.
 * `l1Us` comes from the recording: what a read served from Caffeine took.
 */
export function TieredPlayground({ l1Us }: { l1Us: number }) {
  const [instances, setInstances] = useState(4)
  const [reads, setReads] = useState(500)
  const [writes, setWrites] = useState(5)
  const [skew, setSkew] = useState(1.1)
  const [l1Size, setL1Size] = useState(1000)
  const [l1Ttl, setL1Ttl] = useState(10)
  const [rtt, setRtt] = useState(0.5)
  const [query, setQuery] = useState(2)
  const [invalidation, setInvalidation] = useState<'on' | 'off'>('on')

  const results = useMemo(() => {
    const input: Omit<TieredInput, 'strategy'> = {
      instances, readsPerSecond: reads, writesPerSecond: writes, products: 10_000, skew, l1Size, l1TtlSeconds: l1Ttl, l2TtlSeconds: 300,
      invalidation: invalidation === 'on', rttMs: rtt, queryMs: query, l1Us,
    }
    return Object.fromEntries(STRATEGIES.map((s) => [s.id, simulateTiered({ ...input, strategy: s.id })])) as Record<Strategy, ReturnType<typeof simulateTiered>>
  }, [instances, reads, writes, skew, l1Size, l1Ttl, rtt, query, invalidation, l1Us])

  const t = results.tiered
  const none = results.none
  return (
    <Demo
      title="Tune a three-level cache"
      hint="10,000 products, Zipf popularity, 300 s Redis TTL. Every setting runs all three strategies on the same traffic. Turn invalidation off and watch stale reads appear; shrink the L1 or the skew and watch it stop paying off."
      controls={
        <>
          <Slider label="app instances" value={instances} min={1} max={8} onChange={setInstances} />
          <Slider label="reads/s per instance" value={reads} min={100} max={3000} step={100} format={(v) => v.toLocaleString()} onChange={setReads} />
          <Slider label="writes/s" value={writes} min={0} max={50} onChange={setWrites} />
          <Slider label="popularity skew" value={skew} min={0.5} max={1.5} step={0.1} format={(v) => v.toFixed(1)} onChange={setSkew} />
          <Slider label="L1 size (per instance)" value={l1Size} min={50} max={5000} step={50} format={(v) => `${v.toLocaleString()} products`} onChange={setL1Size} />
          <Slider label="L1 TTL" value={l1Ttl} min={1} max={60} format={(v) => `${v} s`} onChange={setL1Ttl} />
          <Slider label="network round trip" value={rtt} min={0.1} max={5} step={0.1} format={(v) => `${v.toFixed(1)} ms`} onChange={setRtt} />
          <Slider label="Postgres query" value={query} min={0.2} max={50} step={0.2} format={(v) => `${v.toFixed(1)} ms`} onChange={setQuery} />
          <Segmented label="invalidation" value={invalidation} options={ON_OFF} onChange={setInvalidation} />
        </>
      }
    >
      <Proportion
        title={`L1 + Redis: where ${t.reads.toLocaleString()} simulated reads were answered`}
        parts={[
          { label: 'L1 (in-process)', value: t.served.L1, hue: 1 },
          { label: 'Redis', value: t.served.L2, hue: 2 },
          { label: 'Postgres', value: t.served.PG, hue: 4 },
        ]}
      />
      <StatTiles
        stats={[
          { label: 'Postgres queries/s', value: Math.round(t.dbQueriesPerSecond).toLocaleString(), sub: `without a cache: ${Math.round(none.dbQueriesPerSecond).toLocaleString()}/s`, hue: 4, bar: { value: t.dbQueriesPerSecond, max: none.dbQueriesPerSecond } },
          { label: 'average read', value: ms(t.avgMs), sub: `p50 ${ms(t.p50Ms)} · p99 ${ms(t.p99Ms)}`, hue: 1 },
          { label: 'Redis calls/s', value: Math.round((t.served.L2 + t.served.PG * 2) / t.seconds).toLocaleString(), sub: `Redis only: ${Math.round((results.redis.served.L2 + results.redis.served.PG * 2) / results.redis.seconds).toLocaleString()}/s`, hue: 2 },
          { label: 'stale reads', value: `${((t.staleReads / t.reads) * 100).toFixed(t.staleReads ? 2 : 0)} %`, sub: `${t.staleReads.toLocaleString()} reads older than Postgres`, hue: t.staleReads ? 8 : 6 },
        ]}
      />
      <BarChart
        title="Average read latency"
        bars={STRATEGIES.map((s) => ({ label: s.label, value: results[s.id].avgMs, display: ms(results[s.id].avgMs), hue: s.id === 'none' ? 4 : s.id === 'redis' ? 2 : 1 }))}
      />
      <BarChart
        title="Postgres queries per second"
        bars={STRATEGIES.map((s) => ({ label: s.label, value: results[s.id].dbQueriesPerSecond, display: Math.round(results[s.id].dbQueriesPerSecond).toLocaleString(), hue: s.id === 'none' ? 4 : s.id === 'redis' ? 2 : 1 }))}
      />
    </Demo>
  )
}
