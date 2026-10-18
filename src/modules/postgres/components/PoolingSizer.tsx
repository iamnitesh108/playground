import { useState } from 'react'
import { StatTiles } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { clientLatencyMs, saturationPoint, sizingPoint, type SizingModel } from '../simulation/pool'
import { MonitoringLineChart } from './MonitoringLineChart'
import styles from './PoolingSizer.module.css'

const SIZES = [1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128]
const WAIT = [
  { value: 0, label: 'all CPU' },
  { value: 1, label: 'half waiting' },
  { value: 4, label: '80 % waiting' },
]
const ms = (v: number) => (v < 10 ? `${v.toFixed(1)} ms` : `${Math.round(v).toLocaleString()} ms`)

/** Throughput and latency against pool size, from the model in simulation/pool.ts. */
export function PoolingSizer() {
  const [cores, setCores] = useState(8)
  const [waitMs, setWaitMs] = useState(1)
  const [clients, setClients] = useState(200)
  const [size, setSize] = useState(16)
  const model: SizingModel = { cores, cpuMs: 1, waitMs, contention: 0.006 }
  const curve = SIZES.map((n) => sizingPoint(model, n))
  const here = sizingPoint(model, size)
  const latency = clientLatencyMs(model, size, clients)
  const knee = saturationPoint(model)

  return (
    <Demo
      title="Pool size against throughput and latency"
      hint="Each transaction needs 1 ms of CPU, and may also wait (disk, network, locks) while its core serves someone else. Pick the server and the workload, then move the pool size."
      controls={
        <>
          <Segmented label="CPU cores" value={cores} options={[2, 4, 8, 16].map((n) => ({ value: n, label: String(n) }))} onChange={setCores} />
          <Segmented label="per transaction" value={waitMs} options={WAIT} onChange={setWaitMs} />
          <Segmented label="app clients" value={clients} options={[50, 200].map((n) => ({ value: n, label: String(n) }))} onChange={setClients} />
          <label className={styles.slider}>
            <span>pool size <strong>{size}</strong></span>
            <input type="range" min={0} max={SIZES.length - 1} step={1} value={SIZES.indexOf(size)} onChange={(e) => setSize(SIZES[Number(e.target.value)])} aria-valuetext={`${size} connections`} />
          </label>
        </>
      }
    >
      <MonitoringLineChart
        title="Transactions per second by pool size (model)"
        series={[{ label: 'throughput (tps)', hue: 6, points: curve.map((p) => ({ x: p.connections, y: p.tps })) }]}
        xUnit="connections in the pool"
        yLabel="tps"
        categorical
        markers={[{ x: size, label: `pool = ${size}` }]}
      />
      <StatTiles
        stats={[
          { label: 'throughput', value: `${here.tps.toLocaleString()} tps`, sub: `best possible: ${Math.round((cores / model.cpuMs) * 1000).toLocaleString()} tps`, hue: 6, bar: { value: here.tps, max: (cores / model.cpuMs) * 1000 } },
          { label: 'time inside PostgreSQL', value: ms(here.dbMs), sub: `alone it takes ${ms(model.cpuMs + waitMs)}`, hue: 3 },
          { label: 'waiting in the pool queue', value: size >= clients ? '0 ms' : ms(latency.waitMs), sub: `${Math.max(0, clients - size)} of ${clients} clients wait`, hue: 1 },
          { label: 'connections that saturate the cores', value: Math.round(knee), sub: 'cores × (CPU + wait) ÷ CPU', hue: 7 },
        ]}
      />
      <p className={styles.note}>
        Below {Math.round(knee)} connections the cores sit idle while transactions wait. Above it, extra connections cannot run any faster:
        they queue inside PostgreSQL instead of in the pool, and contention makes every transaction a little slower. A schematic model — the
        recorded curve above is the real thing.
      </p>
    </Demo>
  )
}
