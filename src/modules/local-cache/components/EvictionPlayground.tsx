import { useMemo, useState } from 'react'
import { BarChart, hue, StatTiles, type Hue } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { POLICIES, WTinyLfu, createPolicy, optimalHitRatio, replay, type PolicyEvent } from '../simulation/evictionPolicies'
import { traceById, type TraceId } from '../simulation/evictionTraces'
import styles from './EvictionPlayground.module.css'

/** The recorded traces at 5 % of their size: 50,000 requests, so every policy runs in a blink. */
const SCALE = 0.05
const TRACE_OPTIONS: { value: TraceId; label: string }[] = [
  { value: 'zipf-0.8', label: 'Zipf 0.8' },
  { value: 'zipf-1.0', label: 'Zipf 1.0' },
  { value: 'scan', label: 'Zipf + scans' },
  { value: 'loop', label: 'loop' },
  { value: 'shift', label: 'shifting hot set' },
]
const SIZE_OPTIONS = [25, 50, 125, 250].map((v) => ({ value: v, label: `${v} entries` }))
// the same colours as the recorded charts: Caffeine 1, moka 2, lru-cache 3
const POLICY_HUE: Record<string, Hue> = { fifo: 4, lru: 3, lfu: 5, tinylfu: 2, wtinylfu: 1 }

/** The step-through: the same kind of trace, tiny (a few hundred keys), into a cache of 10 entries. */
const STEP_SCALE = 0.002
const STEP_CAPACITY = 10

export function EvictionPlayground() {
  const [traceId, setTraceId] = useState<TraceId>('scan')
  const [size, setSize] = useState(50)
  const trace = useMemo(() => traceById(traceId).generate(SCALE), [traceId])
  const results = useMemo(
    () => [
      ...POLICIES.map((p) => ({ id: p.id, label: p.library ? `${p.label} (≈ ${p.library})` : p.label, ratio: replay(createPolicy(p.id, size), trace).hitRatio })),
      { id: 'optimal', label: 'optimal (knows the future)', ratio: optimalHitRatio(trace, size) },
    ],
    [trace, size],
  )
  return (
    <Demo
      title="Policy playground"
      hint={`Pick a trace and a cache size; all five models replay the same ${trace.length.toLocaleString()} requests (the recorded traces at 5 % of their size). Then step through W-TinyLFU on a tiny cache and watch every admission.`}
      controls={
        <>
          <Segmented label="trace" value={traceId} options={TRACE_OPTIONS} onChange={setTraceId} />
          <Segmented label="cache size" value={size} options={SIZE_OPTIONS} onChange={setSize} />
        </>
      }
    >
      <p className={styles.note}>{traceById(traceId).description}</p>
      <BarChart
        title={`Hit ratio, ${traceById(traceId).label}, ${size} entries (models)`}
        max={100}
        unit=" %"
        bars={results.map((r) => ({ label: r.label, value: Math.round(r.ratio * 1000) / 10, hue: r.id === 'optimal' ? 7 : POLICY_HUE[r.id] }))}
      />
      <Stepper key={traceId} traceId={traceId} />
    </Demo>
  )
}

/** A W-TinyLFU run being stepped: the policy and the events of the request being shown. */
interface Run {
  policy: WTinyLfu
  log: PolicyEvent[]
}

interface StepView {
  position: number
  hits: number
  events: PolicyEvent[]
}

const newRun = (): Run => {
  const log: PolicyEvent[] = []
  return { policy: new WTinyLfu(STEP_CAPACITY, (e) => log.push(e)), log }
}
const START: StepView = { position: 0, hits: 0, events: [] }

