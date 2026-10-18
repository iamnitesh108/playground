import { BarChart, ByteLayout, Flow, Proportion, StatTiles, Timeline, type ByteField, type TimelineSegment } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import commitLossSource from '../../../../tools/postgres-capture/durability-app/commitLoss.ts?raw'
import { WalPlayground } from '../components'
import { CAPTURE } from '../data/captures'
import { DURABILITY } from '../data/durability'

const W = DURABILITY.wal
const kB = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} kB`)
const MB = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`
const short = (r: { resource_manager: string; record_type: string }) => `${r.resource_manager} ${r.record_type}`.replace('Transaction ', '').replace('XLOG ', '')

// the LSN of the first record of the second transaction, taken apart
const lsnHex = W.walFile.lsn.split('/')
const lsnBytes = Number.parseInt(lsnHex[0], 16) * 2 ** 32 + Number.parseInt(lsnHex[1], 16)
const segNo = Math.floor(lsnBytes / W.walFile.segBytes)

// the recorded checkpoints, as start → complete segments
const cp = W.checkpoints
const end = Math.ceil(cp.phases.at(-1)!.from)
const segments: TimelineSegment[] = []
cp.lines.forEach((l, i) => {
  const m = l.text.match(/checkpoint starting: (\w+)/)
  if (!m) return
  const done = cp.lines.slice(i + 1).find((x) => x.text.includes('checkpoint complete'))
  const timed = m[1] === 'time'
  segments.push({ lane: timed ? 'timed' : 'wal', from: l.t, to: done?.t ?? end, hue: timed ? 4 : 8 })
})
const phases: TimelineSegment[] = cp.phases.slice(0, -1).map((p, i) => ({
  lane: 'load',
  from: p.from,
  to: cp.phases[i + 1].from,
  label: p.label,
  hue: p.label.startsWith('heavy') ? 8 : 1,
  striped: p.label.startsWith('heavy'),
}))
const warnings = cp.lines.filter((l) => l.text.includes('too frequently')).length
const checkpointer = W.checkpointer.match(/\n\s+(\d+) \|\s+(\d+) \|/)!

const fpwOn = W.fpw[0]
const loss = { off: W.loss.find((l) => l.level === 'off')!, on: W.loss.find((l) => l.level === 'on')! }
const sync = { off: W.syncLevels.find((s) => s.level === 'off')!, on: W.syncLevels.find((s) => s.level === 'on')! }
const checkpointRecord = CAPTURE.wal.find((w) => w.label === 'checkpoint')!
const recovery = W.recoveryLog.split('\n').map((l) => l.replace(/^\S+ \S+ \S+ \[\d+\] /, ''))

