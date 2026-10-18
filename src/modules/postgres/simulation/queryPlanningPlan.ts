/**
 * Turns the text of an EXPLAIN (ANALYZE, BUFFERS) plan into a tree of nodes,
 * so a recorded plan can be drawn and explored node by node.
 */
export interface PlanNode {
  id: number
  /** Node type and target, e.g. "Index Scan using orders_pkey on orders o". */
  name: string
  /** Just the node type, e.g. "Index Scan". */
  type: string
  est: { startup: number; total: number; rows: number } | null
  actual: { first: number | null; last: number | null; rows: number; loops: number } | null
  /** Lines under the node: conditions, buffers, sort method… */
  details: string[]
  children: PlanNode[]
}

export interface ParsedPlan {
  root: PlanNode
  /** Planning: / Planning Time / Execution Time lines. */
  summary: string[]
}

const HEADER = /^(.*?)(?:\s{2}\(cost=([\d.]+)\.\.([\d.]+) rows=(\d+) width=\d+\))?(?:\s*\(actual (?:time=([\d.]+)\.\.([\d.]+) )?rows=([\d.]+) loops=(\d+)\))?$/

const TYPES = [
  'Index Only Scan', 'Index Scan Backward', 'Index Scan', 'Bitmap Heap Scan', 'Bitmap Index Scan', 'Parallel Seq Scan', 'Seq Scan',
  'Nested Loop', 'Hash Join', 'Merge Join', 'Hash', 'Finalize GroupAggregate', 'Partial HashAggregate', 'HashAggregate', 'GroupAggregate',
  'Aggregate', 'Gather Merge', 'Gather', 'Sort', 'Limit', 'Materialize', 'Memoize',
]

function header(text: string, id: number): PlanNode {
  const m = HEADER.exec(text.trim())!
  const name = m[1].trim()
  return {
    id,
    name,
    type: TYPES.filter((t) => name.startsWith(t)).sort((a, b) => b.length - a.length)[0] ?? name.split(' on ')[0],
    est: m[2] ? { startup: Number(m[2]), total: Number(m[3]), rows: Number(m[4]) } : null,
    actual: m[7] ? { first: m[5] ? Number(m[5]) : null, last: m[6] ? Number(m[6]) : null, rows: Number(m[7]), loops: Number(m[8]) } : null,
    details: [],
    children: [],
  }
}

const indentOf = (line: string) => line.length - line.trimStart().length

export function parsePlan(lines: readonly string[]): ParsedPlan {
  const root = header(lines[0], 0)
  // each node remembers where its "->" sits; its own detail lines sit 6 columns further right
  const stack: { node: PlanNode; arrow: number }[] = [{ node: root, arrow: -4 }]
  const summary: string[] = []
  let id = 1
  for (const line of lines.slice(1)) {
    const indent = indentOf(line)
    if (summary.length || indent === 0) {
      summary.push(line)
      continue
    }
    const arrow = /^\s*->\s+(.*)$/.exec(line)
    if (arrow) {
      while (stack.length > 1 && stack.at(-1)!.arrow >= indent) stack.pop()
      const node = header(arrow[1], id++)
      stack.at(-1)!.node.children.push(node)
      stack.push({ node, arrow: indent })
      continue
    }
    while (stack.length > 1 && stack.at(-1)!.arrow + 6 > indent) stack.pop()
    stack.at(-1)!.node.details.push(line.trim())
  }
  return { root, summary }
}

/** Nodes in the order they finish producing their first row's inputs: children before parents. */
export function postOrder(node: PlanNode): PlanNode[] {
  return [...node.children.flatMap(postOrder), node]
}

export function walk(node: PlanNode): PlanNode[] {
  return [node, ...node.children.flatMap(walk)]
}

/** How far the row estimate was off: >1 means more rows than estimated. Null when not comparable. */
export function misestimate(node: PlanNode): number | null {
  if (!node.est || !node.actual) return null
  const est = Math.max(node.est.rows, 1)
  const act = Math.max(node.actual.rows, 1)
  return act / est
}

/** Nodes that read all their input before returning a first row: whatever is above them, their inputs run to the end. */
const BLOCKING = /^(Sort|Hash|HashAggregate|Partial HashAggregate|Aggregate|Materialize)$/

/**
 * Ids of nodes below a Limit that stop as soon as the Limit has its rows, so fewer rows than
 * estimated is expected. A blocking node (a Sort, a Hash…) stops early itself, but its inputs ran in full.
 */
export function stoppedEarly(root: PlanNode): Set<number> {
  const ids = new Set<number>()
  const visit = (n: PlanNode, under: boolean) => {
    if (under) ids.add(n.id)
    const passOn = n.type === 'Limit' || (under && !BLOCKING.test(n.type))
    for (const c of n.children) visit(c, passOn)
  }
  visit(root, false)
  return ids
}

/** The number after `key=` in a detail line such as "Buffers: shared hit=37 read=2". */
export function detailNumber(node: PlanNode, key: string): number | null {
  for (const d of node.details) {
    const m = new RegExp(`${key}=(\\d+)`).exec(d)
    if (m) return Number(m[1])
  }
  return null
}

/** The estimated total cost printed on the first line of a plan. */
export function totalCost(lines: readonly string[]): number {
  return parsePlan(lines).root.est?.total ?? 0
}

/** Estimated and actual rows of the top node of a plan. */
export function rowsOf(lines: readonly string[]): { est: number; actual: number } {
  const root = parsePlan(lines).root
  return { est: root.est?.rows ?? 0, actual: root.actual?.rows ?? 0 }
}

/** The first plan line containing `text`, trimmed. */
export function lineWith(lines: readonly string[], text: string): string {
  return lines.find((l) => l.includes(text))?.trim() ?? ''
}

/** "Execution Time: 22.006 ms" → 22.006 */
export function executionMs(lines: readonly string[]): number {
  return Number(/Execution Time: ([\d.]+)/.exec(lineWith(lines, 'Execution Time'))?.[1] ?? 0)
}
