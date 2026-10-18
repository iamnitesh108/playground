import { useMemo, useState, type ReactNode } from 'react'
import { hue } from '@/shared/figures'
import { Segmented, Walkthrough } from '@/shared/ui'
import { CompactedLog, type CleaningReport, type CompactedRecord, type CompactedSegment } from '../simulation/logCompactor'
import { CompactionLog, type RecordMark } from './CompactionLog'
import styles from './CompactionFigures.module.css'

export interface RecordedScenario {
  /** The partition before any cleaning, from the recorded dumps. */
  readonly before: readonly CompactedSegment[]
  /** Records written between the two cleanings (they roll the active segment). */
  readonly later: readonly { readonly key: string; readonly value: string | null }[]
  readonly times: { readonly clean1: number; readonly round4: number; readonly clean2: number }
  readonly deleteRetentionMs: number
  /** Recorded ls / checkpoint evidence for the last two steps, per pass. */
  readonly evidence: readonly [readonly [ReactNode, ReactNode], readonly [ReactNode, ReactNode]]
}

interface Pass {
  before: { segments: CompactedSegment[]; cleanedTo: number; firstUncleanable: number }
  report: CleaningReport
  after: { segments: CompactedSegment[]; cleanedTo: number; firstUncleanable: number }
  dirtyRatio: number
}

/** Runs the recorded scenario through the model and keeps the state around each cleaning. */
function replay(s: RecordedScenario): [Pass, Pass] {
  const log = new CompactedLog({ deleteRetentionMs: s.deleteRetentionMs, segmentSize: Number.MAX_SAFE_INTEGER, minCleanableRatio: 0.01 })
  log.segments = s.before.map((seg) => ({ base: seg.base, records: [...seg.records] }))
  log.logEnd = Math.max(...s.before.flatMap((seg) => seg.records.map((r) => r.offset))) + 1
  const snap = () => ({ segments: log.segments.map((seg) => ({ ...seg })), cleanedTo: log.cleanedTo, firstUncleanable: log.firstUncleanable })
  const pass = (now: number): Pass => {
    const before = snap()
    const dirtyRatio = log.dirtyRatio
    const report = log.clean(now)
    if (!report) throw new Error('nothing to clean')
    return { before, report, after: snap(), dirtyRatio }
  }
  const first = pass(s.times.clean1)
  log.roll()
  for (const r of s.later) log.append(r.key, r.value, s.times.round4)
  return [first, pass(s.times.clean2)]
}

function MapTable({ report }: { report: CleaningReport }) {
  return (
    <div className={styles.map} style={hue(5)}>
      <div className={styles.mapHead}>offset map · MD5(key) → last offset in [{report.dirtyFrom}, {report.dirtyTo})</div>
      {[...report.map].map(([key, offset]) => (
        <span key={key} className={styles.mapEntry}>
          {key} → {offset}
        </span>
      ))}
    </div>
  )
}

const marksFor = (report: CleaningReport, with_: 'mapped' | 'horizon') =>
  new Map<number, RecordMark>(with_ === 'mapped' ? [...report.map.values()].map((o) => [o, 'mapped']) : report.horizonsSet.map((r) => [r.offset, 'horizon']))

/** The recorded cleanings, step by step: dirty section, offset map, recopy, swap, checkpoint. */
export function CompactionPass({ scenario }: { scenario: RecordedScenario }) {
  const passes = useMemo(() => replay(scenario), [scenario])
  const [which, setWhich] = useState<0 | 1>(0)
  const p = passes[which]
  const r = p.report
  const removed: CompactedRecord[] = r.removed.map((x) => x.record)
  const why = (w: string) => r.removed.filter((x) => x.why === w).map((x) => x.record.offset)
  const superseded = why('superseded')
  const expired = why('tombstone expired')
  const active = p.before.segments.at(-1)?.records[0]
  const steps = [
    {
      title: 'Find the dirty section',
      body: (
        <p>
          The checkpoint says everything before offset {r.dirtyFrom} is clean. The active segment starts at {r.dirtyTo} and is never touched, so the
          dirty section is [{r.dirtyFrom}, {r.dirtyTo}). Dirty ratio = dirty ÷ (clean + dirty) = {Math.round(p.dirtyRatio * 100)}%, above{' '}
          <code>min.cleanable.dirty.ratio</code> (0.01 here, 0.5 by default), so this log is cleaned.
        </p>
      ),
    },
    {
      title: 'Build the offset map from the dirty section only',
      body: (
        <p>
          The cleaner reads the dirty records and keeps, per key, the last offset it saw — {r.map.size} keys. Records in the clean section and in the active
          segment are not in the map{active ? <>: {active.key}={active.value ?? 'null'} at offset {active.offset} is in the active segment, so it cannot supersede anything yet</> : null}.
        </p>
      ),
    },
    {
      title: 'Recopy the log from the beginning',
      body: (
        <p>
          Every segment before the active one is copied record by record. A record goes if the map holds a later offset for its key
          {superseded.length ? <> (offsets {superseded.join(', ')})</> : null}.{' '}
          {r.horizonsSet.length ? <>The tombstone at offset {r.horizonsSet.map((t) => t.offset).join(', ')} is the latest for its key, so it stays — and this first copy writes its delete horizon: now + <code>delete.retention.ms</code>.</> : null}
          {expired.length ? <>The tombstone at offset {expired.join(', ')} is past its delete horizon, so it goes too.</> : null}
        </p>
      ),
    },
    { title: 'Swap the cleaned segment in', body: <>{scenario.evidence[which][0]}</> },
    { title: 'Move the checkpoint', body: <>{scenario.evidence[which][1]}</> },
  ]
  return (
    <div className={styles.figure}>
      <Segmented label="cleaning" value={which} onChange={setWhich} options={[{ value: 0, label: 'first' }, { value: 1, label: 'second' }]} />
      <Walkthrough key={which} title={`Cleaning ${which + 1}, recorded on profiles-0`} steps={steps}>
        {(i) => (
          <div className={styles.stage}>
            {i <= 1 && <CompactionLog {...p.before} marks={i === 1 ? marksFor(r, 'mapped') : undefined} />}
            {i === 2 && <CompactionLog segments={p.before.segments.map((s) => ({ ...s, records: s.records.filter((x) => !removed.some((y) => y.offset === x.offset)) }))} cleanedTo={p.before.cleanedTo} firstUncleanable={p.before.firstUncleanable} ghosts={removed} marks={marksFor(r, 'horizon')} />}
            {i === 3 && <CompactionLog segments={p.after.segments} cleanedTo={p.before.cleanedTo} firstUncleanable={p.after.firstUncleanable} />}
            {i === 4 && <CompactionLog {...p.after} />}
            {i >= 1 && <MapTable report={r} />}
          </div>
        )}
      </Walkthrough>
    </div>
  )
}
