import { lessonsOf } from '@/core/registry'
import { Flow, Proportion, type Hue } from '@/shared/figures'
import { CodeBlock, LessonGoals, Predict, Recap, Table, Tabs } from '@/shared/ui'
import { postgresModule } from '..'
import { GlossarySearch } from '../components/GlossarySearch'
import { OPERATIONS } from '../data/operations'
import { GLOSSARY } from '../glossary'

const LESSON_TITLES = new Map(lessonsOf(postgresModule).map((lesson) => [lesson.slug, lesson.title]))
const GROUP_OF = new Map(postgresModule.groups.flatMap((g) => g.lessons.map((l) => [l.slug, g.title] as const)))
const HUE_OF: Record<string, Hue> = {
  'Getting started': 1,
  'How it works': 3,
  'Transactions and concurrency': 2,
  'Making queries fast': 7,
  'Durability and scale': 4,
  Operations: 6,
}
const PARTS = postgresModule.groups
  .map((g) => ({ title: g.title, hue: HUE_OF[g.title] ?? 5, count: GLOSSARY.filter((e) => GROUP_OF.get(e.lesson) === g.title).length, lessons: g.lessons.length }))
  .filter((p) => p.count > 0)
const part = (title: string) => PARTS.find((p) => p.title === title)
const sub = (title: string) => `${part(title)?.lessons ?? 0} lessons · ${part(title)?.count ?? 0} terms`
const partOf = (lesson: string) => {
  const g = GROUP_OF.get(lesson)
  return g ? { title: g, hue: HUE_OF[g] ?? 5 } : undefined
}

const shot = (cmd: string) => OPERATIONS.cheatSheet.find((c) => c.cmd === cmd)?.out ?? ''
const SIZES_SQL = OPERATIONS.cheatSheet[4]
const DB_SIZES_SQL = OPERATIONS.cheatSheet[5]

const META: [string, string][] = [
  ['\\l', 'list databases'],
  ['\\c shop', 'connect to another database'],
  ['\\conninfo', 'where am I connected, as whom'],
  ['\\dn', 'list schemas'],
  ['\\dt  \\dt+', 'list tables (+ sizes)'],
  ['\\d orders', 'columns, indexes, constraints, triggers of a table'],
  ['\\di  \\dv  \\ds', 'list indexes, views, sequences'],
  ['\\df', 'list functions'],
  ['\\du', 'list roles and their attributes'],
  ['\\dp orders', 'privileges on a table'],
  ['\\dx', 'installed extensions'],
  ['\\x auto', 'expanded output when rows are too wide'],
  ['\\timing on', 'show how long each statement took'],
  ['\\watch 2', 'repeat the last query every 2 s'],
  ['\\e', 'edit the last query in $EDITOR'],
  ['\\i file.sql', 'run a script'],
  ['\\copy t TO \'t.csv\' CSV HEADER', 'COPY through the client (files on your machine)'],
  ['\\set ON_ERROR_STOP on', 'make scripts stop at the first error'],
  ['\\h CREATE INDEX', 'SQL syntax help'],
  ['\\?', 'all psql commands'],
  ['\\q', 'quit'],
]

