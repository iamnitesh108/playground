import { useMemo, useState, type ReactNode } from 'react'
import { Box, Callout, CodeBlock, Column, Connector, Demo, Row, Segmented, TermList, Walkthrough } from '@/shared/ui'
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
import own from './Outbox.module.css'

const DUAL_WRITE_STEPS = [
  { title: 'Save the order', body: <p>The service commits the order to its database.</p> },
  { title: 'Publish the event', body: <p>Then it calls <code>producer.send("order-created", …)</code>.</p> },
  { title: 'The broker is unreachable', body: <p>A network blip, a deploy, a timeout. The send fails after the database already committed.</p> },
  { title: 'Inconsistent forever', body: <p>The order exists, but nobody downstream will ever hear about it. Reversing the order of the two writes just flips the problem: an event for an order that was never saved.</p> },
]

function DualWrite() {
  return (
    <Walkthrough title="The dual-write problem" steps={DUAL_WRITE_STEPS}>
      {(step) => (
        <Row align="center">
          <Box title="Order service" active={step <= 1} />
          <Column gap={14}>
            <Row align="center">
              <div style={{ width: 120, display: 'flex' }}>
                <Connector active={step === 0} label="1. COMMIT" />
              </div>
              <Box title="Database" caption={step >= 0 ? 'order saved ✓' : ''} active={step === 0} />
            </Row>
            <Row align="center">
              <div style={{ width: 120, display: 'flex' }}>
                <Connector active={step === 1} dashed={step >= 2} label={step >= 2 ? '2. send ✕' : '2. send'} />
              </div>
              <Box title="Kafka" caption={step >= 2 ? 'never received' : ''} dimmed={step >= 2} active={step === 1} />
            </Row>
          </Column>
        </Row>
      )}
    </Walkthrough>
  )
}

type Node = 'service' | 'db' | 'wal' | 'debezium' | 'smt' | 'topic' | 'consumer' | 'retry'

const PIPELINE_STEPS: { title: string; body: ReactNode; active: Node[]; edge?: string }[] = [
  {
    title: 'One local transaction',
    body: <p>The service writes the business row <em>and</em> an outbox row describing the event, in the same database transaction. Both commit or neither does. No Kafka call in the request path.</p>,
    active: ['service', 'db'],
    edge: 'service-db',
  },
  {
    title: 'The insert reaches the WAL',
    body: <p>The committed outbox insert is in the write-ahead log. The replication slot retains it until Debezium confirms it.</p>,
    active: ['db', 'wal'],
    edge: 'db-wal',
  },
  {
    title: 'Debezium captures inserts only',
    body: <p>The connector watches only the outbox table and skips updates, deletes and truncates (<code>skipped.operations=u,d,t</code>). Old outbox rows can be purged without emitting anything.</p>,
    active: ['wal', 'debezium'],
    edge: 'wal-debezium',
  },
  {
    title: 'Transforms route and reshape',
    body: <p><strong>Reroute</strong> sends the record to the topic named in the row’s <code>event_type</code> column, <strong>unwrap</strong> strips the Debezium envelope, <strong>ExtractField</strong> makes the outbox <code>id</code> the key.</p>,
    active: ['debezium', 'smt'],
    edge: 'debezium-smt',
  },
  {
    title: 'An ordinary event in a topic',
    body: <p>Downstream sees a clean record on e.g. <code>ledger-entries</code>: key = outbox ID, value = the outbox row as JSON.</p>,
    active: ['smt', 'topic'],
    edge: 'smt-topic',
  },
  {
    title: 'A consumer group processes it',
    body: <p>Consumers with manual acknowledgement, <code>auto.offset.reset=earliest</code>. They apply the event in their own database and only then ack.</p>,
    active: ['topic', 'consumer'],
    edge: 'topic-consumer',
  },
  {
    title: 'Duplicates and failures',
    body: <p>A duplicate hits a unique constraint → it was already done → ack. A real failure → write a new outbox row (with the error as remarks) → ack. The retry rides the same pipeline later, and the partition never blocks.</p>,
    active: ['consumer', 'retry', 'db'],
    edge: 'retry',
  },
]

