import type { ConfigEntry } from '@/shared/ui'

/** config/connect-distributed.properties — one Kafka Connect worker. */
export const CONNECT_PROPERTIES: ConfigEntry[] = [
  {
    section: 'Which Kafka, which cluster',
    key: 'bootstrap.servers',
    value: 'kafka:19092',
    explain: (
      <p>
        The broker(s) the worker connects to. It is a client like any other, so in Compose it uses the INTERNAL
        listener (<code>kafka:19092</code>); on a laptop install it would be <code>localhost:9092</code>.
      </p>
    ),
  },
  {
    key: 'group.id',
    value: 'connect-cluster',
    explain: (
      <p>
        Workers with the same <code>group.id</code> form one Connect cluster and share connectors and tasks between
        them, using the same group protocol consumer groups use. It must not clash with any consumer group name.
      </p>
    ),
  },
  {
    section: 'Converters: how records become bytes',
    key: 'key.converter',
    value: 'org.apache.kafka.connect.json.JsonConverter',
    options: 'JsonConverter | StringConverter | ByteArrayConverter | Avro/Protobuf converters (Schema Registry)',
    explain: (
      <p>
        Inside Connect, records are structured data. The converter writes the <em>key</em> to Kafka as bytes — here JSON.
        This is the worker default; each connector may override it.
      </p>
    ),
  },
  {
    key: 'value.converter',
    value: 'org.apache.kafka.connect.json.JsonConverter',
    explain: <p>Same for the record <em>value</em>. JSON is readable with any tool; Avro/Protobuf are smaller and enforce schemas but need a Schema Registry.</p>,
  },
  {
    key: 'key.converter.schemas.enable',
    value: 'false',
    defaultValue: 'true',
    explain: (
      <p>
        With <code>true</code>, every JSON message carries its schema: <code>{'{"schema": {...}, "payload": {...}}'}</code>
        . That makes messages several times larger and every consumer must unwrap <code>payload</code>. <code>false</code>{' '}
        writes plain JSON.
      </p>
    ),
  },
  {
    key: 'value.converter.schemas.enable',
    value: 'false',
    defaultValue: 'true',
    explain: <p>Same for values. The shipped example file sets both to true; plain JSON is easier to start with.</p>,
  },
  {
    section: 'Where the worker keeps its own state (in Kafka)',
    key: 'config.storage.topic',
    value: 'connect-configs',
    explain: (
      <p>
        Compacted topic holding every connector’s configuration. Must have exactly one partition — the worker creates it
        that way. Losing it means losing your connector definitions.
      </p>
    ),
  },
  {
    key: 'offset.storage.topic',
    value: 'connect-offsets',
    explain: (
      <p>
        Compacted topic where source connectors save how far they have read. For Debezium that is the database log
        position (LSN). After a restart the connector resumes from here. Default 25 partitions
        (<code>offset.storage.partitions</code>).
      </p>
    ),
  },
  {
    key: 'status.storage.topic',
    value: 'connect-status',
    explain: <p>Compacted topic holding the RUNNING / PAUSED / FAILED state of connectors and tasks. Default 5 partitions.</p>,
  },
  {
    key: 'config.storage.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: <p>Replication of the configs topic. Must be ≤ the number of brokers; use 3 in production.</p>,
  },
  {
    key: 'offset.storage.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: <p>Replication of the offsets topic.</p>,
  },
  {
    key: 'status.storage.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: <p>Replication of the status topic.</p>,
  },
  {
    key: 'offset.flush.interval.ms',
    value: '10000',
    defaultValue: '60000',
    explain: (
      <p>
        How often source offsets are saved to the offsets topic. Lower = less re-reading after a crash. For Debezium on
        Postgres it is also how often the replication slot is told what has been processed, so WAL can be freed.
      </p>
    ),
  },
  {
    section: 'REST API',
    key: 'listeners',
    value: 'http://0.0.0.0:8083',
    defaultValue: 'http://:8083',
    explain: <p>Where the REST API listens. You manage connectors entirely through it (<code>curl …/connectors</code>). Secure it before exposing it: it can read your database credentials.</p>,
  },
  {
    key: 'rest.advertised.host.name',
    value: 'connect',
    explain: <p>The hostname other workers use to forward REST requests to this one. With several workers, it must be reachable from all of them.</p>,
  },
  {
    section: 'Plugins',
    key: 'plugin.path',
    value: '/opt/connect-plugins',
    explain: (
      <>
        <p>
          Directories scanned for connectors, converters and transforms. Each plugin goes in its own subdirectory (e.g.{' '}
          <code>/opt/connect-plugins/debezium-connector-postgres/</code> with all its JARs), and gets its own class loader
          so plugins cannot clash.
        </p>
        <p>
          Check what was found with <code>curl localhost:8083/connector-plugins</code>.
        </p>
      </>
    ),
  },
]
