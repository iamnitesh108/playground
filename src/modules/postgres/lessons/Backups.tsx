import type { ReactNode } from 'react'
import { BarChart, ByteLayout, Flow, StatTiles, Timeline, type ByteField } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList, Walkthrough } from '@/shared/ui'
import { BackupTimeline } from '../components/BackupTimeline'
import { OPS } from '../data/ops'

const b = OPS.backup
const time = (ts: string) => ts.slice(11, 19)
const fullStart = b.label.match(/START TIME: (.+)/)![1].replace(' UTC', '')
const [rowsLines, statusLine] = [b.result.split('\n').slice(0, -1).join('\n'), b.result.split('\n').at(-1)!]

const ARCHIVE_CONF = `# postgresql.conf (or ALTER SYSTEM) — archive_mode needs a restart
archive_mode = on
archive_command = 'test ! -f /backup/wal/%f && cp %p /backup/wal/%f'
summarize_wal = on          # PostgreSQL 17+: needed for incremental backups`

const PITR: { title: string; body: ReactNode; code: string }[] = [
  {
    title: `${time(b.label.match(/START TIME: (.+)/)![1].replace(' UTC', ''))} — full base backup`,
    body: <p><code>pg_basebackup</code> copies the whole data directory over a replication connection while the server keeps running. The table has one order.</p>,
    code: `${b.full}\n\n${b.label}`,
  },
  {
    title: 'Orders 2 and 3, then an incremental backup',
    body: <p>Two orders are inserted. An incremental backup then copies only the blocks that changed since the full one (PostgreSQL 17+).</p>,
    code: `$ pg_basebackup -D /backup/base/incr1 -c fast --incremental=/backup/base/full/backup_manifest\n${b.du}\n\n${b.verify}`,
  },
  {
    title: `${time(b.goodTime)} — the last good moment`,
    body: <p>Order 4 is committed. The database is in the state we will want back. Its time is noted (in practice you find it in logs afterwards).</p>,
    code: `$ psql -d shop -Atc "SELECT id, amount FROM app.orders ORDER BY id"\n${b.rows}`,
  },
  {
    title: `${time(b.accidentTime)} — DROP TABLE`,
    body: <p>Someone runs <code>DROP TABLE app.orders</code> in production. The table is gone — but the WAL describing everything up to and including the drop is archived.</p>,
    code: `$ psql -d shop -c 'DROP TABLE app.orders'\nDROP TABLE\n\n${b.walList}`,
  },
  {
    title: 'Restore the backups and configure recovery',
    body: (
      <p>
        Stop the server and move the damaged data directory aside. <code>pg_combinebackup</code> merges full + incremental into a new data
        directory. Recovery settings say where WAL comes from and where to stop; <code>recovery.signal</code> says “do archive recovery”.
      </p>
    ),
    code: `$ pg_ctlcluster 18 main stop\n$ mv /var/lib/postgresql/18/main /var/lib/postgresql/18/main.broken\n${b.combine}\n\n${b.recoveryConf}\n\n$ touch /var/lib/postgresql/18/main/recovery.signal\n$ pg_ctlcluster 18 main start`,
  },
  {
    title: 'Replay, stop before the DROP, promote',
    body: (
      <p>
        The server restores WAL segments from the archive, replays them, and stops <em>before the commit</em> of the transaction that dropped
        the table. The <code>cp: cannot stat</code> lines are normal: the server asks for files that may not exist (history files, the next
        segment).
      </p>
    ),
    code: b.log,
  },
  {
    title: 'The table is back, on timeline 2',
    body: (
      <p>
        All four orders are there. The server is out of recovery and starts a new <strong>timeline</strong>: its WAL from now on is named{' '}
        <code>00000002…</code>, so it can never be confused with the old history in which the table was dropped. The history file records the
        fork. <code>recovery.signal</code> was removed automatically; remove the recovery target settings too.
      </p>
    ),
    code: `$ psql -d shop -Atc "SELECT id, amount FROM app.orders ORDER BY id"\n${rowsLines}\n\n$ psql -Atc "SELECT pg_is_in_recovery(), (SELECT timeline_id FROM pg_control_checkpoint())"\n${statusLine}\n\n${b.history}`,
  },
]

