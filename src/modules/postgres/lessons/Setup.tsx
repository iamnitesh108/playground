import type { ReactNode } from 'react'
import { Box, Callout, CodeBlock, ConfigExplorer, LessonGoals, Predict, Recap, Table, Tabs, Walkthrough } from '@/shared/ui'
import { COMPOSE, INIT_SQL } from '../configs/docker'
import { PG_HBA } from '../configs/pgHba'
import { POSTGRESQL_CONF } from '../configs/postgresql'
import { OPS } from '../data/ops'
import own from './lesson.module.css'

const { ubuntu, setup } = OPS
const [dropDenied, createDenied, otherDatabase, wrongPassword] = setup.denied

const INSTALL = `sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh     # adds the PostgreSQL apt repository
sudo apt install -y postgresql-18

systemctl status postgresql@18-main      # one systemd unit per cluster
sudo -u postgres psql                     # admin shell, via peer authentication`

const ROLES = `CREATE ROLE app_owner NOLOGIN;                         -- owns the schema; nobody logs in as it
CREATE ROLE app_rw LOGIN PASSWORD 'app-secret';        -- what the application uses
CREATE DATABASE shop OWNER app_owner;
\\c shop
CREATE SCHEMA app AUTHORIZATION app_owner;
GRANT USAGE ON SCHEMA app TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO app_rw;
SET ROLE app_owner;                                     -- migrations run as the owner
CREATE TABLE app.orders (id bigserial PRIMARY KEY, amount numeric(12,2) NOT NULL);`

const GATES: { title: string; gate: string; body: ReactNode; output?: string }[] = [
  {
    title: 'Is the server listening on that address?',
    gate: 'network',
    body: <p><code>listen_addresses</code> defaults to <code>localhost</code>. A client on another machine (10.0.1.20 here) is refused before PostgreSQL even sees it.</p>,
    output: setup.refused,
  },
  {
    title: 'Does a pg_hba.conf line match?',
    gate: 'pg_hba',
    body: <p>After <code>listen_addresses = '*'</code> and a restart, the connection arrives — but no line allows this host, role and database. psql tried with TLS and then without, so the error appears twice.</p>,
    output: setup.hbaReject,
  },
  {
    title: 'Is the password right?',
    gate: 'password',
    body: <p>The added line <code>host shop app_rw 10.0.1.0/24 scram-sha-256</code> matches, so the password is checked. The client only learns that it failed; the server log also says which line matched.</p>,
    output: `${wrongPassword}\n\nserver log:\n${setup.log}`,
  },
  {
    title: 'Only the databases the rule names',
    gate: 'database',
    body: <p>The same role, with the right password, cannot reach the <code>postgres</code> database: the only line for this subnet names <code>shop</code>.</p>,
    output: otherDatabase,
  },
  {
    title: 'Schema privileges',
    gate: 'schema',
    body: <p>Logged in to <code>shop</code>. The role may use objects in schema <code>app</code> (USAGE), but not create new ones (CREATE).</p>,
    output: createDenied,
  },
  {
    title: 'Table privileges and ownership',
    gate: 'table',
    body: <p>Reading and writing rows works. Dropping or altering the table does not: only its owner may do that, and the application is not the owner.</p>,
    output: `${setup.appOk}\n\n${dropDenied}`,
  },
]

function Gates() {
  return (
    <Walkthrough title="Six checks between a client and a row" steps={GATES} intervalMs={4200}>
      {(i) => (
        <div>
          <div className={own.gates}>
            {GATES.map((g, k) => (
              <Box key={g.gate} title={g.gate} caption={k < i ? 'passed' : k === i ? 'checking' : ''} active={k === i} dimmed={k > i} />
            ))}
          </div>
          {GATES[i].output && <CodeBlock title="recorded" code={GATES[i].output.trim()} />}
        </div>
      )}
    </Walkthrough>
  )
}

