import { useMemo, useState } from 'react'
import { ByteLayout, Flow, Timeline, type ByteField, type FlowStep } from '@/shared/figures'
import { Callout, CodeBlock, Demo, Segmented, TermList } from '@/shared/ui'
import { TransformTrace } from '../components'
import {
  ConditionalTransform,
  ExtractKeyField,
  ExtractNewRecordState,
  ExtractTopicFromField,
  TopicNameMatches,
  TransformChain,
  type ConnectRecord,
} from '../simulation'

const DUAL_WRITE_STEPS: FlowStep[] = [
  { title: 'Save the order', body: <p>The service commits the order to its database.</p>, active: ['svc', 'db', 'svc>db'] },
  { title: 'Publish the event', body: <p>Then it calls <code>producer.send("order-created", …)</code>.</p>, active: ['svc', 'kafka', 'svc>kafka'] },
  { title: 'The broker is unreachable', body: <p>A network blip, a deploy, a timeout. The send fails after the database already committed.</p>, active: ['svc', 'svc>kafka'] },
  { title: 'Inconsistent forever', body: <p>The order exists, but nobody downstream will ever hear about it. Reversing the order of the two writes just flips the problem: an event for an order that was never saved.</p>, active: ['db', 'downstream'] },
]

function DualWrite() {
  return (
    <>
      <Flow
        title="The dual-write problem"
        cols={3}
        rowHeight={96}
        rows={2}
        nodes={[
          { id: 'svc', label: 'order service', sub: 'handles a request', col: 0, row: 0, rowSpan: 2, hue: 7 },
          { id: 'db', label: 'database', sub: '1. COMMIT order ✓', col: 1, row: 0, hue: 6, shape: 'store' },
          { id: 'kafka', label: 'Kafka', sub: '2. send — may fail', col: 1, row: 1, hue: 3, shape: 'log' },
          { id: 'downstream', label: 'downstream', sub: 'never hears of it', col: 2, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'svc', to: 'db', hue: 6, flow: true },
          { from: 'svc', to: 'kafka', hue: 8, dashed: true },
          { from: 'kafka', to: 'downstream', hue: 8, dashed: true },
        ]}
        steps={DUAL_WRITE_STEPS}
      />
      <Timeline
        title="One request, two writes, no shared transaction (schematic)"
        lanes={[
          { id: 'svc', label: 'service' },
          { id: 'db', label: 'database' },
          { id: 'kafka', label: 'Kafka' },
        ]}
        segments={[
          { lane: 'svc', from: 0, to: 70, label: 'handle the request', hue: 7 },
          { lane: 'db', from: 10, to: 30, label: 'INSERT + COMMIT', hue: 6 },
          { lane: 'kafka', from: 40, to: 70, label: 'send times out', hue: 8, striped: true },
          { lane: 'db', from: 30, to: 100, label: 'order exists', hue: 6 },
        ]}
        events={[
          { lane: 'db', at: 30, label: 'committed', hue: 6 },
          { lane: 'kafka', at: 70, label: 'no event, ever', hue: 8 },
        ]}
        end={100}
        unit="ms"
        playable
      />
    </>
  )
}

const PIPELINE_STEPS: FlowStep[] = [
  { title: 'One local transaction', body: <p>The service writes the business row <em>and</em> an outbox row describing the event, in the same database transaction. Both commit or neither does. No Kafka call in the request path.</p>, active: ['service', 'db', 'service>db'] },
  { title: 'The insert reaches the WAL', body: <p>The committed outbox insert is in the write-ahead log. The replication slot retains it until Debezium confirms it.</p>, active: ['db', 'wal', 'db>wal'] },
  { title: 'Debezium captures inserts only', body: <p>The connector watches only the outbox table and skips updates, deletes and truncates (<code>skipped.operations=u,d,t</code>). Old outbox rows can be purged without emitting anything.</p>, active: ['wal', 'debezium', 'wal>debezium'] },
  { title: 'Transforms route and reshape', body: <p><strong>Reroute</strong> sends the record to the topic named in the row’s <code>event_type</code> column, <strong>unwrap</strong> strips the Debezium envelope, <strong>ExtractField</strong> makes the business <code>id</code> the key, so every event for one entity lands in the same partition, in order.</p>, active: ['debezium', 'smt', 'debezium>smt'] },
  { title: 'An ordinary event in a topic', body: <p>Downstream sees a clean record on e.g. <code>INVOICE-ISSUED</code>: key = the business ID from the <code>id</code> column, value = the outbox row as JSON.</p>, active: ['smt', 'topic', 'smt>topic'] },
  { title: 'A consumer group processes it', body: <p>Consumers with manual acknowledgement, <code>auto.offset.reset=earliest</code>. They apply the event in their own database and only then ack.</p>, active: ['topic', 'consumer', 'topic>consumer'] },
  { title: 'Duplicates and failures', body: <p>A duplicate hits a unique constraint → it was already done → ack. A real failure → write a new outbox row (with the error as remarks) → ack. The retry rides the same pipeline later, and the partition never blocks.</p>, active: ['consumer', 'retry', 'db', 'consumer>retry', 'retry>db'] },
]