export default function Wal() {
  return (
    <>
      <LessonGoals
        goals={[
          'state the write-ahead rule and why COMMIT is fast',
          'read real WAL records and LSNs, and find the file an LSN lives in',
          'explain full-page writes and how checkpoints are spaced',
          'choose a synchronous_commit level knowing exactly what it risks, and see group commit at work',
          'crash a database and recover it, step by step',
        ]}
        before={
          <>
            <a href="#/postgres/architecture">How PostgreSQL runs</a> (the path of a commit) and <a href="#/postgres/mvcc">Rows are versions (MVCC)</a>
          </>
        }
      />

      <h2>Log first, data later</h2>
      <p>
        PostgreSQL makes a change durable by writing a short description of it to a log, not by writing the changed table page. Writing every
        changed 8 kB page to its place on disk at every commit would mean scattered random writes; appending to one sequential file, the{' '}
        <strong>write-ahead log (WAL)</strong>, is much cheaper. Data pages are written later, in the background.
      </p>
      <TermList
        items={[
          { term: 'WAL record', definition: 'A description of one change: “insert this tuple at offset 32 of page 7 of this table”, or “transaction 758 committed”.' },
          { term: 'LSN', definition: 'Log sequence number: a record’s byte position in the WAL, written like 0/2A22E68. Every page remembers the LSN of its last change.' },
          { term: 'WAL segment', definition: 'One file of 16 MB in pg_wal/. The WAL is a long sequence of them.' },
          { term: 'fsync', definition: 'Asking the operating system to put written data on the disk itself, not only in its cache.' },
          { term: 'checkpoint', definition: 'Writing all changed pages to the data files and recording a redo point: recovery never needs WAL older than that.' },
          { term: 'full-page image', definition: 'A copy of a whole page inside the WAL, written the first time the page changes after a checkpoint.' },
        ]}
      />
      <p>Two rules make this safe:</p>
      <ol>
        <li>
          <strong>COMMIT</strong> returns only after the WAL up to its commit record is flushed to disk (with the default{' '}
          <code>synchronous_commit = on</code>).
        </li>
        <li>A changed data page may be written to disk only after the WAL describing that change is on disk — <em>write-ahead</em>.</li>
      </ol>
      <Flow
        title="One UPDATE and its COMMIT"
        cols={4}
        rows={2}
        nodes={[
          { id: 'client', label: 'client', sub: 'UPDATE … ; COMMIT', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'backend', label: 'backend', sub: 'your connection', col: 1, row: 0, hue: 1 },
          { id: 'walbuf', label: 'WAL buffers', sub: 'shared memory', col: 2, row: 0, hue: 4, shape: 'queue' },
          { id: 'pgwal', label: 'pg_wal/', sub: '16 MB segments', col: 3, row: 0, hue: 4, shape: 'log' },
          { id: 'shbuf', label: 'shared buffers', sub: 'page now dirty', col: 2, row: 1, hue: 3, shape: 'queue' },
          { id: 'data', label: 'data file', sub: 'base/…/16384', col: 3, row: 1, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'client', to: 'backend', both: true, hue: 1 },
          { from: 'backend', to: 'walbuf', label: 'record', hue: 4, flow: true },
          { from: 'walbuf', to: 'pgwal', label: 'fsync', hue: 4 },
          { from: 'backend', to: 'shbuf', label: 'change', hue: 3 },
          { from: 'shbuf', to: 'data', label: 'later', hue: 3, dashed: true },
        ]}
        steps={[
          { title: 'UPDATE', body: <p>The backend changes the page in shared buffers (it becomes <em>dirty</em>) and appends a WAL record describing the change to the WAL buffers. Nothing has touched the disk yet.</p>, active: ['client', 'backend', 'client>backend', 'backend>walbuf', 'walbuf', 'backend>shbuf', 'shbuf'] },
          { title: 'COMMIT', body: <p>A commit record is appended, and the WAL up to it is written and flushed to the current segment in <code>pg_wal/</code> — one sequential write and one fsync.</p>, active: ['backend', 'walbuf', 'walbuf>pgwal', 'pgwal'] },
          { title: 'OK to the client', body: <p>The commit is durable: after a crash, replaying the WAL rebuilds the change. The data page is still only in memory.</p>, active: ['client', 'backend', 'client>backend', 'pgwal'] },
          { title: 'Later: the page is written', body: <p>The checkpointer or background writer writes the dirty page to its data file — only ever after the WAL up to the page’s LSN is on disk. Many commits to the same page cost one page write.</p>, active: ['shbuf', 'shbuf>data', 'data', 'pgwal'] },
        ]}
      />

      <h2>What one transaction writes</h2>
      <p>Every change becomes one or more WAL records; reading them shows exactly what PostgreSQL logs.</p>
      <p>
        Recorded with <code>pg_walinspect</code> on a table of {W.table.pages} pages: the same transaction twice — once right after a checkpoint,
        once immediately afterwards.
      </p>
      <CodeBlock language="text" title="recorded" code={W.txShown} />
      <CodeBlock language="text" title="recorded: the second run" code={W.inspectShown} />
      <ByteLayout
        title={`The second run: ${W.again.bytes} bytes of WAL, drawn to scale`}
        rows={[{ label: `transaction ${W.again.records[0].xid}`, fields: W.again.records.map((r) => ({ label: short(r), bytes: r.record_length, hue: r.resource_manager === 'Transaction' ? 6 : r.resource_manager === 'Btree' ? 7 : 3 })) }]}
        caption="Heap records change the table, the Btree record adds the index entry, and the COMMIT record makes the others count."
      />
      <ByteLayout
        title={`The first run, right after a checkpoint: ${kB(W.afterCheckpoint.bytes)} of WAL`}
        rows={[
          {
            label: `transaction ${W.afterCheckpoint.records[0].xid}`,
            fields: W.afterCheckpoint.records.map((r): ByteField => ({
              label: r.fpi_length > 0 ? `${short(r)} + page image` : short(r),
              bytes: r.record_length,
              hue: r.fpi_length > 0 ? 4 : r.resource_manager === 'Transaction' ? 6 : 3,
              content: r.fpi_length > 0 ? kB(r.record_length) : undefined,
            })),
          },
        ]}
        caption="The same four changes, but every page touched for the first time since the checkpoint is logged whole inside its record (“+ page image”): see full-page writes below."
      />
      <p>
        The <code>HOT_UPDATE</code> wrote no index record: <code>status</code> is not indexed and the new version fit on the same page (see{' '}
        <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM</a>). <code>FPI_FOR_HINT</code> is a page image logged because a hint bit was set
        on a page: PostgreSQL 18 enables data checksums by default, and then even hint-bit changes must be WAL-logged once per checkpoint.
      </p>

      <h3>An LSN is a byte position</h3>
      <p>
        <code>{W.walFile.lsn}</code> means “byte {lsnBytes.toLocaleString()} of the WAL since the cluster was created”. With 16 MB segments, that is
        segment {segNo}, at offset {W.walFile.file_offset.toLocaleString()}:
      </p>
      <StatTiles
        stats={[
          { label: 'LSN', value: W.walFile.lsn, sub: 'high 32 bits / low 32 bits, hex', hue: 4 },
          { label: 'byte position', value: lsnBytes.toLocaleString(), sub: `= ${segNo} × ${W.walFile.seg} + offset`, hue: 4 },
          { label: 'segment file', value: `…${W.walFile.file_name.slice(-8)}`, sub: W.walFile.file_name, hue: 4 },
        ]}
      />
      <Proportion
        title={`Segment ${W.walFile.file_name}: where ${W.walFile.lsn} sits`}
        parts={[
          { label: 'before this record', value: W.walFile.file_offset, hue: 4, display: MB(W.walFile.file_offset) },
          { label: 'rest of the 16 MB segment', value: W.walFile.segBytes - W.walFile.file_offset, hue: 3, display: MB(W.walFile.segBytes - W.walFile.file_offset) },
        ]}
      />
      <Tabs
        items={[
          { label: 'pg_walfile_name', content: <CodeBlock language="text" title="recorded" code={W.walFileShown} /> },
          { label: 'ls pg_wal', content: <CodeBlock language="text" title="recorded" code={W.lsShown} /> },
        ]}
      />
      <p>
        The file name is three 8-digit hex numbers: timeline, then the segment number split in two. Comparing two LSNs tells you how many bytes
        lie between them — <code>pg_wal_lsn_diff()</code> — which is how replication lag in bytes is measured (
        <a href="#/postgres/replication">Replication and failover</a>).
      </p>

      <Predict
        question={
          <p>
            A transaction updates a row but the server loses power before COMMIT. The changed page was already written to the data file by the
            background writer. After restart, what does a query see?
          </p>
        }
        options={['The new value — it is in the data file', 'The old value', 'A corrupted page']}
        answer={1}
        explanation={
          <>
            The new tuple is on disk, but its xmin never committed: there is no commit record in the WAL, so the transaction counts as aborted and
            the tuple is invisible (<a href="#/postgres/mvcc">MVCC</a>). Try it below: update, write the page, crash, recover.
          </>
        }
      />

      <WalPlayground />
      <p>
        Things to try: commit, then crash before any page is written — recovery replays the change. Update without committing, checkpoint, then
        crash — the page on disk holds the new value, but it stays invisible. During replay, records older than a page’s LSN are skipped, so
        replay can safely repeat.
      </p>
      <Callout tone="note" title="Simplified">
        The simulator keeps the rules and drops details: one row per key, no commit log file, and no full-page images (next section).
      </Callout>

      <h2>Full-page writes</h2>
      <p>The first change to a page after a checkpoint puts a copy of the whole page into the WAL.</p>
      <p>
        The reason is the <strong>torn page</strong>: PostgreSQL writes 8 kB pages, but a disk may only guarantee 4 kB (or 512 bytes) to be
        written atomically. If power fails in the middle of a page write, the page on disk is half old, half new, and a small WAL record cannot
        be replayed onto it. With a full-page image in the WAL, recovery simply puts the whole page back. Recorded: update one row on each of
        about {fpwOn.first.fpi} pages ({W.fpwRows.toLocaleString()} rows), right after a checkpoint, then the same update again:
      </p>
      <BarChart
        title="Recorded WAL volume of the same UPDATE (1,000 rows)"
        bars={W.fpw.flatMap((f, i) => [
          { label: `${f.label}: first`, value: f.first.bytes, display: `${MB(f.first.bytes)} · ${f.first.fpi} page images`, hue: (i === 2 ? 8 : 4) as 4 | 8 },
          { label: `${f.label}: again`, value: f.second.bytes, display: kB(f.second.bytes), hue: 3 as const },
        ])}
      />
      <StatTiles
        stats={[
          { label: 'first update after a checkpoint', value: MB(fpwOn.first.bytes), sub: `${Math.round((fpwOn.first.fpi_bytes / fpwOn.first.bytes) * 100)} % of it page images`, hue: 4 },
          { label: 'the same update again', value: kB(fpwOn.second.bytes), sub: 'no page images: already logged since the checkpoint', hue: 3 },
          { label: 'with wal_compression = lz4', value: MB(W.fpw[1].first.bytes), sub: 'page images compressed', hue: 6 },
        ]}
      />
      <Callout tone="warn" title="Do not turn full_page_writes off">
        It is the only protection against torn pages unless the file system guarantees atomic 8 kB writes (ZFS does, for example). The safe ways
        to reduce the cost are fewer checkpoints (each page is imaged at most once per checkpoint interval) and <code>wal_compression</code>.
      </Callout>

      <h2>Checkpoints</h2>
      <p>A checkpoint bounds how much WAL a crash recovery must replay.</p>
      <p>
        It writes every dirty page to the data files, then records a <em>redo point</em>: recovery starts there, and older WAL segments can be
        recycled. Two settings start one, whichever comes first:
      </p>
      <Table
        head={['Setting', 'Default', 'Effect']}
        rows={[
          ['checkpoint_timeout', '5min', 'Start a checkpoint at least this often (“checkpoint starting: time”)'],
          ['max_wal_size', '1GB', 'Start one earlier when this much WAL has accumulated (“checkpoint starting: wal”)'],
          ['checkpoint_completion_target', '0.9', 'Spread the page writes over 90 % of the interval, to avoid I/O spikes'],
          ['checkpoint_warning', '30s', 'Log a warning when WAL-triggered checkpoints come closer than this'],
        ]}
      />
      <p>
        Recorded with <code>checkpoint_timeout = 30s</code> and <code>max_wal_size = 64MB</code> (both lowered so it fits in {end} seconds): light
        writes, then about 40 seconds of heavy inserts, then light writes again.
      </p>
      <Timeline
        title="Recorded checkpoints: each bar runs from “checkpoint starting” to “checkpoint complete”"
        lanes={[
          { id: 'load', label: 'write load' },
          { id: 'timed', label: 'timed (timeout)' },
          { id: 'wal', label: 'requested (max_wal_size)' },
        ]}
        segments={[...phases, ...segments]}
        end={end}
        unit="s"
        playable
      />
      <StatTiles
        stats={[
          { label: 'timed checkpoints', value: Number(checkpointer[1]), sub: 'every 30 s while writes are light', hue: 4 },
          { label: 'requested by max_wal_size', value: Number(checkpointer[2]), sub: 'during and after the heavy writes', hue: 8 },
          { label: '“too frequently” warnings', value: warnings, sub: 'in the server log', hue: 8 },
        ]}
      />
      <CodeBlock language="text" title="recorded: server log (log_checkpoints is on by default)" code={W.checkpointLogSample} />
      <p>
        Timed checkpoints stretch their writes over the interval; the WAL-triggered ones during the burst write thousands of buffers in a few
        seconds, back to back — and each one restarts full-page writes for every page. In production, size <code>max_wal_size</code> so that
        checkpoints are almost always timed: check <code>num_timed</code> against <code>num_requested</code> in <code>pg_stat_checkpointer</code>.
        Longer intervals mean less write I/O but longer crash recovery.
      </p>
      <CodeBlock language="text" title="recorded" code={W.checkpointer} />
      <Table
        head={['LSN', 'Record', 'Description']}
        rows={checkpointRecord.records.map((r) => [<code key="l">{r.start_lsn}</code>, `${r.resource_manager} / ${r.record_type}`, r.description])}
      />
      <p>The WAL record of a manual <code>CHECKPOINT</code> (from the shared lab recording), with its redo point.</p>

      <h2>synchronous_commit: when does COMMIT return?</h2>
      <p>
        <code>synchronous_commit</code> chooses how much of the durability work a COMMIT waits for. It can be set per transaction, so one
        database can mix both.
      </p>
      <Table
        head={['Value', 'COMMIT waits for', 'A crash of this server can lose']}
        rows={[
          ['off', 'nothing: the WAL writer flushes within wal_writer_delay (200 ms)', 'the last acknowledged commits, up to 3 × wal_writer_delay — never consistency'],
          ['local', 'the local WAL flush', 'nothing acknowledged'],
          ['on (default)', 'the local flush, and a synchronous standby’s flush if one is configured', 'nothing acknowledged'],
          ['remote_write / remote_apply', 'a synchronous standby’s write / replay', 'nothing; see Replication'],
        ]}
      />
      <p>Without a synchronous standby, local, on, remote_write and remote_apply all behave the same. Recorded, one client inserting one row per transaction (median of three 5-second runs):</p>
      <StatTiles
        stats={[
          { label: 'synchronous_commit = off', value: `${sync.off.tps.toLocaleString()} tps`, sub: `${sync.off.latencyMs} ms per commit`, hue: 8 },
          { label: 'synchronous_commit = on', value: `${sync.on.tps.toLocaleString()} tps`, sub: `${sync.on.latencyMs} ms per commit — one fsync each`, hue: 6 },
        ]}
      />
      <p>
        What does <code>off</code> really risk? A small TypeScript program inserted rows one transaction at a time and remembered the last id the
        server acknowledged; the server was killed with <code>SIGKILL</code> after three seconds and restarted. Recorded:
      </p>
      <BarChart
        title="Acknowledged to the program vs present after the restart"
        bars={[
          { label: 'off: acknowledged', value: loss.off.acked, hue: 1 },
          { label: 'off: in the table after restart', value: loss.off.present, hue: 8, note: `${loss.off.acked - loss.off.present} acknowledged commits are gone` },
          { label: 'on: acknowledged', value: loss.on.acked, hue: 1 },
          { label: 'on: in the table after restart', value: loss.on.present, hue: 6 },
        ]}
      />
      <StatTiles
        stats={[
          { label: 'off: acknowledged commits lost', value: loss.off.acked - loss.off.present, sub: 'their WAL was still in memory', hue: 8 },
          { label: 'on: acknowledged commits lost', value: Math.max(0, loss.on.acked - loss.on.present), sub: `and ${Math.max(0, loss.on.present - loss.on.acked)} committed whose OK never arrived`, hue: 6 },
        ]}
      />
      <Tabs
        items={[
          { label: 'commitLoss.ts', content: <CodeBlock language="ts" title="tools/postgres-capture/durability-app/commitLoss.ts (ran)" code={commitLossSource} /> },
          { label: 'output: off', content: <CodeBlock language="text" title="recorded" code={loss.off.printed} /> },
          { label: 'output: on', content: <CodeBlock language="text" title="recorded" code={loss.on.printed} /> },
        ]}
      />
      <p>
        Two lessons in one recording. With <code>off</code>, {loss.off.acked - loss.off.present} transactions the program believed were saved are
        gone — the database is consistent, they simply never happened. With <code>on</code> nothing acknowledged was lost, but one more row exists
        than was acknowledged: the commit reached the disk and the connection died before the OK. A client that sees a connection error after
        COMMIT does not know the outcome — design writes to be safely retried (see{' '}
        <a href="#/postgres/constraints">Constraints and idempotency</a>).
      </p>
      <Callout tone="note" title="A process kill is gentler than a power cut">
        Killing the server loses only what was not yet handed to the operating system. A power cut also loses what the OS had not written to
        disk; that is what fsync — and <code>synchronous_commit = on</code> — protects against.
      </Callout>

      <h2>Group commit</h2>
      <p>When many sessions commit at once, one fsync can make all of their commit records durable.</p>
      <p>
        A backend that wants to flush finds that another backend is already flushing; when that flush finishes, it often covers the waiting
        commit records too. Recorded with pgbench and <code>synchronous_commit = on</code>, counting commits and WAL fsyncs (from{' '}
        <code>pg_stat_database</code> and <code>pg_stat_io</code>):
      </p>
      <BarChart
        title="Recorded: commits made durable per WAL fsync"
        bars={W.group.map((g) => ({ label: `${g.clients} client${g.clients > 1 ? 's' : ''}`, value: g.commits / g.fsyncs, display: `${(g.commits / g.fsyncs).toFixed(1)} commits / fsync`, hue: 4 }))}
      />
      <BarChart
        title="Recorded: transactions per second"
        bars={W.group.map((g) => ({ label: `${g.clients} client${g.clients > 1 ? 's' : ''}`, value: g.tps, display: `${g.tps.toLocaleString()} tps · ${g.latencyMs} ms`, hue: 6 }))}
      />
      <CodeBlock language="text" title="recorded" code={W.pgbenchShown} />
      <p>
        This is why throughput grows with concurrency on the same disk while each commit still waits for its own fsync. <code>commit_delay</code>{' '}
        (with <code>commit_siblings</code>) can make the leader wait a few microseconds to gather more commits, but it rarely helps on fast disks;
        measure before changing it. The numbers vary from run to run on a shared lab disk; the ratio of commits to fsyncs is the stable part.
      </p>

      <h2>After a crash</h2>
      <p>Crash recovery replays the WAL from the last checkpoint’s redo point to the end, then the server opens.</p>
      <Flow
        title="Recorded: the restart after the SIGKILL above"
        cols={4}
        rows={1}
        nodes={[
          { id: 'ctl', label: 'pg_control', sub: 'last checkpoint', col: 0, row: 0, hue: 4, shape: 'store' },
          { id: 'redo', label: 'redo', sub: 'replay WAL records', col: 1, row: 0, hue: 4, shape: 'log' },
          { id: 'cp', label: 'checkpoint', sub: 'end-of-recovery', col: 2, row: 0, hue: 4 },
          { id: 'open', label: 'accept', sub: 'connections', col: 3, row: 0, hue: 6, shape: 'actor' },
        ]}
        edges={[
          { from: 'ctl', to: 'redo', hue: 4 },
          { from: 'redo', to: 'cp', hue: 4 },
          { from: 'cp', to: 'open', hue: 6 },
        ]}
        steps={[
          { title: 'Not shut down cleanly', body: <code>{recovery.slice(0, 2).join(' · ')}</code>, active: ['ctl'] },
          { title: 'Replay from the redo point', body: <code>{recovery.slice(2, 4).join(' · ')}</code>, active: ['ctl>redo', 'redo'] },
          { title: 'Checkpoint, then open', body: <code>{recovery.slice(4).join(' · ')}</code>, active: ['redo>cp', 'cp', 'cp>open', 'open'] },
        ]}
      />
      <p>
        Replay applies a record to a page only if the page’s LSN is older than the record, so it is safe to repeat. Transactions without a commit
        record stay invisible. Recovery time depends on how much WAL lies after the redo point — which <code>checkpoint_timeout</code> and{' '}
        <code>max_wal_size</code> bound.
      </p>

      <h2>The WAL is also a stream of changes</h2>
      <p>Because the WAL describes every change in order, other servers and programs can follow it.</p>
      <Flow
        title="One WAL, three consumers"
        cols={4}
        rows={3}
        nodes={[
          { id: 'wal', label: 'pg_wal/', sub: 'on the primary', col: 0, row: 1, hue: 4, shape: 'log' },
          { id: 'sender', label: 'walsender', sub: 'one per consumer', col: 1, row: 1, hue: 4 },
          { id: 'standby', label: 'standby', sub: 'physical: exact copy', col: 3, row: 0, hue: 5, shape: 'store' },
          { id: 'sub', label: 'subscriber', sub: 'logical: chosen tables', col: 3, row: 1, hue: 5, shape: 'store' },
          { id: 'cdc', label: 'CDC connector', sub: 'e.g. Debezium → Kafka', col: 3, row: 2, hue: 1 },
          { id: 'archive', label: 'WAL archive', sub: 'for PITR', col: 1, row: 2, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'wal', to: 'sender', hue: 4, flow: true },
          { from: 'sender', to: 'standby', label: 'WAL records', hue: 5 },
          { from: 'sender', to: 'sub', label: 'row changes', hue: 5 },
          { from: 'sender', to: 'cdc', label: 'row changes', hue: 1 },
          { from: 'wal', to: 'archive', hue: 4, dashed: true },
        ]}
      />
      <Table
        head={['', 'Physical replication', 'Logical decoding']}
        rows={[
          ['Sends', 'WAL records as they are: page changes', 'Row changes: INSERT / UPDATE / DELETE with column values'],
          ['Needs', 'wal_level = replica (the default)', 'wal_level = logical'],
          ['Receiver', 'A standby: an exact, read-only copy of the whole cluster', 'Subscriptions, or CDC tools that publish to Kafka'],
          ['Position tracked by', 'the standby (optionally a physical slot)', 'a logical replication slot'],
        ]}
      />
      <Callout tone="warn" title="Replication slots keep WAL">
        A slot guarantees that the server keeps all WAL its consumer has not confirmed yet. If the consumer stops — a CDC connector deleted without
        dropping its slot, for example — WAL piles up in <code>pg_wal/</code> until the disk is full. It is recorded in{' '}
        <a href="#/postgres/replication">Replication and failover</a>; set <code>max_slot_wal_keep_size</code>.
      </Callout>
      <p>
        The archive is how backups reach any point in time: <a href="#/postgres/backups">Backups and point-in-time recovery</a>. Change data
        capture is covered in the Kafka module: <a href="#/kafka/debezium">Debezium</a> and the <a href="#/kafka/outbox">outbox pattern</a>.
      </p>

      <h2>Checklist</h2>
      <Table
        head={['Check', 'Why']}
        rows={[
          ['Keep fsync = on and full_page_writes = on', 'Off means a crash can corrupt the cluster, not just lose recent commits'],
          ['Use synchronous_commit = off only per transaction, for data you can lose', 'e.g. metrics or session updates; never for payments or orders'],
          ['Size max_wal_size so that most checkpoints are timed', 'Requested checkpoints cause I/O bursts and extra full-page images'],
          ['Consider wal_compression = lz4 or zstd', 'Page images compress well; recorded here to less than half'],
          ['Put pg_wal on fast, reliable storage and watch its size', 'Every commit waits for it; a full pg_wal stops the server'],
          ['Treat “connection lost during COMMIT” as “outcome unknown”', 'The commit may have succeeded; retries must be idempotent'],
        ]}
      />

      <Recap
        points={[
          'COMMIT flushes the WAL, not the data pages; data pages follow later, never before their WAL.',
          'An LSN is a byte position in the WAL; every page remembers the LSN of its last change, so replay skips what is already there.',
          'The first change to a page after a checkpoint logs the whole page — most of the WAL right after a checkpoint is page images.',
          'Checkpoints come from checkpoint_timeout or max_wal_size; frequent requested checkpoints mean max_wal_size is too small.',
          'synchronous_commit = off loses the last fraction of a second of acknowledged commits on a crash; group commit lets one fsync serve many commits.',
          'The same WAL feeds standbys, logical replication, CDC and the backup archive.',
        ]}
      />
    </>
  )
}
