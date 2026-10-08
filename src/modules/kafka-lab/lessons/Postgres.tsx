import { Callout, CodeBlock, ConfigExplorer, Tabs } from '@/shared/ui'
import { INIT_SQL, PG_HBA, POSTGRES_SETTINGS } from '../configs/postgres'

function OnUbuntu() {
  return (
    <>
      <CodeBlock
        title="install (Ubuntu 24.04 ships PostgreSQL 16)"
        code={`sudo apt install -y postgresql
ls /etc/postgresql/          # 16  — the major version, used in the paths below`}
      />
      <p>
        Ubuntu’s <code>postgresql.conf</code> already contains <code>include_dir = 'conf.d'</code>, so put your settings
        in a separate file: package upgrades and config management never fight over it.
      </p>
      <ConfigExplorer file="/etc/postgresql/16/main/conf.d/90-cdc.conf" format="properties" entries={POSTGRES_SETTINGS} />
      <ConfigExplorer file="/etc/postgresql/16/main/pg_hba.conf (appended)" format="raw" entries={PG_HBA} />
      <CodeBlock
        title="apply — wal_level needs a restart, not a reload"
        code={`sudo systemctl restart postgresql
sudo -u postgres psql -c "SHOW wal_level;"        # logical`}
      />
      <p>
        Newer major versions come from the PostgreSQL project’s own apt repository (apt.postgresql.org); the settings are
        identical, only the version number in the paths changes. Open port 5432 only to the Connect workers and your
        applications.
      </p>
    </>
  )
}

function InDocker() {
  return (
    <>
      <p>
        In the Compose stack the same settings are passed as <code>-c</code> flags (see the <code>postgres</code> service
        in the Docker lesson), and <code>init.sql</code> is mounted into <code>/docker-entrypoint-initdb.d/</code>, where it
        runs automatically the first time the data volume is empty. The official image’s <code>pg_hba.conf</code> already
        allows password logins from any address (<code>host all all all scram-sha-256</code>).
      </p>
      <CodeBlock code={`docker compose exec postgres psql -U postgres -d shop -c "SHOW wal_level;"`} />
    </>
  )
}

export default function Postgres() {
  return (
    <>
      <p>
        Debezium reads PostgreSQL’s <strong>write-ahead log</strong> through a <strong>replication slot</strong>. Three
        things are needed on the database: logical WAL, a user allowed to replicate, and a publication listing the tables.
      </p>

      <h2>Server settings</h2>
      <Tabs items={[{ label: 'Ubuntu', content: <OnUbuntu /> }, { label: 'Docker', content: <InDocker /> }]} />

      <h2>Database objects</h2>
      <p>
        Run as a superuser in the application database (on Ubuntu: <code>sudo -u postgres createdb shop</code>, then{' '}
        <code>sudo -u postgres psql -d shop &lt; init.sql</code> — your shell reads the file, so the <code>postgres</code> user does not need access to it; in Docker the entrypoint does it).
      </p>
      <ConfigExplorer file="init.sql" format="raw" entries={INIT_SQL} />
      <CodeBlock
        title="check as the connector will connect"
        code={`PGPASSWORD=… psql -h <db-host> -U debezium -d shop -c "SELECT count(*) FROM pg_publication_tables;"`}
      />

      <Callout tone="tip" title="Managed databases (RDS, Cloud SQL, Azure)">
        You cannot edit configuration files there. Look for a parameter such as <code>rds.logical_replication = 1</code>{' '}
        or <code>cloudsql.logical_decoding = on</code>, and a built-in role granting replication rights (for example{' '}
        <code>rds_replication</code>).
      </Callout>
      <Callout tone="warn" title="Watch the slot">
        Postgres keeps every WAL file the slot has not confirmed. Monitor it from the first day:
        <CodeBlock
          code={`SELECT slot_name, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS behind
FROM pg_replication_slots;`}
        />
      </Callout>
    </>
  )
}
