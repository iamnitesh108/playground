import { useMemo, useState } from 'react'
import { Box, Button, Callout, CodeBlock, Connector, Demo, Row, Segmented, Table, Tabs, TermList, Walkthrough } from '@/shared/ui'
import { TransformTrace } from '../components'
import { ExtractKeyField, RegexRouter, TransformChain, type Transform } from '../simulation'
import styles from './lesson.module.css'

const FLOW = [
  { title: 'Source system', caption: 'database, API, files' },
  { title: 'Source task', caption: 'reads changes' },
  { title: 'Transforms', caption: 'SMTs, optional' },
  { title: 'Converter', caption: 'object → bytes' },
  { title: 'Kafka topic', caption: '' },
  { title: 'Sink task', caption: 'bytes → object → write' },
  { title: 'Target system', caption: 'warehouse, search, S3' },
]

const FLOW_STEPS = [
  { title: 'Something changes at the source', body: <p>A row is inserted, a file appears, an API returns new data.</p> },
  { title: 'A source task picks it up', body: <p>The connector’s task polls the source and produces a <em>source record</em>: topic, key, value, plus a <strong>source offset</strong> (“how far I have read”, e.g. a log position).</p> },
  { title: 'Transforms reshape it', body: <p>Single Message Transforms can rename the topic, pick fields, drop records — one record at a time, no code.</p> },
  { title: 'A converter serializes it', body: <p>The configured <code>key.converter</code>/<code>value.converter</code> turns the record into bytes, e.g. JSON.</p> },
  { title: 'It lands in Kafka', body: <p>The worker’s internal producer writes it. Periodically the worker saves the source offset to the offsets topic, so a restart resumes in the right place.</p> },
  { title: 'A sink task consumes it', body: <p>On the other side, a sink connector is just a managed consumer group (named <code>connect-&lt;connector name&gt;</code>). Its tasks deserialize records with their converter…</p> },
  { title: '…and writes it to the target', body: <p>…and write batches to the destination. Committed consumer offsets track sink progress.</p> },
]

function ConnectFlow() {
  return (
    <Walkthrough title="Data flowing through Kafka Connect" steps={FLOW_STEPS}>
      {(step) => (
        <Row>
          {FLOW.map((node, i) => (
            <Row key={node.title}>
              {i > 0 && (
                <div style={{ width: 28, display: 'flex' }}>
                  <Connector active={i === step} />
                </div>
              )}
              <Box title={node.title} caption={node.caption || undefined} active={i === step} dimmed={i > step} />
            </Row>
          ))}
        </Row>
      )}
    </Walkthrough>
  )
}

function WorkerCluster() {
  const [workers, setWorkers] = useState(2)
  const tasks = ['orders-source/0', 'orders-source/1', 'search-sink/0', 'search-sink/1', 'search-sink/2']
  const byWorker = Array.from({ length: workers }, (_, w) => tasks.filter((_, t) => t % workers === w))

  return (
    <Demo
      title="Distributed mode: workers share tasks"
      hint="Two connectors with five tasks in total. Add or remove workers and the cluster rebalances tasks between them."
      controls={
        <>
          <Button size="sm" disabled={workers >= 4} onClick={() => setWorkers(workers + 1)}>
            + Worker
          </Button>
          <Button size="sm" disabled={workers <= 1} onClick={() => setWorkers(workers - 1)}>
            − Worker
          </Button>
        </>
      }
    >
      <Row gap={10} align="start" wrap>
        {byWorker.map((assigned, w) => (
          <Box key={`${workers}-${w}`} title={`Worker ${w + 1}`} caption="JVM process, REST :8083">
            {assigned.map((task) => (
              <div key={task} className={styles.mono}>
                {task}
              </div>
            ))}
          </Box>
        ))}
      </Row>
      <p className={styles.demoNote}>
        Workers with the same <code>group.id</code> form one Connect cluster — the same group protocol consumers use.
        A dead worker’s tasks move to the survivors (after <code>scheduled.rebalance.max.delay.ms</code>, default 5 min,
        in case it comes back quickly).
      </p>
    </Demo>
  )
}

