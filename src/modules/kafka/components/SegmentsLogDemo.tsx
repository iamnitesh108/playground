import { useReducer, useState } from 'react'
import { hue } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { SegmentedLog, fileName, type LogSegment } from '../simulation/segmentedLog'
import styles from './SegmentsFigures.module.css'

const HOUR = 3_600_000
/** One write is a batch of 3 records of 100 bytes. */
const BATCH_RECORDS = 3
const BATCH_BYTES = 300

interface Settings {
  segmentBytes: number
  segmentMs: number
  retentionMs: number
}
const OFF = Number.POSITIVE_INFINITY
const INITIAL: Settings = { segmentBytes: 900, segmentMs: OFF, retentionMs: OFF }

const newLog = (s: Settings) => new SegmentedLog({ segmentBytes: s.segmentBytes, segmentMs: s.segmentMs, indexIntervalBytes: 4096 })

function SegmentCard({ seg, active, now, segmentBytes, deleted }: { seg: LogSegment; active: boolean; now: number; segmentBytes: number; deleted?: boolean }) {
  const records = seg.batches.flatMap((b) => Array.from({ length: b.last - b.base + 1 }, (_, i) => ({ offset: b.base + i, time: b.time })))
  const age = seg.batches.length ? Math.round((now - seg.batches[seg.batches.length - 1].time) / HOUR) : null
  return (
    <div className={cx(styles.card, active && styles.cardActive, deleted && styles.cardDeleted)} style={hue(deleted ? 8 : 3)}>
      <div className={styles.cardHead}>
        <span className={styles.baseName}>{fileName(seg.base, 'log').replace(/^0+(?=\d)/, '…')}</span>
        <span className={styles.badge}>{deleted ? 'deleted' : active ? 'active' : 'closed'}</span>
      </div>
      <div className={styles.cells}>
        {records.map((r) => (
          <span key={r.offset} className={styles.cell} title={`offset ${r.offset}`}>
            {r.offset}
          </span>
        ))}
        {!records.length && <span className={styles.emptyNote}>empty</span>}
      </div>
      <div className={styles.fill} aria-hidden>
        <div className={styles.fillBar} style={{ width: `${Math.min(100, (seg.bytes / segmentBytes) * 100)}%` }} />
      </div>
      <div className={styles.cardMeta}>
        <span>{seg.bytes} of {segmentBytes} B</span>
        <span>{age === null ? '' : `newest record ${age} h old`}</span>
      </div>
    </div>
  )
}

/** Write batches, let time pass, and watch the active segment roll (by size or time) and old segments expire. */
export function SegmentsLogDemo() {
  const [settings, setSettings] = useState<Settings>(INITIAL)
  const [log, setLog] = useState(() => newLog(INITIAL))
  const [now, setNow] = useState(0)
  const [gone, setGone] = useState<LogSegment[]>([])
  const [event, setEvent] = useState('Nothing written yet: one empty segment, 00000000000000000000.log.')
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  const change = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setLog(newLog(next))
    setNow(0)
    setGone([])
    setEvent('Settings changed: the partition starts again, empty.')
  }

  /** Retention runs in the background; here it runs after every action. */
  const cleanup = (at: number, what: string) => {
    const before = log.segments.slice()
    const deleted = log.expire(at, settings.retentionMs)
    if (deleted.length) {
      setGone(before.filter((s) => deleted.includes(s.base)))
      const rolled = log.active.batches.length === 0 && log.active.base === log.logEnd && deleted.length === before.length
      return `${what} Retention deleted ${deleted.map((b) => `segment ${b}`).join(', ')}: every record in it was older than ${settings.retentionMs / HOUR} h.${rolled ? ' All of them had expired, so Kafka first rolled a new empty segment.' : ''} The log now starts at offset ${log.logStart}.`
    }
    return what
  }

  const write = () => {
    const reason = log.rollReason(BATCH_BYTES, now)
    const batch = log.append(BATCH_RECORDS, BATCH_BYTES, now)
    const what =
      reason === 'size'
        ? `The batch did not fit (${log.segments[log.segments.length - 2].bytes} + ${BATCH_BYTES} B > ${settings.segmentBytes} B): rolled a new segment at offset ${batch.base}.`
        : reason === 'time'
          ? `This batch came more than segment.ms after the active segment’s first batch, so it rolled a new segment at offset ${batch.base}.`
          : `Appended offsets ${batch.base}–${batch.last} to the active segment.`
    setEvent(cleanup(now, what))
    redraw()
  }

  const wait = () => {
    const at = now + HOUR
    setNow(at)
    setEvent(cleanup(at, `One hour later (t = ${at / HOUR} h). Nothing rolls while nobody writes.`))
    redraw()
  }

  return (
    <Demo
      title="Write, wait, and watch segments roll and expire"
      hint="Each write is one batch of 3 records (300 bytes). Sizes are tiny so you can see the rules; the real defaults are 1 GiB and 7 days."
      controls={
        <>
          <Segmented label="segment.bytes" value={settings.segmentBytes} onChange={(v) => change({ segmentBytes: v })} options={[{ value: 600, label: '600 B' }, { value: 900, label: '900 B' }, { value: 1500, label: '1500 B' }]} />
          <Segmented label="segment.ms" value={settings.segmentMs} onChange={(v) => change({ segmentMs: v })} options={[{ value: OFF, label: 'off' }, { value: 2 * HOUR, label: '2 h' }]} />
          <Segmented label="retention.ms" value={settings.retentionMs} onChange={(v) => change({ retentionMs: v })} options={[{ value: OFF, label: 'off' }, { value: 3 * HOUR, label: '3 h' }]} />
          <Button size="sm" variant="primary" onClick={write}>write a batch</Button>
          <Button size="sm" onClick={wait}>wait 1 hour</Button>
        </>
      }
    >
      <div className={styles.clock} style={hue(3)}>
        t = {now / HOUR} h · log start offset {log.logStart} · log end offset {log.logEnd} · {log.segments.length} segment{log.segments.length === 1 ? '' : 's'}
      </div>
      <div className={styles.dir}>
        {gone.map((seg) => (
          <SegmentCard key={`gone-${seg.base}`} seg={seg} active={false} now={now} segmentBytes={settings.segmentBytes} deleted />
        ))}
        {log.segments.map((seg) => (
          <SegmentCard key={seg.base} seg={seg} active={seg === log.active} now={now} segmentBytes={settings.segmentBytes} />
        ))}
      </div>
      <p className={styles.event} aria-live="polite">{event}</p>
    </Demo>
  )
}
