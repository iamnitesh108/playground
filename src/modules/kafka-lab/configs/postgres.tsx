import type { ConfigEntry } from '@/shared/ui'

/** postgresql.conf settings Debezium needs (passed with -c in Compose). */
export const POSTGRES_SETTINGS: ConfigEntry[] = [
  {
    key: 'wal_level',
    value: 'logical',
    defaultValue: 'replica',
    options: 'minimal | replica | logical',
    explain: (
      <p>
        How much the write-ahead log records. Only <code>logical</code> contains enough to rebuild row changes, which
        Debezium needs. Changing it requires a server restart. Check with <code>SHOW wal_level;</code>.
      </p>
    ),
  },
  {
    key: 'max_wal_senders',
    value: '10',
    defaultValue: '10',
    explain: <p>Maximum concurrent replication connections (WAL sender processes). Each running connector uses one, as does each physical standby.</p>,
  },
  {
    key: 'max_replication_slots',
    value: '10',
    defaultValue: '10',
    explain: <p>Maximum replication slots. Each connector owns one slot (its <code>slot.name</code>).</p>,
  },
  {
    key: 'max_slot_wal_keep_size',
    value: '-1',
    defaultValue: '-1 (unlimited)',
    explain: (
      <p>
        Optional safety net (Postgres 13+): the most WAL a slot may hold back, e.g. <code>10GB</code>. Beyond it the slot
        is invalidated instead of filling the disk — the connector must then be re-snapshotted. Worth setting in production.
      </p>
    ),
  },
]

/** postgres/init.sql, block by block. Runs once, on the first start of an empty database. */
export const INIT_SQL: ConfigEntry[] = [
  {
    key: 'the table',
    text: `CREATE TABLE public.orders (
    id          bigserial PRIMARY KEY,
    customer    text           NOT NULL,
    amount      numeric(12, 2) NOT NULL,
    status      text           NOT NULL DEFAULT 'NEW',
    created_at  timestamptz    NOT NULL DEFAULT now()
);`,
    explain: (
      <p>
        An ordinary table. The primary key matters: Debezium uses it as the Kafka record key (<code>{'{"id": 1}'}</code>
        ), so every change to one order lands in the same partition, in order. Tables without a primary key get a{' '}
        <code>null</code> key.
      </p>
    ),
  },
  {
    key: 'replica identity',
    text: 'ALTER TABLE public.orders REPLICA IDENTITY FULL;',
    explain: (
      <p>
        Controls what the WAL records about the <em>old</em> row. With the default, an UPDATE event has no{' '}
        <code>before</code> and a DELETE only carries the primary key. <code>FULL</code> logs every old column, at the
        cost of more WAL. Set it when consumers need the previous values.
      </p>
    ),
  },
  {
    key: 'the connector user',
    text: `CREATE ROLE debezium WITH LOGIN REPLICATION PASSWORD 'dbz';
GRANT SELECT ON public.orders TO debezium;`,
    explain: (
      <p>
        <code>REPLICATION</code> allows opening a replication connection and creating slots; <code>SELECT</code> is needed
        for the initial snapshot. Nothing else — the connector cannot modify data.
      </p>
    ),
  },
  {
    key: 'the publication',
    text: 'CREATE PUBLICATION shop_publication FOR TABLE public.orders;',
    explain: (
      <p>
        Lists the tables whose changes may be streamed. Created here by the superuser so that the connector user needs no
        extra rights (<code>publication.autocreate.mode=disabled</code>). Add tables later with{' '}
        <code>ALTER PUBLICATION shop_publication ADD TABLE …;</code>.
      </p>
    ),
  },
]
