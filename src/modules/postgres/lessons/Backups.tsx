import type { ReactNode } from 'react'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Walkthrough } from '@/shared/ui'
import { BackupTimeline } from '../components'
import { OPS } from '../data/ops'

const b = OPS.backup
const time = (ts: string) => ts.slice(11, 19)
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
    code: `${b.du}\n\n${b.verify}`,
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
        before="Lesson 8 — WAL and crash recovery"
      />

      <h2>Two kinds of backup</h2>
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
      <CodeBlock title="recorded" code={`$ pg_dump -Fc -d shop -f /backup/shop.dump\n${b.dumpList}`} />
      <CodeBlock title="recorded (password hash shortened)" code={b.globals} />
      <CodeBlock title="recorded: restore into a new database" code={b.copy} />

      <h2>Physical: base backups and the WAL archive</h2>
      <p>
        A <strong>base backup</strong> is a copy of the data directory taken while the server runs. On its own it is inconsistent — pages
        changed during the copy. Replaying the WAL from the backup’s start fixes that (it is the same crash recovery as in lesson 8), and
        replaying further moves the database forward in time. So the server must <strong>archive</strong> every finished WAL segment:
      </p>
      <CodeBlock title="settings" code={ARCHIVE_CONF} />
      <CodeBlock title="recorded" code={b.archive} />
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
        {(i) => <CodeBlock title="recorded" code={PITR[i].code} />}
      </Walkthrough>

      <h2>Choose the target yourself</h2>
      <BackupTimeline />
      <p>
        Recovery starts from the newest base backup before the target, so recent backups shorten replay and make older WAL unnecessary. A
        missing segment between that backup and the target makes the target unreachable — PostgreSQL stops with an error rather than skip it.
      </p>

      <h2>Targets and options</h2>
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

      <h2>A backup you have not restored is a hope</h2>
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
