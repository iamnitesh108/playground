import { Timeline, type TimelineEvent, type TimelineSegment } from '@/shared/figures'
import { ExpiryLegend } from './ExpiryLegend'

/*
 * Timelines drawn from the recorded expiry runs (data/policies.ts). Each takes the JSON lines one experiment printed.
 */

interface Probe {
  t: number
  [variant: string]: number | boolean
}

/** An entry read at fixed times under two lifetimes: alive while the reads hit, gone after the first miss. */
export function ExpiryTwoClocks({ title, rows, variants, unit, lifetime }: { title: string; rows: readonly Probe[]; variants: readonly { key: string; label: string; sliding: boolean }[]; unit: string; lifetime: number }) {
  const end = rows[rows.length - 1].t
  const segments: TimelineSegment[] = []
  const events: TimelineEvent[] = []
  for (const v of variants) {
    const hits = rows.filter((r) => r[v.key] === true)
    const lastHit = hits.length ? hits[hits.length - 1].t : 0
    // the entry lives until `lifetime` after its write (TTL) or after its last read (TTI, a sliding lifetime)
    const expiresAt = Math.min(end, (v.sliding ? lastHit : 0) + lifetime)
    segments.push({ lane: v.key, from: 0, to: expiresAt, label: 'cached', hue: 3 })
    events.push({ lane: v.key, at: expiresAt, label: '', hue: 4 })
    for (const r of rows) events.push({ lane: v.key, at: r.t, label: r[v.key] ? 'hit' : 'miss', hue: r[v.key] ? 6 : 8 })
  }
  return (
    <>
      <Timeline title={title} lanes={variants.map((v) => ({ id: v.key, label: v.label }))} segments={segments} events={events} end={end} unit={unit} />
      <ExpiryLegend items={[{ hue: 3, shape: 'bar', label: 'cached' }, { hue: 6, shape: 'dot', label: 'read hit' }, { hue: 8, shape: 'dot', label: 'read missed' }, { hue: 4, shape: 'dot', label: 'expired' }]} />
    </>
  )
}

interface PerEntryLine {
  event: string
  key: string
  t?: number
  afterMs?: number
  ttlSeconds?: number
  ttlMs?: number
}

/** Per-entry lifetimes: visible until expiry, then still stored (striped) until the timer wheel removes it. */
export function ExpiryPerEntry({ title, lines, unit, scale, end }: { title: string; lines: readonly PerEntryLine[]; unit: string; scale: number; end: number }) {
  const time = (l: PerEntryLine) => (l.t ?? l.afterMs ?? 0) * scale
  const keys = lines.filter((l) => l.event === 'put' || l.event === 'insert').map((l) => l.key)
  const segments: TimelineSegment[] = []
  const events: TimelineEvent[] = []
  for (const key of keys) {
    const invisible = lines.find((l) => l.event === 'invisible' && l.key === key)
    const removed = lines.find((l) => l.event === 'removed' && l.key === key)
    if (!invisible || !removed || time(invisible) > end) continue
    segments.push({ lane: key, from: 0, to: time(invisible), label: 'visible', hue: 3 })
    const stored = time(removed) - time(invisible)
    if (stored > 0) segments.push({ lane: key, from: time(invisible), to: time(removed), label: stored / end > 0.15 ? 'expired, still stored' : undefined, hue: 4, striped: true })
    events.push({ lane: key, at: time(removed), label: `removed at ${time(removed).toLocaleString()} ${unit}`, hue: 8 })
  }
  const lanes = keys.filter((k) => segments.some((s) => s.lane === k)).map((k) => ({ id: k, label: k }))
  return (
    <>
      <Timeline title={title} lanes={lanes} segments={segments} events={events} end={end} unit={unit} />
      <ExpiryLegend items={[{ hue: 3, shape: 'bar', label: 'visible to reads' }, { hue: 4, shape: 'striped', label: 'expired, still stored' }, { hue: 8, shape: 'dot', label: 'removed, listener called' }]} />
    </>
  )
}

interface RefreshLine {
  mode: string
  event: string
  from?: number
  to?: number
  at?: number
  ms?: number
  version?: number
  thread?: string
}

/**
 * A reader every 100 ms; loads take 200 ms. For each mode: the loads (striped red when a caller waited, pink in the
 * background) and the reads (red when they waited, with how long).
 */
export function ExpiryRefreshRun({ title, lines, modes, end = 3000 }: { title: string; lines: readonly RefreshLine[]; modes: readonly { mode: string; label: string; background: boolean }[]; end?: number }) {
  const lanes = modes.flatMap((m) => [
    { id: `${m.mode}:loads`, label: `${m.label}: loads` },
    { id: `${m.mode}:reads`, label: `${m.label}: reads` },
  ])
  const segments: TimelineSegment[] = []
  const events: TimelineEvent[] = []
  for (const m of modes) {
    const mine = lines.filter((l) => l.mode === m.mode)
    mine.filter((l) => l.event === 'load').forEach((l, i) => {
      // the first load of every run is cold: somebody has to wait for it
      const background = l.thread ? l.thread === 'background' : m.background && i > 0
      segments.push({ lane: `${m.mode}:loads`, from: l.from!, to: l.to!, label: `v${l.version}`, hue: background ? 5 : 8, striped: !background })
    })
    for (const r of mine.filter((l) => l.event === 'read')) {
      const waited = r.ms! > 20
      const start = r.at! - r.ms!
      events.push({ lane: `${m.mode}:reads`, at: start, label: waited ? `waited ${Math.round(r.ms!)} ms` : '', hue: waited ? 8 : 6 })
    }
  }
  return (
    <>
      <Timeline title={title} lanes={lanes} segments={segments} events={events} end={end} unit="ms" />
      <ExpiryLegend
        items={[
          { hue: 8, shape: 'striped', label: 'load a caller waited for' },
          { hue: 5, shape: 'bar', label: 'background reload' },
          { hue: 6, shape: 'dot', label: 'read answered at once' },
          { hue: 8, shape: 'dot', label: 'read waited' },
        ]}
      />
    </>
  )
}
