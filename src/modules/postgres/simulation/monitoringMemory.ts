/*
 * Memory settings from the size of the machine: the widely used starting points
 * (PostgreSQL docs and common tuning guides), plus the worst case they allow.
 * Rules of thumb for a dedicated database server — measure and adjust.
 */

export type Workload = 'oltp' | 'mixed' | 'reporting'

export interface MemoryInput {
  readonly ramMb: number
  readonly maxConnections: number
  readonly workload: Workload
  readonly autovacuumWorkers: number
}

export interface MemoryPlan {
  readonly sharedBuffersMb: number
  readonly effectiveCacheSizeMb: number
  readonly maintenanceWorkMemMb: number
  readonly workMemMb: number
  /** work_mem-sized areas one query may use at once (sorts, hashes ×hash_mem_multiplier). */
  readonly areasPerQuery: number
  /** If every connection ran such a query at the same moment. */
  readonly worstCaseQueriesMb: number
  readonly worstCaseMaintenanceMb: number
  /** What is left for the OS page cache and everything else in the worst case. */
  readonly leftMb: number
}

/** How many work_mem areas a typical query uses at once, by workload. */
const AREAS: Record<Workload, number> = { oltp: 2, mixed: 3, reporting: 6 }

const roundMb = (mb: number) => (mb >= 64 ? Math.round(mb / 16) * 16 : Math.max(1, Math.round(mb)))

export function planMemory(input: MemoryInput): MemoryPlan {
  const { ramMb, maxConnections, workload, autovacuumWorkers } = input
  const sharedBuffersMb = roundMb(ramMb / 4)
  const effectiveCacheSizeMb = roundMb(ramMb * 0.75)
  const maintenanceWorkMemMb = roundMb(Math.min(2048, ramMb / (workload === 'reporting' ? 8 : 16)))
  const areasPerQuery = AREAS[workload]
  // half of what remains after shared_buffers, shared by every connection's sorts and hashes;
  // the other half stays for the OS page cache even in the worst case
  const workMemMb = Math.max(1, Math.floor((ramMb - sharedBuffersMb) / 2 / (maxConnections * areasPerQuery)))
  const worstCaseQueriesMb = workMemMb * areasPerQuery * maxConnections
  const worstCaseMaintenanceMb = maintenanceWorkMemMb * autovacuumWorkers
  const leftMb = ramMb - sharedBuffersMb - worstCaseQueriesMb - worstCaseMaintenanceMb
  return { sharedBuffersMb, effectiveCacheSizeMb, maintenanceWorkMemMb, workMemMb, areasPerQuery, worstCaseQueriesMb, worstCaseMaintenanceMb, leftMb }
}

export const formatMb = (mb: number): string => (Math.abs(mb) >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${Math.round(mb)} MB`)
