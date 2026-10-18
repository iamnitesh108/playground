import { useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { lockTimeline } from '../simulation/lock'
import { Slider } from './Slider'
import styles from './LockPlayground.module.css'
import play from './play.module.css'

/** A lock with a TTL, a worker that pauses longer than the TTL, and the two safety measures. */
export function LockPlayground() {
  const [ttl, setTtl] = useState(500)
  const [pause, setPause] = useState(800)
  const [safe, setSafe] = useState(false)
  const [fencing, setFencing] = useState(false)
  const r = lockTimeline({ ttl, workA: pause, bTriesAt: 600, workB: 900, cTriesAt: 1000, safeRelease: safe, fencing })
  const end = Math.max(...r.holds.map((h) => h.to), ...r.events.map((e) => e.at)) + 100
  return (
    <Demo
      title="When the lock expires before the work is done"
      hint="A takes the lock, then stalls (a GC pause, a slow network call). B asks at 600 ms, C at 1000 ms. Change the TTL and the pause, then switch on the two fixes."
      controls={
        <>
          <Slider label="TTL" value={ttl} min={200} max={2000} step={100} format={(v) => `${v} ms`} onChange={setTtl} />
          <Slider label="A's work + pause" value={pause} min={100} max={1500} step={100} format={(v) => `${v} ms`} onChange={setPause} />
          <Segmented label="release" value={safe ? 'safe' : 'del'} options={[{ value: 'del', label: 'DEL' }, { value: 'safe', label: 'compare-and-delete' }]} onChange={(v) => setSafe(v === 'safe')} />
          <Segmented label="fencing token" value={fencing ? 'on' : 'off'} options={[{ value: 'off', label: 'off' }, { value: 'on', label: 'on' }]} onChange={(v) => setFencing(v === 'on')} />
        </>
      }
    >
      <div className={styles.lanes}>
        {(['A', 'B', 'C'] as const).map((who) => (
          <div key={who} className={styles.lane}>
            <span className={styles.who}>{who}</span>
            <span className={styles.track}>
              {r.holds.filter((h) => h.who === who).map((h) => (
                <span key={h.from}>
                  <span className={styles.valid} style={{ left: `${(h.from / end) * 100}%`, width: `${((Math.min(h.to, h.validUntil) - h.from) / end) * 100}%` }} title="working, holds the lock" />
                  {h.to > h.validUntil && <span className={styles.expired} style={{ left: `${(h.validUntil / end) * 100}%`, width: `${((h.to - h.validUntil) / end) * 100}%` }} title="still working, lock expired" />}
                </span>
              ))}
            </span>
          </div>
        ))}
        <div className={styles.axis}><span>0</span><span>{Math.round(end / 2)} ms</span><span>{end} ms</span></div>
      </div>
      <ol className={styles.events}>
        {r.events.map((e, i) => (
          <li key={i} className={cx(styles.event, styles[e.outcome])}>
            <span className={styles.at}>{e.at} ms</span> <b>{e.who}</b> {e.what}
          </li>
        ))}
      </ol>
      <p className={cx(play.verdict, (r.overlap && !fencing) || r.staleWriteAccepted ? play.verdictBad : undefined)}>
        {r.staleWriteAccepted ? 'A write was made by a client that no longer held the lock.' : r.overlap ? 'Two clients worked at the same time, but fencing rejected the stale write.' : 'No overlap: only one client worked at a time.'}
      </p>
    </Demo>
  )
}