function ConverterDemo() {
  const [schemas, setSchemas] = useState(false)
  const value = { id: 7, status: 'PAID' }
  const output = schemas
    ? {
        schema: {
          type: 'struct',
          fields: [
            { field: 'id', type: 'int64' },
            { field: 'status', type: 'string' },
          ],
        },
        payload: value,
      }
    : value

  return (
    <Demo
      title="JsonConverter with and without embedded schemas"
      controls={
        <Segmented
          label="value.converter.schemas.enable"
          value={schemas ? 'true' : 'false'}
          onChange={(v) => setSchemas(v === 'true')}
          options={[
            { value: 'true', label: 'true' },
            { value: 'false', label: 'false' },
          ]}
        />
      }
    >
      <pre className={styles.json}>{JSON.stringify(output, null, 2)}</pre>
      <p className={styles.demoNote}>
        {schemas
          ? 'Every single message carries its schema. Self-describing, but large, and consumers must unwrap “payload”.'
          : 'Plain JSON. Small and easy for any consumer to parse — the usual choice when no Schema Registry is used.'}
      </p>
    </Demo>
  )
}

const AVAILABLE: Transform[] = [new RegexRouter('route', 'app\\.public\\.(.*)', '$1-events'), new ExtractKeyField('key', 'id')]

function SmtDemo() {
  const [enabled, setEnabled] = useState<string[]>(['route', 'key'])
  const stages = useMemo(
    () =>
      new TransformChain(AVAILABLE.filter((t) => enabled.includes(t.alias))).trace({
        topic: 'app.public.customers',
        key: { id: 7 },
        value: { id: 7, name: 'Ann', tier: 'gold' },
      }),
    [enabled],
  )
  const toggle = (alias: string) => setEnabled((list) => (list.includes(alias) ? list.filter((a) => a !== alias) : [...list, alias]))

  return (
    <Demo
      title="Chain transforms"
      hint="Toggle transforms to see the record change at each step. They run in the order listed in “transforms”."
      controls={AVAILABLE.map((t) => (
        <Button key={t.alias} size="sm" variant={enabled.includes(t.alias) ? 'primary' : 'default'} onClick={() => toggle(t.alias)}>
          {t.alias}: {t.type}
        </Button>
      ))}
    >
      <TransformTrace stages={stages} />
    </Demo>
  )
}

