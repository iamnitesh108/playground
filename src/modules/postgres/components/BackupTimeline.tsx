import { useMemo, useState, type CSSProperties } from 'react'
import { Button, Demo } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { planRestore, segmentCount, type Scenario } from '../simulation/backup'
import styles from './BackupTimeline.module.css'

const DAY: Scenario = {
  initialRows: [1],
  segmentMinutes: 2,
  end: 14,
  events: [
    { at: 0, kind: 'backup', backup: 'full', label: 'full backup' },
    { at: 3, kind: 'insert', ids: [2, 3], label: 'orders 2, 3' },
    { at: 6, kind: 'backup', backup: 'incremental', label: 'incremental backup' },
    { at: 8, kind: 'insert', ids: [4], label: 'order 4' },
    { at: 11, kind: 'drop', label: 'DROP TABLE' },
  ],
}

const clock = (minute: number) => `10:${String(minute).padStart(2, '0')}`
const walName = (segment: number) => `0000000100000000000000${String(segment + 3).padStart(2, '0')}`

/** Choose a recovery target on a timeline of backups, changes and archived WAL. */
export function BackupTimeline() {
  const [target, setTarget] = useState(10)
  const [lost, setLost] = useState<ReadonlySet<number>>(new Set())
  const plan = useMemo(() => planRestore(DAY, target, lost), [target, lost])
  const segments = segmentCount(DAY)

  const toggle = (s: number) =>
    setLost((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })

  const col = (minute: number, span = 1): CSSProperties => ({ gridColumn: `${minute + 1} / span ${span}` })

  return (
    <Demo
      title="Restore to any minute"
      hint="Drag the target. Click a WAL segment to lose it from the archive and see which targets become impossible."
      controls={
        <>
          <label className={styles.slider}>
            <span>recovery_target_time</span>
            <input type="range" min={0} max={DAY.end - 1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
            <code>{clock(target)}</code>
          </label>
          <Button size="sm" onClick={() => setTarget(10)}>Just before the DROP</Button>
          <Button size="sm" variant="ghost" onClick={() => setLost(new Set())} disabled={lost.size === 0}>Restore the archive</Button>
        </>
      }
    >
      <div className={styles.scroll}>
        <div className={styles.timeline} style={{ gridTemplateColumns: `repeat(${DAY.end}, minmax(0, 1fr))` }}>
          {DAY.events.map((e) => (
            <div key={e.at} className={cx(styles.event, plan.backups.includes(e) && styles.used, plan.applied.includes(e) && styles.applied)} data-kind={e.kind === 'backup' ? e.backup : e.kind} style={col(e.at, 2)}>
              <span className={styles.time}>{clock(e.at)}</span>
              {e.label}
            </div>
          ))}
  
          {Array.from({ length: DAY.end }, (_, m) => (
            <div key={`m${m}`} className={cx(styles.minute, m <= target && styles.past)} style={col(m)} />
          ))}
          <div className={styles.target} style={{ ...col(target), gridRow: '2 / span 2' }} aria-hidden="true" />
  
          {Array.from({ length: segments }, (_, s) => (
            <button
              key={`s${s}`}
              type="button"
              className={cx(styles.segment, lost.has(s) && styles.lost, plan.replay.includes(s) && styles.replayed, plan.missing === s && styles.missing)}
              style={col(s * DAY.segmentMinutes, DAY.segmentMinutes)}
              onClick={() => toggle(s)}
              title={`${walName(s)} — click to ${lost.has(s) ? 'restore' : 'lose'} it`}
            >
              …{walName(s).slice(-2)}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.legend}>
        <span className={styles.key} data-kind="replayed">replayed</span>
        <span className={styles.key} data-kind="lost">missing from archive</span>
        <span>WAL segments, one per 2 minutes</span>
      </div>

      <div className={cx(styles.result, !plan.ok && styles.failed)} aria-live="polite">
        <ol className={styles.steps}>
          <li>
            Restore base backup{plan.backups.length > 1 ? 's' : ''}:{' '}
            {plan.backups.length ? plan.backups.map((b) => `${b.label} (${clock(b.at)})`).join(' + ') : 'none available'}
          </li>
          <li>
            Replay WAL: {plan.replay.length ? plan.replay.map((s) => `…${walName(s).slice(-2)}`).join(', ') : '—'}
            {plan.missing !== null && <> → <strong>…{walName(plan.missing).slice(-2)} missing</strong></>}
          </li>
          <li>{plan.ok ? <>Stop at {clock(target)}, promote: a new timeline begins.</> : <>Recovery fails.</>}</li>
        </ol>
        <p className={styles.reason}>{plan.reason}</p>
        {plan.ok && (
          <div className={styles.rows}>
            <span className={styles.rowsLabel}>app.orders after restore:</span>
            {plan.rows === null ? <strong>table does not exist (restored after the DROP)</strong> : plan.rows.map((id) => <code key={id}>{id}</code>)}
          </div>
        )}
      </div>
    </Demo>
  )
}