/* ---- figures from the recording ---- */
const secs = (ts: string) => {
  const m = ts.match(/(\d\d):(\d\d):(\d\d(?:\.\d+)?)/)!
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}
const t0 = secs(fullStart)
const lastCommit = b.log.match(/last completed transaction was at log time \S+ (\S+)/)![1]
const dropCommit = b.log.match(/recovery stopping before commit of transaction (\d+), time \S+ (\S+)/)!
const stopLsn = b.log.match(/redo done at ([0-9A-F]+\/[0-9A-F]+)/)![1]
const redoLsn = b.log.match(/starting backup recovery with redo LSN ([0-9A-F]+\/[0-9A-F]+)/)![1]
const at = (ts: string) => Math.round((secs(ts) - t0) * 10) / 10
// The combined backup's checkpoint ("last known up at") is the incremental backup's start.
const incrStart = b.log.match(/last known up at \S+ (\S+) UTC/)![1]
const sizes = [...b.du.matchAll(/^(\d+)M\s+\S+\/(\w+)$/gm)].map((m) => ({ name: m[2], mb: Number(m[1]) }))
const archived = b.walList.split('\n').filter((l) => /^[0-9A-F]{24}$/.test(l))
const backupStarts = b.walList.split('\n').filter((l) => l.endsWith('.backup')).map((l) => l.slice(0, 24))
const segOf = (lsn: string) => Number.parseInt(lsn.split('/')[1].padStart(8, '0').slice(0, 2), 16)
const replayFrom = segOf(redoLsn)
const stopSeg = segOf(stopLsn)
const archiveFields: ByteField[] = archived.map((name) => {
  const n = Number.parseInt(name.slice(-2), 16)
  const start = backupStarts.indexOf(name)
  const role = n < replayFrom ? 'not needed' : n === stopSeg ? `replayed to ${stopLsn}, stop` : 'replayed'
  const what = start === 0 ? `full backup starts · ${role}` : start === 1 ? `incremental starts · ${role}` : role
  return { label: what, bytes: 16 * 1024 * 1024, hue: n < replayFrom ? 4 : n === stopSeg ? 8 : 6, content: `…${name.slice(-2)}` }
})
const archiveRows = [archiveFields.slice(0, 3), archiveFields.slice(3)].map((fields, i) => ({
  label: `timeline 1, segments ${i * 3 + 1}–${i * 3 + fields.length}`,
  fields,
}))

