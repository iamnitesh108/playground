import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Demo } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { WalSimulator, type Page, type WalRecord } from '../simulation/wal'
import styles from './WalPlayground.module.css'

function PageCard({ page, sim, dirty }: { page: Page; sim: WalSimulator; dirty?: boolean }) {
  const committed = sim.committed
  const visible = sim.visible(page)
  return (
    <div className={cx(styles.page, dirty && styles.dirty)}>
      <div className={styles.pageHead}>
        <span>{page.id}</span>
        <span className={styles.lsn}>LSN {page.lsn || '—'}</span>
        {dirty && <span className={styles.badge}>dirty</span>}
      </div>
      {Object.entries(page.rows).map(([key, versions]) => (
        <div key={key} className={styles.row}>
          <span className={styles.key}>{key}</span>
          <span className={styles.versions}>
            {versions.map((v, i) => (
              <span
                key={i}
                className={styles.version}
                data-status={committed.has(v.xid) ? 'committed' : v.xid === sim.open?.xid ? 'open' : 'aborted'}
                title={`value ${v.value} written by xid ${v.xid}`}
              >
                {v.value}
                <sub>{v.xid}</sub>
              </span>
            ))}
          </span>
          <span className={styles.visible}>= {visible[key]}</span>
        </div>
      ))}
    </div>
  )
}

function Record({ r }: { r: WalRecord }) {
  return (
    <span className={styles.record} data-kind={r.kind}>
      <span className={styles.recLsn}>{r.lsn}</span>
      {r.kind === 'update' && `xid ${r.xid} ${r.key}=${r.value}`}
      {r.kind === 'commit' && `COMMIT ${r.xid}`}
      {r.kind === 'checkpoint' && `CHECKPOINT redo ${r.redo}`}
    </span>
  )
}

/** A new value for an UPDATE; only ever called from click handlers. */
const randomValue = () => 10 + Math.floor(Math.random() * 90)

/** Shared buffers, WAL and data files, with commits, checkpoints and crashes. */
export function WalPlayground() {
  const sim = useObservable(() => new WalSimulator())
  const crashed = sim.phase === 'crashed'


  return (
    <Demo
      title="Write-ahead logging and crash recovery"
      hint="Update a key and commit it, then crash: is it lost? Update without committing and crash. Write a page to disk before committing. Try a checkpoint before a crash."
      controls={
        <>
          {['a', 'b', 'c', 'd'].map((k) => (
            <Button key={k} size="sm" disabled={crashed} onClick={() => sim.update(k, randomValue())}>
              UPDATE {k}
            </Button>
          ))}
          <Button size="sm" variant="primary" disabled={!sim.open || crashed} onClick={() => sim.commit()}>
            COMMIT{sim.open ? ` xid ${sim.open.xid}` : ''}
          </Button>
          <Button size="sm" disabled={crashed} onClick={() => sim.writePage('page 0')}>
            write page 0
          </Button>
          <Button size="sm" disabled={crashed} onClick={() => sim.writePage('page 1')}>
            write page 1
          </Button>
          <Button size="sm" disabled={crashed} onClick={() => sim.checkpoint()}>
            CHECKPOINT
          </Button>
          <Button size="sm" variant="danger" disabled={crashed} onClick={() => sim.crash()}>
            Crash
          </Button>
          <Button size="sm" variant="primary" disabled={!crashed} onClick={() => sim.recover()}>
            Restart &amp; recover
          </Button>
          <Button size="sm" variant="ghost" onClick={() => sim.reset()}>
            Reset
          </Button>
        </>
      }
    >
      <div className={styles.columns}>
        <section className={cx(styles.side, crashed && styles.lost)}>
          <div className={styles.sideTitle}>Memory {crashed && '— lost in the crash'}</div>
          <div className={styles.label}>shared buffers</div>
          <div className={styles.pages}>
            {Object.values(sim.buffers).map((p) => (
              <PageCard key={p.id} page={p} sim={sim} dirty={p.dirty} />
            ))}
            {Object.keys(sim.buffers).length === 0 && <div className={styles.empty}>no pages cached</div>}
          </div>
          <div className={styles.label}>WAL buffer (not yet flushed)</div>
          <div className={styles.wal}>
            {sim.walBuffer.length === 0 ? <span className={styles.empty}>empty</span> : sim.walBuffer.map((r) => <Record key={r.lsn} r={r} />)}
          </div>
        </section>

        <section className={styles.side}>
          <div className={styles.sideTitle}>Disk — survives a crash</div>
          <div className={styles.label}>data files</div>
          <div className={styles.pages}>
            {Object.values(sim.disk).map((p) => (
              <PageCard key={p.id} page={p} sim={sim} />
            ))}
          </div>
          <div className={styles.label}>WAL files (pg_wal/)</div>
          <div className={styles.wal}>
            {sim.walDisk.length === 0 ? <span className={styles.empty}>empty</span> : sim.walDisk.map((r) => <Record key={r.lsn} r={r} />)}
          </div>
        </section>
      </div>

      <div className={styles.legend}>
        value<sub>xid</sub>: <span className={styles.version} data-status="committed">committed</span>
        <span className={styles.version} data-status="open">open</span>
        <span className={styles.version} data-status="aborted">never committed</span>
        <span> · “= n” is what a query sees</span>
      </div>
      <ol className={styles.log}>
        {sim.log.map((l) => (
          <li key={l.id} data-tone={l.tone}>
            {l.text}
          </li>
        ))}
      </ol>
    </Demo>
  )
}
