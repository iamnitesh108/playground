import type { ReactNode } from 'react'
import { BarChart, Flow } from '@/shared/figures'
import { Box, Callout, CodeBlock, ConfigExplorer, LessonGoals, Predict, Recap, Table, Tabs, TermList, Walkthrough } from '@/shared/ui'
import { SetupAcl } from '../components/SetupAcl'
import { SetupContexts } from '../components/SetupContexts'
import { SetupHbaPlayground } from '../components/SetupHbaPlayground'
import { COMPOSE, INIT_SQL } from '../configs/docker'
import { PG_HBA } from '../configs/pgHba'
import { POSTGRESQL_CONF } from '../configs/postgresql'
import { OPS } from '../data/ops'
import { START } from '../data/start'
import { parseHbaRules } from '../simulation/setupHba'
import own from './lesson.module.css'

const { ubuntu, setup } = OPS
const [dropDenied, createDenied, otherDatabase, wrongPassword] = setup.denied
const HBA_RULES = parseHbaRules(setup.hbaRules)
const S = START.setup

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
          {GATES[i].output && <CodeBlock title="recorded" language="text" code={GATES[i].output.trim()} />}
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
          'write pg_hba.conf rules, predict which line decides, and read the errors they cause',
          'give an application a role that can change rows but not the schema',
        ]}
        before={
          <>
            A Linux shell and basic SQL. How the server works inside comes later, in{' '}
            <a href="#/postgres/architecture">How PostgreSQL runs</a>.
          </>
        }
      />

      <TermList
        items={[
          { term: 'cluster', definition: 'One running server and its data directory, holding several databases. Not a group of machines.' },
          { term: 'data directory', definition: 'Where a cluster keeps its files (tables, WAL, status). Owned by the postgres OS user.' },
          { term: 'role', definition: 'A user or group inside PostgreSQL. Roles with LOGIN can connect; roles own objects and hold privileges.' },
          { term: 'superuser', definition: 'A role that skips every privilege check (postgres by default). Not for applications.' },
          { term: 'peer', definition: 'Authentication for local socket connections: the OS user name must equal the role name. No password.' },
          { term: 'scram-sha-256', definition: 'Password authentication where the password never crosses the network. The default since version 14.' },
        ]}
      />

      <h2>Two common ways to run it</h2>
      <p>On a server you install the operating-system packages; on a laptop or in a deployment you often run the official container image.</p>
      <Tabs
        items={[
          {
            label: 'Ubuntu packages',
            content: (
              <>
                <p>
                  Ubuntu’s own repository lags behind; the PostgreSQL project publishes current versions at apt.postgresql.org. Installing creates
                  and starts a <strong>cluster</strong> named <code>18/main</code>.
                </p>
                <Flow
                  title="What the Ubuntu package sets up"
                  cols={4}
                  rows={2}
                  rowHeight={84}
                  nodes={[
                    { id: 'unit', label: 'postgresql@18-main', sub: 'systemd unit', col: 0, row: 0, hue: 7 },
                    { id: 'srv', label: 'postgres server', sub: 'port 5432', col: 1, row: 0, hue: 3 },
                    { id: 'conf', label: '/etc/postgresql/18/main', sub: 'postgresql.conf, pg_hba.conf', col: 2, row: 0, span: 2, hue: 7 },
                    { id: 'psql', label: 'psql', sub: 'via /var/run/postgresql', col: 0, row: 1, hue: 1, shape: 'actor' },
                    { id: 'data', label: '/var/lib/postgresql/18/main', sub: 'data directory', col: 1, row: 1, span: 2, hue: 4, shape: 'store' },
                    { id: 'log', label: 'server log', sub: '/var/log/postgresql/', col: 3, row: 1, hue: 4, shape: 'log' },
                  ]}
                  edges={[
                    { from: 'unit', to: 'srv', label: 'starts', hue: 7 },
                    { from: 'srv', to: 'conf', label: 'reads', hue: 7, dashed: true },
                    { from: 'psql', to: 'srv', hue: 1, flow: true },
                    { from: 'srv', to: 'data', both: true, hue: 4 },
                    { from: 'data', to: 'log', hue: 4, dashed: true },
                  ]}
                  caption="Debian and Ubuntu keep configuration out of the data directory, under /etc. Most other systems (and Docker) keep it inside the data directory."
                />
                <CodeBlock title="install" language="bash" code={INSTALL} />
                <CodeBlock title="recorded on a fresh Ubuntu 24.04" language="text" code={ubuntu.clusters} />
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
                  <CodeBlock title="recorded" language="text" code={ubuntu.etc} />
                  <CodeBlock title="recorded" language="text" code={ubuntu.data} />
                </div>
                <Callout tone="note" title="Not every program is on the PATH">
                  psql, pg_dump and pg_basebackup are on the PATH through a wrapper that picks the right version. Others, such as{' '}
                  <code>pg_verifybackup</code> and <code>pg_combinebackup</code>, are only in <code>/usr/lib/postgresql/18/bin/</code> — calling them
                  by name gives “command not found” (recorded in <a href="#/postgres/backups">Backups and point-in-time recovery</a>).
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
                  <code>.sql</code> or <code>.sh</code> files in <code>/docker-entrypoint-initdb.d/</code> once.
                </p>
                <Flow
                  title="The Compose file below, as a picture"
                  cols={4}
                  rows={2}
                  rowHeight={84}
                  nodes={[
                    { id: 'secret', label: 'secret file', sub: 'superuser password', col: 0, row: 0, hue: 8 },
                    { id: 'init', label: 'initdb/*.sql', sub: 'run once, empty volume', col: 0, row: 1, hue: 7 },
                    { id: 'ctr', label: 'postgres:18.6', sub: 'container', col: 1, row: 0, rowSpan: 2, hue: 3 },
                    { id: 'vol', label: 'volume pgdata', sub: '/var/lib/postgresql', col: 2, row: 1, hue: 4, shape: 'store' },
                    { id: 'port', label: '127.0.0.1:5432', sub: 'this host only', col: 2, row: 0, hue: 1 },
                    { id: 'app', label: 'clients', col: 3, row: 0, hue: 1, shape: 'actor' },
                  ]}
                  edges={[
                    { from: 'secret', to: 'ctr', hue: 8, dashed: true },
                    { from: 'init', to: 'ctr', hue: 7, dashed: true },
                    { from: 'ctr', to: 'vol', both: true, hue: 4 },
                    { from: 'port', to: 'ctr', hue: 1, flow: true },
                    { from: 'app', to: 'port', hue: 1, flow: true },
                  ]}
                  caption="Data lives in the named volume, so the container can be replaced; the init scripts only run when that volume is empty."
                />
                <CodeBlock title="compose.yaml (tested with podman-compose)" language="yaml" code={COMPOSE} />
                <CodeBlock title="initdb/01-roles.sql" language="sql" code={INIT_SQL} />
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
                <CodeBlock title="recorded: postgres:18 with a volume at /var/lib/postgresql/data" language="text" code={OPS.docker.slice(OPS.docker.indexOf('Error'), OPS.docker.indexOf('### new-mount')).trim()} />
                <CodeBlock title="recorded: volume at /var/lib/postgresql" language="text" code={OPS.docker.slice(OPS.docker.indexOf('$ ls')).trim()} />
                <p>
                  The image’s own <code>pg_hba.conf</code> ends with <code>host all all all scram-sha-256</code>: any address may try a password.
                  PostgreSQL 18 also enables data checksums at initdb by default (recorded: <code>data_checksums = {S.checksums}</code>), so no extra
                  flag is needed.
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
      <SetupContexts settings={S.settings} />
      <BarChart
        title={`All ${S.contexts.reduce((n, c) => n + c.n, 0)} settings of PostgreSQL ${START.version.split(' ')[0]}, by context (recorded from pg_settings)`}
        bars={S.contexts.map((c) => ({
          label: c.context,
          value: c.n,
          hue: ({ postmaster: 8, sighup: 4, user: 6, superuser: 5, 'superuser-backend': 7, backend: 7, internal: 3 } as const)[c.context] ?? 3,
          note: c.context === 'internal' ? 'fixed when the server was built or initialised, e.g. block_size' : c.context === 'backend' ? 'set at connection start only' : undefined,
        }))}
      />
      <p>Settings of context <code>user</code> can even be changed for one session with SET; the others refuse:</p>
      <CodeBlock title="recorded: SET in a session" language="text" code={S.sessionSet} />

      <Predict
        question={
          <p>
            You run <code>ALTER SYSTEM SET shared_buffers = '512MB'</code> and then <code>SELECT pg_reload_conf()</code>. Is the new value in use?
          </p>
        }
        options={['Yes, reload applies it', 'No, it needs a restart', 'No, ALTER SYSTEM only works for session settings']}
        answer={1}
        explanation="ALTER SYSTEM writes postgresql.auto.conf, which overrides postgresql.conf. A reload re-reads the files, but shared_buffers can only change when the server starts. Step through it:"
      />
      <Flow
        title="ALTER SYSTEM, reload, restart — recorded on the Ubuntu server"
        cols={4}
        rows={1}
        rowHeight={92}
        nodes={[
          { id: 'alter', label: 'ALTER SYSTEM SET', sub: 'shared_buffers = 512MB', col: 0, row: 0, hue: 1 },
          { id: 'auto', label: 'postgresql.auto.conf', sub: 'wins over postgresql.conf', col: 1, row: 0, hue: 7, shape: 'log' },
          { id: 'reload', label: 'pg_reload_conf()', sub: 'pending_restart = t', col: 2, row: 0, hue: 4 },
          { id: 'restart', label: 'restart', sub: 'setting 65536 × 8kB', col: 3, row: 0, hue: 6 },
        ]}
        edges={[
          { from: 'alter', to: 'auto', label: 'writes', hue: 7 },
          { from: 'auto', to: 'reload', label: 'read', hue: 4 },
          { from: 'reload', to: 'restart', hue: 6 },
        ]}
        steps={[
          { title: 'ALTER SYSTEM', body: <p>Nothing changes in the running server yet. The value is written to a file.</p>, active: ['alter', 'auto', 'alter>auto'] },
          { title: 'The file', body: <CodeBlock title="recorded: postgresql.auto.conf" language="ini" code={setup.alter.autoConf} />, active: ['auto'] },
          { title: 'Reload', body: <><p>The server reads the file, applies reloadable settings and marks the others as pending:</p><CodeBlock title="recorded" language="text" code={setup.alter.pending} /></>, active: ['auto', 'reload', 'auto>reload'] },
          { title: 'Restart', body: <><p>Only now does shared_buffers change (65536 pages of 8 kB = 512 MB):</p><CodeBlock title="recorded: after systemctl restart postgresql@18-main" language="text" code={setup.alter.restarted} /></>, active: ['reload', 'restart', 'reload>restart'] },
        ]}
      />

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
      <CodeBlock title="recorded: SELECT … FROM pg_hba_file_rules" language="text" code={setup.hbaRules} />
      <Predict
        question={
          <p>
            The application at 10.0.1.20 connects as <code>app_rw</code> to database <code>postgres</code>. Line 133 allows{' '}
            <code>shop app_rw 10.0.1.0/24</code>. What happens?
          </p>
        }
        options={['It connects: the role and address match', 'It is refused: no line matches the database', 'It falls through to a default allow rule']}
        answer={1}
        explanation="All four columns must match, and there is no default rule: when no line matches, the connection is refused. Try other connections:"
      />
      <SetupHbaPlayground rules={HBA_RULES} />
      <Callout tone="tip" title="Order the file from specific to general">
        The first matching line wins, so a broad <code>host all all 0.0.0.0/0 scram-sha-256</code> above a narrower <code>reject</code> line makes
        the reject line dead. Put rejects and special cases first.
      </Callout>

      <h2>Least privilege</h2>
      <p>
        The application should not own its tables. Then a bug or an injected statement cannot drop or alter them. Migrations run as the owner
        role; the application gets row privileges only:
      </p>
      <Flow
        title="Three roles, three jobs"
        cols={3}
        rows={2}
        rowHeight={86}
        nodes={[
          { id: 'pg', label: 'postgres', sub: 'superuser: setup only', col: 0, row: 0, hue: 8 },
          { id: 'owner', label: 'app_owner', sub: 'NOLOGIN, owns schema app', col: 1, row: 0, hue: 7 },
          { id: 'mig', label: 'migrations', sub: 'SET ROLE app_owner', col: 2, row: 0, hue: 1, shape: 'actor' },
          { id: 'tables', label: 'app.orders, …', sub: 'tables and sequences', col: 1, row: 1, hue: 3, shape: 'store' },
          { id: 'rw', label: 'app_rw', sub: 'LOGIN: the application', col: 2, row: 1, hue: 1, shape: 'actor' },
        ]}
        edges={[
          { from: 'pg', to: 'owner', label: 'creates', hue: 8, dashed: true },
          { from: 'mig', to: 'owner', label: 'acts as', hue: 1 },
          { from: 'owner', to: 'tables', label: 'owns', hue: 7 },
          { from: 'rw', to: 'tables', label: 'SELECT … DELETE', hue: 6, flow: true },
        ]}
        caption="Only the owner (or a superuser) can ALTER or DROP a table. The application role gets the four row privileges through default privileges."
      />
      <CodeBlock title="as the postgres superuser" language="sql" code={ROLES} />
      <CodeBlock title="recorded: \dp app.*" language="text" code={setup.privileges} />
      <SetupAcl dp={setup.privileges} />
      <p>
        The owner also has <strong>D</strong> (TRUNCATE), <strong>x</strong> (REFERENCES), <strong>t</strong> (TRIGGER) and <strong>m</strong>{' '}
        (MAINTAIN, new in version 17); <strong>U</strong> on a sequence is USAGE, needed for <code>bigserial</code> ids.{' '}
        <code>ALTER DEFAULT PRIVILEGES</code> applies these grants to tables the owner creates later — a plain GRANT only covers tables that already
        exist.
      </p>

      <h2>Every check, replayed</h2>
      <p>A client at 10.0.1.20 connects to the server at 10.0.1.10, step by step. Each failure was recorded:</p>
      <Gates />

      <h2>Checklist</h2>
      <p>Before a server holds data anyone cares about:</p>
      <Table
        head={['Check', 'Why']}
        rows={[
          ['Version pinned (package or image tag 18.x)', 'Minor updates are safe and should be deliberate; major versions need pg_upgrade.'],
          ['listen_addresses only as wide as needed; firewall in front', 'pg_hba.conf decides who may try; the network decides who can reach the port at all.'],
          ['No trust lines for TCP; scram-sha-256 everywhere', 'trust lets anyone who reaches the port log in as any role.'],
          ['pg_hba_file_rules has no errors after each edit', 'If the file has an error, a reload keeps the old rules and only logs “pg_hba.conf was not reloaded” — your change is not in effect.'],
          ['Application role owns nothing and is not superuser', 'A bug or injection cannot DROP or ALTER tables.'],
          ['ALTER DEFAULT PRIVILEGES for future tables', 'Otherwise every new table is invisible to the application until someone remembers to GRANT.'],
          ['pending_restart is false everywhere', 'A setting you think is active may be waiting for a restart.'],
          ['Docker: volume at /var/lib/postgresql, port on 127.0.0.1', 'The 18 image layout; and the image accepts passwords from every address.'],
          ['Backups and monitoring set up', <span key="b">See <a href="#/postgres/backups">Backups</a> and <a href="#/postgres/monitoring">Monitoring and tuning</a>.</span>],
        ]}
      />

      <Recap
        points={[
          'Ubuntu: config in /etc/postgresql/18/main, data in /var/lib/postgresql/18/main, one systemd unit per cluster.',
          'Docker postgres:18: mount the volume at /var/lib/postgresql; publish the port only where it is needed.',
          'Settings apply per session, on reload, or only on restart — check pending_restart in pg_settings.',
          'pg_hba.conf: the first line matching type, database, user and address decides; no match means refused.',
          'Applications log in as a role that has row privileges, not ownership.',
        ]}
      />
    </>
  )
}
