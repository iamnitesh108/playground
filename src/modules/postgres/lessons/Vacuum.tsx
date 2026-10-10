import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { SessionPlayer } from '../components'
import { CAPTURE } from '../data/captures'
import type { WalCapture } from '../data/types'
import { scenario } from './frames'

const frames = scenario('vacuum')

const NOTES = [
  <>
    An UPDATE of row 1 (each statement here is its own transaction). The new version goes to lp 3, and it is a <strong>HOT</strong> update
    (heap-only tuple): lp 1 is flagged <em>HOT updated</em>, lp 3 <em>heap-only</em>. The primary-key index still points only at lp 1; a
    lookup lands there and follows the <code>ctid</code> chain to lp 3.
  </>,
  <>A second update of row 1. The chain grows: lp 1 → lp 3 → lp 4. Still no index change — the index has one entry for row 1, pointing at lp 1.</>,
  <>
    Row 2 is deleted: lp 2 gets an <code>xmax</code>. The page now holds four tuples, of which only lp 4 is live. lp 1, lp 2 and lp 3 are{' '}
    <strong>dead</strong> — every transaction that could see them has finished.
  </>,
  <>
    <code>VACUUM</code> cleans the page. lp 3 had no index entry, so it becomes <strong>unused</strong> at once. lp 2’s index entry is deleted
    first, then lp 2 becomes unused too. lp 1 cannot be freed — the index still points at it — so it becomes a <strong>redirect</strong> to the
    live version, lp 4. The tuple bytes of all three are gone.
  </>,
  <>
    A new row is inserted. It <strong>reuses lp 2</strong> and the freed space: the table file did not grow. This is the point of vacuum —
    space is recycled inside the table.
  </>,
]

export default function Vacuum() {
  const updateKey = CAPTURE.wal.find((w) => w.label === 'update-key')!
  const hot = CAPTURE.wal.find((w) => w.label === 'hot-update')!
  const records = (w: WalCapture) => w.records.map((r) => `${r.resource_manager.padEnd(12)}${r.record_type.padEnd(14)}${r.description}`).join('\n')

  return (
    <>
      <LessonGoals
        goals={[
          'explain what a dead tuple is and why it stays on the page',
          'recognise a HOT update and the condition for it',
          'see VACUUM turn line pointers into redirect and unused',
          'know why autovacuum and freezing must never be turned off',
        ]}
        before="Lesson 2 — xmin, xmax and ctid"
      />

      <h2>Dead tuples</h2>
      <p>
        After an UPDATE or DELETE commits, the old version still sits on the page. Once no running transaction can still see it, it is{' '}
        <strong>dead</strong>: it takes space and slows scans down, but nothing will ever read it. <strong>VACUUM</strong> finds dead tuples,
        removes their index entries and frees their space for new rows.
      </p>

      <Predict
        question={<p>After VACUUM removes dead tuples from a page, what happens to the table’s file on disk?</p>}
        options={['It shrinks', 'It stays the same size; the space is reused by new rows', 'It is rewritten']}
        answer={1}
        explanation={
          <>
            Plain VACUUM marks space as free inside the pages (and only truncates completely empty pages at the very end of the file). New rows
            then fill that space. Watch a page go through it:
          </>
        }
      />

      <SessionPlayer title="HOT updates, a delete, and VACUUM on one page" frames={frames} columns={['id', 'balance']} notes={NOTES} />

      <h2>HOT: updates that skip the indexes</h2>
      <p>
        Normally every new version needs a new entry in <em>every</em> index of the table. A <strong>HOT update</strong> avoids that when two
        conditions hold:
      </p>
      <ul>
        <li>no indexed column changed, and</li>
        <li>the new version fits on the <strong>same page</strong>.</li>
      </ul>
      <p>The WAL shows the difference. A HOT update of <code>balance</code> writes one heap record; changing the primary key also writes an index record:</p>
      <CodeBlock title={hot.sql} code={records(hot)} />
      <CodeBlock title={updateKey.sql} code={records(updateKey)} />
      <Callout tone="tip" title="Leave room for HOT">
        For tables that are updated a lot, a lower <code>fillfactor</code> (e.g. <code>ALTER TABLE … SET (fillfactor = 90)</code>) leaves free
        space in each page, so updated versions stay on the same page. Fewer indexes also mean more HOT updates.
      </Callout>

      <h2>Autovacuum</h2>
      <p>
        You rarely run VACUUM by hand. The <strong>autovacuum launcher</strong> starts workers for tables whose dead tuples exceed a threshold:
      </p>
      <CodeBlock
        title="when a table is vacuumed (defaults)"
        code={`dead tuples > autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor × rows
             =        50                    +              0.2               × rows
(capped by autovacuum_vacuum_max_threshold = 100,000,000 since PostgreSQL 18)`}
      />
      <p>
        Autovacuum also runs <code>ANALYZE</code> (statistics for the planner) and sets bits in the <strong>visibility map</strong>, which marks
        pages whose tuples are all visible — that is what lets an index-only scan skip the table (lesson 7).
      </p>

      <h2>Freezing: why vacuum is not optional</h2>
      <p>
        xids are 32-bit and wrap around. Comparisons are done in a circle, so a transaction can only tell “older” from “newer” for about 2 billion
        xids. Old tuples must therefore be <strong>frozen</strong> — marked as visible to everyone, independent of their xmin — before they
        drift out of that window.
      </p>
      <Table
        head={['Setting', 'Default', 'Meaning']}
        rows={[
          ['autovacuum_freeze_max_age', '200 million', 'A table whose oldest unfrozen xid is this old gets an aggressive (anti-wraparound) vacuum, even if autovacuum is disabled for it'],
          ['vacuum_freeze_min_age', '50 million', 'Tuples older than this are frozen when vacuum visits their page'],
        ]}
      />
      <Callout tone="warn" title="Things that stop vacuum">
        Vacuum can only remove tuples that <em>no</em> transaction can see. A transaction left open for hours — an idle session after{' '}
        <code>BEGIN</code>, an abandoned replication slot, a long report — holds back cleanup for the whole database, and tables bloat. Watch{' '}
        <code>pg_stat_activity</code> for old <code>xact_start</code> and set <code>idle_in_transaction_session_timeout</code>.
      </Callout>
      <p>
        <code>VACUUM FULL</code> rewrites the table into a new, compact file, but holds an exclusive lock the whole time: nothing can read or write
        the table. It is a repair tool, not routine maintenance.
      </p>

      <Recap
        points={[
          'Old versions stay on the page until VACUUM; a dead tuple is one no transaction can see any more.',
          'HOT updates (no indexed column changed, same page) add no index entries; the index points at the chain’s head.',
          'VACUUM turns freed line pointers into unused (or redirect, for the head of a HOT chain) and reuses the space; it does not shrink the file.',
          'Vacuum also freezes old tuples; if it falls too far behind, the server stops assigning new xids (refuses writes) to prevent wraparound.',
        ]}
      />
    </>
  )
}
