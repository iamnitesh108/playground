import { useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { ByteLayout, Flow, Timeline, type ByteField, type FlowStep } from '@/shared/figures'
import { Button, Callout, CodeBlock, Demo, Segmented, Table, TermList } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { CdcPipeline, ExtractNewRecordState, type ChangeEvent, type ReplicaIdentity } from '../simulation'
import styles from './lesson.module.css'
import own from './Debezium.module.css'

const OP_LABEL = { c: 'INSERT', u: 'UPDATE', d: 'DELETE' } as const

const CHAIN_STEPS: FlowStep[] = [
  { title: 'The app writes normally', body: <p>Your service runs an ordinary <code>INSERT</code>/<code>UPDATE</code>/<code>DELETE</code>. It knows nothing about Kafka.</p>, active: ['app', 'table', 'app>table'] },
  { title: 'Postgres changes the table', body: <p>The transaction commits. Nothing special so far.</p>, active: ['table'] },
  { title: 'Every change is in the WAL', body: <p>Before any change is applied, Postgres writes it to its <strong>write-ahead log</strong> for crash safety. With <code>wal_level=logical</code> the log contains enough detail to rebuild row changes. Each entry has a position, the <strong>LSN</strong>.</p>, active: ['table', 'wal', 'table>wal'] },
  { title: 'The slot remembers progress', body: <p>A <strong>logical replication slot</strong> decodes the WAL through the <code>pgoutput</code> plugin (only tables in the <strong>publication</strong>) and remembers the last LSN the reader confirmed. Postgres keeps all newer WAL until it is confirmed.</p>, active: ['wal', 'slot', 'wal>slot'] },
  { title: 'Debezium turns entries into events', body: <p>The connector streams from the slot, builds a change event for each row change, and confirms LSNs after Kafka has stored them.</p>, active: ['slot', 'dbz', 'slot>dbz'] },
  { title: 'Events land in a topic per table', body: <p>Default topic name: <code>&lt;topic.prefix&gt;.&lt;schema&gt;.&lt;table&gt;</code>. Key = the primary key, so all changes to one row stay in order.</p>, active: ['dbz', 'topic', 'dbz>topic'] },
]

function CdcChain() {
  return (
    <Flow
      title="From SQL statement to Kafka event"
      cols={4}
      rows={2}
      nodes={[
        { id: 'app', label: 'your service', sub: 'plain SQL', col: 0, row: 0, shape: 'actor' },
        { id: 'table', label: 'orders table', sub: 'Postgres', col: 1, row: 0, hue: 6, shape: 'store' },
        { id: 'wal', label: 'WAL', sub: 'every change, by LSN', col: 2, row: 0, hue: 6, shape: 'log' },
        { id: 'slot', label: 'replication slot', sub: 'pgoutput · confirmed LSN', col: 3, row: 0, hue: 6 },
        { id: 'dbz', label: 'Debezium task', sub: 'Kafka Connect', col: 3, row: 1, hue: 4 },
        { id: 'topic', label: 'app.public.orders', sub: 'key = primary key', col: 1, row: 1, span: 2, hue: 3, shape: 'log' },
      ]}
      edges={[
        { from: 'app', to: 'table', label: 'INSERT', flow: true },
        { from: 'table', to: 'wal', label: 'logged first', hue: 6, flow: true },
        { from: 'wal', to: 'slot', label: 'decode', hue: 6, flow: true },
        { from: 'slot', to: 'dbz', label: 'changes ⇄ confirmed LSN', hue: 4, flow: true, both: true },
        { from: 'dbz', to: 'topic', label: 'change event', hue: 3, flow: true },
      ]}
      steps={CHAIN_STEPS}
    />
  )
}

/* Sample change events (schemas.enable=false). The figure shows how many bytes each envelope field takes. */
const ROW = { id: 7, customer: 'ann', status: 'PAID', amount: 120.5 }
const SOURCE = { connector: 'postgresql', db: 'appdb', schema: 'public', table: 'orders', lsn: 24023128, txId: 771 }
const TS = 1792300000000
const fieldBytes = (name: string, value: unknown) => `"${name}":${JSON.stringify(value)}`.length
const envelopeRow = (op: 'c' | 'u' | 'd', before: unknown, after: unknown): ByteField[] => [
  { label: 'before', bytes: fieldBytes('before', before), hue: 2, content: before === null ? 'null' : JSON.stringify(before) },
  { label: 'after', bytes: fieldBytes('after', after), hue: 6, content: after === null ? 'null' : JSON.stringify(after) },
  { label: 'source', bytes: fieldBytes('source', SOURCE), hue: 5, content: '{"table":"orders","lsn":…}' },
  { label: 'op', bytes: fieldBytes('op', op), hue: 7, content: op },
  { label: 'ts_ms', bytes: fieldBytes('ts_ms', TS), hue: 3, content: String(TS) },
]

function CdcPlayground() {
  const cdc = useObservable(() => new CdcPipeline())
  const [view, setView] = useState<'envelope' | 'unwrapped'>('envelope')
  const latest: ChangeEvent | undefined = cdc.events[cdc.events.length - 1]
  const shown = latest && (view === 'envelope' ? latest.value : new ExtractNewRecordState().apply({ topic: cdc.topicName, key: latest.key, value: latest.value })?.value)

  return (
    <Demo
      title="Change data capture, live"
      hint="Insert rows, update and delete them, and compare the before field under each replica identity. Then stop the connector, make changes, and watch the WAL pile up until it restarts."
      controls={
        <>
          <Button size="sm" variant="primary" onClick={() => cdc.insert()}>
            INSERT order
          </Button>
          <Button size="sm" variant={cdc.connectorRunning ? 'danger' : 'default'} onClick={() => cdc.setConnectorRunning(!cdc.connectorRunning)}>
            {cdc.connectorRunning ? 'Stop connector' : 'Start connector'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => cdc.reset()}>
            Reset
          </Button>
          <Segmented
            label="REPLICA IDENTITY"
            value={cdc.replicaIdentity}
            onChange={(v: ReplicaIdentity) => cdc.setReplicaIdentity(v)}
            options={[
              { value: 'default', label: 'DEFAULT' },
              { value: 'full', label: 'FULL' },
            ]}
          />
        </>
      }
    >
      <div className={own.columns}>
        <section>
          <div className={styles.label}>table public.orders</div>
          <table className={own.table}>
            <thead>
              <tr>
                <th>id</th>
                <th>status</th>
                <th>amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cdc.rows.length === 0 && (
                <tr>
                  <td colSpan={4} className={own.empty}>
                    empty
                  </td>
                </tr>
              )}
              {cdc.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.status}</td>
                  <td>{row.amount}</td>
                  <td className={own.actions}>
                    <button type="button" onClick={() => cdc.advanceStatus(row.id)}>
                      update
                    </button>
                    <button type="button" onClick={() => cdc.remove(row.id)}>
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <div className={styles.label}>
            WAL · slot confirmed LSN {cdc.confirmedLsn || '—'} · {cdc.retainedWal.length} retained
          </div>
          <ol className={own.wal}>
            {cdc.wal.slice(-8).map((entry) => (
              <li key={entry.lsn} className={cx(own.walEntry, entry.lsn > cdc.confirmedLsn && own.pending)}>
                <span className={own.lsn}>0/{entry.lsn.toString(16).toUpperCase()}</span>
                {OP_LABEL[entry.op]} id={(entry.after ?? entry.before)!.id}
                <span className={own.walState}>{entry.lsn > cdc.confirmedLsn ? 'retained' : 'confirmed'}</span>
              </li>
            ))}
          </ol>
          <div className={cx(own.connector, !cdc.connectorRunning && own.stopped)}>
            Debezium connector: {cdc.connectorRunning ? 'RUNNING' : 'STOPPED — WAL is being retained'}
          </div>
        </section>
      </div>

      <div className={own.topic}>
        <div className={styles.label}>
          topic {cdc.topicName} · {cdc.events.length} events
        </div>
        <div className={own.events}>
          {cdc.events.map((event, i) => (
            <span key={i} className={own.event} data-op={event.value.op}>
              {event.value.op}:{event.key.id}
            </span>
          ))}
        </div>
      </div>

      {latest && (
        <div style={{ marginTop: 12 }}>
          <Segmented
            label="latest event value"
            value={view}
            onChange={setView}
            options={[
              { value: 'envelope', label: 'Debezium envelope' },
              { value: 'unwrapped', label: 'after ExtractNewRecordState' },
            ]}
          />
          <pre className={styles.json} style={{ marginTop: 8 }}>
            {`key: ${JSON.stringify(latest.key)}\nvalue: ${JSON.stringify(shown, null, 2)}${view === 'unwrapped' && latest.value.op === 'd' ? '   (a delete becomes a tombstone by default)' : ''}`}
          </pre>
        </div>
      )}
    </Demo>
  )
}

