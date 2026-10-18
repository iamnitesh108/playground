import { useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { backlogFor, lostOnFailover, reconnect } from '../simulation/replication'
import { Slider } from './Slider'
import styles from './play.module.css'

const MB = 1024 * 1024
const size = (b: number) => (b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)

export function ReplicationPlayground() {
  const [rate, setRate] = useState(5000)
  const [bytes, setBytes] = useState(200)
  const [backlog, setBacklog] = useState(1)
  const [down, setDown] = useState(1)
  const [lag, setLag] = useState(20)
  const [wait, setWait] = useState(false)
  const r = reconnect({ backlogBytes: backlog * MB, writesPerSecond: rate, bytesPerWrite: bytes, disconnectedSeconds: down })
  const lost = lostOnFailover({ writesPerSecond: rate, replicaLagMs: lag, waitForReplica: wait })
  return (
    <Demo
      title="The replication backlog, and what a failover loses"
      hint="The primary keeps the last repl-backlog-size bytes of its write stream. A replica that comes back within that window continues where it stopped; later, it needs a full copy."
      controls={
        <>
          <Slider label="writes/s" value={rate} min={100} max={50_000} step={100} format={(v) => v.toLocaleString()} onChange={setRate} />
          <Slider label="bytes/write" value={bytes} min={50} max={2000} step={50} format={(v) => `${v} B`} onChange={setBytes} />
          <Slider label="repl-backlog-size" value={backlog} min={1} max={256} format={(v) => `${v} MB`} onChange={setBacklog} />
          <Slider label="replica away" value={down} min={0.1} max={120} step={0.1} format={(v) => `${v} s`} onChange={setDown} />
        </>
      }
    >
      <dl className={styles.stats}>
        <div><dt>stream while away</dt><dd>{size(r.missedBytes)}</dd></div>
        <div className={r.partial ? styles.good : styles.bad}><dt>on reconnect</dt><dd>{r.partial ? 'partial resync' : 'FULL resync'}</dd></div>
        <div><dt>backlog for 60 s away</dt><dd>{size(backlogFor(rate, bytes, 60))}</dd></div>
      </dl>
      <div className={styles.label} style={{ marginTop: 20 }}>Failover while the replica is behind</div>
      <div className={styles.row}>
        <Slider label="replica lag" value={lag} min={0} max={2000} step={10} format={(v) => `${v} ms`} onChange={setLag} />
        <Segmented label="clients use WAIT 1" value={wait ? 'yes' : 'no'} options={[{ value: 'no', label: 'no' }, { value: 'yes', label: 'yes' }]} onChange={(v) => setWait(v === 'yes')} />
      </div>
      <p className={cx(styles.verdict, lost > 0 && styles.verdictBad)}>
        {lost > 0 ? `${lost.toLocaleString()} acknowledged writes exist only on the old primary and are lost when the replica is promoted.` : wait ? 'Every acknowledged write reached a replica first (at the cost of a round trip per write) — though WAIT still is not a transaction: a write that timed out can still be on the primary only.' : 'The replica is in sync: nothing to lose right now.'}
      </p>
    </Demo>
  )
}