function Stepper({ traceId }: { traceId: TraceId }) {
  const trace = useMemo(() => traceById(traceId).generate(STEP_SCALE), [traceId])
  const [run, setRun] = useState(newRun)
  const [state, setState] = useState<StepView>(START)
  // requests are applied in the click handler (once), never during render
  const step = (count: number) => {
    let { position, hits } = state
    let from = run.log.length
    for (let n = 0; n < count && position < trace.length; n++) {
      from = run.log.length
      if (run.policy.access(trace[position++])) hits++
    }
    // the events of the last request only
    setState({ position, hits, events: run.log.slice(from) })
  }
  const reset = () => {
    setRun(newRun())
    setState(START)
  }
  const p = run.policy
  const current = state.position > 0 ? trace[state.position - 1] : null
  const admission = state.events.find((e) => e.type === 'admit' || e.type === 'reject')
  const evicted = new Set(state.events.flatMap((e) => (e.type === 'evict' ? [e.key] : [])))
  const regions = [
    { id: 'window', label: 'window', sub: `LRU · max ${p.windowMax}`, keys: p.window.keys() },
    { id: 'probation', label: 'probation', sub: 'main · the rest', keys: p.probation.keys() },
    { id: 'protected', label: 'protected', sub: `main · max ${p.protectedMax}`, keys: p.protectedList.keys() },
  ]
  // only the key of this request is coloured: green for a hit, blue for a newly loaded key
  const chipHue = (k: number): Hue | undefined => (k === current ? (state.events[0]?.type === 'hit' ? 6 : 1) : undefined)
  return (
    <div className={styles.stepper}>
      <div className={styles.stepHead}>
        <strong>Step through W-TinyLFU</strong>
        <span className={styles.muted}>{STEP_CAPACITY} entries, a {trace.length.toLocaleString()}-request version of the same trace</span>
      </div>
      <div className={styles.buttons}>
        <Button size="sm" variant="primary" onClick={() => step(1)} disabled={state.position >= trace.length}>Next request</Button>
        <Button size="sm" onClick={() => step(10)} disabled={state.position >= trace.length}>+10</Button>
        <Button size="sm" onClick={() => step(100)} disabled={state.position >= trace.length}>+100</Button>
        <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
      </div>
      <StatTiles
        stats={[
          { label: 'requests', value: state.position.toLocaleString(), hue: 1 },
          { label: 'hit ratio so far', value: state.position ? `${((state.hits / state.position) * 100).toFixed(1)} %` : '—', hue: 6 },
          { label: 'sketch halvings', value: p.sketch.resets, sub: `every ${p.sketch.sampleSize} increments`, hue: 7 },
        ]}
      />
      <div className={styles.status} aria-live="polite">
        {current === null ? (
          'Press Next request.'
        ) : (
          <>
            Request <code>key {current}</code>:{' '}
            {state.events.map((e, i) => <EventText key={i} event={e} />)}
          </>
        )}
      </div>
      <div className={styles.regions}>
        {regions.map((r) => (
          <div key={r.id} className={styles.region} style={hue(7)}>
            <div className={styles.regionHead}>
              <span>{r.label}</span>
              <small>{r.sub}</small>
            </div>
            <div className={styles.chips}>
              {r.keys.length === 0 && <span className={styles.muted}>empty</span>}
              {r.keys.map((k, i) => (
                <span key={k} className={styles.chip} style={hue(chipHue(k))} title={`key ${k}: estimated frequency ${p.sketch.frequency(k)}`}>
                  {i === 0 && r.keys.length > 1 && <span className={styles.lruMark}>LRU</span>}
                  <span className={styles.key}>{k}</span>
                  <span className={styles.freq}>f {p.sketch.frequency(k)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {admission && (admission.type === 'admit' || admission.type === 'reject') && (
        <div className={styles.duel}>
          <span className={styles.fighter} style={hue(admission.type === 'admit' ? 6 : 8)}>candidate {admission.candidate}<b>f {admission.candidateFreq}</b></span>
          <span className={styles.vs}>{admission.type === 'admit' ? '>' : '≤'}</span>
          <span className={styles.fighter} style={hue(admission.type === 'admit' ? 8 : 6)}>victim {admission.victim}<b>f {admission.victimFreq}</b></span>
          <span className={styles.muted}>{admission.type === 'admit' ? 'candidate admitted, victim evicted' : 'candidate rejected, victim stays'}</span>
        </div>
      )}
      {evicted.size > 0 && <p className={styles.muted}>Gone: {[...evicted].join(', ')}</p>}
    </div>
  )
}

function EventText({ event: e }: { event: PolicyEvent }) {
  const text: Record<PolicyEvent['type'], () => string> = {
    hit: () => (e.type === 'hit' ? `hit in ${e.region}. ` : ''),
    miss: () => 'miss, loaded into the window. ',
    insert: () => '',
    promote: () => (e.type === 'promote' ? `${e.key} promoted to protected. ` : ''),
    demote: () => (e.type === 'demote' ? `${e.key} demoted to probation. ` : ''),
    admit: () => (e.type === 'admit' ? `${e.candidate} left the window and beat ${e.victim} (${e.candidateFreq} > ${e.victimFreq}). ` : ''),
    reject: () => (e.type === 'reject' ? `${e.candidate} left the window but lost to ${e.victim} (${e.candidateFreq} ≤ ${e.victimFreq}). ` : ''),
    evict: () => '',
    resize: () => (e.type === 'resize' ? `window resized to ${e.windowMax}. ` : ''),
  }
  return <>{text[e.type]()}</>
}