function OutboxPipeline() {
  return (
    <Walkthrough title="The outbox pipeline end to end" steps={PIPELINE_STEPS} intervalMs={2600}>
      {(step) => {
        const { active, edge } = PIPELINE_STEPS[step]
        const on = (node: Node) => active.includes(node)
        return (
          <div className={own.pipeline}>
            <Row align="center">
              <Box title="Service A" caption="handles a request" active={on('service')} />
              <div className={own.edge}>
                <Connector active={edge === 'service-db'} label="1 tx" />
              </div>
              <Box title="Postgres" caption="orders + outbox" active={on('db')} />
              <div className={own.edge}>
                <Connector active={edge === 'db-wal'} />
              </div>
              <Box title="WAL + slot" caption="pgoutput" active={on('wal')} />
              <div className={own.edge}>
                <Connector active={edge === 'wal-debezium'} />
              </div>
              <Box title="Debezium" caption="Kafka Connect" active={on('debezium')} className={own.anchor} />
            </Row>
            <div className={own.down}>
              <Connector direction="down" active={edge === 'debezium-smt'} />
            </div>
            <Row align="center">
              <Box title="Retry" caption="new outbox row" active={on('retry')} dimmed={!on('retry')} />
              <div className={own.edge}>
                <Connector direction="left" active={edge === 'retry'} label="on failure" dashed={edge !== 'retry'} />
              </div>
              <Box title="Service B" caption="consumer group" active={on('consumer')} />
              <div className={own.edge}>
                <Connector direction="left" active={edge === 'topic-consumer'} />
              </div>
              <Box title="Topic" caption="ledger-entries" active={on('topic')} />
              <div className={own.edge}>
                <Connector direction="left" active={edge === 'smt-topic'} />
              </div>
              <Box title="SMTs" caption="reroute · unwrap · key" active={on('smt')} className={own.anchor} />
            </Row>
          </div>
        )
      }}
    </Walkthrough>
  )
}

/** The transform chain from the connector config below, built from the simulation's SMTs. */
const OUTBOX_CHAIN = new TransformChain([
  new ConditionalTransform(new ExtractTopicFromField('Reroute', ['after', 'event_type']), new TopicNameMatches('(.*)outbox')),
  new ExtractNewRecordState('unwrap'),
  new ConditionalTransform(new ExtractKeyField('ExtractField', 'id'), new TopicNameMatches('(.*)heartbeat(.*)'), true),
])

type Input = 'LEDGER-ENTRIES' | 'ORDER-CREATED' | 'none' | 'heartbeat'

function sourceRecord(input: Input): ConnectRecord {
  if (input === 'heartbeat') {
    return { topic: '__debezium-heartbeat.app', key: { serverName: 'app' }, value: { ts_ms: 1727000000000 } }
  }
  const row = {
    id: '9f2c',
    source: 'payments',
    type: 'TRANSACTION',
    event_type: input === 'none' ? null : input,
    tenant_id: 'acme',
    payload: '{"transactionId":981}',
    created_at: '2024-09-22T10:15:00Z',
  }
  return {
    topic: 'app.public.outbox',
    key: { id: '9f2c' },
    value: { before: null, after: row, source: { table: 'outbox', lsn: 24023128 }, op: 'c', ts_ms: 1727000000000 },
  }
}

function OutboxTransforms() {
  const [input, setInput] = useState<Input>('LEDGER-ENTRIES')
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
            { value: 'LEDGER-ENTRIES', label: 'event_type=LEDGER-ENTRIES' },
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
    id          text PRIMARY KEY,          -- becomes the Kafka key
    source      text NOT NULL,             -- which service/domain produced it
    type        text NOT NULL,             -- entity type, e.g. TRANSACTION
    event_type  text NOT NULL,             -- destination topic, e.g. LEDGER-ENTRIES
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
VALUES ('981', 'payments', 'TRANSACTION', 'LEDGER-ENTRIES', 'acme', '{"transactionId":981}');
COMMIT;
`}
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

  "snapshot.mode": "never",
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
          <code>snapshot.mode=never</code> — old outbox rows were already delivered; only new inserts matter.
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
      <CodeBlock
        title="consumer settings"
        code={`
group.id=ledger-entries-group
auto.offset.reset=earliest            # a new group processes everything still retained
enable.auto.commit=false              # ack manually, after the work is done
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
          <strong>Never blocks:</strong> any other failure inserts a fresh outbox row (same ID and event type, error in{' '}
          <code>remarks</code>) and acks. The retry travels through the pipeline again later. Track an attempt count so
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