function OutboxPipeline() {
  return (
    <Flow
      title="The outbox pipeline end to end"
      cols={4}
      rowHeight={96}
      rows={2}
      nodes={[
        { id: 'service', label: 'service A', sub: 'handles a request', col: 0, row: 0, hue: 7 },
        { id: 'db', label: 'Postgres', sub: 'orders + outbox', col: 1, row: 0, hue: 6, shape: 'store' },
        { id: 'wal', label: 'WAL + slot', sub: 'pgoutput', col: 2, row: 0, hue: 6, shape: 'log' },
        { id: 'debezium', label: 'Debezium', sub: 'Kafka Connect', col: 3, row: 0, hue: 4 },
        { id: 'smt', label: 'SMTs', sub: 'reroute · unwrap · key', col: 3, row: 1, hue: 4 },
        { id: 'topic', label: 'topic', sub: 'INVOICE-ISSUED', col: 2, row: 1, hue: 3, shape: 'log' },
        { id: 'consumer', label: 'service B', sub: 'consumer group', col: 1, row: 1, hue: 1 },
        { id: 'retry', label: 'retry', sub: 'new outbox row', col: 0, row: 1, hue: 8 },
      ]}
      edges={[
        { from: 'service', to: 'db', hue: 6, flow: true },
        { from: 'db', to: 'wal', hue: 6, flow: true },
        { from: 'wal', to: 'debezium', hue: 4, flow: true },
        { from: 'debezium', to: 'smt', hue: 4, flow: true },
        { from: 'smt', to: 'topic', hue: 3, flow: true },
        { from: 'topic', to: 'consumer', hue: 1, flow: true },
        { from: 'consumer', to: 'retry', hue: 8, dashed: true },
        { from: 'retry', to: 'db', hue: 8, dashed: true },
      ]}
      steps={PIPELINE_STEPS}
    />
  )
}

/* The outbox row from the example INSERT below, column by column. */
const OUTBOX_KAFKA: ByteField[] = [
  { label: 'id → key', bytes: '981'.length, hue: 3, content: '981' },
  { label: 'event_type → topic', bytes: 'INVOICE-ISSUED'.length, hue: 3, content: 'INVOICE-ISSUED' },
  { label: 'event_id (uuid)', bytes: 16, hue: 6, content: 'c51e…' },
]
const OUTBOX_REST: ByteField[] = [
  { label: 'source', bytes: 'payments'.length, hue: 6, content: 'payments' },
  { label: 'type', bytes: 'TRANSACTION'.length, hue: 6, content: 'TRANSACTION' },
  { label: 'tenant_id', bytes: 'acme'.length, hue: 6, content: 'acme' },
  { label: 'payload (json)', bytes: '{"transactionId":981}'.length, hue: 6, content: '{"transactionId":981}' },
  { label: 'created_at', bytes: 8, hue: 6, content: 'now()' },
]

/** The transform chain from the connector config below, built from the simulation's SMTs. */
const OUTBOX_CHAIN = new TransformChain([
  new ConditionalTransform(new ExtractTopicFromField('Reroute', ['after', 'event_type']), new TopicNameMatches('(.*)outbox')),
  new ExtractNewRecordState('unwrap'),
  new ConditionalTransform(new ExtractKeyField('ExtractField', 'id'), new TopicNameMatches('(.*)heartbeat(.*)'), true),
])

type Input = 'INVOICE-ISSUED' | 'ORDER-CREATED' | 'none' | 'heartbeat'

