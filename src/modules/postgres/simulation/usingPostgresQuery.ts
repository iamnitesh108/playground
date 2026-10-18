/*
 * A tiny model of how PostgreSQL evaluates one SELECT, clause by clause, on the sample
 * customers and orders of the "Using PostgreSQL" lesson. Values are kept as the strings
 * the server returns (numeric '45.00', bigint '3'), so results can be compared with the
 * recorded output of the same SQL on a real server. No React, no dependencies.
 */

export interface Customer {
  id: string
  name: string
  city: string
}

export interface Order {
  id: string
  customer_id: string
  status: 'new' | 'paid' | 'shipped'
  /** numeric(10,2) as text */
  amount: string
}

export const CUSTOMERS: readonly Customer[] = [
  { id: '1', name: 'Ann', city: 'Lisbon' },
  { id: '2', name: 'Ben', city: 'Oslo' },
  { id: '3', name: 'Cara', city: 'Lisbon' },
  { id: '4', name: 'Dev', city: 'Porto' },
]

export const ORDERS: readonly Order[] = [
  { id: '1', customer_id: '1', status: 'paid', amount: '45.00' },
  { id: '2', customer_id: '1', status: 'paid', amount: '17.00' },
  { id: '3', customer_id: '2', status: 'shipped', amount: '180.00' },
  { id: '4', customer_id: '3', status: 'new', amount: '40.00' },
  { id: '5', customer_id: '2', status: 'paid', amount: '20.00' },
  { id: '6', customer_id: '1', status: 'new', amount: '180.00' },
  { id: '7', customer_id: '3', status: 'paid', amount: '90.00' },
]

export type Value = string | null
/** One row flowing through the pipeline: column name → value. */
export type Row = Readonly<Record<string, Value>>

export type FromChoice = 'orders' | 'inner' | 'left'
export type WhereChoice = 'none' | 'paid' | 'big'
export type GroupChoice = 'none' | 'customer'
export type HavingChoice = 'none' | 'two'
export type OrderChoice = 'amount' | 'key'
export type LimitChoice = 'none' | '3'

export interface QuerySpec {
  from: FromChoice
  where: WhereChoice
  group: GroupChoice
  having: HavingChoice
  order: OrderChoice
  limit: LimitChoice
}

export type Clause = 'FROM' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'SELECT' | 'ORDER BY' | 'LIMIT'

export interface Stage {
  clause: Clause
  /** The SQL text of this clause, or null when the query does not use it. */
  sql: string | null
  columns: readonly string[]
  rows: readonly Row[]
  /** For GROUP BY: how many input rows went into each group, same order as rows. */
  groupSizes?: readonly number[]
  note: string
}

const cents = (v: string) => Math.round(Number(v) * 100)
const money = (c: number) => `${Math.trunc(c / 100)}.${String(Math.abs(c % 100)).padStart(2, '0')}`

// ---- FROM: one strategy per source -------------------------------------------------------

interface Source {
  sql: string
  columns: readonly string[]
  rows: () => Row[]
  /** The grouping key and its column name in the output. */
  key: { expr: string; column: string }
}

const orderCols = (o: Order | null): Row => ({
  'o.id': o?.id ?? null,
  'o.customer_id': o?.customer_id ?? null,
  'o.status': o?.status ?? null,
  'o.amount': o?.amount ?? null,
})

const SOURCES: Record<FromChoice, Source> = {
  orders: {
    sql: 'FROM orders o',
    columns: ['o.id', 'o.customer_id', 'o.status', 'o.amount'],
    rows: () => ORDERS.map(orderCols),
    key: { expr: 'o.customer_id', column: 'customer_id' },
  },
  inner: {
    sql: 'FROM customers c\n  JOIN orders o ON o.customer_id = c.id',
    columns: ['c.name', 'o.id', 'o.customer_id', 'o.status', 'o.amount'],
    rows: () => CUSTOMERS.flatMap((c) => ORDERS.filter((o) => o.customer_id === c.id).map((o) => ({ 'c.name': c.name, ...orderCols(o) }))),
    key: { expr: 'c.name', column: 'name' },
  },
  left: {
    sql: 'FROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id',
    columns: ['c.name', 'o.id', 'o.customer_id', 'o.status', 'o.amount'],
    rows: () =>
      CUSTOMERS.flatMap((c) => {
        const mine = ORDERS.filter((o) => o.customer_id === c.id)
        // a customer without orders still appears once, with NULL in every orders column
        return mine.length ? mine.map((o) => ({ 'c.name': c.name, ...orderCols(o) })) : [{ 'c.name': c.name, ...orderCols(null) }]
      }),
    key: { expr: 'c.name', column: 'name' },
  },
}

// ---- WHERE: predicates (NULL compares as unknown, which WHERE treats as false) ---------------