export default function Setup() {
  return (
    <>
      <LessonGoals
        goals={[
          'install PostgreSQL 18 on Ubuntu or run it in Docker, and find its files',
          'tell settings that need a reload from those that need a restart',
          'write pg_hba.conf rules and read the errors they cause',
          'give an application a role that can change rows but not the schema',
        ]}
        before="Lesson 1 — processes and files"
      />

      <h2>Two common ways to run it</h2>
      <Tabs
        items={[
          {
            label: 'Ubuntu packages',
            content: (
              <>
                <p>
                  Ubuntu’s own repository lags behind; the PostgreSQL project publishes current versions at apt.postgresql.org. Installing creates
                  and starts a <strong>cluster</strong> named <code>18/main</code>. This is the recorded state of a fresh Ubuntu 24.04:
                </p>
                <CodeBlock title="install" code={INSTALL} />
                <CodeBlock title="recorded" code={ubuntu.clusters} />
                <Table
                  head={['What', 'Where (Ubuntu / Debian)']}
                  rows={[
                    ['configuration', <code key="c">/etc/postgresql/18/main/</code>],
                    ['data directory', <code key="d">/var/lib/postgresql/18/main/</code>],
                    ['server log', <code key="l">/var/log/postgresql/postgresql-18-main.log</code>],
                    ['programs', <code key="p">/usr/lib/postgresql/18/bin/</code>],
                  ]}
                />
                <div className={own.grid2}>
                  <CodeBlock title="recorded" code={ubuntu.etc} />
                  <CodeBlock title="recorded" code={ubuntu.data} />
                </div>
                <Callout tone="note" title="Not every program is on the PATH">
                  psql, pg_dump and pg_basebackup are on the PATH through a wrapper that picks the right version. Others, such as{' '}
                  <code>pg_verifybackup</code> and <code>pg_combinebackup</code>, are only in <code>/usr/lib/postgresql/18/bin/</code> — calling them
                  by name gives “command not found” (recorded in lesson 11).
                </Callout>
              </>
            ),
          },
          {
            label: 'Docker',
            content: (
              <>
                <p>
                  The official <code>postgres</code> image initialises a cluster on first start from environment variables, and runs any{' '}
                  <code>.sql</code> or <code>.sh</code> files in <code>/docker-entrypoint-initdb.d/</code> once. This Compose file was tested as
                  shown:
                </p>
                <CodeBlock title="compose.yaml" code={COMPOSE} />
                <CodeBlock title="initdb/01-roles.sql" code={INIT_SQL} />
                <Table
                  head={['Line', 'Why']}
                  rows={[
                    ['image: postgres:18.6', 'Pin the minor version, so a redeploy cannot change it silently. Major upgrades need pg_upgrade or dump/restore, never just a new tag.'],
                    ['POSTGRES_PASSWORD_FILE', 'The superuser password comes from a secret file, not from the Compose file or the environment.'],
                    ['command: postgres -c …', 'Settings without a custom postgresql.conf.'],
                    ['127.0.0.1:5432:5432', 'Publish the port on localhost only. The image allows password logins from every address (below), so 0.0.0.0 would expose it.'],
                    ['pgdata:/var/lib/postgresql', 'The volume. In version 18 images, data lives in /var/lib/postgresql/18/docker (below).'],
                    ['shm_size', 'Parallel queries use shared memory; Docker’s 64 MB default can be too small.'],
                    ['healthcheck', 'pg_isready lets dependent services wait until the server accepts connections.'],
                  ]}
                />
                <Callout tone="warn" title="Volume path changed in the 18 image">
                  Older guides mount <code>/var/lib/postgresql/data</code>. With <code>postgres:18</code> that container refuses to start:
                </Callout>
                <CodeBlock title="recorded: postgres:18 with a volume at /var/lib/postgresql/data" code={OPS.docker.slice(OPS.docker.indexOf('Error'), OPS.docker.indexOf('### new-mount')).trim()} />
                <CodeBlock title="recorded: volume at /var/lib/postgresql" code={OPS.docker.slice(OPS.docker.indexOf('$ ls')).trim()} />
                <p>
                  The image’s own <code>pg_hba.conf</code> ends with <code>host all all all scram-sha-256</code>: any address may try a password.
                  PostgreSQL 18 also enables data checksums at initdb by default, so no extra flag is needed.
                </p>
              </>
            ),
          },
        ]}
      />

      <h2>postgresql.conf</h2>
      <p>
        One <code>key = value</code> per line. Every setting has a <em>context</em> that says when a change takes effect: per session, on reload, or
        only after a restart. A starting point for a dedicated 16 GB server — click a line:
      </p>
      <ConfigExplorer file="/etc/postgresql/18/main/postgresql.conf" format="raw" entries={POSTGRESQL_CONF} />

      <Predict
        question={
          <p>
            You run <code>ALTER SYSTEM SET shared_buffers = '512MB'</code> and then <code>SELECT pg_reload_conf()</code>. Is the new value in use?
          </p>
        }
        options={['Yes, reload applies it', 'No, it needs a restart', 'No, ALTER SYSTEM only works for session settings']}
        answer={1}
        explanation="ALTER SYSTEM writes postgresql.auto.conf, which overrides postgresql.conf. A reload re-reads the files, but shared_buffers can only change when the server starts. Recorded:"
      />
      <div className={own.grid2}>
        <CodeBlock title="after ALTER SYSTEM + reload" code={setup.alter.pending} />
        <CodeBlock title="postgresql.auto.conf" code={setup.alter.autoConf} />
      </div>
      <CodeBlock title="after systemctl restart postgresql@18-main" code={setup.alter.restarted} />

      <h2>pg_hba.conf: who may connect</h2>
      <p>
        HBA stands for host-based authentication. Each line names a connection type, database, role, client address and authentication method.
        The default Ubuntu file, plus one rule for an application subnet:
      </p>
      <ConfigExplorer file="/etc/postgresql/18/main/pg_hba.conf" format="raw" entries={PG_HBA} />
      <p>
        After editing, reload. The view <code>pg_hba_file_rules</code> shows how the server parsed the file — check its <code>error</code> column
        before relying on a change:
      </p>
      <CodeBlock title="recorded: SELECT … FROM pg_hba_file_rules" code={setup.hbaRules} />

      <h2>Least privilege</h2>
      <p>
        The application should not own its tables. Then a bug or an injected statement cannot drop or alter them. Migrations run as the owner
        role; the application gets row privileges only:
      </p>
      <CodeBlock title="as the postgres superuser" code={ROLES} />
      <CodeBlock title="recorded: \dp app.*" code={setup.privileges} />
      <p>
        Read <code>app_rw=arwd/app_owner</code> as: app_rw may <strong>a</strong>ppend (INSERT), <strong>r</strong>ead (SELECT),{' '}
        <strong>w</strong>rite (UPDATE) and <strong>d</strong>elete, granted by app_owner. The owner also has <strong>D</strong> (TRUNCATE),{' '}
        <strong>x</strong> (REFERENCES), <strong>t</strong> (TRIGGER) and <strong>m</strong> (MAINTAIN); <strong>U</strong> on a sequence is USAGE,
        needed for <code>bigserial</code> ids. <code>ALTER DEFAULT PRIVILEGES</code> applies these grants to tables the owner creates later.
      </p>

      <h2>Every check, replayed</h2>
      <p>A client at 10.0.1.20 connects to the server at 10.0.1.10, step by step. Each failure was recorded:</p>
      <Gates />

      <Recap
        points={[
          'Ubuntu: config in /etc/postgresql/18/main, data in /var/lib/postgresql/18/main, one systemd unit per cluster.',
          'Docker postgres:18: mount the volume at /var/lib/postgresql; publish the port only where it is needed.',
          'Settings apply per session, on reload, or only on restart — check pending_restart in pg_settings.',
          'pg_hba.conf: first matching line decides. Check pg_hba_file_rules after editing.',
          'Applications log in as a role that has row privileges, not ownership.',
        ]}
      />
    </>
  )
}
