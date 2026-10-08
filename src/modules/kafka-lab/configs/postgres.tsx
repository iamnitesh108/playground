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
    value: '10GB',
    defaultValue: '-1 (unlimited)',
    explain: (
      <p>
        Safety net (Postgres 13+): the most WAL a replication slot may hold back. If the connector stops and the backlog
        passes this size, the slot is invalidated instead of filling the disk and taking the database down — the
        connector must then be re-snapshotted. Size it from free disk space and how long a Connect outage may last.
      </p>
    ),
  },
  {
    key: 'listen_addresses',
    value: "'*'",
    defaultValue: "'localhost'",
    explain: (
      <p>
        Interfaces Postgres accepts TCP connections on. The Ubuntu package listens on <code>localhost</code> only; a Connect
        worker on another server needs the network interface (<code>'*'</code>, or a specific address). Access is still
        controlled by <code>pg_hba.conf</code> and the firewall.
      </p>
    ),
  },
]

/** Lines appended to pg_hba.conf (Ubuntu: /etc/postgresql/<version>/main/pg_hba.conf). */
export const PG_HBA: ConfigEntry[] = [
  {
    key: 'from the Connect hosts',
    text: 'host    shop    debezium    10.0.0.0/8    scram-sha-256',
    explain: (
      <>
        <p>
          Columns: connection type (<code>host</code> = TCP), database, user, client address range, authentication
          method. This lets <code>debezium</code> reach only the <code>shop</code> database, only from the private network
          where the Connect workers run, with a SCRAM password. Narrow the range to your workers’ subnet.
        </p>
        <p>
          A logical replication connection names a database, so it matches rules like this one. Guides that add{' '}
          <code>host replication …</code> lines are describing <em>physical</em> replication.
        </p>
      </>
    ),
  },
  {
    key: 'from this host',
    text: 'host    shop    debezium    127.0.0.1/32  scram-sha-256',
    explain: <p>Only needed when a worker runs on the database server itself, as in a single-machine setup.</p>,
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
