import { Callout, CodeBlock, ConfigExplorer } from '@/shared/ui'
import { INIT_SQL, POSTGRES_SETTINGS } from '../configs/postgres'

export default function Postgres() {
  return (
    <>
      <p>
        Debezium reads Postgres’ <strong>write-ahead log (WAL)</strong> through a <strong>replication slot</strong>. For
        that, the server needs logical WAL, the connector needs a user allowed to replicate, and the tables to capture
        must be listed in a <strong>publication</strong>.
      </p>

      <h2>Server settings</h2>
      <p>
        In Compose they are passed as <code>-c name=value</code> flags (see the postgres service). On a normal install
        they go in <code>postgresql.conf</code>, followed by a restart.
      </p>
      <ConfigExplorer file="postgresql.conf" format="properties" entries={POSTGRES_SETTINGS} />

      <h2>The init script</h2>
      <p>
        Create <code>postgres/init.sql</code>. The official image runs it once, when the database is created for the
        first time.
      </p>
      <ConfigExplorer file="postgres/init.sql" format="raw" entries={INIT_SQL} />

      <h2>Start and check</h2>
      <CodeBlock
        title="start Postgres and verify"
        code={`docker compose up -d postgres
docker compose exec postgres psql -U postgres -d shop -c "SHOW wal_level;"                 # logical
docker compose exec postgres psql -U postgres -d shop -c "SELECT * FROM pg_publication_tables;"
docker compose exec postgres psql -U postgres -d shop -c "\\du debezium"                    # Replication`}
      />

      <Callout tone="note" title="pg_hba.conf and logical replication">
        Many guides add <code>host replication debezium … </code> lines to <code>pg_hba.conf</code>. Those rules apply to{' '}
        <em>physical</em> replication. A logical replication connection, which is what pgoutput uses, names a database and
        is matched by the ordinary rules for that database. The official image’s catch-all{' '}
        <code>host all all all scram-sha-256</code> is enough — that is what this stack runs with. On your own server,
        make sure some rule lets the <code>debezium</code> user reach the <code>shop</code> database from the Connect host.
      </Callout>

      <Callout tone="tip" title="Managed databases (RDS, Cloud SQL, Azure)">
        You cannot edit <code>postgresql.conf</code> there. Look for a parameter such as{' '}
        <code>rds.logical_replication = 1</code> or <code>cloudsql.logical_decoding = on</code>, and a built-in role that
        grants replication rights (e.g. <code>rds_replication</code>).
      </Callout>
    </>
  )
}
