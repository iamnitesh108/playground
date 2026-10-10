import { useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { PoolSimulator, SESSION_MODE, TRANSACTION_MODE, type PoolMode } from '../simulation/pool'
import styles from './PoolPlayground.module.css'

const MODES: Record<PoolMode['id'], PoolMode> = { session: SESSION_MODE, transaction: TRANSACTION_MODE }

const PHASE_LABEL = { thinking: 'in app code', waiting: 'waiting', running: 'in a transaction' } as const

/** Clients, a pooler and its server connections, ticking in real time. */
export function PoolPlayground() {
  const sim = useObservable(() => new PoolSimulator({ clients: 8, size: 3, mode: TRANSACTION_MODE, thinkTicks: 4, runTicks: 2 }))
  const [playing, setPlaying] = useState(true)
  useInterval(() => sim.step(), playing ? 600 : null)
  const { mode, clients, size } = sim.options

  return (
    <Demo
      title="A pooler between many clients and few server connections"
      hint="Each client spends some time in application code, then runs one short transaction. Switch the pool mode, and watch who waits."
      controls={
        <>
          <Segmented label="pool_mode" value={mode.id} options={[{ value: 'session', label: 'session' }, { value: 'transaction', label: 'transaction' }]} onChange={(id) => sim.configure({ mode: MODES[id] })} />
          <Segmented label="clients" value={clients} options={[4, 8, 16].map((n) => ({ value: n, label: String(n) }))} onChange={(n) => sim.configure({ clients: n })} />
          <Segmented label="pool size" value={size} options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))} onChange={(n) => sim.configure({ size: n })} />
          <Button size="sm" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</Button>
          <Button size="sm" disabled={playing} onClick={() => sim.step()}>Step</Button>
          <Button size="sm" variant="ghost" onClick={() => sim.reset()}>Reset</Button>
        </>
      }
    >
      <div className={styles.layout}>
        <section>
          <div className={styles.label}>Clients (application connections)</div>
          <div className={styles.clients}>
            {sim.clients.map((c) => (
              <div key={c.id} className={styles.client} data-phase={c.phase} title={`client ${c.id}: ${PHASE_LABEL[c.phase]}`}>
                <span className={styles.clientId}>c{c.id}</span>
                <span className={styles.phase}>{PHASE_LABEL[c.phase]}</span>
                <span className={styles.done}>{c.done} done</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.middle}>
          <div className={styles.label}>Waiting queue</div>
          <div className={styles.queue}>
            {sim.queue.length === 0 ? <span className={styles.empty}>empty</span> : sim.queue.map((id) => <span key={id} className={styles.queued}>c{id}</span>)}
          </div>
        </section>

        <section>
          <div className={styles.label}>Server connections (PostgreSQL backends)</div>
          <div className={styles.servers}>
            {sim.servers.map((holder, i) => {
              const client = holder === null ? null : sim.clients[holder - 1]
              const state = client === null ? 'free' : client.phase === 'running' ? 'busy' : 'held'
              return (
                <div key={i} className={cx(styles.server)} data-state={state}>
                  <span className={styles.serverId}>backend {i + 1}</span>
                  <span className={styles.holder}>{client ? `c${client.id}` : '—'}</span>
                  <span className={styles.phase}>{state === 'busy' ? 'running' : state === 'held' ? 'held, idle' : 'free'}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <dl className={styles.stats}>
        <div><dt>tick</dt><dd>{sim.tick}</dd></div>
        <div><dt>transactions done</dt><dd>{sim.completed}</dd></div>
        <div><dt>clients waiting</dt><dd>{sim.waiting}</dd></div>
        <div><dt>backends running SQL</dt><dd>{sim.busy} / {size}</dd></div>
        <div><dt>clients never served</dt><dd>{sim.clients.filter((c) => c.done === 0 && c.phase !== 'running').length}</dd></div>
      </dl>
    </Demo>
  )
}
