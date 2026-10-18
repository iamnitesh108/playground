/**
 * The leaf level of a two-column index on (customer_id, created_at): entries
 * sorted by the first column, and by the second only within equal firsts.
 * For each query: which entries match, and how many separate stretches of
 * the leaf level they form (each stretch costs one descent of the tree).
 */
export interface Entry {
  customer: number
  date: string
}

export const CUSTOMERS = [40, 41, 42, 43, 44] as const
const DATES = ['01-15', '03-02', '05-20', '06-11'] as const

export const ENTRIES: readonly Entry[] = CUSTOMERS.flatMap((customer) => DATES.map((date) => ({ customer, date })))

export type CompositeQuery = 'both' | 'leading' | 'second' | 'sorted' | 'secondOrder'

export interface CompositeResult {
  sql: string
  matches: number[]
  /** Contiguous runs of matching entries. */
  ranges: number
  /** For queries with ORDER BY: do entries come out in that order? */
  ordered: boolean | null
  usable: 'yes' | 'skip' | 'no'
  text: string
}

function runs(matches: readonly number[]): number {
  return matches.filter((m, i) => i === 0 || matches[i - 1] !== m - 1).length
}

export function evaluate(q: CompositeQuery): CompositeResult {
  const idx = (pred: (e: Entry) => boolean) => ENTRIES.flatMap((e, i) => (pred(e) ? [i] : []))
  switch (q) {
    case 'both': {
      const m = idx((e) => e.customer === 42 && e.date >= '05-01')
      return {
        sql: "WHERE customer_id = 42 AND created_at >= '05-01'",
        matches: m,
        ranges: runs(m),
        ordered: null,
        usable: 'yes',
        text: 'Both columns are bounded: descend once to (42, 05-01) and read right until the customer changes. One short stretch.',
      }
    }
    case 'leading': {
      const m = idx((e) => e.customer === 42)
      return {
        sql: 'WHERE customer_id = 42',
        matches: m,
        ranges: runs(m),
        ordered: null,
        usable: 'yes',
        text: 'The leading column alone is enough: all entries of customer 42 sit next to each other. The leftmost prefix of an index works like an index on that prefix.',
      }
    }
    case 'second': {
      const m = idx((e) => e.date.startsWith('03'))
      return {
        sql: "WHERE created_at BETWEEN '03-01' AND '03-31'",
        matches: m,
        ranges: runs(m),
        ordered: null,
        usable: 'skip',
        text: 'Only the second column: matches are scattered, one stretch per customer. Before PostgreSQL 18 the choice was reading the whole index or the table. PostgreSQL 18 can skip scan: one descent per distinct customer — worth it only when the first column has few distinct values.',
      }
    }
    case 'sorted': {
      const m = idx((e) => e.customer === 42).slice(-2)
      return {
        sql: 'WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 2',
        matches: m,
        ranges: runs(m),
        ordered: true,
        usable: 'yes',
        text: 'Within customer 42 the dates are already sorted: read the stretch backwards and stop after 2. No Sort node, and only the rows returned are touched.',
      }
    }
    case 'secondOrder': {
      // the earliest date: one entry per customer, spread over the whole leaf level
      const m = idx((e) => e.date === DATES[0])
      return {
        sql: `ORDER BY created_at LIMIT ${m.length}`,
        matches: m,
        ranges: runs(m),
        ordered: false,
        usable: 'no',
        text: 'Across customers the dates are not in order: the five earliest entries (all 01-15) are spread over the whole leaf level, one per customer, so the index cannot deliver this order. The planner sorts — or uses an index that starts with created_at.',
      }
    }
  }
}
