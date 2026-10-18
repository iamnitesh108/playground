import { useMemo, useState } from 'react'
import { StatTiles, Timeline, type TimelineEvent, type TimelineSegment } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { simulateExpiry, type ExpiryMode, type ExpiryResult, type ReadPattern } from '../simulation/expiryTimeline'
import { ExpiryLegend } from './ExpiryLegend'
import { ExpirySlider } from './ExpirySlider'

const DURATION = 10_000
const MODES: { value: ExpiryMode; label: string }[] = [
  { value: 'write', label: 'expire after write (TTL)' },
  { value: 'access', label: 'expire after access (TTI)' },
  { value: 'refresh', label: 'refresh after write + TTL' },
]
const PATTERNS: { value: ReadPattern; label: string }[] = [
  { value: 'steady', label: 'every 250 ms' },
  { value: 'sparse', label: 'every 1.5 s' },
  { value: 'pause', label: 'busy, quiet, busy' },
]
const JITTER = [0, 10, 25].map((v) => ({ value: v, label: v ? `±${v} %` : 'none' }))
const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 2 : 0)} s` : `${Math.round(v)} ms`)

/** The simulated run as timeline lanes; only a few reads get a label, so labels never overlap. */
function timelineOf(r: ExpiryResult): { segments: TimelineSegment[]; events: TimelineEvent[] } {
  const segments: TimelineSegment[] = [
    ...[0, ...r.sourceChanges].map((from, i, all) => ({ lane: 'source', from, to: all[i + 1] ?? DURATION, label: `v${i + 1}`, hue: 5 as const })),
    ...r.entries.map((e) => ({ lane: 'entry', from: e.from, to: e.to, label: `v${e.version}`, hue: 3 as const })),
    ...r.loads.map((l) => ({ lane: 'loads', from: l.from, to: Math.min(DURATION, l.to), label: l.to - l.from >= DURATION * 0.1 ? (l.background ? 'background' : 'caller waits') : undefined, hue: l.background ? (5 as const) : (8 as const), striped: !l.background })),
  ]
  let lastLabel = -Infinity
  const events: TimelineEvent[] = [
    ...r.expirations.map((at) => ({ lane: 'entry', at, label: '', hue: 4 as const })),
    ...r.reads.map((read) => {
      const labelled = read.outcome !== 'hit' && read.at - lastLabel >= DURATION * 0.26
      if (labelled) lastLabel = read.at
      const label = !labelled ? '' : read.outcome === 'waited' ? `waited ${ms(read.waitMs)}` : 'old value, reload'
      return { lane: 'reads', at: read.at, label, hue: read.outcome === 'hit' ? (6 as const) : read.outcome === 'waited' ? (8 as const) : (5 as const) }
    }),
  ]
  return { segments, events }
}

/** One key, one reader, ten seconds: what TTL, TTI and refresh do to waiting and staleness. */
export function ExpirySimulator() {
  const [mode, setMode] = useState<ExpiryMode>('refresh')
  const [ttl, setTtl] = useState(3000)
  const [refresh, setRefresh] = useState(1000)
  const [load, setLoad] = useState(300)
  const [change, setChange] = useState(2500)
  const [pattern, setPattern] = useState<ReadPattern>('steady')
  const [jitter, setJitter] = useState(0)
  const r = useMemo(
    () => simulateExpiry({ mode, ttlMs: ttl, refreshMs: Math.min(refresh, ttl), loadMs: load, sourceChangeMs: change, pattern, jitterPercent: jitter, durationMs: DURATION }),
    [mode, ttl, refresh, load, change, pattern, jitter],
  )

  const { segments, events } = timelineOf(r)
  return (
    <Demo
      title="TTL, TTI and refresh on a timeline"
      hint="One key, one reader, ten seconds. The source of truth changes on a schedule; each read either hits, waits for a load, or gets the cached value while a background reload runs."
      controls={
        <>
          <Segmented label="policy" value={mode} options={MODES} onChange={setMode} />
          <ExpirySlider label={mode === 'access' ? 'time to idle' : 'time to live'} value={ttl} min={500} max={6000} step={250} format={ms} onChange={setTtl} />
          {mode === 'refresh' && <ExpirySlider label="refresh after" value={Math.min(refresh, ttl)} min={250} max={ttl} step={250} format={ms} onChange={setRefresh} />}
          <ExpirySlider label="load takes" value={load} min={50} max={1000} step={50} format={ms} onChange={setLoad} />
          <ExpirySlider label="source changes every" value={change} min={1000} max={10_000} step={500} format={ms} onChange={setChange} />
          <Segmented label="reads" value={pattern} options={PATTERNS} onChange={setPattern} />
          <Segmented label="jitter" value={jitter} options={JITTER} onChange={setJitter} />
        </>
      }
    >
      <Timeline
        title="Simulated: one key over 10 s"
        lanes={[
          { id: 'source', label: 'source of truth' },
          { id: 'entry', label: 'cached entry' },
          { id: 'loads', label: 'loads' },
          { id: 'reads', label: 'reads' },
        ]}
        segments={segments}
        events={events}
        end={DURATION}
        unit="ms"
      />
      <ExpiryLegend
        items={[
          { hue: 5, shape: 'bar', label: 'source version / background reload' },
          { hue: 3, shape: 'bar', label: 'cached value' },
          { hue: 8, shape: 'striped', label: 'load a caller waits for' },
          { hue: 6, shape: 'dot', label: 'hit' },
          { hue: 8, shape: 'dot', label: 'read waited' },
          { hue: 5, shape: 'dot', label: 'old value served, reload started' },
          { hue: 4, shape: 'dot', label: 'entry expired' },
        ]}
      />
      <StatTiles
        stats={[
          { label: 'reads that waited', value: `${r.stats.waited} of ${r.stats.reads}`, sub: `${ms(r.stats.totalWaitMs)} waited in total`, hue: 8, bar: { value: r.stats.waited, max: r.stats.reads } },
          { label: 'loads from the source', value: r.stats.loads, sub: `${r.loads.filter((l) => l.background).length} in the background`, hue: 5 },
          { label: 'worst staleness', value: ms(r.stats.maxStaleMs), sub: `average ${ms(r.stats.avgStaleMs)} behind the source`, hue: 4 },
        ]}
      />
    </Demo>
  )
}