export default function Glossary() {
  return (
    <>
      <LessonGoals
        goals={[
          'look up any term from the module and jump to the lesson that explains it',
          'see how the parts of the module fit together',
          'find your way around a server with the psql commands and admin queries used most',
        ]}
        before="nothing — come back here whenever a word is unfamiliar"
      />

      <h2>How the module fits together</h2>
      <p>Each part builds on the one before it; the colours are used for the terms below.</p>
      <Flow
        title="The parts of the PostgreSQL module"
        cols={3}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'start', label: 'Getting started', sub: sub('Getting started'), col: 0, row: 0, hue: HUE_OF['Getting started'], shape: 'actor' },
          { id: 'how', label: 'How it works', sub: sub('How it works'), col: 1, row: 0, hue: HUE_OF['How it works'] },
          { id: 'tx', label: 'Transactions', sub: sub('Transactions and concurrency'), col: 2, row: 0, hue: HUE_OF['Transactions and concurrency'] },
          { id: 'fast', label: 'Making queries fast', sub: sub('Making queries fast'), col: 0, row: 1, hue: HUE_OF['Making queries fast'] },
          { id: 'dur', label: 'Durability and scale', sub: sub('Durability and scale'), col: 1, row: 1, hue: HUE_OF['Durability and scale'], shape: 'store' },
          { id: 'ops', label: 'Operations', sub: sub('Operations'), col: 2, row: 1, hue: HUE_OF.Operations },
        ]}
        edges={[
          { from: 'start', to: 'how', hue: 1, flow: true },
          { from: 'how', to: 'tx', label: 'MVCC', hue: 3 },
          { from: 'how', to: 'fast', label: 'pages', hue: 7 },
          { from: 'how', to: 'dur', label: 'WAL', hue: 4 },
          { from: 'dur', to: 'ops', hue: 6, dashed: true },
          { from: 'tx', to: 'ops', label: 'locks', hue: 2, dashed: true },
        ]}
        steps={[
          { title: 'Getting started', body: <p>Install and configure the server, use it from psql and from code, design tables. Everything else assumes these.</p>, active: ['start', 'start>how'] },
          { title: 'How it works', body: <p>Processes and memory, 8 kB pages, row versions (MVCC) and vacuum: the mechanisms every later lesson points back to.</p>, active: ['how', 'start', 'start>how'] },
          { title: 'Transactions and concurrency', body: <p>Snapshots decide what each transaction sees; locks decide who waits; constraints keep the data valid under concurrency.</p>, active: ['how', 'tx', 'how>tx'] },
          { title: 'Making queries fast', body: <p>The planner reads statistics and picks scans and joins over pages; indexes give it shortcuts.</p>, active: ['how', 'fast', 'how>fast'] },
          { title: 'Durability and scale', body: <p>The WAL makes commits durable and feeds replicas, backups and point-in-time recovery; partitioning keeps big tables manageable.</p>, active: ['how', 'dur', 'how>dur'] },
          { title: 'Operations', body: <p>Running it: pooling connections, and monitoring locks, queries, vacuum and replication.</p>, active: ['ops', 'dur', 'tx', 'dur>ops', 'tx>ops'] },
        ]}
        caption="Step through to see which part leads to which."
      />
      <Proportion title={`${GLOSSARY.length} terms, by part of the module`} parts={PARTS.map((p) => ({ label: p.title, value: p.count, hue: p.hue }))} />

      <h2>Glossary</h2>
      <p>Search a word, or filter by part. Each entry links to the lesson that explains it.</p>
      <GlossarySearch entries={GLOSSARY} parts={PARTS} partOf={partOf} lessonTitle={(slug) => LESSON_TITLES.get(slug)} moduleId={postgresModule.id} />

      <h2>Cheat sheet: psql</h2>
      <p>psql’s own commands start with a backslash and end at the line end — no semicolon.</p>
      <Predict
        question={<p>You want the columns, indexes and foreign keys of table <code>orders</code>. Which psql command?</p>}
        options={['\\dt orders', '\\d orders', '\\di orders', 'SELECT * FROM orders LIMIT 0']}
        answer={1}
        explanation={<>\d shows one object in detail; \dt only lists tables, \di only indexes. Recorded:</>}
      />
      <CodeBlock title="\d orders — recorded" language="text" code={shot('\\d orders')} />
      <Table head={['Command', 'Does']} rows={META.map(([c, d]) => [<code key="c">{c}</code>, d])} />
      <Tabs
        items={[
          { label: '\\conninfo', content: <CodeBlock title={`recorded on PostgreSQL ${OPERATIONS.recordedWith.split(' ')[0]}`} language="text" code={shot('\\conninfo')} /> },
          { label: '\\dt+', content: <CodeBlock title="recorded" language="text" code={shot('\\dt+')} /> },
          { label: '\\du', content: <CodeBlock title="recorded" language="text" code={shot('\\du')} /> },
        ]}
      />
      <CodeBlock
        title="connecting"
        language="bash"
        code={`psql -h db.example.internal -p 5432 -U app_rw -d shop        # asks for the password
psql "postgresql://app_rw@db.example.internal:5432/shop?sslmode=verify-full"
psql -d shop -c "SELECT count(*) FROM orders"                    # one command, then exit
psql -d shop -f migrate.sql -v ON_ERROR_STOP=1                   # a script that stops on error
PGPASSWORD=… or ~/.pgpass (mode 0600): host:port:db:user:password`}
      />

      <h2>Cheat sheet: admin queries</h2>
      <p>The queries used most on a running server. Each one is explained in the lesson linked from its tab.</p>
      <Tabs
        items={[
          {
            label: 'sizes',
            content: (
              <>
                <CodeBlock title="largest tables (heap + indexes + TOAST)" language="sql" code={SIZES_SQL.cmd.replace(/ (FROM|WHERE|ORDER BY|LIMIT) /g, '\n$1 ').replace(/, pg_size/g, ',\n       pg_size')} />
                <CodeBlock title="recorded" language="text" code={SIZES_SQL.out} />
                <CodeBlock title="databases" language="sql" code={DB_SIZES_SQL.cmd.replace(/ (FROM|ORDER BY) /g, '\n$1 ')} />
                <CodeBlock title="recorded" language="text" code={DB_SIZES_SQL.out} />
              </>
            ),
          },
          {
            label: 'activity',
            content: (
              <>
                <CodeBlock
                  title="what runs now, oldest transaction first — see Monitoring and tuning"
                  language="sql"
                  code={`SELECT pid, usename, application_name, state, wait_event_type, wait_event,
       now() - xact_start AS xact_age, left(query, 60) AS query
FROM pg_stat_activity
WHERE backend_type = 'client backend' AND state <> 'idle'
ORDER BY xact_start NULLS LAST;

SELECT pid, pg_blocking_pids(pid) AS blocked_by, left(query, 60)
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;

SELECT pg_cancel_backend(12345);     -- stop the running query
SELECT pg_terminate_backend(12345);  -- end the session (rolls back)`}
                />
                <p><a href="#/postgres/monitoring">Monitoring and tuning →</a></p>
              </>
            ),
          },
          {
            label: 'slow queries',
            content: (
              <>
                <CodeBlock
                  title="top queries by total time (pg_stat_statements)"
                  language="sql"
                  code={`SELECT left(query, 60) AS query, calls, round(total_exec_time) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms, rows
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

EXPLAIN (ANALYZE, BUFFERS) SELECT …;   -- then read the plan`}
                />
                <p>
                  <a href="#/postgres/monitoring">Monitoring and tuning →</a> · <a href="#/postgres/query-planning">Query planning and EXPLAIN →</a>
                </p>
              </>
            ),
          },
          {
            label: 'vacuum & indexes',
            content: (
              <>
                <CodeBlock
                  title="dead tuples, and indexes nobody uses"
                  language="sql"
                  code={`SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;

SELECT indexrelid::regclass AS index, relid::regclass AS table, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;

SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;   -- wraparound distance`}
                />
                <p>
                  <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM →</a> · <a href="#/postgres/indexes">B-tree indexes →</a>
                </p>
              </>
            ),
          },
          {
            label: 'settings',
            content: (
              <>
                <CodeBlock
                  title="read and change settings"
                  language="sql"
                  code={`SHOW work_mem;
SELECT name, setting, unit, context, source FROM pg_settings WHERE name LIKE 'autovacuum%';
ALTER SYSTEM SET log_min_duration_statement = '500ms';   -- written to postgresql.auto.conf
SELECT pg_reload_conf();                                  -- context 'sighup': applies now
SELECT name FROM pg_settings WHERE pending_restart;       -- 'postmaster' settings wait for a restart
ALTER ROLE app_rw SET statement_timeout = '30s';          -- per role`}
                />
                <p>
                  <a href="#/postgres/setup">Install and configure →</a>
                </p>
              </>
            ),
          },
          {
            label: 'replication',
            content: (
              <>
                <CodeBlock
                  title="lag and slots, on the primary (not recorded here)"
                  language="sql"
                  code={`SELECT application_name, state, sync_state, replay_lag,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS behind
FROM pg_stat_replication;

SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;`}
                />
                <p>
                  <a href="#/postgres/replication">Replication and failover →</a>
                </p>
              </>
            ),
          },
          {
            label: 'backup',
            content: (
              <>
                <CodeBlock
                  title="from the shell (not recorded here)"
                  language="bash"
                  code={`pg_dump -Fc -d shop -f shop.dump                 # one database, custom format
pg_restore -d shop_copy --jobs 4 shop.dump       # restore it in parallel
pg_basebackup -D /backups/base -X stream -P      # the whole cluster, physical`}
                />
                <p>
                  <a href="#/postgres/backups">Backups and point-in-time recovery →</a>
                </p>
              </>
            ),
          },
        ]}
      />

      <h2>Checklist: five minutes on an unknown server</h2>
      <ol>
        <li><code>SELECT version();</code> and <code>\conninfo</code> — which server, which database, which role.</li>
        <li><code>\l</code>, <code>\dn</code>, <code>\dt+</code> — what is there and how big.</li>
        <li>pg_stat_activity — anything long-running, idle in transaction or blocked?</li>
        <li>pg_stat_statements — the top 10 by total time.</li>
        <li>pg_stat_user_tables — dead tuples and last autovacuum on the biggest tables.</li>
        <li>pg_stat_replication and pg_replication_slots — lag, and slots nobody reads.</li>
        <li><code>SHOW shared_buffers; SHOW max_connections;</code> — compare with the machine.</li>
      </ol>

      <Recap
        points={[
          'Every term links to the lesson that explains it — search, or filter by part.',
          'psql backslash commands describe objects: \\d table, \\dt+, \\du, \\conninfo, \\x, \\timing.',
          'Most admin questions are answered by a handful of views: pg_stat_activity, pg_stat_statements, pg_stat_user_tables, pg_stat_replication, pg_settings.',
        ]}
      />
    </>
  )
}
