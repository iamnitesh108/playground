import { useMemo, useState } from 'react'
import { StatTiles, Timeline } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { simulateFlight, STRATEGIES } from '../simulation/loadingFlight'
import { LoadingSlider } from './LoadingSlider'

const ON_OFF = [
  { value: 'ok', label: 'returns a value' },
  { value: 'fails', label: 'throws' },
] as const
const ms = (v: number) => `${Math.round(v)} ms`

/** Callers asking for one missing key, under the three ways of loading it. */
export function LoadingFlightPlayground() {
  const [strategy, setStrategy] = useState(STRATEGIES[1].id)
  const [callers, setCallers] = useState(8)
  const [spread, setSpread] = useState(60)
  const [loaderMs, setLoaderMs] = useState(200)
  const [outcome, setOutcome] = useState<'ok' | 'fails'>('ok')

  const chosen = STRATEGIES.find((s) => s.id === strategy)!
  const result = useMemo(
    () => simulateFlight(chosen, { callers, arrivalSpreadMs: spread, loaderMs, fails: outcome === 'fails' }),
    [chosen, callers, spread, loaderMs, outcome],
  )
  const end = Math.max(...result.callers.map((c) => c.doneMs), loaderMs) * 1.05
  return (
    <Demo
      title="Single-flight simulator"
      hint="Callers arrive one after another for the same cold key. naive = check, load, put. shared result = lru-cache fetch(), moka get_with / try_get_with, Caffeine AsyncCache. blocking compute = Caffeine Cache.get(key, loader). Then make the loader fail."
      controls={
        <>
          <Segmented label="loading" value={strategy} options={STRATEGIES.map((s) => ({ value: s.id, label: s.label }))} onChange={setStrategy} />
          <LoadingSlider label="callers" value={callers} min={2} max={12} onChange={setCallers} />
          <LoadingSlider label="arrive within" value={spread} min={0} max={400} step={10} format={ms} onChange={setSpread} />
          <LoadingSlider label="loader takes" value={loaderMs} min={50} max={500} step={10} format={ms} onChange={setLoaderMs} />
          <Segmented label="the loader" value={outcome} options={ON_OFF} onChange={setOutcome} />
        </>
      }
    >
      <StatTiles
        stats={[
          { label: 'loader calls', value: result.loaderCalls, sub: `of ${callers} callers`, hue: result.loaderCalls > 1 ? 8 : 6, bar: { value: result.loaderCalls, max: callers } },
          { label: 'source of truth busy', value: ms(result.sourceBusyMs), sub: 'sum of all loader calls', hue: 5 },
          { label: 'median wait', value: ms(result.medianWaitMs), sub: `slowest caller: ${ms(result.maxWaitMs)}`, hue: 1 },
          { label: 'callers that got an error', value: result.errors, sub: result.errors ? 'nothing was cached' : 'value cached for later callers', hue: result.errors ? 8 : 6 },
        ]}
      />
      <Timeline
        title={`${chosen.label}: who waits, who loads (model)`}
        lanes={[{ id: 'src', label: 'source of truth' }, ...result.callers.map((c) => ({ id: `c${c.id}`, label: `caller ${c.id + 1}` }))]}
        end={end}
        unit="ms"
        segments={[
          ...result.callers.filter((c) => c.loadStartMs !== undefined).map((c) => ({ lane: 'src', from: c.loadStartMs!, to: c.doneMs, hue: 5 as const, label: 'load' })),
          ...result.callers.flatMap((c) => {
            const lane = `c${c.id}`
            const parts = []
            const waitUntil = c.loadStartMs ?? c.doneMs
            if (waitUntil > c.arriveMs) parts.push({ lane, from: c.arriveMs, to: waitUntil, hue: (c.id % 2 ? 2 : 1) as 1 | 2, striped: true, label: 'waits' })
            if (c.loadStartMs !== undefined) parts.push({ lane, from: c.loadStartMs, to: c.doneMs, hue: 5 as const, label: 'loads' })
            return parts
          }),
        ]}
        events={result.callers.map((c) => ({
          lane: `c${c.id}`,
          at: c.doneMs,
          label: c.role === 'hit' ? 'hit' : c.ok ? 'value' : 'error',
          hue: (c.ok ? 6 : 8) as 6 | 8,
        }))}
      />
    </Demo>
  )
}
