import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { WalPlayground } from '../components'
import { CAPTURE } from '../data/captures'
import type { WalCapture } from '../data/types'

export default function Wal() {
  const insert = CAPTURE.wal.find((w) => w.label === 'insert')!
  const checkpoint = CAPTURE.wal.find((w) => w.label === 'checkpoint')!
  const rows = (w: WalCapture) =>
    w.records.map((r) => [<code key="lsn">{r.start_lsn}</code>, `${r.resource_manager} / ${r.record_type}`, r.xid === '0' ? '—' : r.xid, r.description])

  return (
    <>
      <LessonGoals
        goals={[
          'state the write-ahead rule and why COMMIT is fast',
          'read real WAL records and LSNs',
          'crash a database and recover it, step by step',
          'connect the WAL to replication and change data capture',
        ]}
        before="Lesson 1 — the path of a commit"
      />

      <h2>Log first, data later</h2>
      <p>
        Writing every changed 8 KB page to its place on disk at every commit would be slow: scattered random writes. Instead PostgreSQL appends a
        short description of each change to one sequential file, the <strong>write-ahead log (WAL)</strong>, and writes data pages later. Two rules
        make this safe:
      </p>
      <ol>
        <li><strong>COMMIT</strong> returns only after the WAL up to its commit record is flushed to disk.</li>
        <li>A changed data page may be written to disk only after the WAL describing that change is on disk — <em>write-ahead</em>.</li>
      </ol>
      <p>
        Each record has a position in the log, its <strong>LSN</strong> (log sequence number, shown as <code>0/1D2E8D0</code>). Every page stores
        the LSN of the last record that changed it.
      </p>

      <h2>What one INSERT writes</h2>
      <p>
        Recorded with <code>pg_walinspect</code> for <code>{insert.sql}</code> on the <code>accounts</code> table:
      </p>
      <Table head={['LSN', 'Record', 'xid', 'Description']} rows={rows(insert)} />
      <p>
        One record for the row in the heap, one for the new entry in the primary-key index, and the commit record. The commit record is what
        makes transaction {insert.records[0].xid} committed; without it, the other two records count for nothing.
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
            the tuple is invisible (MVCC, lesson 2). Try it below: update, write the page, crash, recover.
          </>
        }
      />

      <WalPlayground />
      <p>
        Things to try: commit, then crash before any page is written — recovery replays the change. Update without committing, checkpoint, then
        crash — the page on disk holds the new value, but it stays invisible. During replay, records older than a page’s LSN are
        skipped, so replay can safely repeat.
      </p>
      <Callout tone="note" title="Simplified">
        The simulator keeps the rules and drops details: one row per key, no commit log file, and no <em>full-page images</em> — PostgreSQL writes
        a whole page into the WAL the first time it changes after a checkpoint (<code>full_page_writes</code>), so a page torn by a crash mid-write
        can be restored.
      </Callout>

      <h2>Checkpoints</h2>
      <p>
        Without checkpoints, recovery would replay the WAL from the beginning of time. A <strong>checkpoint</strong> writes all dirty pages and
        records a <em>redo point</em>: recovery starts there, and older WAL files can be recycled. The recorded <code>CHECKPOINT</code>:
      </p>
      <Table head={['LSN', 'Record', 'xid', 'Description']} rows={rows(checkpoint)} />
      <Table
        head={['Setting', 'Default', 'Effect']}
        rows={[
          ['checkpoint_timeout', '5min', 'Start a checkpoint at least this often'],
          ['max_wal_size', '1GB', 'Start one earlier if this much WAL accumulated'],
          ['checkpoint_completion_target', '0.9', 'Spread the writes over 90% of the interval, to avoid I/O spikes'],
        ]}
      />
      <p>
        Longer intervals mean less write I/O (fewer full-page images) but longer crash recovery. A log message “checkpoints are occurring too
        frequently” means <code>max_wal_size</code> is too small for the write load.
      </p>

      <h2>The WAL is also a stream of changes</h2>
      <p>Because the WAL describes every change in order, other servers can follow it:</p>
      <Table
        head={['', 'Physical replication', 'Logical decoding']}
        rows={[
          ['Sends', 'WAL records as they are: page changes', 'Row changes: INSERT / UPDATE / DELETE with column values'],
          ['Needs', 'wal_level = replica (the default)', 'wal_level = logical'],
          ['Receiver', 'A standby: an exact, read-only copy of the whole cluster', 'Subscriptions, or tools such as Debezium that publish to Kafka'],
          ['Position tracked by', 'the standby (optionally a physical slot)', 'a logical replication slot'],
        ]}
      />
      <Callout tone="warn" title="Replication slots keep WAL">
        A slot guarantees that the server keeps all WAL its consumer has not confirmed yet. If the consumer stops — a CDC connector deleted without
        dropping its slot, for example — WAL piles up in <code>pg_wal/</code> until the disk is full. Monitor{' '}
        <code>pg_replication_slots</code> and set <code>max_slot_wal_keep_size</code>.
      </Callout>
      <p>
        This is exactly what powers change data capture: see the <a href="#/kafka/debezium">Debezium lesson</a> in the Kafka module, and the{' '}
        <a href="#/kafka/outbox">outbox pattern</a>.
      </p>

      <Recap
        points={[
          'COMMIT flushes the WAL, not the data pages; data pages follow later, never before their WAL.',
          'Every WAL record has an LSN; every page remembers the LSN of its last change, so replay skips what is already there.',
          'After a crash, the WAL is replayed from the last checkpoint’s redo point; transactions without a commit record stay invisible.',
          'The same WAL feeds standbys (physical) and change data capture (logical decoding through slots).',
        ]}
      />
    </>
  )
}
