import { useReducer, useState } from 'react'
import { hue } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { CompactedLog, type CleaningReport } from '../simulation/logCompactor'
import { CompactionLog } from './CompactionLog'
import styles from './CompactionFigures.module.css'

const HOUR = 3_600_000
const KEYS = ['user-1', 'user-2', 'user-3'] as const
type Key = (typeof KEYS)[number]
const NAMES: Record<Key, string[]> = { 'user-1': ['Ann', 'Anna', 'Annie', 'Ana'], 'user-2': ['Ben', 'Benny', 'Benji', 'Bo'], 'user-3': ['Cat', 'Cathy', 'Kat', 'Cate'] }
/** delete.retention.ms in the lab; one cleaned segment holds at most this many records (stands in for segment.bytes). */
const DELETE_RETENTION_MS = 2 * HOUR
const SEGMENT_SIZE = 6

const newLog = (ratio: number) => new CompactedLog({ deleteRetentionMs: DELETE_RETENTION_MS, segmentSize: SEGMENT_SIZE, minCleanableRatio: ratio })

/** Write values and tombstones, roll segments, run the cleaner and let time pass. */
export function CompactionLab() {
  const [ratio, setRatio] = useState(0.5)
  const [log, setLog] = useState(() => newLog(0.5))
  const [key, setKey] = useState<Key>('user-1')
  const [now, setNow] = useState(0)
  const [written, setWritten] = useState<Record<string, number>>({})
  const [report, setReport] = useState<CleaningReport | null>(null)
  const [event, setEvent] = useState('Write a few values, roll the segment so they become dirty, then run the cleaner.')
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  const reset = (r: number) => {
    setRatio(r)
    setLog(newLog(r))
    setNow(0)
    setWritten({})
    setReport(null)
    setEvent('Started again with an empty partition.')
  }

  const write = (tombstone: boolean) => {
    const n = written[key] ?? 0
    const value = tombstone ? null : NAMES[key][n % NAMES[key].length]
    const rec = log.append(key, value, now)
    if (!tombstone) setWritten({ ...written, [key]: n + 1 })
    setReport(null)
    setEvent(tombstone ? `Offset ${rec.offset}: a tombstone for ${key} (null value) — “delete ${key}”.` : `Offset ${rec.offset}: ${key}=${value} appended to the active segment.`)
    redraw()
  }

  const roll = () => {
    const before = log.segments.length
    log.roll()
    setEvent(log.segments.length > before ? `Rolled: the segment is closed and its records are now dirty — the cleaner may touch them. New writes go to …${String(log.active.base).padStart(4, '0')}.log.` : 'The active segment is empty; there is nothing to roll.')
    redraw()
  }

  const clean = () => {
    const pct = Math.round(log.dirtyRatio * 100)
    if (!log.cleanable) {
      setEvent(log.firstUncleanable <= log.cleanedTo ? 'Nothing is dirty: everything outside the active segment is already clean. Roll the segment first.' : `Dirty ratio ${pct}% is not above min.cleanable.dirty.ratio ${ratio * 100}%: the cleaner skips this log for now.`)
      setReport(null)
      return
    }
    const r = log.clean(now)
    setReport(r)
    if (r) {
      const sup = r.removed.filter((x) => x.why === 'superseded').length
      const exp = r.removed.filter((x) => x.why === 'tombstone expired').length
      setEvent(`Cleaned [${r.dirtyFrom}, ${r.dirtyTo}) at dirty ratio ${pct}%: ${sup} superseded record${sup === 1 ? '' : 's'} removed${exp ? `, ${exp} expired tombstone${exp === 1 ? '' : 's'} removed` : ''}${r.horizonsSet.length ? `, delete horizon set on ${r.horizonsSet.length} tombstone${r.horizonsSet.length === 1 ? '' : 's'} (t = ${(now + DELETE_RETENTION_MS) / HOUR} h)` : ''}; ${r.segmentsBefore} segment${r.segmentsBefore === 1 ? '' : 's'} → ${r.segmentsAfter}.`)
    }
    redraw()
  }

  const wait = () => {
    setNow(now + HOUR)
    setEvent(`One hour later (t = ${(now + HOUR) / HOUR} h). Tombstones go only when a cleaning runs after their horizon.`)
  }

  const removed = report?.removed.map((x) => x.record) ?? []
  return (
    <Demo
      title="Compact a partition by hand"
      hint={`Pick a key, write values or a tombstone, roll, then run the cleaner. delete.retention.ms is ${DELETE_RETENTION_MS / HOUR} h here.`}
      controls={
        <>
          <Segmented label="key" value={key} onChange={setKey} options={KEYS.map((k) => ({ value: k, label: k }))} />
          <Button size="sm" onClick={() => write(false)}>write value</Button>
          <Button size="sm" onClick={() => write(true)}>write tombstone</Button>
          <Button size="sm" onClick={roll}>roll segment</Button>
          <Button size="sm" variant="primary" onClick={clean}>run cleaner</Button>
          <Button size="sm" onClick={wait}>wait 1 hour</Button>
          <Segmented label="min.cleanable.dirty.ratio" value={ratio} onChange={reset} options={[{ value: 0.5, label: '0.5' }, { value: 0.01, label: '0.01' }]} />
        </>
      }
    >
      <div className={styles.status} style={hue(5)}>
        t = {now / HOUR} h · checkpoint {log.cleanedTo} · dirty ratio {Math.round(log.dirtyRatio * 100)}% · {log.read().length} records stored
      </div>
      <CompactionLog segments={log.segments} cleanedTo={log.cleanedTo} firstUncleanable={log.firstUncleanable} ghosts={removed} />
      <p className={styles.event} aria-live="polite">{event}</p>
    </Demo>
  )
}
