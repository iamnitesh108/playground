import type { ReactNode } from 'react'
import { Flow, type FlowEdge, type FlowNode, type FlowStep } from '@/shared/figures'
import { Tabs } from '@/shared/ui'

/*
 * Session, transaction and statement pooling as stepped flows: three clients, one PgBouncer,
 * a pool of two server connections. Colours: c1 client A, c2 client B, c3 PostgreSQL backends.
 */

const NODES: FlowNode[] = [
  { id: 'a', label: 'client A', sub: 'app connection', col: 0, row: 0, hue: 1, shape: 'actor' },
  { id: 'b', label: 'client B', sub: 'app connection', col: 0, row: 1, hue: 2, shape: 'actor' },
  { id: 'c', label: 'client C', sub: 'app connection', col: 0, row: 2, shape: 'actor' },
  { id: 'pgb', label: 'PgBouncer', sub: 'pool of 2', col: 1, row: 0, rowSpan: 3, shape: 'queue' },
  { id: 'b1', label: 'backend 1', sub: 'postgres process', col: 2, row: 0, hue: 3, shape: 'store' },
  { id: 'b2', label: 'backend 2', sub: 'postgres process', col: 2, row: 1, hue: 3, shape: 'store' },
]
const EDGES: FlowEdge[] = [
  { from: 'a', to: 'pgb', hue: 1 },
  { from: 'b', to: 'pgb', hue: 2 },
  { from: 'c', to: 'pgb' },
  { from: 'pgb', to: 'b1', hue: 3, flow: true },
  { from: 'pgb', to: 'b2', hue: 3, flow: true },
]

const SESSION: FlowStep[] = [
  {
    title: 'A connects and gets backend 1 — for good',
    body: <p>In session mode a server connection is lent when the client connects and returned only when it disconnects.</p>,
    active: ['a', 'pgb', 'b1', 'a>pgb', 'pgb>b1'],
  },
  {
    title: 'B connects and gets backend 2',
    body: <p>A is busy in its own application code, but backend 1 stays reserved for it. B takes the last free one.</p>,
    active: ['a', 'b', 'pgb', 'b1', 'b2', 'a>pgb', 'b>pgb', 'pgb>b1', 'pgb>b2'],
  },
  {
    title: 'C waits — although both backends are idle',
    body: <p>The pool is used up by sessions, not by work. C’s query waits until A or B disconnects (recorded below: 2 seconds).</p>,
    active: ['c', 'pgb', 'c>pgb'],
  },
]

const TRANSACTION: FlowStep[] = [
  {
    title: 'A runs one transaction on backend 1',
    body: <p>The server connection is lent at <code>BEGIN</code> (or at a single statement) and taken back at <code>COMMIT</code>.</p>,
    active: ['a', 'pgb', 'b1', 'a>pgb', 'pgb>b1'],
  },
  {
    title: 'B’s transaction runs on the same backend 1',
    body: <p>While A is in application code, backend 1 serves B. Two backends can serve hundreds of mostly idle clients.</p>,
    active: ['b', 'pgb', 'b1', 'b>pgb', 'pgb>b1'],
  },
  {
    title: 'Three at once: two run, one queues',
    body: <p>Nobody gets an error: C waits in PgBouncer’s queue until a transaction ends, as in the recorded <code>pg_sleep</code> test above.</p>,
    active: ['a', 'b', 'c', 'pgb', 'b1', 'b2', 'a>pgb', 'b>pgb', 'c>pgb', 'pgb>b1', 'pgb>b2'],
  },
  {
    title: 'Session state stays on the backend',
    body: (
      <p>
        A’s <code>SET statement_timeout</code> changed backend 1, not “A”. B’s next transaction lands there and inherits it — recorded in the
        next section.
      </p>
    ),
    active: ['a', 'b', 'pgb', 'b1', 'a>pgb', 'b>pgb', 'pgb>b1'],
  },
]

const STATEMENT: FlowStep[] = [
  {
    title: 'Every statement is lent separately',
    body: <p>A’s first statement may run on backend 1 and its second on backend 2. The finest sharing of all.</p>,
    active: ['a', 'pgb', 'b1', 'b2', 'a>pgb', 'pgb>b1', 'pgb>b2'],
  },
  {
    title: 'So multi-statement transactions are refused',
    body: <p>A transaction must stay on one backend, which statement mode cannot promise: PgBouncer rejects <code>BEGIN</code> (recorded below).</p>,
    active: ['a', 'pgb', 'a>pgb'],
  },
]

const flow = (title: string, steps: FlowStep[], caption: ReactNode) => (
  <Flow title={title} cols={3} rows={3} nodes={NODES} edges={EDGES} steps={steps} width={640} rowHeight={78} caption={caption} />
)

export function PoolingModes() {
  return (
    <Tabs
      items={[
        { label: 'session', content: flow('pool_mode = session', SESSION, 'Lent per connection: safe for every feature, but no more clients than server connections can do anything at a time.') },
        { label: 'transaction', content: flow('pool_mode = transaction', TRANSACTION, 'Lent per transaction: the usual choice for applications; session features need care.') },
        { label: 'statement', content: flow('pool_mode = statement', STATEMENT, 'Lent per statement: autocommit only. Rarely used outside special cases (e.g. PL/Proxy).') },
      ]}
    />
  )
}
