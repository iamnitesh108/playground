import { useState } from 'react'
import { BarChart, StatTiles } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { averageRead, formatNs } from '../simulation/whyLatency'
import { WhySlider } from './WhySlider'

export interface RecordedLatency {
  label: string
  cacheNs: number
  redisNs: number
}

type Source = 'redis' | 'db'
const SOURCES = [
  { value: 'redis', label: 'Redis GET (recorded)' },
  { value: 'db', label: 'a database query (your value)' },
] as const
const RATIOS = [0, 0.5, 0.8, 0.9, 0.95, 0.99]

/** Average read time for a hit ratio, from the recorded cache and Redis latencies of one language. */
export function WhyLatencyCalculator({ recorded }: { recorded: Record<string, RecordedLatency> }) {
  const langs = Object.keys(recorded)
  const [lang, setLang] = useState(langs[0])
  const [hitPct, setHitPct] = useState(90)
  const [source, setSource] = useState<Source>('redis')
  const [queryMs, setQueryMs] = useState(2)
  const r = recorded[lang]
  const missNs = source === 'redis' ? r.redisNs : queryMs * 1_000_000
  const result = averageRead({ hitRatio: hitPct / 100, cacheNs: r.cacheNs, missNs })
  return (
    <Demo
      title="What does a hit ratio buy?"
      hint="A hit costs one cache lookup; a miss costs the lookup, the load and the put. Cache and Redis times are the medians recorded on this page; for a database, set your own query time."
      controls={
        <>
          <Segmented label="language" value={lang} options={langs.map((l) => ({ value: l, label: recorded[l].label }))} onChange={setLang} />
          <Segmented label="a miss goes to" value={source} options={SOURCES} onChange={setSource} />
          <WhySlider label="hit ratio" value={hitPct} min={0} max={100} format={(v) => `${v} %`} onChange={setHitPct} />
          {source === 'db' && <WhySlider label="query time" value={queryMs} min={0.2} max={20} step={0.2} format={(v) => `${v.toFixed(1)} ms`} onChange={setQueryMs} />}
        </>
      }
    >
      <StatTiles
        stats={[
          { label: 'average read', value: formatNs(result.averageNs), sub: `cache hit ${formatNs(r.cacheNs)} · miss ${formatNs(missNs)}`, hue: 1 },
          { label: 'faster than no cache', value: `${result.speedup < 10 ? result.speedup.toFixed(1) : Math.round(result.speedup).toLocaleString()}×`, sub: 'vs every read going to the source', hue: 6 },
          { label: 'time spent on misses', value: `${(result.missShare * 100).toFixed(result.missShare > 0.995 ? 1 : 0)} %`, sub: `${100 - hitPct} % of reads`, hue: 8, bar: { value: result.missShare, max: 1 } },
        ]}
      />
      <BarChart
        title={`Average read at different hit ratios (${recorded[lang].label}, miss → ${source === 'redis' ? 'Redis' : `${queryMs.toFixed(1)} ms query`})`}
        bars={[...new Set([...RATIOS, hitPct / 100])].sort((a, b) => a - b).map((h) => {
          const avg = averageRead({ hitRatio: h, cacheNs: r.cacheNs, missNs }).averageNs
          return { label: `${Math.round(h * 100)} % hits${h === hitPct / 100 ? ' (yours)' : ''}`, value: avg, display: formatNs(avg), hue: h === hitPct / 100 ? 1 : 3 }
        })}
      />
    </Demo>
  )
}