export default function Backups() {
  return (
    <>
      <LessonGoals
        goals={[
          'choose between logical dumps and physical backups',
          'set up WAL archiving, full and incremental base backups',
          'restore a database to a point in time, as recorded on a real server',
          'know what makes a backup trustworthy',
        ]}
        before={<a href="#/postgres/wal">WAL and crash recovery</a>}
      />

      <h2>Two kinds of backup</h2>
      <p>A backup is either a copy of the data as SQL (logical) or a copy of the database files plus the WAL that follows them (physical).</p>
      <TermList
        items={[
          { term: 'logical dump', definition: 'pg_dump: the SQL definitions and rows of one database, as of the moment the dump started.' },
          { term: 'base backup', definition: 'A copy of the whole data directory taken while the server runs (pg_basebackup).' },
          { term: 'WAL archive', definition: 'Every finished 16 MB WAL segment, copied somewhere safe by archive_command.' },
          { term: 'PITR', definition: 'Point-in-time recovery: restore a base backup, then replay archived WAL up to a chosen moment.' },
          { term: 'timeline', definition: 'A numbered history. Each recovery that opens for writes starts a new one, so old and new WAL never mix.' },
        ]}
      />
      <Table
        head={['', 'Logical: pg_dump', 'Physical: base backup + WAL archive']}
        rows={[
          ['contains', 'SQL definitions and data of one database', 'the files of the whole cluster, plus every WAL segment since'],
          ['restores to', 'the moment the dump started', 'any moment covered by the archived WAL'],
          ['restore into', 'any version ≥ the source; can pick tables', 'same major version, same platform'],
          ['speed for large databases', 'slow: rows are re-inserted, indexes rebuilt', 'fast: files are copied'],
          ['typical use', 'migrations, copies, small databases, extra safety', 'production disaster recovery'],
        ]}
      />
      <Callout tone="warn" title="A replica is not a backup">
        A standby replays every change — including <code>DROP TABLE</code> — within milliseconds. It protects against a dead server, not
        against a mistake.
      </Callout>

      <h2>Logical: pg_dump</h2>
      <p>
        The custom format (<code>-Fc</code>) is compressed and lets <code>pg_restore</code> list, select and reorder objects. Roles are cluster-wide,
        so they are not in a database dump; <code>pg_dumpall --globals-only</code> exports them. All recorded:
      </p>
      <CodeBlock language="text" title="recorded" code={`$ pg_dump -Fc -d shop -f /backup/shop.dump\n${b.dumpList}`} />
      <CodeBlock language="text" title="recorded (password hash shortened)" code={b.globals} />
      <CodeBlock language="text" title="recorded: restore into a new database" code={b.copy} />

      <h2>Physical: base backups and the WAL archive</h2>
      <p>
        A <strong>base backup</strong> is a copy of the data directory taken while the server runs. On its own it is inconsistent — pages
        changed during the copy. Replaying the WAL from the backup’s start fixes that (it is the same crash recovery as in <a href="#/postgres/wal">WAL and crash recovery</a>), and
        replaying further moves the database forward in time. So the server must <strong>archive</strong> every finished WAL segment:
      </p>
      <Flow
        title="Continuous archiving: two streams of files leave the server"
        cols={4}
        rows={2}
        nodes={[
          { id: 'pg', label: 'PostgreSQL', sub: 'primary', col: 0, row: 0, rowSpan: 2, hue: 3 },
          { id: 'wal', label: 'pg_wal/', sub: 'current segments', col: 1, row: 0, hue: 4, shape: 'log' },
          { id: 'arch', label: 'WAL archive', sub: 'every segment', col: 3, row: 0, hue: 4, shape: 'store' },
          { id: 'bb', label: 'pg_basebackup', sub: 'full / incremental', col: 1, row: 1, hue: 6 },
          { id: 'base', label: 'base backups', sub: 'data directory copies', col: 3, row: 1, hue: 6, shape: 'store' },
        ]}
        edges={[
          { from: 'pg', to: 'wal', hue: 4, flow: true },
          { from: 'wal', to: 'arch', label: 'archive_command', hue: 4, flow: true },
          { from: 'pg', to: 'bb', hue: 6 },
          { from: 'bb', to: 'base', label: 'nightly, say', hue: 6 },
        ]}
        caption="A restore needs one base backup and every archived segment from that backup’s start to the target — a single gap ends the chain."
      />
      <CodeBlock language="ini" title="settings" code={ARCHIVE_CONF} />
      <CodeBlock language="text" title="recorded" code={b.archive} />
      <p>
        <code>archive_command</code> runs for each 16 MB segment once it is complete; the segment is only recycled after the command succeeded.
        It must fail if the file already exists (so a mistake never overwrites good WAL) — real setups use a tool such as pgBackRest, Barman or
        WAL-G, which also compress, encrypt and upload. Check <code>pg_stat_archiver</code>: <code>{b.archived}</code> is{' '}
        <code>archived_count | last_archived_wal | failed_count</code>.
      </p>

      <Predict
        question={
          <p>
            At {time(b.accidentTime)} someone drops a table. You have a full base backup from {time(b.label.match(/START TIME: (.+)/)![1].replace(' UTC', ''))}{' '}
            and the WAL archive. What can you get back?
          </p>
        }
        options={['Only the table as it was at the backup', 'The table as it was just before the drop', 'Nothing: the drop is in the WAL too']}
        answer={1}
        explanation="Recovery replays the archived WAL from the backup forward and can stop at any point — here, just before the commit of the DROP. Recorded, step by step:"
      />

      <Walkthrough title="Undoing a DROP TABLE with point-in-time recovery" steps={PITR} intervalMs={6000}>
        {(i) => <CodeBlock language="text" title="recorded" code={PITR[i].code} />}
      </Walkthrough>

      <h3>The recording as pictures</h3>
      <Timeline
        title={`Recorded: seconds after the full backup started (${fullStart.slice(11)} UTC)`}
        lanes={[
          { id: 'primary', label: 'production' },
          { id: 'restore', label: 'restored copy' },
        ]}
        segments={[
          { lane: 'primary', from: 0, to: at(dropCommit[2]), label: 'writes', hue: 4 },
          { lane: 'restore', from: 0, to: at(incrStart), label: 'from backups', hue: 3 },
          { lane: 'restore', from: at(incrStart), to: at(b.goodTime), label: 'WAL replayed', hue: 6 },
          { lane: 'restore', from: at(b.goodTime), to: at(dropCommit[2]), label: 'skipped', hue: 8, striped: true },
        ]}
        events={[
          { lane: 'primary', at: 0, label: 'full backup', hue: 3 },
          { lane: 'primary', at: at(incrStart), label: 'incremental', hue: 3 },
          { lane: 'primary', at: at(lastCommit), label: 'order 4', hue: 1 },
          { lane: 'primary', at: at(dropCommit[2]), label: 'DROP TABLE', hue: 8 },
          { lane: 'restore', at: at(b.goodTime), label: 'target', hue: 6 },
        ]}
        end={Math.ceil(at(dropCommit[2])) + 1}
        unit="s"
      />
      <ByteLayout
        title="Recorded: the WAL archive, one block per 16 MB segment"
        rows={archiveRows}
        caption={`Recovery started from the incremental backup’s redo point ${redoLsn} and stopped inside segment …${stopSeg.toString(16).padStart(2, '0').toUpperCase()}, before the commit of transaction ${dropCommit[1]} (the DROP). Earlier segments were not needed.`}
      />
      <BarChart
        title="Recorded: the two base backups the restore combined (du -sh)"
        unit=" MB"
        bars={sizes.map((s) => ({ label: s.name === 'full' ? 'full base backup' : 'incremental (changed blocks only)', value: s.mb, hue: 3 }))}
      />
      <StatTiles
        stats={[
          { label: 'last transaction kept', value: lastCommit.slice(0, 8), sub: 'order 4, from the server log', hue: 6 },
          { label: 'recovery stopped at', value: stopLsn, sub: `before transaction ${dropCommit[1]} committed`, hue: 8 },
          { label: 'recovery took', value:`${Math.round((secs(b.log.match(/^(\S+) UTC.*ready to accept connections$/m)![1]) - secs(b.log.split('\n')[0])) * 1000)} ms`, sub: 'start to ready; two segments replayed', hue: 4 },
        ]}
      />
      <Flow
        title="After the restore, history forks"
        cols={4}
        rows={2}
        nodes={[
          { id: 's5', label: '…05', sub: 'timeline 1', col: 0, row: 0, hue: 4, shape: 'log' },
          { id: 's6', label: '…06', sub: `fork at ${stopLsn}`, col: 1, row: 0, hue: 4, shape: 'log' },
          { id: 'old', label: 'DROP TABLE', sub: 'old history, ignored', col: 2, row: 0, span: 2, hue: 8 },
          { id: 'new', label: '00000002…', sub: 'timeline 2: new WAL', col: 2, row: 1, span: 2, hue: 6, shape: 'log' },
        ]}
        edges={[
          { from: 's5', to: 's6', hue: 4 },
          { from: 's6', to: 'old', hue: 8, dashed: true },
          { from: 's6', to: 'new', hue: 6, flow: true },
        ]}
        caption="00000002.history records the fork point. Recovery and standbys follow the newest timeline, so the dropped table never comes back by accident."
      />

      <h2>Choose the target yourself</h2>
      <p>Recovery can stop anywhere the archive covers; what you get depends on the target and on which segments exist.</p>
      <BackupTimeline />
      <p>
        Recovery starts from the newest base backup before the target, so recent backups shorten replay and make older WAL unnecessary. A
        missing segment between that backup and the target makes the target unreachable — PostgreSQL stops with an error rather than skip it.
      </p>

      <h2>Targets and options</h2>
      <p>Recovery settings say where to stop and what to do when the target is reached.</p>
      <Table
        head={['Setting', 'Meaning']}
        rows={[
          ['recovery_target_time', 'stop at a timestamp (give the time zone)'],
          ['recovery_target_xid / _lsn / _name', 'stop at a transaction id, a WAL position, or a point created with pg_create_restore_point()'],
          ['recovery_target = \'immediate\'', 'stop as soon as the backup is consistent'],
          ['recovery_target_inclusive', 'on (default): stop just after the target; off: just before it'],
          ['recovery_target_action', 'pause (default): stay read-only so you can check; promote: open for writes; shutdown'],
          ['(no target)', 'replay all archived WAL — the normal disaster recovery'],
        ]}
      />
      <Callout tone="tip" title="Restore somewhere else first">
        Restoring over production loses everything written after the target. Usually you restore to a separate server, check it, and copy the
        lost data back — or switch over if the original is gone.
      </Callout>

      <h2>Checklist: a backup you have not restored is a hope</h2>
      <p>A backup is only proven by restoring it.</p>
      <ul>
        <li>Restore regularly into a scratch server, automatically, and run a query that proves the data is there.</li>
        <li>Verify backups: <code>pg_verifybackup</code> checks every file against the backup manifest.</li>
        <li>Alert on <code>pg_stat_archiver.failed_count</code> and on the age of the last archived segment — a broken archive silently ends your ability to do PITR.</li>
        <li>Keep backups off the database server, ideally in another location, and keep enough base backups to cover your retention period.</li>
        <li>Write down how long a restore takes. That number, not the backup schedule, is what the business experiences.</li>
      </ul>

      <Recap
        points={[
          'pg_dump: a logical copy of one database at one moment. Base backup + WAL archive: the whole cluster at any moment.',
          'archive_command must succeed for every segment; monitor pg_stat_archiver.',
          'PITR = restore a base backup, set restore_command and a target, create recovery.signal, start. A new timeline begins.',
          'Incremental backups (PostgreSQL 17+) copy changed blocks; pg_combinebackup rebuilds a full data directory.',
          'Test restores; replicas are not backups.',
        ]}
      />
    </>
  )
}