function sourceRecord(input: Input): ConnectRecord {
  if (input === 'heartbeat') {
    return { topic: '__debezium-heartbeat.app', key: { serverName: 'app' }, value: { ts_ms: 1727000000000 } }
  }
  const row = {
    event_id: 'c51e…',
    id: '981',
    source: 'payments',
    type: 'TRANSACTION',
    event_type: input === 'none' ? null : input,
    tenant_id: 'acme',
    payload: '{"transactionId":981}',
    created_at: '2024-09-22T10:15:00Z',
  }
  return {
    topic: 'app.public.outbox',
    key: { id: '981' },
    value: { before: null, after: row, source: { table: 'outbox', lsn: 24023128 }, op: 'c', ts_ms: 1727000000000 },
  }
}

function OutboxTransforms() {
  const [input, setInput] = useState<Input>('INVOICE-ISSUED')
  const stages = useMemo(() => OUTBOX_CHAIN.trace(sourceRecord(input)), [input])

  return (
    <Demo
      title="Follow one outbox row through the transforms"
      hint="Change the event_type of the inserted row, or send a heartbeat record instead, and see what each transform does."
      controls={
        <Segmented
          label="input"
          value={input}
          onChange={setInput}
          options={[
            { value: 'INVOICE-ISSUED', label: 'event_type=INVOICE-ISSUED' },
            { value: 'ORDER-CREATED', label: 'ORDER-CREATED' },
            { value: 'none', label: 'event_type null' },
            { value: 'heartbeat', label: 'heartbeat' },
          ]}
        />
      }
    >
      <TransformTrace stages={stages} />
    </Demo>
  )
}

