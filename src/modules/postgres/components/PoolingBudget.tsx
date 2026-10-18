import { useState } from 'react'
import { Proportion } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { connectionBudget } from '../simulation/pool'
import styles from './PoolingBudget.module.css'

/** Every pool that can reach the server, added up against max_connections. */
export function PoolingBudget({ backendKb, refusal }: { backendKb: number; refusal: string }) {
  const [instances, setInstances] = useState(6)
  const [perInstance, setPerInstance] = useState(10)
  const [bouncer, setBouncer] = useState(false)
  const maxConnections = 100
  const b = connectionBudget({
    instances: bouncer ? 0 : instances,
    perInstance,
    bouncerPools: bouncer ? 1 : 0,
    bouncerPoolSize: 20,
    other: 5,
    maxConnections,
    reserved: 3,
  })
  const used = b.apps + b.bouncer + b.other + b.reserved
  const backends = b.apps + b.bouncer + b.other
  return (
    <Demo
      title="The connection budget"
      hint="Application instances each keep their own pool. Scale them out and watch max_connections — then put PgBouncer in front."
      controls={
        <>
          <Segmented label="app instances" value={instances} options={[2, 6, 12, 24].map((n) => ({ value: n, label: String(n) }))} onChange={setInstances} />
          <Segmented label="pool per instance" value={perInstance} options={[5, 10, 20].map((n) => ({ value: n, label: String(n) }))} onChange={setPerInstance} />
          <Segmented label="route" value={bouncer ? 'pgb' : 'direct'} options={[{ value: 'direct', label: 'direct' }, { value: 'pgb', label: 'via PgBouncer (pool 20)' }]} onChange={(v) => setBouncer(v === 'pgb')} />
        </>
      }
    >
      <Proportion
        title={`max_connections = ${maxConnections}: ${used} wanted`}
        parts={[
          ...(bouncer
            ? [{ label: `PgBouncer pool (${instances} × ${perInstance} clients share it)`, value: b.bouncer, hue: 1 as const }]
            : [{ label: `${instances} instances × ${perInstance}`, value: b.apps, hue: 1 as const }]),
          { label: 'monitoring, backups, admin', value: b.other, hue: 2 },
          { label: 'superuser_reserved_connections', value: b.reserved, hue: 4 },
          ...(b.free > 0 ? [{ label: 'free', value: b.free, hue: 6 as const }] : []),
        ]}
      />
      <p className={b.fits ? styles.ok : styles.bad}>
        {b.fits
          ? `Fits, with ${b.free} to spare. ${backends} backends × ${(backendKb / 1024).toFixed(1)} MB private memory each (recorded) ≈ ${Math.round((backends * backendKb) / 1024)} MB.`
          : `${-b.free} connections too many: the last instances to start get “${refusal}”.`}
      </p>
    </Demo>
  )
}