export default function KafkaConnect() {
  return (
    <>
      <p>
        Most data you want in Kafka already lives somewhere: a database, a SaaS API, log files. And much of what is in
        Kafka needs to end up somewhere else: a warehouse, a search index, object storage. You <em>could</em> write a
        producer or consumer for each — or use <strong>Kafka Connect</strong>, a framework that does it from
        configuration alone.
      </p>

      <h2>Connectors and tasks</h2>
      <ul>
        <li>
          A <strong>source connector</strong> brings data <em>into</em> Kafka (e.g. Debezium for Postgres).
        </li>
        <li>
          A <strong>sink connector</strong> sends data <em>out of</em> Kafka (e.g. JDBC, Elasticsearch, S3).
        </li>
        <li>
          A connector is split into <strong>tasks</strong> that do the actual copying in parallel, up to{' '}
          <code>tasks.max</code>. Some sources can only use one task (a database’s change log is a single stream).
        </li>
        <li>
          Connectors are <strong>plugins</strong>: JAR files placed in a directory listed in <code>plugin.path</code>.
        </li>
      </ul>

      <ConnectFlow />

      <h2>Workers and modes</h2>
      <p>
        Connectors run inside <strong>workers</strong> — JVM processes. In <strong>standalone</strong> mode a single
        worker keeps its state in a local file (good for experiments). In <strong>distributed</strong> mode several
        workers form a cluster, store all state in Kafka, and are managed through a REST API.
      </p>
      <WorkerCluster />

      <p>A distributed worker keeps everything it knows in three compacted internal topics:</p>
      <Table
        head={['Setting', 'Holds']}
        rows={[
          ['config.storage.topic', 'Connector and task configurations'],
          ['offset.storage.topic', 'Source offsets: how far each source connector has read'],
          ['status.storage.topic', 'RUNNING / PAUSED / FAILED state of connectors and tasks'],
        ]}
      />
      <CodeBlock
        title="connect-distributed.properties"
        code={`
bootstrap.servers=localhost:9092
# workers sharing this group.id form one Connect cluster
group.id=connect-cluster

key.converter=org.apache.kafka.connect.storage.StringConverter
value.converter=org.apache.kafka.connect.json.JsonConverter
value.converter.schemas.enable=false

config.storage.topic=_connect-configs
offset.storage.topic=_connect-offsets
status.storage.topic=_connect-status
# how often source offsets are saved (default 60000)
offset.flush.interval.ms=10000

# REST API
listeners=HTTP://0.0.0.0:8083
plugin.path=/opt/connect/plugins

# Keep secrets out of connector JSON: \${file:/path:key} is resolved at runtime
config.providers=file
config.providers.file.class=org.apache.kafka.common.config.provider.FileConfigProvider
`}
      />

      <h2>Converters</h2>
      <p>
        Inside Connect, records are structured data. A <strong>converter</strong> decides how they become bytes in
        Kafka. Keys and values each have their own: <code>StringConverter</code>, <code>JsonConverter</code>,{' '}
        <code>ByteArrayConverter</code>, or Avro/Protobuf converters backed by a Schema Registry.
      </p>
      <ConverterDemo />

      <h2>Single Message Transforms (SMTs)</h2>
      <p>
        SMTs make small changes to each record as it passes through: rename a topic, extract a field, mask a value,
        drop a record. You list them in <code>transforms</code>, configure each by alias, and can make them conditional
        with <strong>predicates</strong> (e.g. only for topics matching a pattern).
      </p>
      <SmtDemo />
      <Callout tone="tip">
        Keep SMTs to simple, per-record reshaping. Joins, aggregations or anything needing state belongs in a stream
        processor (Kafka Streams, Flink) or in the consuming application.
      </Callout>

      <h2>Error handling</h2>
      <CodeBlock
        title="connector config — tolerate bad records (sink connector)"
        code={`
"errors.tolerance": "all",
"errors.log.enable": "true",
"errors.log.include.messages": "true",
"errors.deadletterqueue.topic.name": "dlq-orders",
"errors.deadletterqueue.topic.replication.factor": "3",
"errors.deadletterqueue.context.headers.enable": "true"
`}
      />
      <p>
        <code>errors.tolerance=all</code> skips records that fail in a converter or transform instead of stopping the
        task. The dead letter queue receives those records, and with context headers enabled each one carries the
        failure reason in its headers.
      </p>
      <Callout tone="warn">
        The dead letter queue settings apply to <strong>sink</strong> connectors. On a source connector,{' '}
        <code>errors.tolerance=all</code> skips failing records (logged if enabled) but does not route them anywhere.
        And <code>errors.tolerance</code> only covers converters and transforms — not failures inside the connector
        itself, which put the task into <code>FAILED</code>.
      </Callout>

      <h2>Managing connectors over REST</h2>
      <Tabs
        items={[
          {
            label: 'Create / update',
            content: (
              <CodeBlock
                title="PUT is idempotent: creates the connector or updates its config"
                code={`curl -X PUT -H 'Content-Type: application/json' \\
  --data @orders-connector.json \\
  http://localhost:8083/connectors/orders-connector/config`}
              />
            ),
          },
          {
            label: 'Status',
            content: (
              <CodeBlock
                code={`curl -s http://localhost:8083/connectors?expand=status
curl -s http://localhost:8083/connectors/orders-connector/status`}
              />
            ),
          },
          {
            label: 'Restart',
            content: (
              <CodeBlock
                title="restart only what failed, tasks included"
                code={`curl -X POST \\
  'http://localhost:8083/connectors/orders-connector/restart?includeTasks=true&onlyFailed=true'`}
              />
            ),
          },
          {
            label: 'Pause / delete',
            content: (
              <CodeBlock
                code={`curl -X PUT    http://localhost:8083/connectors/orders-connector/pause
curl -X PUT    http://localhost:8083/connectors/orders-connector/resume
curl -X DELETE http://localhost:8083/connectors/orders-connector
curl -s        http://localhost:8083/connector-plugins      # what is installed`}
              />
            ),
          },
        ]}
      />
      <p>
        A neat deployment trick: a startup script that waits for the worker’s REST API, PUTs the config, then restarts
        failed tasks. Run it on every deploy — it is safe to repeat.
      </p>

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Kafka Connect', definition: 'Framework for streaming data between Kafka and other systems via configuration.' },
          { term: 'Connector', definition: 'A configured plugin instance that defines what to copy and where.' },
          { term: 'Source / sink', definition: 'Connectors that write into Kafka vs. read out of Kafka.' },
          { term: 'Task', definition: 'Unit of parallel work a connector is split into.' },
          { term: 'Worker', definition: 'JVM process that runs connectors and tasks.' },
          { term: 'Distributed mode', definition: 'Workers form a cluster, store state in Kafka, managed via REST.' },
          { term: 'Source offset', definition: 'Connector-specific position in the source (e.g. a log position).' },
          { term: 'Converter', definition: 'Translates between Connect’s data model and bytes in Kafka.' },
          { term: 'SMT', definition: 'Single Message Transform: a lightweight per-record change.' },
          { term: 'Predicate', definition: 'Condition that decides whether an SMT applies to a record.' },
          { term: 'plugin.path', definition: 'Directories where workers look for connector and transform JARs.' },
          { term: 'Config provider', definition: 'Resolves placeholders like ${file:…} so secrets stay out of configs.' },
        ]}
      />
    </>
  )
}
