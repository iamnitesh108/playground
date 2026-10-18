import { useState } from 'react'
import { Proportion, StatTiles } from '@/shared/figures'
import { CodeBlock, Demo, Segmented } from '@/shared/ui'
import { formatMb, planMemory, type Workload } from '../simulation/monitoringMemory'
import styles from './MonitoringMemory.module.css'

const RAM_GB = [4, 16, 64, 256]
const WORKLOADS: { value: Workload; label: string }[] = [
  { value: 'oltp', label: 'web / OLTP' },
  { value: 'mixed', label: 'mixed' },
  { value: 'reporting', label: 'reporting' },
]
const pgSize = (mb: number) => (mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024}GB` : `${mb}MB`)

/** Starting values for the memory settings, and the worst case they allow. */
export function MonitoringMemory() {
  const [ramGb, setRamGb] = useState(16)
  const [maxConnections, setMaxConnections] = useState(100)
  const [workload, setWorkload] = useState<Workload>('oltp')
  const plan = planMemory({ ramMb: ramGb * 1024, maxConnections, workload, autovacuumWorkers: 3 })
  const over = plan.leftMb < 0

  return (
    <Demo
      title="Memory settings calculator"
      hint="A dedicated database server. Choose its RAM, how many connections it accepts, and what the queries look like."
      controls={
        <>
          <Segmented label="RAM" value={ramGb} options={RAM_GB.map((g) => ({ value: g, label: `${g} GB` }))} onChange={setRamGb} />
          <Segmented label="max_connections" value={maxConnections} options={[50, 100, 200, 500].map((n) => ({ value: n, label: String(n) }))} onChange={setMaxConnections} />
          <Segmented label="workload" value={workload} options={WORKLOADS} onChange={setWorkload} />
        </>
      }
    >
      <StatTiles
        stats={[
          { label: 'shared_buffers', value: formatMb(plan.sharedBuffersMb), sub: '25 % of RAM', hue: 3 },
          { label: 'effective_cache_size', value: formatMb(plan.effectiveCacheSizeMb), sub: '75 % of RAM — a hint, allocates nothing', hue: 7 },
          { label: 'work_mem', value: formatMb(plan.workMemMb), sub: `per sort or hash; ~${plan.areasPerQuery} per query`, hue: 1 },
          { label: 'maintenance_work_mem', value: formatMb(plan.maintenanceWorkMemMb), sub: 'VACUUM, CREATE INDEX; capped at 2 GB here', hue: 4 },
        ]}
      />
      <Proportion
        title={`Worst case: every connection sorting at once (${formatMb(ramGb * 1024)} RAM)`}
        parts={[
          { label: 'shared_buffers', value: plan.sharedBuffersMb, hue: 3, display: formatMb(plan.sharedBuffersMb) },
          { label: `${maxConnections} × ${plan.areasPerQuery} × work_mem`, value: plan.worstCaseQueriesMb, hue: 1, display: formatMb(plan.worstCaseQueriesMb) },
          { label: '3 autovacuum workers', value: plan.worstCaseMaintenanceMb, hue: 4, display: formatMb(plan.worstCaseMaintenanceMb) },
          { label: 'left for the OS page cache', value: Math.max(0, plan.leftMb), hue: 6, display: formatMb(Math.max(0, plan.leftMb)) },
        ]}
      />
      {over && <p className={styles.warn}>Over RAM: the worst case no longer fits. Lower work_mem or max_connections (or put a pooler in front).</p>}
      <CodeBlock
        title="postgresql.conf (starting values)"
        language="ini"
        code={`shared_buffers = ${pgSize(plan.sharedBuffersMb)}          # restart needed
effective_cache_size = ${pgSize(plan.effectiveCacheSizeMb)}
work_mem = ${pgSize(plan.workMemMb)}
maintenance_work_mem = ${pgSize(plan.maintenanceWorkMemMb)}
max_connections = ${maxConnections}             # restart needed`}
      />
    </Demo>
  )
}
