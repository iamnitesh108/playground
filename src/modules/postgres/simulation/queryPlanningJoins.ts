/**
 * The three join algorithms, run step by step on two tiny tables, and a
 * simplified version of the planner's arithmetic for pricing them at any size.
 */
export interface OrderRow {
  id: number
  customerId: number
}
export interface CustomerRow {
  id: number
  name: string
}

export const ORDERS: readonly OrderRow[] = [
  { id: 101, customerId: 7 },
  { id: 102, customerId: 3 },
  { id: 103, customerId: 9 },
  { id: 104, customerId: 7 },
  { id: 105, customerId: 2 },
  { id: 106, customerId: 4 },
]
export const CUSTOMERS: readonly CustomerRow[] = [
  { id: 3, name: 'Ann' },
  { id: 7, name: 'Ben' },
  { id: 1, name: 'Cho' },
  { id: 9, name: 'Dev' },
  { id: 4, name: 'Eli' },
]

export type JoinAlgorithm = 'nested' | 'indexed' | 'hash' | 'merge'

export interface JoinStep {
  phase: string
  note: string
  /** Position in the (possibly sorted) outer list, and in the inner list. */
  outer: number | null
  inner: number | null
  /** Hash join: buckets of inner positions, and the bucket in use. */
  buckets?: number[][]
  bucket?: number | null
  /** Pairs (outer position, inner position) emitted so far. */
  output: [number, number][]
  comparisons: number
  match: boolean
}

export interface JoinTrace {
  outer: readonly OrderRow[]
  inner: readonly CustomerRow[]
  steps: JoinStep[]
}

const BUCKETS = 4

export function traceJoin(alg: JoinAlgorithm): JoinTrace {
  const sortedRuns = alg === 'merge'
  const outer = sortedRuns ? [...ORDERS].sort((a, b) => a.customerId - b.customerId) : ORDERS
  const inner = sortedRuns ? [...CUSTOMERS].sort((a, b) => a.id - b.id) : CUSTOMERS
  const steps: JoinStep[] = []
  const output: [number, number][] = []
  let comparisons = 0
  const push = (s: Omit<JoinStep, 'output' | 'comparisons'>) => steps.push({ ...s, output: [...output], comparisons })

  if (alg === 'nested') {
    outer.forEach((o, i) => {
      inner.forEach((c, j) => {
        comparisons++
        const match = o.customerId === c.id
        if (match) output.push([i, j])
        push({ phase: 'loop', outer: i, inner: j, match, note: `order ${o.id} (customer ${o.customerId}) vs customer ${c.id}: ${match ? 'match → emit' : 'no'}` })
      })
    })
  } else if (alg === 'indexed') {
    // the inner table is reached through its primary-key index: one descent per outer row
    const byId = new Map(inner.map((c, j) => [c.id, j]))
    outer.forEach((o, i) => {
      comparisons += 2 // a two-level tree: root page, then leaf page
      const j = byId.get(o.customerId)
      if (j !== undefined) output.push([i, j])
      push({
        phase: 'probe',
        outer: i,
        inner: j ?? null,
        match: j !== undefined,
        note: `order ${o.id}: look up customer ${o.customerId} in customers_pkey → ${j !== undefined ? `found ${inner[j].name}` : 'no such key'}`,
      })
    })
  } else if (alg === 'hash') {
    const buckets: number[][] = Array.from({ length: BUCKETS }, () => [])
    inner.forEach((c, j) => {
      const b = c.id % BUCKETS
      buckets[b].push(j)
      push({ phase: 'build', outer: null, inner: j, buckets: buckets.map((x) => [...x]), bucket: b, match: false, note: `build: customer ${c.id} → bucket ${c.id} mod ${BUCKETS} = ${b}` })
    })
    outer.forEach((o, i) => {
      const b = o.customerId % BUCKETS
      let found: number | null = null
      for (const j of buckets[b]) {
        comparisons++
        if (inner[j].id === o.customerId) {
          found = j
          output.push([i, j])
        }
      }
      push({
        phase: 'probe',
        outer: i,
        inner: found,
        buckets,
        bucket: b,
        match: found !== null,
        note: `probe: order ${o.id} needs customer ${o.customerId} → bucket ${b} (${buckets[b].length} entr${buckets[b].length === 1 ? 'y' : 'ies'}) → ${found !== null ? 'match → emit' : 'no match'}`,
      })
    })
  } else {
    let i = 0
    let j = 0
    push({ phase: 'sorted', outer: null, inner: null, match: false, note: 'Both inputs sorted by the join key (by a Sort node, or read in order from an index).' })
    while (i < outer.length && j < inner.length) {
      comparisons++
      const a = outer[i].customerId
      const b = inner[j].id
      if (a === b) {
        output.push([i, j])
        push({ phase: 'merge', outer: i, inner: j, match: true, note: `${a} = ${b}: emit, next order` })
        i++
      } else if (a < b) {
        push({ phase: 'merge', outer: i, inner: j, match: false, note: `${a} < ${b}: no customer ${a}, advance orders` })
        i++
      } else {
        push({ phase: 'merge', outer: i, inner: j, match: false, note: `${a} > ${b}: no more orders for customer ${b}, advance customers` })
        j++
      }
    }
  }
  return { outer, inner, steps }
}