const FILTERS: Record<Exclude<WhereChoice, 'none'>, { sql: string; test: (r: Row) => boolean }> = {
  paid: { sql: "WHERE o.status = 'paid'", test: (r) => r['o.status'] === 'paid' },
  big: { sql: 'WHERE o.amount >= 40', test: (r) => r['o.amount'] !== null && cents(r['o.amount']) >= 4000 },
}

// ---- ORDER BY: NULLs sort as larger than every value (last ascending, first descending) -----

type Dir = 'asc' | 'desc'
function compare(a: Value, b: Value, dir: Dir, numeric: boolean): number {
  if (a === b) return 0
  if (a === null) return dir === 'asc' ? 1 : -1
  if (b === null) return dir === 'asc' ? -1 : 1
  const d = numeric ? Number(a) - Number(b) : a < b ? -1 : a > b ? 1 : 0
  return dir === 'asc' ? d : -d
}

interface SortKey {
  column: string
  dir: Dir
  numeric: boolean
  sql: string
}

function sortKeys(spec: QuerySpec, src: Source): SortKey[] {
  if (spec.group === 'customer') {
    const k: SortKey = { column: src.key.column, dir: 'asc', numeric: src.key.column === 'customer_id', sql: src.key.column }
    return spec.order === 'amount' ? [{ column: 'total', dir: 'desc', numeric: true, sql: 'total DESC' }, k] : [k]
  }
  const id: SortKey = { column: 'id', dir: 'asc', numeric: true, sql: 'o.id' }
  return spec.order === 'amount' ? [{ column: 'amount', dir: 'desc', numeric: true, sql: 'o.amount DESC' }, id] : [id]
}

/** The SELECT list: which output columns come from which pipeline columns. */
function projection(spec: QuerySpec, src: Source): { sql: string; columns: string[] } {
  if (spec.group === 'customer') {
    return { sql: `SELECT ${src.key.expr}, count(o.id) AS orders, sum(o.amount) AS total`, columns: [src.key.column, 'orders', 'total'] }
  }
  return spec.from === 'orders'
    ? { sql: 'SELECT o.id, o.customer_id, o.status, o.amount', columns: ['id', 'customer_id', 'status', 'amount'] }
    : { sql: 'SELECT c.name, o.id, o.status, o.amount', columns: ['name', 'id', 'status', 'amount'] }
}

/** HAVING is only meaningful with GROUP BY; the lesson's controls enforce that. */
export function normalise(spec: QuerySpec): QuerySpec {
  return spec.group === 'none' ? { ...spec, having: 'none' } : spec
}

export function toSql(input: QuerySpec): string {
  const spec = normalise(input)
  const src = SOURCES[spec.from]
  const lines = [projection(spec, src).sql, src.sql]
  if (spec.where !== 'none') lines.push(FILTERS[spec.where].sql)
  if (spec.group === 'customer') lines.push(`GROUP BY ${src.key.expr}`)
  if (spec.having === 'two') lines.push('HAVING count(o.id) >= 2')
  lines.push(`ORDER BY ${sortKeys(spec, src).map((k) => k.sql).join(', ')}`)
  if (spec.limit === '3') lines.push('LIMIT 3')
  return lines.join('\n')
}

