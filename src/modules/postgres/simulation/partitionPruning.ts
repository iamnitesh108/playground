/*
 * Partition pruning as a pure function: given how a table is partitioned and what a query
 * filters on, which partitions does PostgreSQL scan, and when does it decide?
 *  - The planner prunes with constants in the WHERE clause (EXPLAIN shows only the survivors).
 *  - The executor prunes at startup with values known only then: parameters of a generic
 *    plan, now(), stable functions ("Subplans Removed: n").
 *  - Nothing is pruned when the query does not compare the partition key itself, for
 *    example a filter on another column or on an expression of the key.
 */

export type Strategy = 'range' | 'list' | 'hash'

export interface Partition {
  name: string
  /** Bounds shown to the reader, e.g. FOR VALUES FROM ('2026-03-01') TO ('2026-04-01'). */
  bounds: string
}

export type Predicate =
  | { kind: 'range'; from: number; to: number } // months, inclusive (1–12)
  | { kind: 'param'; month: number } // created_at >= $1 in a generic plan
  | { kind: 'expression'; month: number } // date_trunc('month', created_at) = …
  | { kind: 'other-column' } // user_id = 42
  | { kind: 'list'; values: readonly string[] }
  | { kind: 'hash-eq'; userId: number }
  | { kind: 'hash-range' }

export type Stage = 'planner' | 'executor' | 'none'

export interface PruneResult {
  scanned: string[]
  stage: Stage
  why: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const mm = (m: number) => String(m).padStart(2, '0')
const day = (m: number) => (m === 13 ? '2027-01-01' : `2026-${mm(m)}-01`)

export const monthName = (m: number) => MONTHS[m - 1]

export const RANGE_PARTITIONS: Partition[] = MONTHS.map((_, i) => ({
  name: `events_2026_${mm(i + 1)}`,
  bounds: `FROM ('${day(i + 1)}') TO ('${day(i + 2)}')`,
}))

export const LIST_PARTITIONS: Partition[] = [
  { name: 'customers_eu', bounds: "IN ('de', 'fr', 'nl')" },
  { name: 'customers_us', bounds: "IN ('us', 'ca')" },
  { name: 'customers_other', bounds: 'DEFAULT' },
]
const LIST_VALUES: Record<string, string[]> = { customers_eu: ['de', 'fr', 'nl'], customers_us: ['us', 'ca'] }

export const HASH_PARTITIONS: Partition[] = [0, 1, 2, 3].map((r) => ({ name: `carts_${r}`, bounds: `WITH (MODULUS 4, REMAINDER ${r})` }))

export const partitionsOf = (s: Strategy): Partition[] => (s === 'range' ? RANGE_PARTITIONS : s === 'list' ? LIST_PARTITIONS : HASH_PARTITIONS)

/** The WHERE clause a predicate stands for. */
export function whereOf(p: Predicate): string {
  switch (p.kind) {
    case 'range':
      return `created_at >= '${day(p.from)}' AND created_at < '${day(p.to + 1)}'`
    case 'param':
      return `created_at >= $1 AND created_at < $1 + interval '1 day'`
    case 'expression':
      return `date_trunc('month', created_at) = '${day(p.month)}'`
    case 'other-column':
      return 'user_id = 42'
    case 'list':
      return p.values.length === 1 ? `region = '${p.values[0]}'` : `region IN (${p.values.map((v) => `'${v}'`).join(', ')})`
    case 'hash-eq':
      return `user_id = ${p.userId}`
    case 'hash-range':
      return 'user_id < 100'
  }
}

/**
 * Which partitions a query on `strategy` scans for `predicate`.
 * `hashOf` maps a user id to its hash partition (recorded on a real server: the hash function is PostgreSQL's own).
 */
export function prune(strategy: Strategy, p: Predicate, hashOf: (userId: number) => string | undefined): PruneResult {
  const all = partitionsOf(strategy).map((x) => x.name)
  if (strategy === 'range') {
    if (p.kind === 'range') {
      if (p.from === 1 && p.to === all.length) {
        return { scanned: all, stage: 'none', why: 'The range covers every partition’s bounds, so there is nothing to prune.' }
      }
      return { scanned: all.slice(p.from - 1, p.to), stage: 'planner', why: 'The bounds are constants, so the planner compares them with each partition’s range and keeps only the overlapping months.' }
    }
    if (p.kind === 'param') {
      return { scanned: [all[p.month - 1]], stage: 'executor', why: 'A generic plan does not know $1 when it is planned, so it keeps every partition; at execution start the value is known and the others are removed (“Subplans Removed: 11”).' }
    }
    if (p.kind === 'expression') {
      return { scanned: all, stage: 'none', why: 'The filter compares date_trunc(created_at), not created_at itself, so the planner cannot match it to the partition bounds. Write it as a range on the key instead.' }
    }
    return { scanned: all, stage: 'none', why: 'user_id is not the partition key: any month may contain user 42, so every partition is scanned (each through its own index, if it has one).' }
  }
  if (strategy === 'list') {
    if (p.kind !== 'list' || p.values.length === 0) return { scanned: all, stage: 'none', why: 'No filter on region: every partition is scanned.' }
    const hit = new Set<string>()
    for (const v of p.values) hit.add(Object.entries(LIST_VALUES).find(([, vs]) => vs.includes(v))?.[0] ?? 'customers_other')
    if (hit.size === all.length) {
      return { scanned: all, stage: 'none', why: 'These values fall into every list (values in no list belong to the DEFAULT partition), so there is nothing to prune.' }
    }
    return { scanned: all.filter((n) => hit.has(n)), stage: 'planner', why: 'Each value belongs to exactly one list; values in no list go to the DEFAULT partition.' }
  }
  if (p.kind === 'hash-eq') {
    const name = hashOf(p.userId)
    return { scanned: name ? [name] : all, stage: 'planner', why: 'For equality the planner hashes the constant and keeps the one partition with that remainder.' }
  }
  return { scanned: all, stage: 'none', why: 'Hash partitions do not keep ranges together: users 1–99 are spread over every partition, so a range filter cannot prune.' }
}
