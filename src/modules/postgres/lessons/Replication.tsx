import { BarChart, Flow, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import readYourWritesSource from '../../../../tools/postgres-capture/durability-app/readYourWrites.ts?raw'
import { ReplicationLagPlayground } from '../components/ReplicationLagPlayground'
import { ReplicationLsnChart } from '../components/ReplicationLsnChart'
import { DURABILITY } from '../data/durability'

const R = DURABILITY.repl
const MB = (b: number) => b / 1024 / 1024
const lag = R.lag
const pause = lag.marks.find((m) => m.label === 'pause')!.t
const resume = lag.marks.find((m) => m.label === 'resume')!.t
const maxReplayLag = Math.max(...lag.samples.map((s) => s.replay_lag_ms ?? 0))
const maxBehind = Math.max(...lag.samples.map((s) => s.cur - s.replay))
const calm = lag.samples.filter((s) => s.t < pause)
const calmLag = calm.reduce((n, s) => n + (s.replay_lag_ms ?? 0), 0) / Math.max(1, calm.length)
const level = (l: string) => R.syncLevels.find((s) => s.level === l)!
const growth = R.slotGrowth
const lastGrowth = growth.filter((g) => g.step > 0 && g.step < 7).at(-1) as { wal?: number }
const notFound = (text: string) => Number(text.match(/not found on the standby: (\d+)/)?.[1] ?? 0)
const avgWait = R.ryw.waitLsn.match(/average wait for replay: ([\d.]+) ms/)?.[1] ?? '?'

const CLIENT_URLS = `# libpq (psql, Python, Go, Node pg …): try the hosts in order, keep the one that accepts writes
postgresql://app@db1.internal:5432,db2.internal:5432/shop?target_session_attrs=read-write

# JDBC (pgjdbc)
jdbc:postgresql://db1.internal:5432,db2.internal:5432/shop?targetServerType=primary`

export default function Replication() {
  return (
    <>
      <LessonGoals
        goals={[
          'set up a streaming standby with pg_basebackup and read pg_stat_replication',
          'choose synchronous_commit and synchronous_standby_names knowing what each costs and risks',
          'read from a standby safely: lag, read-your-writes and query conflicts',
          'use replication slots without filling the disk, and promote a standby',
          'replicate chosen tables with logical replication',
        ]}
        before={<a href="#/postgres/wal">WAL and crash recovery</a>}
      />

      <h2>A standby replays the primary’s WAL</h2>
      <p>
        A streaming replica is a second server that receives the primary’s WAL as it is written and replays it, so it holds an exact copy of the
        whole cluster. It is the same mechanism as crash recovery, running forever.
      </p>
      <TermList
        items={[
          { term: 'primary', definition: 'The server that accepts writes.' },
          { term: 'standby (replica)', definition: 'A server in continuous recovery, replaying WAL from the primary. With hot_standby (the default) it answers read-only queries.' },
          { term: 'walsender / walreceiver', definition: 'The process on the primary that streams WAL, and the process on the standby that receives it and writes it to its own pg_wal/.' },
          { term: 'startup process', definition: 'The standby process that replays received WAL into the data files.' },
          { term: 'replication slot', definition: 'A record on the primary of how far a consumer got, so the WAL it still needs is never removed.' },
          { term: 'synchronous standby', definition: 'A standby the primary waits for before telling a client its COMMIT succeeded.' },
          { term: 'promotion', definition: 'Ending recovery on a standby so it becomes a primary, on a new timeline.' },
        ]}
      />
      <Flow
        title="The path of a committed change to a standby — and the four positions pg_stat_replication reports"
        cols={5}
        rows={2}
        width={800}
        nodes={[
          { id: 'app', label: 'client', sub: 'COMMIT', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'pwal', label: 'pg_wal/', sub: 'primary: flushed', col: 1, row: 0, hue: 4, shape: 'log' },
          { id: 'sender', label: 'walsender', sub: 'sent_lsn', col: 2, row: 0, hue: 4 },
          { id: 'recv', label: 'walreceiver', sub: 'write / flush', col: 3, row: 0, hue: 5 },
          { id: 'swal', label: 'pg_wal/', sub: 'standby: flush_lsn', col: 4, row: 0, hue: 5, shape: 'log' },
          { id: 'startup', label: 'startup', sub: 'replay_lsn', col: 4, row: 1, hue: 6 },
          { id: 'reader', label: 'read-only query', sub: 'on the standby', col: 2, row: 1, hue: 1, shape: 'actor' },
        ]}
        edges={[
          { from: 'app', to: 'pwal', hue: 4 },
          { from: 'pwal', to: 'sender', hue: 4, flow: true },
          { from: 'sender', to: 'recv', label: 'network', hue: 5, flow: true },
          { from: 'recv', to: 'swal', hue: 5 },
          { from: 'swal', to: 'startup', hue: 6 },
          { from: 'startup', to: 'reader', label: 'visible', hue: 6 },
        ]}
        steps={[
          { title: 'Flushed on the primary', body: <p>The commit record is in the primary’s WAL on disk. The walsender only ever sends WAL that is already flushed.</p>, active: ['app', 'app>pwal', 'pwal'] },
          { title: 'Sent', body: <p><code>sent_lsn</code>: how far the walsender has pushed WAL into the network connection.</p>, active: ['pwal>sender', 'sender', 'sender>recv'] },
          { title: 'Written and flushed on the standby', body: <p>The walreceiver writes the WAL to the standby’s <code>pg_wal/</code> (<code>write_lsn</code>), fsyncs it (<code>flush_lsn</code>) and reports both back.</p>, active: ['recv', 'recv>swal', 'swal'] },
          { title: 'Replayed', body: <p>The startup process applies the records (<code>replay_lsn</code>). Only now can a query on the standby see the change.</p>, active: ['swal>startup', 'startup', 'startup>reader', 'reader'] },
        ]}
      />

      <h2>Setting up a standby</h2>
      <p>A standby starts as a base backup of the primary that knows where to stream from.</p>
      <p>
        Recorded with two <code>postgres:18</code> containers on one network, named <code>primary</code> and <code>standby</code>. On the primary, a
        role allowed to replicate and a <code>pg_hba.conf</code> line for it (the word <code>replication</code> in the database column):
      </p>
      <CodeBlock language="text" title="recorded on the primary" code={R.primarySetup} />
      <CodeBlock language="text" title="the last two lines of pg_hba.conf" code={R.hbaLine} />
      <p>
        On the standby, <code>pg_basebackup</code> copies the data directory. <code>-R</code> writes the connection settings and{' '}
        <code>standby.signal</code>, <code>-C -S standby1</code> creates a replication slot, <code>-X stream</code> includes the WAL needed to make
        the copy consistent, and <code>-c fast</code> asks for an immediate checkpoint instead of waiting for a spread one.
      </p>
      <CodeBlock language="text" title="recorded on the standby" code={R.basebackup} />
      <CodeBlock language="text" title="recorded" code={`${R.standbyFiles}\n\n${R.autoConf}`} />
      <p>Start the server on that directory and it connects, catches up and keeps streaming:</p>
      <Tabs
        items={[
          { label: 'primary: pg_stat_replication', content: <CodeBlock language="text" title="recorded" code={R.statReplication} /> },
          { label: 'standby: pg_stat_wal_receiver', content: <CodeBlock language="text" title="recorded" code={R.walReceiver} /> },
        ]}
      />

      <h2>Lag, measured</h2>
      <p>Lag is the distance between what the primary wrote and what the standby has flushed or replayed.</p>
      <p>
        Recorded: a write load on the primary for 16 seconds, sampling <code>pg_stat_replication</code> every 250 ms. From second{' '}
        {pause.toFixed(0)} to {resume.toFixed(0)}, replay on the standby was paused with <code>pg_wal_replay_pause()</code> — as a long query or a slow
        disk would.
      </p>
      <ReplicationLsnChart
        title="Recorded: WAL positions, MB since the start of the run"
        series={[
          { label: 'primary wrote', hue: 4, points: lag.samples.map((s) => [s.t, MB(s.cur)]) },
          { label: 'standby flushed', hue: 5, dashed: true, points: lag.samples.map((s) => [s.t, MB(s.flush)]) },
          { label: 'standby replayed', hue: 6, points: lag.samples.map((s) => [s.t, MB(s.replay)]) },
        ]}
        bands={[{ from: pause, to: resume, label: 'replay paused' }]}
        caption="Receiving and flushing never stopped; only replay did. A query on the standby kept seeing the database as it was at the pause."
      />
      <StatTiles
        stats={[
          { label: 'replay_lag while streaming normally', value: `${calmLag.toFixed(0)} ms`, sub: 'one host, no real network', hue: 6 },
          { label: 'replay_lag at the end of the pause', value: `${(maxReplayLag / 1000).toFixed(1)} s`, sub: `${MB(maxBehind).toFixed(0)} MB of WAL not yet replayed`, hue: 8 },
          { label: 'flush_lag during the pause', value: 'unchanged', sub: 'the WAL was safe on the standby’s disk', hue: 5 },
        ]}
      />
      <Callout tone="note" title="Bytes or seconds">
        <code>pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)</code> measures lag in bytes; <code>replay_lag</code> in time, as how long ago the
        primary flushed the WAL the standby has just replayed. On an idle primary the time columns keep their last value, so alert on both.
      </Callout>

      <h2>Synchronous replication</h2>
      <p>By default replication is asynchronous: COMMIT returns before the standby has anything.</p>
      <p>
        If the primary is destroyed, the commits the standby had not received are lost on failover. Listing a standby in{' '}
        <code>synchronous_standby_names</code> makes COMMIT wait for it; <code>synchronous_commit</code> decides how far it must get:
      </p>
      <CodeBlock language="text" title="recorded on the primary" code={`${R.syncSetup}\n${R.syncState}`} />
      <Table
        head={['synchronous_commit', 'COMMIT returns after', 'If the primary is lost, you lose', 'A read on the standby right after COMMIT']}
        rows={[
          ['off', 'nothing is flushed yet', 'up to ~600 ms of commits, even without failover', 'may not see it'],
          ['local', 'local flush', 'what the standby had not received', 'may not see it'],
          ['remote_write', 'standby wrote it (OS cache)', 'nothing, unless the standby’s OS crashes too', 'may not see it'],
          ['on', 'standby flushed it', 'nothing', 'may not see it (replay lag)'],
          ['remote_apply', 'standby replayed it', 'nothing', 'sees it'],
        ]}
      />
      <BarChart
        title="Recorded: time per COMMIT, one client, standby1 synchronous (median of five 4-second runs)"
        bars={R.syncLevels.map((s) => ({
          label: s.level,
          value: s.latencyMs,
          display: `${s.latencyMs} ms · ${s.tps.toLocaleString()} tps`,
          hue: s.level === 'off' ? 8 : s.level === 'local' ? 4 : s.level === 'remote_apply' ? 6 : 5,
          note: `runs: ${s.runs.join(', ')} ms`,
        }))}
      />
      <p>
        Both servers share one lab disk, so fsync times vary a lot between runs (hover a bar for all five). The order is the stable part:{' '}
        <code>off</code> waits for nothing ({level('off').latencyMs} ms); every other level waits for at least one fsync; waiting for the standby
        to replay is the slowest. Over a real network, add one round trip to every level from <code>remote_write</code> up.
      </p>

      <Predict
        question={
          <p>
            <code>synchronous_standby_names = 'standby1'</code>, and the standby’s server is switched off. A client runs an INSERT on the primary.
            What happens?
          </p>
        }
        options={['It commits normally: the standby is down, so it is skipped', 'It fails with an error', 'It waits — until the standby is back or someone cancels it']}
        answer={2}
        explanation="PostgreSQL never silently downgrades a synchronous commit. The commit is already in the primary’s WAL, but the client gets no answer. Recorded:"
      />
      <CodeBlock language="text" title="recorded: the INSERT waits; seen from another session after 3 s" code={R.syncWaitActivity} />
      <CodeBlock language="text" title="recorded: the waiting session after pg_cancel_backend()" code={`${R.syncWaitCancelled}\n${R.syncWaitAfter}`} />
      <Callout tone="warn" title="One synchronous standby halves your availability">
        With a single synchronous standby, losing either server stops all writes. Run at least two standbys and wait for any one of them:{' '}
        <code>synchronous_standby_names = 'ANY 1 (standby1, standby2)'</code> (quorum commit; <code>FIRST 1 (…)</code> is priority-based). And note
        the warning above: a cancelled wait leaves a commit that is visible on the primary but maybe not on any standby.
      </Callout>

      <ReplicationLagPlayground />

      <h2>Reading from a standby</h2>
      <p>A standby answers read-only queries, but what it returns can be slightly old.</p>
      <CodeBlock language="text" title="recorded on the standby" code={R.hotRead} />
      <h3>Read your own writes</h3>
      <p>
        An application that writes on the primary and immediately reads from a standby may not find its own row. Recorded with a small TypeScript
        program: 500 orders, each read back from the standby at once — first naively, then after waiting until the standby had replayed past
        the primary’s WAL flush position:
      </p>
      <StatTiles
        stats={[
          { label: 'read at once: not found', value: `${notFound(R.ryw.naive)} of 500`, sub: 'asynchronous standby on the same host', hue: 8, bar: { value: notFound(R.ryw.naive), max: 500 } },
          { label: 'after waiting for replay: not found', value: `${notFound(R.ryw.waitLsn)} of 500`, sub: `average wait ${avgWait} ms`, hue: 6, bar: { value: notFound(R.ryw.waitLsn), max: 500 } },
        ]}
      />
      <Tabs
        items={[
          { label: 'readYourWrites.ts', content: <CodeBlock language="ts" title="tools/postgres-capture/durability-app/readYourWrites.ts (ran)" code={readYourWritesSource} /> },
          { label: 'output', content: <CodeBlock language="text" title="recorded" code={`$ node readYourWrites.ts naive\n${R.ryw.naive}\n\n$ node readYourWrites.ts wait-lsn\n${R.ryw.waitLsn}`} /> },
        ]}
      />
      <p>
        Even on one machine with milliseconds of lag, nearly every immediate read missed. Choices: read your own recent writes from the primary
        (simplest), wait for the standby’s <code>pg_last_wal_replay_lsn()</code> to pass the LSN you got after commit (as above), or use{' '}
        <code>synchronous_commit = remote_apply</code> for those transactions.
      </p>

      <h3>Query conflicts</h3>
      <p>
        Replay can remove row versions a standby query still needs: VACUUM on the primary does not know about queries on the standby. The
        standby then delays replay for up to <code>max_standby_streaming_delay</code> (30 s by default; 5 s here) and cancels the query.
        Recorded: a repeatable-read transaction on the standby while the primary deletes and vacuums the rows it reads:
      </p>
      <Tabs
        items={R.conflicts.map((c) => ({
          label: `hot_standby_feedback = ${c.feedback}`,
          content: (
            <>
              <CodeBlock language="text" title="recorded on the primary" code={c.primary} />
              <CodeBlock language="text" title="recorded on the standby, at the same time" code={c.standby} />
            </>
          ),
        }))}
      />
      <Table
        head={['Setting', 'Effect on the standby query', 'Cost']}
        rows={[
          ['hot_standby_feedback = off (default)', 'cancelled after max_standby_streaming_delay', 'none on the primary'],
          ['hot_standby_feedback = on', 'keeps running (recorded above)', 'the primary keeps dead rows: “5000 are dead but not yet removable” — bloat while long standby queries run'],
          ['larger max_standby_streaming_delay', 'survives longer', 'replay waits: the standby falls behind for everyone'],
        ]}
      />
      <CodeBlock language="text" title="recorded: conflicts counted on the standby" code={R.conflictStats} />

      <h2>Replication slots</h2>
      <p>A slot makes the primary keep every WAL segment its consumer has not confirmed.</p>
      <p>
        Without a slot, a standby that falls too far behind finds its WAL already recycled and must be rebuilt. With a slot it can always catch
        up — but if the consumer never comes back, the WAL is kept forever. Recorded: a slot for a standby that is gone, then six batches of
        inserts, each followed by a checkpoint:
      </p>
      <CodeBlock language="text" title="recorded" code={R.slotCreate} />
      <BarChart
        title="Recorded: size of pg_wal/ with an abandoned slot (max_wal_size = 128MB)"
        unit=" MB"
        marker={{ value: 128, label: 'max_wal_size: what checkpoints normally keep it near' }}
        bars={growth
          .filter((g) => g.step < 7)
          .map((g) => ({ label: g.step === 0 ? 'slot created' : `after batch ${g.step}`, value: Math.round(MB(g.bytes)), display: `${Math.round(MB(g.bytes))} MB · ${g.files} files`, hue: g.step === 0 ? 4 : 8 }))}
      />
      <CodeBlock language="text" title="recorded" code={R.slotStatus} />
      <p>
        <code>wal_status = extended</code> means the slot holds WAL beyond <code>max_wal_size</code>; here {Math.round(MB(lastGrowth.wal ?? 0))} MB and
        growing with every write. On a busy database that is a full disk in hours, and a full <code>pg_wal/</code> stops the primary.{' '}
        <code>max_slot_wal_keep_size</code> caps it: past the cap the slot is invalidated and the WAL removed.
      </p>
      <CodeBlock language="text" title="recorded" code={`${R.slotLimit}\n\n${R.slotLost}`} />
      <CodeBlock language="text" title="recorded: drop the slot, and pg_wal/ shrinks at the next checkpoint" code={R.slotDrop} />
      <Callout tone="warn" title="Every slot is a promise to keep WAL">
        Alert on <code>pg_replication_slots</code> where <code>active = false</code> or the retained WAL grows; set{' '}
        <code>max_slot_wal_keep_size</code>; drop slots of standbys and CDC connectors you remove. Logical slots (below) behave the same way.
      </Callout>

      <h2>Promotion and failover</h2>
      <p>Promotion ends recovery: the standby stops following and starts accepting writes, on a new timeline.</p>
      <CodeBlock language="text" title="recorded on the standby" code={`${R.beforePromote}\n${R.promote}\n${R.afterPromote}`} />
      <CodeBlock language="text" title="recorded: standby server log" code={R.promoteLog} />
      <CodeBlock language="text" title="recorded" code={R.historyFile} />
      <p>
        The old primary did not notice. It still accepted a write, and the two servers now have different histories — <strong>split brain</strong>:
      </p>
      <CodeBlock language="text" title="recorded on the old primary, after the promotion" code={R.oldPrimary} />
      <Flow
        title="A safe failover (not recorded: needs tooling and more than one host)"
        cols={5}
        rows={1}
        width={800}
        nodes={[
          { id: 'detect', label: 'detect', sub: 'primary unreachable', col: 0, row: 0, hue: 8 },
          { id: 'fence', label: 'fence', sub: 'old primary stopped', col: 1, row: 0, hue: 8 },
          { id: 'promote', label: 'promote', sub: 'most advanced standby', col: 2, row: 0, hue: 5 },
          { id: 'route', label: 'redirect', sub: 'clients, other standbys', col: 3, row: 0, hue: 1 },
          { id: 'rejoin', label: 'rejoin', sub: 'pg_rewind old primary', col: 4, row: 0, hue: 6 },
        ]}
        edges={[
          { from: 'detect', to: 'fence', hue: 8 },
          { from: 'fence', to: 'promote', hue: 5 },
          { from: 'promote', to: 'route', hue: 1 },
          { from: 'route', to: 'rejoin', hue: 6 },
        ]}
        steps={[
          { title: 'Detect', body: <p>Several observers must agree the primary is gone — a network blip seen by one node must not trigger a failover.</p>, active: ['detect'] },
          { title: 'Fence', body: <p>Make sure the old primary cannot accept writes any more (stop it, cut it off, or let it demote itself when it loses its leader lock). This is what prevents the split brain recorded above.</p>, active: ['detect>fence', 'fence'] },
          { title: 'Promote', body: <p>Choose the standby with the highest received LSN (with synchronous replication: a synchronous one, so no acknowledged commit is lost) and run <code>pg_promote()</code>.</p>, active: ['fence>promote', 'promote'] },
          { title: 'Redirect', body: <p>Point clients at the new primary — a virtual IP, DNS, a proxy, or multi-host connection strings — and point the other standbys at it too.</p>, active: ['promote>route', 'route'] },
          { title: 'Rejoin', body: <p><code>pg_rewind</code> rewinds the old primary to the fork point so it can follow the new timeline as a standby, instead of a full new base backup.</p>, active: ['route>rejoin', 'rejoin'] },
        ]}
      />
      <p>
        Do not script this by hand. Failover managers do it with a consensus store so that exactly one node is primary:{' '}
        <strong>Patroni</strong> (leader lock in etcd, Consul or the Kubernetes API, the most common choice), <strong>pg_auto_failover</strong> (a
        monitor node), <strong>repmgr</strong>, and on Kubernetes operators such as <strong>CloudNativePG</strong>. Managed cloud databases do the
        same internally. Clients follow the primary with a multi-host connection string:
      </p>
      <CodeBlock language="bash" title="not recorded: adapt the host names" code={CLIENT_URLS} />

      <h2>Logical replication</h2>
      <p>Logical replication sends row changes of chosen tables, not pages, to another, independent and writable server.</p>
      <Flow
        title="Publication → slot → subscription"
        cols={4}
        rows={2}
        nodes={[
          { id: 'tbl', label: 'orders', sub: 'on the primary', col: 0, row: 0, hue: 3, shape: 'store' },
          { id: 'wal', label: 'WAL', sub: 'wal_level = logical', col: 1, row: 0, hue: 4, shape: 'log' },
          { id: 'slot', label: 'slot orders_sub', sub: 'pgoutput decoding', col: 2, row: 0, hue: 7 },
          { id: 'apply', label: 'apply worker', sub: 'on the subscriber', col: 3, row: 0, hue: 5 },
          { id: 'sub', label: 'orders', sub: 'subscriber’s own table', col: 3, row: 1, hue: 5, shape: 'store' },
          { id: 'pub', label: 'orders_pub', sub: 'publication: which tables', col: 1, row: 1, hue: 7 },
        ]}
        edges={[
          { from: 'tbl', to: 'wal', hue: 4 },
          { from: 'wal', to: 'slot', hue: 7, flow: true },
          { from: 'slot', to: 'apply', label: 'rows', hue: 5, flow: true },
          { from: 'apply', to: 'sub', hue: 5 },
          { from: 'pub', to: 'slot', dashed: true, hue: 7 },
        ]}
        caption="The subscriber is an ordinary primary: it can have other tables, indexes and writes of its own, and a different major version."
      />
      <Tabs
        items={[
          { label: '1. publish', content: <CodeBlock language="text" title="recorded" code={R.publication} /> },
          { label: '2. subscribe', content: <CodeBlock language="text" title="recorded" code={`${R.subscription}\n${R.subscriptionCopy}`} /> },
          { label: '3. changes flow', content: <CodeBlock language="text" title="recorded" code={`${R.logicalChange}\n\n${R.logicalSeen}`} /> },
          { label: '4. the slot', content: <CodeBlock language="text" title="recorded" code={R.logicalSlots} /> },
        ]}
      />
      <p>
        <code>CREATE SUBSCRIPTION</code> creates a slot on the publisher, copies the existing rows, then streams changes. What a slot decodes is
        visible with the <code>test_decoding</code> plugin — rows with column values, grouped by transaction, in commit order:
      </p>
      <CodeBlock language="text" title="recorded" code={R.decoding} />
      <p>Schema changes are not replicated. Recorded: a column added on the publisher only.</p>
      <CodeBlock language="text" title="recorded on the publisher" code={R.ddl} />
      <CodeBlock language="text" title="recorded: subscriber log, retried every few seconds" code={R.ddlError} />
      <CodeBlock language="text" title="recorded: add the column on the subscriber, and replication resumes" code={`${R.ddlFix}\n${R.ddlFixed}`} />
      <Table
        head={['', 'Streaming (physical)', 'Logical']}
        rows={[
          ['Copies', 'the whole cluster, byte for byte', 'chosen tables, as rows'],
          ['Receiver', 'read-only standby, same major version', 'writable server, any supported version'],
          ['DDL, sequences, large objects', 'yes, everything', 'no — apply schema changes on both sides; sequences are not synced'],
          ['Typical use', 'high availability, read replicas', 'major-version upgrades, moving tables, feeding other systems (CDC)'],
          ['Needs', 'wal_level = replica', 'wal_level = logical, a primary key or REPLICA IDENTITY on updated tables'],
        ]}
      />

      <h2>Design rules</h2>
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['Use a slot for each standby and set max_slot_wal_keep_size', 'Standbys can catch up after an outage, without risking a full disk'],
          ['Monitor sent/flush/replay lag in bytes and seconds, and inactive slots', 'Lag is lost data on failover and stale reads; a dead slot fills pg_wal'],
          ['With synchronous replication, have two candidates: ANY 1 (s1, s2)', 'One synchronous standby means any single failure stops writes'],
          ['Send read-your-writes reads to the primary, or wait for replay', 'Asynchronous standbys are behind by design (recorded: almost every immediate read missed)'],
          ['Choose hot_standby_feedback deliberately', 'On: long standby queries bloat the primary. Off: they get cancelled'],
          ['Fail over with a manager (Patroni or similar), never by hand under pressure', 'Fencing the old primary is what prevents split brain'],
          ['A standby is not a backup', 'It replays a DROP TABLE within milliseconds: see Backups'],
        ]}
      />

      <Recap
        points={[
          'A standby is a base backup in permanent recovery, streaming and replaying the primary’s WAL.',
          'pg_stat_replication shows sent, write, flush and replay positions; lag is the gap to the primary’s position.',
          'synchronous_standby_names + synchronous_commit decide what COMMIT waits for: nothing, local flush, standby write, flush or replay.',
          'A synchronous commit waits forever for a missing standby; a cancelled wait leaves a commit only the primary has.',
          'Slots keep WAL until their consumer confirms it: cap with max_slot_wal_keep_size and drop unused slots.',
          'pg_promote() starts a new timeline; without fencing, the old primary keeps taking writes.',
          'Logical replication copies chosen tables as rows to a writable server; schema changes are yours to apply.',
        ]}
      />
    </>
  )
}