/** Runs the query one clause at a time and returns the rows after every clause. */
export function run(input: QuerySpec): Stage[] {
  const spec = normalise(input)
  const src = SOURCES[spec.from]
  const stages: Stage[] = []
  const all = src.rows()
  stages.push({
    clause: 'FROM',
    sql: src.sql,
    columns: src.columns,
    rows: all,
    note:
      spec.from === 'orders'
        ? `Every row of orders: ${all.length}.`
        : spec.from === 'inner'
          ? `Each order paired with its customer: ${all.length} rows. A customer with no orders is not in the result.`
          : `Every customer, with their orders — ${all.length} rows. Dev has no orders, so his orders columns are NULL.`,
  })

  const filter = spec.where === 'none' ? null : FILTERS[spec.where]
  const kept = filter ? all.filter(filter.test) : all
  stages.push({
    clause: 'WHERE',
    sql: filter?.sql ?? null,
    columns: src.columns,
    rows: kept,
    note: filter
      ? `${all.length - kept.length} of ${all.length} rows removed.${spec.from === 'left' && all.some((r) => r['o.id'] === null) && !kept.some((r) => r['o.id'] === null) ? ' The NULL row of the LEFT JOIN is gone too: NULL = … is never true.' : ''}`
      : 'No WHERE: every row continues.',
  })

  const keyCol = spec.from === 'orders' ? 'o.customer_id' : 'c.name'
  let shaped: Row[]
  if (spec.group === 'customer') {
    const groups = new Map<string, Row[]>()
    for (const r of kept) {
      const k = r[keyCol] ?? ''
      groups.set(k, [...(groups.get(k) ?? []), r])
    }
    const grouped = [...groups.entries()].map(([k, rows]) => {
      const amounts = rows.map((r) => r['o.amount']).filter((a): a is string => a !== null)
      return {
        row: {
          [src.key.column]: k,
          orders: String(rows.filter((r) => r['o.id'] !== null).length),
          total: amounts.length ? money(amounts.reduce((s, a) => s + cents(a), 0)) : null,
        } as Row,
        size: rows.length,
      }
    })
    stages.push({
      clause: 'GROUP BY',
      sql: `GROUP BY ${src.key.expr}`,
      columns: [src.key.column, 'orders', 'total'],
      rows: grouped.map((g) => g.row),
      groupSizes: grouped.map((g) => g.size),
      note: `${kept.length} rows collapse into ${grouped.length} groups, one per ${src.key.column === 'name' ? 'customer' : 'customer_id'}. count() and sum() run once per group; count(o.id) skips NULLs and sum() of nothing is NULL.`,
    })
    const having = spec.having === 'two' ? grouped.filter((g) => Number(g.row.orders) >= 2) : grouped
    stages.push({
      clause: 'HAVING',
      sql: spec.having === 'two' ? 'HAVING count(o.id) >= 2' : null,
      columns: [src.key.column, 'orders', 'total'],
      rows: having.map((g) => g.row),
      note:
        spec.having !== 'two'
          ? 'No HAVING: every group continues.'
          : having.length === grouped.length
            ? 'Filters groups, not rows. Every group here has at least 2 orders, so none is removed.'
            : `Filters groups, not rows: ${grouped.length - having.length} of ${grouped.length} groups had fewer than 2 orders and are removed.`,
    })
    shaped = having.map((g) => g.row)
    stages.push({ clause: 'SELECT', sql: projection(spec, src).sql, columns: [src.key.column, 'orders', 'total'], rows: shaped, note: 'The output columns: the group key and the two aggregates.' })
  } else {
    stages.push({ clause: 'GROUP BY', sql: null, columns: src.columns, rows: kept, note: 'No GROUP BY: rows stay individual.' })
    stages.push({ clause: 'HAVING', sql: null, columns: src.columns, rows: kept, note: 'No HAVING.' })
    const proj = projection(spec, src)
    const from = spec.from === 'orders' ? ['o.id', 'o.customer_id', 'o.status', 'o.amount'] : ['c.name', 'o.id', 'o.status', 'o.amount']
    shaped = kept.map((r) => Object.fromEntries(proj.columns.map((c, i) => [c, r[from[i]]])))
    stages.push({ clause: 'SELECT', sql: proj.sql, columns: proj.columns, rows: shaped, note: `Keeps ${proj.columns.length} of ${src.columns.length} columns.` })
  }

  const keys = sortKeys(spec, src)
  const sorted = [...shaped].sort((a, b) => {
    for (const k of keys) {
      const d = compare(a[k.column], b[k.column], k.dir, k.numeric)
      if (d) return d
    }
    return 0
  })
  const columns = stages[stages.length - 1].columns
  stages.push({
    clause: 'ORDER BY',
    sql: `ORDER BY ${keys.map((k) => k.sql).join(', ')}`,
    columns,
    rows: sorted,
    note: sorted.some((r) => keys.some((k) => r[k.column] === null))
      ? 'Sorted. NULL sorts as the largest value: first when descending, last when ascending.'
      : 'Sorted. The second key breaks ties, so the order is fully defined.',
  })
  const limited = spec.limit === '3' ? sorted.slice(0, 3) : sorted
  stages.push({
    clause: 'LIMIT',
    sql: spec.limit === '3' ? 'LIMIT 3' : null,
    columns,
    rows: limited,
    note: spec.limit !== '3' ? 'No LIMIT: every row is returned.' : sorted.length > 3 ? `First 3 of ${sorted.length} rows.` : `Only ${sorted.length} row${sorted.length === 1 ? '' : 's'} left, so LIMIT 3 cuts nothing here.`,
  })
  return stages
}

/** Every combination the lesson's controls can produce (HAVING only with GROUP BY). */
export function allSpecs(): QuerySpec[] {
  const out: QuerySpec[] = []
  for (const from of ['orders', 'inner', 'left'] as const)
    for (const where of ['none', 'paid', 'big'] as const)
      for (const group of ['none', 'customer'] as const)
        for (const having of group === 'none' ? (['none'] as const) : (['none', 'two'] as const))
          for (const order of ['amount', 'key'] as const)
            for (const limit of ['none', '3'] as const) out.push({ from, where, group, having, order, limit })
  return out
}

/** The final result as text lines, the same shape the recordings use. */
export function resultKey(stages: readonly Stage[]): string[] {
  const last = stages[stages.length - 1]
  return last.rows.map((r) => last.columns.map((c) => r[c] ?? 'NULL').join('|'))
}