export default function Debezium() {
  return (
    <>
      <p>
        <strong>Change data capture (CDC)</strong> means turning every insert, update and delete in a database into an
        event. <strong>Debezium</strong> is the most widely used open-source CDC tool, and it runs as a set of Kafka
        Connect source connectors — one per database type (Postgres, MySQL, SQL Server, MongoDB, Oracle…).
      </p>

      <h2>Why not just poll the table?</h2>
      <p>
        You could run <code>SELECT … WHERE updated_at &gt; :last</code> every few seconds. But polling misses deletes,
        misses intermediate states between polls, needs an <code>updated_at</code> column everywhere, and adds query
        load. Log-based CDC reads the database’s own transaction log instead: every committed change, in order, with
        almost no extra load.
      </p>

      <CdcChain />

      <h2>The Postgres pieces</h2>
      <Table
        head={['Piece', 'What it is', 'Config']}
        rows={[
          ['WAL', 'Postgres’ write-ahead log of every change', 'wal_level=logical'],
          ['Output plugin', 'Decodes WAL into row changes; pgoutput is built in', 'plugin.name=pgoutput'],
          ['Publication', 'Which tables are published for logical replication', 'publication.name, publication.autocreate.mode'],
          ['Replication slot', 'Server-side cursor that remembers the confirmed LSN', 'slot.name'],
          ['Replica identity', 'How much of the old row is logged for UPDATE/DELETE', 'ALTER TABLE … REPLICA IDENTITY FULL'],
        ]}
      />

      <CdcPlayground />

      <Callout tone="warn" title="Slots hold WAL hostage">
        A replication slot keeps every WAL segment its reader has not confirmed. If the connector is stopped, failing,
        or deleted while the slot remains, Postgres keeps writing WAL and never frees it — eventually filling the disk.
        Monitor <code>pg_replication_slots</code>, drop slots you no longer use, and consider{' '}
        <code>max_slot_wal_keep_size</code> (Postgres 13+) to cap how much WAL a slot may hold — at the price of the
        slot being invalidated if it falls further behind.
      </Callout>
      <Timeline
        title="A stopped connector and the WAL its slot holds (schematic)"
        lanes={[
          { id: 'conn', label: 'connector' },
          { id: 'wal', label: 'WAL kept' },
        ]}
        segments={[
          { lane: 'conn', from: 0, to: 30, label: 'streaming, confirming LSNs', hue: 4 },
          { lane: 'conn', from: 30, to: 70, label: 'stopped / failed', hue: 8, striped: true },
          { lane: 'conn', from: 70, to: 100, label: 'catching up', hue: 4 },
          { lane: 'wal', from: 0, to: 30, label: 'a little', hue: 6 },
          { lane: 'wal', from: 30, to: 70, label: 'grows: nothing confirmed', hue: 8, striped: true },
          { lane: 'wal', from: 70, to: 100, label: 'freed as it confirms', hue: 6 },
        ]}
        events={[
          { lane: 'conn', at: 30, label: 'stops', hue: 8 },
          { lane: 'conn', at: 70, label: 'restarted', hue: 6 },
        ]}
        end={100}
        unit="min"
        playable
      />

      <h2>The change event</h2>
      <p>Every Debezium event value is an envelope with the same fields:</p>
      <ul>
        <li>
          <code>op</code> — <code>c</code> create, <code>u</code> update, <code>d</code> delete, <code>r</code> read
          (from a snapshot), <code>t</code> truncate.
        </li>
        <li>
          <code>before</code> / <code>after</code> — the row before and after the change (<code>null</code> where it
          does not apply). How much of <code>before</code> you get depends on the table’s replica identity: with the
          default, an UPDATE has no <code>before</code> and a DELETE only carries the primary key; with{' '}
          <code>REPLICA IDENTITY FULL</code> both carry every old column.
        </li>
        <li>
          <code>source</code> — where it came from: connector, database, schema, table, LSN, transaction ID.
        </li>
        <li>
          <code>ts_ms</code> — when Debezium processed it.
        </li>
      </ul>
      <ByteLayout
        title="The envelope of three changes to one row, field by field (JSON bytes, default replica identity)"
        rows={[
          { label: 'INSERT  op=c', fields: envelopeRow('c', null, ROW) },
          { label: 'UPDATE  op=u — default identity: no before image', fields: envelopeRow('u', null, { ...ROW, status: 'SHIPPED' }) },
          { label: 'DELETE  op=d — default identity: only the primary key', fields: envelopeRow('d', { id: ROW.id }, null) },
          { label: 'tombstone after unwrap: same key, no value', fields: [{ label: 'key', bytes: JSON.stringify({ id: ROW.id }).length, hue: 3, content: JSON.stringify({ id: ROW.id }) }, { label: 'value', bytes: 0, hue: 8, content: 'null' }] },
        ]}
        caption="Rows are drawn to one scale, so events can be compared. The source block is the same size in every event and often outweighs the row itself. Sizes are the JSON lengths of these sample events."
      />
      <p>
        Many consumers only want the new row, not the envelope. The <code>ExtractNewRecordState</code> SMT (“unwrap”)
        replaces the envelope with the contents of <code>after</code>, as the toggle above shows. A delete has no{' '}
        <code>after</code>; by default (<code>delete.tombstone.handling.mode=tombstone</code>) it is turned into a
        tombstone — a record with a <code>null</code> value.
      </p>

      <h2>Snapshots</h2>
      <p>
        A slot only sees changes made after it was created. To also capture rows that already exist, Debezium can take
        an initial <strong>snapshot</strong>, emitting each existing row as an <code>op: r</code> event, before
        streaming. <code>snapshot.mode</code> controls it: <code>initial</code> (default: snapshot once, then stream),{' '}
        <code>always</code>, <code>initial_only</code>, <code>when_needed</code>, or <code>no_data</code> — skip
        existing rows and stream only new changes (older Debezium versions call this <code>never</code>, which newer
        versions deprecate). That last option suits tables whose old
        rows do not matter, such as an outbox.
      </p>
      <Timeline
        title="snapshot.mode=initial: existing rows first, then the stream (schematic)"
        lanes={[
          { id: 'slot', label: 'slot' },
          { id: 'snap', label: 'snapshot' },
          { id: 'stream', label: 'streaming' },
        ]}
        segments={[
          { lane: 'slot', from: 0, to: 100, label: 'keeps every change made since it was created', hue: 6 },
          { lane: 'snap', from: 0, to: 45, label: 'op=r: one event per existing row', hue: 3 },
          { lane: 'stream', from: 45, to: 100, label: 'op=c/u/d: changes, from the slot position', hue: 4 },
        ]}
        events={[
          { lane: 'slot', at: 0, label: 'slot created', hue: 6 },
          { lane: 'snap', at: 45, label: 'snapshot done', hue: 3 },
        ]}
        end={100}
        unit="%"
      />

      <h2>Keeping offsets moving: heartbeats</h2>
      <p>
        If the captured tables are quiet while other tables in the database are busy, the WAL keeps growing but
        Debezium has no event to confirm, so the slot cannot advance. Setting <code>heartbeat.interval.ms</code> makes
        Debezium emit periodic heartbeat records (to a <code>__debezium-heartbeat.&lt;prefix&gt;</code> topic) and
        commit its position with them, letting Postgres recycle WAL. Replication slots are per database: if the busy
        writes happen in a <em>different</em> database on the same server, heartbeats alone do not help — also set{' '}
        <code>heartbeat.action.query</code> so each heartbeat writes a tiny row the connector can confirm.
      </p>
      <Flow
        title="Quiet captured table, busy database: heartbeats let the slot move on"
        cols={4}
        rows={2}
        nodes={[
          { id: 'busy', label: 'other tables', sub: 'busy writes', col: 0, row: 0, hue: 6, shape: 'store' },
          { id: 'wal', label: 'WAL', sub: 'grows with every write', col: 1, row: 0, hue: 6, shape: 'log' },
          { id: 'slot', label: 'replication slot', sub: 'confirmed LSN', col: 2, row: 0, hue: 6 },
          { id: 'dbz', label: 'Debezium', sub: 'no captured change', col: 3, row: 0, hue: 4 },
          { id: 'hb', label: '__debezium-heartbeat.app', sub: 'every heartbeat.interval.ms', col: 2, row: 1, span: 2, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'busy', to: 'wal', label: 'writes', hue: 6, flow: true },
          { from: 'wal', to: 'slot', hue: 6, flow: true },
          { from: 'dbz', to: 'hb', label: 'heartbeat', hue: 3, flow: true },
          { from: 'dbz', to: 'slot', hue: 4, dashed: true },
        ]}
        caption="Each heartbeat lets Debezium confirm the current position, so Postgres can recycle WAL even though no captured row changed."
      />

      <CodeBlock
        title="a Debezium Postgres connector"
        code={`
{
  "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
  "tasks.max": "1",
  "database.hostname": "db",
  "database.port": "5432",
  "database.user": "cdc_user",
  "database.password": "\${file:/run/secrets/connect.properties:db.password}",
  "database.dbname": "appdb",

  "plugin.name": "pgoutput",
  "slot.name": "app_slot",
  "publication.name": "app_publication",
  "publication.autocreate.mode": "filtered",
  "topic.prefix": "app",

  "table.include.list": "public.orders",
  "snapshot.mode": "initial",
  "heartbeat.interval.ms": "10000",
  "tombstones.on.delete": "true"
}
`}
      />
      <Callout tone="note">
        A Postgres change stream is a single ordered sequence, so Debezium’s Postgres connector always runs one task
        regardless of <code>tasks.max</code>. Useful knobs include <code>skipped.operations</code> (e.g.{' '}
        <code>u,d,t</code> to emit inserts only), <code>max.batch.size</code> and <code>poll.interval.ms</code>.
      </Callout>

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'CDC', definition: 'Change data capture: streaming database changes as events.' },
          { term: 'Debezium', definition: 'Open-source CDC platform built on Kafka Connect.' },
          { term: 'WAL', definition: 'Write-ahead log: Postgres’ durable, ordered record of every change.' },
          { term: 'LSN', definition: 'Log sequence number: a position in the WAL.' },
          { term: 'Logical decoding', definition: 'Turning WAL into row-level change streams.' },
          { term: 'pgoutput', definition: 'Postgres’ built-in logical decoding output plugin.' },
          { term: 'Replication slot', definition: 'Server-side cursor that retains WAL until the reader confirms it.' },
          { term: 'Publication', definition: 'The set of tables a logical replication stream covers.' },
          { term: 'Change event envelope', definition: 'Debezium’s before/after/source/op/ts_ms record value.' },
          { term: 'Snapshot', definition: 'Initial read of existing rows before streaming changes.' },
          { term: 'Heartbeat', definition: 'Periodic Debezium record that lets the slot advance on quiet tables.' },
          { term: 'Replica identity', definition: 'Table setting for how much of the old row is written to the WAL.' },
        ]}
      />
    </>
  )
}