export default function Outbox() {
  return (
    <>
      <p>
        This lesson ties everything together into a design used in real payment and order systems: the{' '}
        <strong>transactional outbox</strong>, implemented with Debezium. It answers a deceptively hard question:{' '}
        <em>how does a service reliably update its database and publish an event?</em>
      </p>

      <DualWrite />

      <h2>The fix: write the event to the database too</h2>
      <p>
        Add an <code>outbox</code> table. In the same transaction as the business change, insert a row describing the
        event. The database guarantees both rows commit together. Getting that row into Kafka is then a separate,
        retryable job — and Debezium does it by tailing the WAL, so no polling and no extra code in the service.
      </p>

      <OutboxPipeline />

      <h2>The outbox table</h2>
      <CodeBlock
        title="schema.sql"
        code={`
CREATE TABLE outbox (
    event_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- one row per event, retries included
    id          text NOT NULL,             -- business ID; becomes the Kafka key
    source      text NOT NULL,             -- which service/domain produced it
    type        text NOT NULL,             -- entity type, e.g. TRANSACTION
    event_type  text NOT NULL,             -- destination topic, e.g. INVOICE-ISSUED
    tenant_id   text,                      -- for multi-tenant consumers
    payload     jsonb,                     -- optional event body
    remarks     text,                      -- error details when re-queued for retry
    created_at  timestamptz NOT NULL DEFAULT now()
);
`}
      />
      <CodeBlock
        title="inside the service — one transaction"
        code={`
BEGIN;
INSERT INTO transactions (id, amount, status) VALUES (981, 120.50, 'SETTLED');
INSERT INTO outbox (id, source, type, event_type, tenant_id, payload)
VALUES ('981', 'payments', 'TRANSACTION', 'INVOICE-ISSUED', 'acme', '{"transactionId":981}');
COMMIT;
`}
      />

      <ByteLayout
        title="The outbox row of that transaction, column by column (value sizes)"
        rows={[
          { label: 'the two columns that steer Kafka, and the row id', fields: OUTBOX_KAFKA },
          { label: 'the other columns', fields: OUTBOX_REST },
        ]}
        caption="Both rows use one scale: text columns are shown by length, uuid 16 B, timestamptz 8 B. id becomes the record key and event_type picks the topic; after unwrapping, the whole row (every column) is the event value."
      />

      <h2>The connector</h2>
      <CodeBlock
        title="outbox-connector.json"
        code={`
{
  "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
  "tasks.max": "1",
  "database.hostname": "db",
  "database.dbname": "appdb",
  "database.user": "cdc_user",
  "database.password": "\${file:/run/secrets/connect.properties:db.password}",

  "plugin.name": "pgoutput",
  "slot.name": "outbox_slot",
  "publication.name": "outbox_publication",
  "publication.autocreate.mode": "filtered",
  "topic.prefix": "app",
  "table.include.list": "public.outbox",
  "message.key.columns": "public.outbox:id",

  "snapshot.mode": "no_data",
  "skipped.operations": "u,d,t",
  "tombstones.on.delete": "false",
  "heartbeat.interval.ms": "1000",

  "key.converter": "org.apache.kafka.connect.storage.StringConverter",
  "value.converter": "org.apache.kafka.connect.json.JsonConverter",
  "value.converter.schemas.enable": "false",

  "transforms": "Reroute,unwrap,ExtractField",

  "transforms.Reroute.type": "io.confluent.connect.transforms.ExtractTopic$Value",
  "transforms.Reroute.field": "$[\\"after\\"][\\"event_type\\"]",
  "transforms.Reroute.field.format": "JSON_PATH",
  "transforms.Reroute.skip.missing.or.null": "true",
  "transforms.Reroute.predicate": "IsOutbox",

  "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",

  "transforms.ExtractField.type": "org.apache.kafka.connect.transforms.ExtractField$Key",
  "transforms.ExtractField.field": "id",
  "transforms.ExtractField.predicate": "IsHeartbeat",
  "transforms.ExtractField.negate": "true",

  "predicates": "IsOutbox,IsHeartbeat",
  "predicates.IsOutbox.type": "org.apache.kafka.connect.transforms.predicates.TopicNameMatches",
  "predicates.IsOutbox.pattern": "(.*)outbox",
  "predicates.IsHeartbeat.type": "org.apache.kafka.connect.transforms.predicates.TopicNameMatches",
  "predicates.IsHeartbeat.pattern": "(.*)heartbeat(.*)",

  "errors.tolerance": "all",
  "errors.log.enable": "true",
  "errors.log.include.messages": "true"
}
`}
      />
      <OutboxTransforms />
      <p>Why each choice:</p>
      <ul>
        <li>
          <code>snapshot.mode=no_data</code> (called <code>never</code> in older Debezium versions) — old outbox rows
          were already delivered; only new inserts matter.
        </li>
        <li>
          <code>message.key.columns</code> — Debezium normally keys records by the primary key
          (<code>event_id</code>). This makes the key the business <code>id</code> instead, so ExtractField can turn{' '}
          <code>{"{"}"id": "981"{"}"}</code> into <code>"981"</code>.
        </li>
        <li>
          <code>skipped.operations=u,d,t</code> — the outbox is append-only from Kafka’s point of view. A cleanup job
          can <code>DELETE</code> old rows freely.
        </li>
        <li>
          <strong>Reroute before unwrap</strong> — the JSON path <code>$.after.event_type</code> points into the
          Debezium envelope, so routing must run while the envelope still exists.
        </li>
        <li>
          <strong>Predicates</strong> — routing applies only to outbox records, and key extraction skips heartbeat
          records, whose key has no <code>id</code> field.
        </li>
        <li>
          <code>heartbeat.interval.ms</code> — the outbox may be quiet while the rest of the database is busy;
          heartbeats keep the slot advancing so WAL does not pile up.
        </li>
        <li>
          <code>StringConverter</code> key + schemaless JSON value — consumers read a plain string ID and a plain JSON
          object.
        </li>
      </ul>
      <Callout tone="note" title="Alternative: Debezium’s outbox router">
        <code>ExtractTopic$Value</code> comes from a separately installed Confluent transforms plugin. Debezium ships
        its own <code>io.debezium.transforms.outbox.EventRouter</code> SMT built for this pattern: it routes by a
        column, uses another column as key and can expand a JSON payload. Both approaches work; the chain above is
        more explicit and easy to reason about step by step.
      </Callout>

      <h2>The consumer side</h2>
      <p>Consumers complete the guarantees. Each topic is read by its own consumer group:</p>
      <Flow
        title="One event, three possible outcomes — and the consumer always acks"
        cols={4}
        rowHeight={96}
        rows={2}
        nodes={[
          { id: 'topic', label: 'topic', sub: 'event key = id', col: 0, row: 0, hue: 3, shape: 'log' },
          { id: 'consumer', label: 'consumer', sub: 'group, manual ack', col: 1, row: 0, hue: 1 },
          { id: 'db', label: 'own database', sub: 'unique event id', col: 2, row: 0, hue: 6, shape: 'store' },
          { id: 'ack', label: 'ack / commit', sub: '__consumer_offsets', col: 3, row: 0, hue: 5 },
          { id: 'outbox', label: 'new outbox row', sub: 'error in remarks', col: 2, row: 1, hue: 8, shape: 'store' },
        ]}
        edges={[
          { from: 'topic', to: 'consumer', hue: 3, flow: true },
          { from: 'consumer', to: 'db', hue: 6, flow: true },
          { from: 'db', to: 'ack', label: 'ok', hue: 5, flow: true },
          { from: 'consumer', to: 'outbox', label: 'real failure', hue: 8, dashed: true },
          { from: 'outbox', to: 'ack', label: 'then ack', hue: 5, dashed: true },
        ]}
        steps={[
          { title: 'Normal case', body: <p>The consumer applies the event in its own database, then acks. The committed offset moves past it.</p>, active: ['topic', 'consumer', 'db', 'ack', 'topic>consumer', 'consumer>db', 'db>ack'] },
          { title: 'A duplicate', body: <p>A redelivered event violates the unique constraint on its id: it was already applied, so the consumer just acks.</p>, active: ['consumer', 'db', 'ack', 'consumer>db', 'db>ack'] },
          { title: 'A real failure', body: <p>Anything else: write a new outbox row (same id, error in remarks) and ack. The retry travels the pipeline again later; the partition never blocks.</p>, active: ['consumer', 'outbox', 'ack', 'consumer>outbox', 'outbox>ack'] },
        ]}
      />
      <CodeBlock
        title="consumer settings"
        code={`
group.id=billing-group
# a new group processes everything still retained
auto.offset.reset=earliest
# ack manually, after the work is done
enable.auto.commit=false
key.deserializer=org.apache.kafka.common.serialization.StringDeserializer
value.deserializer=org.apache.kafka.common.serialization.ByteArrayDeserializer
`}
      />
      <ul>
        <li>
          <strong>Idempotent:</strong> the business table has a unique constraint on the event’s ID. A redelivered event
          fails the insert; the consumer treats that as “already processed” and acks.
        </li>
        <li>
          <strong>Never blocks:</strong> any other failure inserts a fresh outbox row (new <code>event_id</code>, same{' '}
          <code>id</code> and event type, error in <code>remarks</code>) and acks. The retry travels through the pipeline again later. Track an attempt count so
          a permanently broken event cannot loop forever.
        </li>
        <li>
          <strong>Tenant-aware:</strong> <code>tenant_id</code> travels in the event, so a shared consumer can switch to
          the right tenant’s schema or data source per record.
        </li>
        <li>
          <strong>Fallback parsing:</strong> if the payload cannot be parsed, the consumer can still load the entity
          by the key (the ID) from its source of truth.
        </li>
      </ul>

      <h2>Operating checklist</h2>
      <ul>
        <li>
          Postgres: <code>wal_level=logical</code>; a user with replication rights; monitor slot lag in{' '}
          <code>pg_replication_slots</code>.
        </li>
        <li>Connect: register the connector with an idempotent PUT on every deploy, then restart only failed tasks.</li>
        <li>
          After a database restart the task can end up <code>FAILED</code>; automated restarts (or the deploy script
          above) bring it back.
        </li>
        <li>Alert on consumer lag per group and on rows piling up in the outbox with remarks.</li>
        <li>Purge delivered outbox rows on a schedule; with inserts-only capture this emits nothing.</li>
      </ul>

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Dual write', definition: 'Updating two systems without a shared transaction; one can fail and leave them inconsistent.' },
          { term: 'Transactional outbox', definition: 'Writing events to a table in the same transaction as the business data.' },
          { term: 'Message relay', definition: 'The process that moves outbox rows to the broker — here, Debezium.' },
          { term: 'Event routing', definition: 'Choosing the destination topic from data in the record.' },
          { term: 'Idempotency key', definition: 'A unique ID that lets consumers detect and ignore duplicates.' },
          { term: 'Re-queue', definition: 'Recording a failed event as a new outbox row so it is delivered again later.' },
        ]}
      />
    </>
  )
}
