import { useMemo, useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import { schedule, workload } from '../simulation/eventLoop'
import { LineChart } from './LineChart'
import styles from './play.module.css'

const A = CAPTURE.architecture
const hgetall = Number(CAPTURE.operations.slowlog[0].out.match(/3\) \(integer\) (\d+)/)![1]) / 1000

/** Costs recorded on the real server (see the lesson). */
const SLOW = {
  none: null,
  hgetall: { command: 'HGETALL on a 100,000-field hash', at: 100, cost: hgetall },
  keys: { command: `KEYS nomatch* on ${A.keyspace.toLocaleString()} keys`, at: 100, cost: A.keysMs },
  lua: { command: 'a 600 ms Lua script', at: 100, cost: A.blockedDefault.slowMs },
} as const

type Slow = keyof typeof SLOW

/** Three clients send a GET every 10 ms; one batch job sends a slow command. */
export function EventLoopPlayground() {
  const [slow, setSlow] = useState<Slow>('keys')
  const until = slow === 'lua' ? 900 : 300
  const runs = useMemo(() => schedule(workload(['web-1', 'web-2', 'web-3'], 10, until, SLOW[slow])), [slow, until])
  const gets = runs.filter((r) => r.command === 'GET')
  const worst = Math.max(...gets.map((g) => g.latency))
  const delayed = gets.filter((g) => g.latency > 1).length
  const busy = runs.find((r) => r.client === 'batch-job')

  return (
    <Demo
      title="One thread, one command at a time"
      hint="Three web servers each send a GET every 10 ms (0.05 ms each, counting the work of reading the request and writing the reply on the socket). At 100 ms a batch job sends one slow command. The costs are the ones measured on the recorded server."
      controls={
        <Segmented
          label="slow command"
          value={slow}
          options={[
            { value: 'none', label: 'none' },
            { value: 'hgetall', label: `HGETALL big hash (${hgetall.toFixed(1)} ms)` },
            { value: 'keys', label: `KEYS nomatch* (${A.keysMs} ms)` },
            { value: 'lua', label: `Lua loop (${A.blockedDefault.slowMs} ms)` },
          ]}
          onChange={setSlow}
        />
      }
    >
      <div className={styles.label}>The server thread, {until} ms</div>
      <div className={styles.track} aria-label="server thread timeline">
        {runs.filter((r) => r.client !== 'batch-job').map((r) => (
          <span key={r.id} className={styles.segment} style={{ left: `${(r.start / until) * 100}%`, width: `max(1px, ${(r.cost / until) * 100}%)` }} />
        ))}
        {busy && <span className={styles.segmentSlow} style={{ left: `${(busy.start / until) * 100}%`, width: `${(busy.cost / until) * 100}%` }} title={busy.command} />}
      </div>
      <LineChart
        title="How long each GET waited (arrival → reply)"
        series={[{ label: 'GET latency', points: gets.map((g) => [Math.round(g.at), +g.latency.toFixed(2)] as const), emphasis: true }]}
        xLabel="arrived at (ms)"
        yLabel="ms"
        formatY={(v) => (v < 1 ? v.toFixed(2) : v.toFixed(0))}
        height={190}
      />
      <dl className={styles.stats}>
        <div><dt>GETs</dt><dd>{gets.length}</dd></div>
        <div className={delayed ? styles.bad : undefined}><dt>GETs that waited</dt><dd>{delayed}</dd></div>
        <div className={worst > 1 ? styles.bad : undefined}><dt>worst GET</dt><dd>{worst < 1 ? `${worst.toFixed(2)} ms` : `${worst.toFixed(0)} ms`}</dd></div>
        <div><dt>a GET on its own</dt><dd>0.05 ms</dd></div>
      </dl>
    </Demo>
  )
}