/* ---------------------------------------------------------------- pricing */

export interface JoinInputs {
  outerRows: number
  innerRows: number
  /** The inner table has an index on the join key. */
  innerIndexed: boolean
  /** Both inputs can be read in join-key order from an index. */
  sorted: boolean
  workMemKb: number
}

export interface JoinPrice {
  algorithm: 'nested loop' | 'nested loop + index' | 'hash join' | 'merge join'
  cost: number
  /** Temp file traffic in kB, 0 when everything fit in work_mem. */
  spillKb: number
  formula: string
}

// the planner's default constants
const SEQ_PAGE = 1
const CPU_TUPLE = 0.01
const CPU_OP = 0.0025
const ROWS_PER_PAGE = 100
const HASH_ENTRY_BYTES = 48
const SORT_ENTRY_BYTES = 40

const scan = (rows: number) => (rows / ROWS_PER_PAGE) * SEQ_PAGE + rows * CPU_TUPLE
const pagesOf = (rows: number, bytes: number) => (rows * bytes) / 8192
const log2 = (n: number) => Math.log2(Math.max(2, n))

function sortCost(rows: number, workMemKb: number): { cost: number; spillKb: number } {
  const cost = 2 * CPU_OP * rows * log2(rows)
  const kb = (rows * SORT_ENTRY_BYTES) / 1024
  if (kb <= workMemKb) return { cost, spillKb: 0 }
  // an external merge writes every row to temp files and reads it back
  return { cost: cost + 2 * pagesOf(rows, SORT_ENTRY_BYTES) * SEQ_PAGE, spillKb: Math.round(2 * kb) }
}

/** Prices every join algorithm for the inputs. Not the planner's exact formulas — the same shape. */
export function priceJoins(x: JoinInputs): JoinPrice[] {
  const { outerRows: n, innerRows: m, workMemKb } = x
  const base = scan(n) + scan(m)
  const prices: JoinPrice[] = [
    { algorithm: 'nested loop', cost: base + n * m * CPU_OP, spillKb: 0, formula: 'scan both + outer × inner comparisons' },
  ]
  if (x.innerIndexed) {
    // one descent per outer row; the upper levels stay cached, so mostly the leaf and the heap page cost anything
    const probe = 2 * 0.5 + log2(m) * CPU_OP + CPU_TUPLE
    prices.push({ algorithm: 'nested loop + index', cost: scan(n) + n * probe, spillKb: 0, formula: 'scan outer + outer × one index lookup' })
  }
  const hashKb = (m * HASH_ENTRY_BYTES) / 1024
  const batches = hashKb <= workMemKb ? 1 : 2 ** Math.ceil(Math.log2(hashKb / workMemKb))
  const hashSpill = batches > 1 ? 2 * (pagesOf(n, 40) + pagesOf(m, HASH_ENTRY_BYTES)) : 0
  prices.push({
    algorithm: 'hash join',
    cost: base + m * (CPU_OP + CPU_TUPLE) + n * CPU_OP + hashSpill * SEQ_PAGE,
    spillKb: Math.round(hashSpill * 8),
    formula: batches > 1 ? `scan both + build + probe, in ${batches} batches through temp files` : 'scan both + build a hash table of inner + one probe per outer row',
  })
  const so = x.sorted ? { cost: 0, spillKb: 0 } : sortCost(n, workMemKb)
  const si = x.sorted ? { cost: 0, spillKb: 0 } : sortCost(m, workMemKb)
  // reading in order from an index visits heap pages in index order: dearer than a plain scan
  const read = x.sorted ? 1.5 * base : base
  prices.push({
    algorithm: 'merge join',
    cost: read + so.cost + si.cost + (n + m) * CPU_OP,
    spillKb: so.spillKb + si.spillKb,
    formula: x.sorted ? 'read both in key order from indexes + one pass' : 'scan both + sort both + one pass',
  })
  return prices
}
