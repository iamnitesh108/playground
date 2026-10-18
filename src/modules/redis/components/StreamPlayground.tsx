import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Demo } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { StreamGroupModel } from '../simulation/stream'
import styles from './play.module.css'

const WORKERS = ['worker-1', 'worker-2']

/** A stream, one consumer group, two consumers: deliver, acknowledge, crash, claim. */
export function StreamPlayground() {
  const g = useObservable(() => new StreamGroupModel(WORKERS))
  return (
    <Demo
      title="A consumer group and its pending entries"
      hint="Reading with > delivers entries nobody in the group has seen and puts them in the reader's pending list. Only XACK takes them out. A crashed worker's pending entries wait there until someone claims them."
      controls={
        <>
          <Button size="sm" onClick={() => g.add(3)}>XADD ×3</Button>
          {WORKERS.map((w) => (
            <span key={w} className={styles.row}>
              <Button size="sm" disabled={g.crashed.has(w)} onClick={() => g.read(w, 2)}>{w}: read 2</Button>
              <Button size="sm" disabled={g.crashed.has(w)} onClick={() => g.ack(w)}>{w}: ack</Button>
            </span>
          ))}
          <Button size="sm" variant="danger" disabled={g.crashed.has('worker-2')} onClick={() => g.crash('worker-2')}>crash worker-2</Button>
          <Button size="sm" onClick={() => g.wait(1000)}>wait 1 s</Button>
          <Button size="sm" onClick={() => g.claim('worker-1', 1000)}>worker-1: XAUTOCLAIM 1000</Button>
          <Button size="sm" variant="ghost" onClick={() => g.reset()}>Reset</Button>
        </>
      }
    >
      <div className={styles.label}>Stream entries (last delivered to the group: {g.lastDelivered ? `#${g.lastDelivered}` : 'none'})</div>
      <div className={styles.cells}>
        {g.entries.length === 0 && <span className={styles.empty}>empty — XADD some entries</span>}
        {g.entries.map((id) => {
          const p = g.pending.find((x) => x.id === id)
          return (
            <span key={id} className={cx(styles.cell, g.acked.has(id) ? styles.cellOk : p ? styles.cellWarn : id <= g.lastDelivered ? styles.cellOn : undefined)} title={g.acked.has(id) ? 'acknowledged' : p ? `pending at ${p.consumer}` : 'not delivered yet'}>
              #{id}
              <br />
              <small>{g.acked.has(id) ? 'acked' : p ? p.consumer.replace('worker-', 'w') : 'new'}</small>
            </span>
          )
        })}
      </div>
      <div className={styles.grid2} style={{ marginTop: 12 }}>
        {WORKERS.map((w) => (
          <div key={w}>
            <div className={styles.label}>{w}{g.crashed.has(w) ? ' (crashed)' : ''} — pending</div>
            <div className={styles.cells}>
              {g.pending.filter((p) => p.consumer === w).map((p) => <span key={p.id} className={cx(styles.cell, styles.cellWarn)}>#{p.id}{p.deliveries > 1 ? ` ×${p.deliveries}` : ''}</span>)}
              {!g.pending.some((p) => p.consumer === w) && <span className={styles.empty}>none</span>}
            </div>
          </div>
        ))}
      </div>
      <dl className={styles.stats}>
        <div><dt>entries</dt><dd>{g.entries.length}</dd></div>
        <div><dt>pending (PEL)</dt><dd>{g.pending.length}</dd></div>
        <div><dt>lag (not delivered)</dt><dd>{g.lag}</dd></div>
        <div><dt>clock</dt><dd>{g.now} ms</dd></div>
      </dl>
      <ul className={styles.log}>{g.log.slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}</ul>
    </Demo>
  )
}
