import type { ConfigEntry } from '@/shared/ui'

/** connectors/orders-cdc.json — the "config" object of the Debezium Postgres connector. */
export const CONNECTOR_CONFIG: ConfigEntry[] = [
  {
    section: 'Which plugin',
    key: 'connector.class',
    value: 'io.debezium.connector.postgresql.PostgresConnector',
    explain: <p>The connector implementation. It must appear in <code>GET /connector-plugins</code>, i.e. the Debezium JARs are in <code>plugin.path</code>.</p>,
  },
  {
    key: 'tasks.max',
    value: '1',
    defaultValue: '1',
    explain: <p>Maximum parallel tasks. A Postgres change stream is one ordered sequence, so this connector always runs exactly one task whatever you set.</p>,
  },
  {
    section: 'How to reach the database',
    key: 'database.hostname',
    value: 'postgres',
    explain: <p>Host of the database, as seen <em>from the Connect worker</em> — the Compose service name here, not <code>localhost</code>.</p>,
  },
  { key: 'database.port', value: '5432', defaultValue: '5432', explain: <p>Postgres port inside the network (the container port, not a remapped host port).</p> },
  {
    key: 'database.user',
    value: 'debezium',
    explain: <p>A role with <code>LOGIN REPLICATION</code> and <code>SELECT</code> on the captured tables (see the Postgres lesson). Avoid using a superuser.</p>,
  },
  {
    key: 'database.password',
    value: 'dbz',
    explain: (
      <p>
        Stored in Connect’s config topic and visible through the REST API. In real setups use a config provider:{' '}
        <code>{'${file:/secrets/db.properties:password}'}</code> with <code>config.providers=file</code> on the worker.
      </p>
    ),
  },
  { key: 'database.dbname', value: 'shop', explain: <p>The database to capture. One connector reads one database.</p> },
  {
    section: 'Naming',
    key: 'topic.prefix',
    value: 'shop',
    explain: (
      <p>
        Prefix of every topic this connector writes: changes of <code>public.orders</code> go to{' '}
        <code>shop.public.orders</code>. It also identifies the connector’s stored offsets, so never change it after the
        first run.
      </p>
    ),
  },
  {
    section: 'Reading the WAL',
    key: 'plugin.name',
    value: 'pgoutput',
    defaultValue: 'decoderbufs',
    options: 'pgoutput | decoderbufs',
    explain: (
      <p>
        The logical decoding plugin. <code>pgoutput</code> is built into Postgres 10+. The default, <code>decoderbufs</code>
        , must be installed on the database server separately — so on a stock Postgres you <strong>must</strong> set this
        to <code>pgoutput</code>.
      </p>
    ),
  },
  {
    key: 'slot.name',
    value: 'shop_slot',
    defaultValue: 'debezium',
    explain: (
      <p>
        The replication slot Debezium creates and reads. Postgres keeps WAL until the slot confirms it. Every connector
        needs its own slot name. Deleting the connector does <strong>not</strong> drop the slot — drop it yourself.
      </p>
    ),
  },
  {
    key: 'publication.name',
    value: 'shop_publication',
    defaultValue: 'dbz_publication',
    explain: <p>The publication listing which tables are streamed. Here it was created by <code>init.sql</code>.</p>,
  },
  {
    key: 'publication.autocreate.mode',
    value: 'disabled',
    defaultValue: 'all_tables',
    options: 'all_tables | filtered | no_tables | disabled',
    explain: (
      <p>
        Whether Debezium creates the publication. <code>all_tables</code> (default) needs superuser rights and publishes
        every table; <code>filtered</code> creates one with just <code>table.include.list</code> (the user must own those
        tables); <code>disabled</code> expects it to exist. Creating it yourself, as a superuser, keeps the connector user
        unprivileged.
      </p>
    ),
  },
  {
    section: 'What to capture',
    key: 'table.include.list',
    value: 'public.orders',
    explain: <p>Comma-separated regular expressions of <code>schema.table</code> names. Also available: <code>schema.include.list</code>, <code>table.exclude.list</code>, <code>column.exclude.list</code> (e.g. drop a <code>password</code> column).</p>,
  },
  {
    key: 'snapshot.mode',
    value: 'initial',
    defaultValue: 'initial',
    options: 'initial | always | initial_only | no_data | when_needed | …',
    explain: (
      <p>
        On first start, read the rows that already exist (events with <code>op: "r"</code>), then stream changes.{' '}
        <code>no_data</code> skips existing rows and streams only new changes.
      </p>
    ),
  },
  {
    section: 'Data formats',
    key: 'decimal.handling.mode',
    value: 'string',
    defaultValue: 'precise',
    options: 'precise | double | string',
    explain: (
      <p>
        How <code>numeric</code>/<code>decimal</code> columns are written. <code>precise</code> encodes them as binary
        bytes — unreadable as plain JSON. <code>string</code> gives <code>"120.50"</code> without losing precision;{' '}
        <code>double</code> gives <code>120.5</code> but can round. For money, use <code>string</code>.
      </p>
    ),
  },
  {
    section: 'Health',
    key: 'heartbeat.interval.ms',
    value: '10000',
    defaultValue: '0 (off)',
    explain: (
      <p>
        Every 10 s, emit a record to <code>__debezium-heartbeat.shop</code>. If the captured table is quiet while the
        rest of the database is busy, heartbeats let Debezium confirm newer WAL positions so Postgres can free disk.
      </p>
    ),
  },
  {
    section: 'Topics Connect creates for you',
    key: 'topic.creation.default.partitions',
    value: '1',
    explain: (
      <p>
        With <code>auto.create.topics.enable=false</code> on the broker, Connect creates the connector’s topics itself
        (the worker allows it by default, <code>topic.creation.enable=true</code>). One partition keeps all changes of the
        table in commit order.
      </p>
    ),
  },
  {
    key: 'topic.creation.default.replication.factor',
    value: '1',
    explain: <p>Replication factor for those topics. 3 in production. Both <code>topic.creation.default.*</code> settings are required for creation to happen.</p>,
  },
]
