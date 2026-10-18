import { BarChart, Flow, Proportion, StatTiles, Timeline, type FlowNode } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { SessionPlayer } from '../components'
import { HeapPageViewMap } from '../components/HeapPageViewMap'
import { VacuumAutovacuumCalc } from '../components/VacuumAutovacuumCalc'
import { VacuumXidCircle } from '../components/VacuumXidCircle'
import { CAPTURE } from '../data/captures'
import { INTERNALS } from '../data/internals'
import type { WalCapture } from '../data/types'
import { hex4, infomaskFlags } from '../simulation/mvccVisibility'
import { DEFAULTS, vacuumThreshold } from '../simulation/vacuumThresholds'
import { scenario } from './frames'

const frames = scenario('vacuum')
const V = INTERNALS.vacuum

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

const records = (w: WalCapture) => w.records.map((r) => `${r.resource_manager.padEnd(12)}${r.record_type.padEnd(14)}${r.description}`).join('\n')
const updateKey = CAPTURE.wal.find((w) => w.label === 'update-key')!
const hot = CAPTURE.wal.find((w) => w.label === 'hot-update')!

// page pruning, recorded: the HOT chain of row 1 before and after a plain SELECT
interface Item {
  lp: number
  lp_flags: number
  lp_off: number
  lp_len: number
  xmin: string | null
  xmax: string | null
  ctid: string | null
}
interface PageState {
  items: readonly Item[]
  free: number
}
const header = (items: readonly Item[], free: number) => {
  const lower = 24 + items.length * 4
  return { lower, upper: lower + free }
}
const toMap = (items: readonly Item[], deadXmax: (t: Item) => boolean) =>
  items.filter((t) => t.lp_flags === 1).map((t) => ({ lp: t.lp, off: t.lp_off, len: t.lp_len, state: deadXmax(t) ? ('dead' as const) : undefined, hoff: 24 }))
const before: PageState = V.pruneBefore
const after: PageState = V.pruneAfter
const chainLps: number[] = []
for (let lp: number | undefined = 1; lp; ) {
  const t: Item | undefined = before.items.find((x) => x.lp === lp)
  if (!t) break
  chainLps.push(lp)
  const next = Number(t.ctid?.match(/,(\d+)\)/)?.[1])
  lp = next !== lp ? next : undefined
}
const redirect = after.items.find((t) => t.lp_flags === 2)!
const unused = after.items.filter((t) => t.lp_flags === 0).map((t) => t.lp)
const CHAIN_NODES: FlowNode[] = [
  { id: 'idx', label: 'index entry', sub: 'id = 1 → (0,1)', col: 0, row: 0, hue: 7 },
  ...chainLps.map((lp, i) => {
    const t = before.items.find((x) => x.lp === lp)!
    return { id: `lp${lp}`, label: `lp ${lp}`, sub: t.xmax === '0' ? 'live' : `dead · xmax ${t.xmax}`, col: i + 1, row: 0, hue: (t.xmax === '0' ? 6 : 8) as 6 | 8 }
  }),
]

const [hot100, hot90] = V.hot
const pct = (n: number, of: number) => `${Math.round((n / of) * 100)} %`
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
const bloat = V.bloat
const av = V.autovacuum
const thresholdAt = (reltuples: number) => vacuumThreshold(reltuples)
const num = (text: string, re: RegExp) => Number(text.match(re)?.[1] ?? 0)
const notRemovable = num(V.held.blocked, /(\d+) are dead but not yet removable/)
const removedLater = num(V.held.released, /tuples: (\d+) removed/)
const fb = V.freezeBefore
const fa = V.freezeAfter
const setting = (n: string) => Number(V.settings.find((s) => s.name === n)!.setting)

export default function Vacuum() {
  return (
    <>
      <LessonGoals
        goals={[
          'explain what a dead tuple is and why it stays on the page',
          'recognise a HOT update, and see a page pruned without VACUUM',
          'follow VACUUM through its phases and measure bloat before and after VACUUM and VACUUM FULL',
          'compute when autovacuum picks a table, and tune it per table',
          'explain freezing and xid wraparound, and what stops vacuum from working',
        ]}
        before={<>xmin, xmax, ctid and snapshots from <a href="#/postgres/mvcc">Rows are versions (MVCC)</a></>}
      />

      <h2>Dead tuples</h2>
      <p>
        A dead tuple is an old row version that no transaction can see any more, yet it still takes space on the page.
      </p>
      <p>
        After an UPDATE or DELETE commits, the old version stays where it was. Once every snapshot that could see it is gone, it is dead: it
        slows scans down and nothing will ever read it. <strong>VACUUM</strong> finds dead tuples, removes their index entries and frees their
        space for new rows.
      </p>
      <TermList
        items={[
          { term: 'dead tuple', definition: 'A version deleted (or replaced) by a committed transaction older than every running snapshot.' },
          { term: 'bloat', definition: 'Space in a table or index taken by dead tuples or left empty after vacuum.' },
          { term: 'HOT update', definition: 'Heap-only tuple: an update that adds no index entries because no indexed column changed and the new version fits on the same page.' },
          { term: 'pruning', definition: 'Cleaning dead versions inside one page while reading it — no VACUUM needed.' },
          { term: 'freezing', definition: 'Marking old tuples as visible to every transaction, so their xmin no longer matters.' },
        ]}
      />

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
      <p>Normally every new version needs a new entry in every index of the table; a HOT update avoids that.</p>
      <p>Two conditions: no column used by any index changed, and the new version fits on the same page. The WAL shows the difference:</p>
      <CodeBlock title={`recorded (pg_walinspect): ${hot.sql}`} language="text" code={records(hot)} />
      <CodeBlock title={`recorded (pg_walinspect): ${updateKey.sql}`} language="text" code={records(updateKey)} />
      <p>The HOT update wrote one heap record; changing the key also wrote an index record — and would for every index on the table.</p>
      <Flow
        title="Recorded: a HOT chain after three updates of row 1"
        cols={chainLps.length + 1}
        rows={1}
        nodes={CHAIN_NODES}
        edges={[
          { from: 'idx', to: `lp${chainLps[0]}`, hue: 7 },
          ...chainLps.slice(1).map((lp, i) => ({ from: `lp${chainLps[i]}`, to: `lp${lp}`, label: 'ctid', hue: 3 as const })),
        ]}
        caption="The index knows only the head of the chain. A lookup lands on lp 1 and follows ctid links on the same page to the version it may see."
      />
      <h3>Pruning: cleaning a page while reading it</h3>
      <p>
        When a page is nearly full, the next query that reads it <strong>prunes</strong> it: dead versions of HOT chains are removed and the
        tuples are compacted. Recorded — the page before, and after one plain <code>SELECT</code>:
      </p>
      <div>
        <HeapPageViewMap
          title={`Before: ${before.free} bytes free, the chain lp ${chainLps.join(' → lp ')}`}
          lower={header(before.items, before.free).lower}
          upper={header(before.items, before.free).upper}
          tuples={toMap(before.items, (t) => t.xmax !== '0')}
        />
        <HeapPageViewMap
          title={`After SELECT: ${after.free} bytes free — lp ${redirect.lp} redirects to lp ${redirect.lp_off}, lp ${unused.join(' and ')} unused`}
          lower={header(after.items, after.free).lower}
          upper={header(after.items, after.free).upper}
          tuples={toMap(after.items, () => false)}
          emptyPointers={unused.length + 1}
          caption="Pruning keeps lp 1 as a redirect because the index points at it; the dead versions’ bytes are gone and the remaining tuples were moved together."
        />
      </div>
      <p>
        Pruning frees space inside the page, but not line pointers referenced by indexes and not index entries: those still need VACUUM. With
        HOT plus pruning, a table updated in place can run for a long time without growing.
      </p>
      <StatTiles
        title={`Recorded: ${hot100.upd.toLocaleString()} updates of a non-indexed column (10 rounds over 20,000 rows)`}
        stats={[
          { label: 'HOT, fillfactor 100', value: pct(hot100.hot, hot100.upd), sub: `${hot100.newpage.toLocaleString()} updates moved to another page`, hue: 8, bar: { value: hot100.hot, max: hot100.upd } },
          { label: 'HOT, fillfactor 90', value: pct(hot90.hot, hot90.upd), sub: `${hot90.newpage.toLocaleString()} moved`, hue: 6, bar: { value: hot90.hot, max: hot90.upd } },
          { label: 'index growth, fillfactor 100', value: `+${Math.round((hot100.after.indexes - hot100.before.indexes) / 1024)} kB`, sub: 'every non-HOT update adds entries to both indexes', hue: 7 },
          { label: 'index growth, fillfactor 90', value: `+${Math.round((hot90.after.indexes - hot90.before.indexes) / 1024)} kB`, hue: 7 },
        ]}
      />
      <CodeBlock title="recorded: pg_stat_user_tables" language="text" code={V.hotText} />
      <Callout tone="tip" title="Getting more HOT updates">
        Leave room on the page (<code>fillfactor</code> 80–90 for update-heavy tables), do not index columns that change often unless queries need
        it, and watch <code>n_tup_hot_upd</code> / <code>n_tup_upd</code> in <code>pg_stat_user_tables</code>. Since PostgreSQL 16,{' '}
        <code>n_tup_newpage_upd</code> counts the updates that had to go to another page.
      </Callout>

      <h2>What VACUUM does</h2>
      <p>VACUUM visits the pages that may need it, removes dead tuples from the table and its indexes, and records what it learned.</p>
      <Flow
        title="The phases of one VACUUM"
        cols={4}
        rows={2}
        nodes={[
          { id: 'scan', label: '1. scan heap', sub: 'prune, collect dead TIDs', col: 0, row: 0, hue: 3 },
          { id: 'idx', label: '2. vacuum indexes', sub: 'delete their entries', col: 1, row: 0, hue: 7 },
          { id: 'heap', label: '3. vacuum heap', sub: 'line pointers → unused', col: 2, row: 0, hue: 3 },
          { id: 'trunc', label: '4. truncate', sub: 'empty pages at the end', col: 3, row: 0, hue: 4 },
          { id: 'maps', label: 'free space map', sub: 'room per page', col: 1, row: 1, hue: 5, shape: 'store' },
          { id: 'vm', label: 'visibility map', sub: 'all-visible / all-frozen', col: 2, row: 1, hue: 5, shape: 'store' },
          { id: 'stats', label: 'statistics', sub: 'n_dead_tup, relfrozenxid', col: 3, row: 1, hue: 7, shape: 'store' },
        ]}
        edges={[
          { from: 'scan', to: 'idx', hue: 3 },
          { from: 'idx', to: 'heap', hue: 7 },
          { from: 'heap', to: 'trunc', hue: 3 },
          { from: 'heap', to: 'maps', hue: 5, dashed: true },
          { from: 'scan', to: 'vm', hue: 5, dashed: true },
          { from: 'trunc', to: 'stats', hue: 7, dashed: true },
        ]}
        steps={[
          { title: '1. Scan the heap', body: <p>Pages the visibility map marks all-visible are skipped. Each other page is pruned and its dead tuples’ addresses (TIDs) are collected in memory; old tuples are frozen and pages that are now clean are marked in the visibility map.</p>, active: ['scan', 'vm', 'scan>vm'] },
          { title: '2. Vacuum every index', body: <p>Each index is scanned once and every entry pointing at a collected TID is deleted. This is usually the most expensive phase — and the reason a table with many indexes vacuums slowly.</p>, active: ['scan', 'idx', 'scan>idx'] },
          { title: '3. Vacuum the heap again', body: <p>Only now can the dead line pointers become unused: no index entry points at them any more. The free space is recorded in the FSM.</p>, active: ['idx', 'heap', 'maps', 'idx>heap', 'heap>maps'] },
          { title: '4. Truncate and report', body: <p>Completely empty pages at the end of the file are cut off (this needs a short exclusive lock). relfrozenxid, n_dead_tup and the last-vacuum time are updated.</p>, active: ['heap', 'trunc', 'stats', 'heap>trunc', 'trunc>stats'] },
        ]}
      />
      <CodeBlock title="recorded: VACUUM (VERBOSE) after updating all 100,000 rows" language="text" code={V.vacuumVerbose} />

      <h2>Bloat, measured</h2>
      <p>Every row of a 100,000-row table was updated once, then the table was vacuumed, then rewritten with VACUUM FULL.</p>
      <BarChart
        title="Recorded: table size (pgstattuple)"
        bars={bloat.map((b) => ({ label: b.label, value: b.bytes, display: `${mb(b.bytes)} · ${b.pages.toLocaleString()} pages`, hue: (b.dead_tuple_percent > 0 ? 8 : b.free_percent > 20 ? 4 : 6) as 4 | 6 | 8 }))}
      />
      {bloat.slice(1, 3).map((b) => (
        <Proportion
          key={b.label}
          title={`Recorded: what the table’s bytes hold, ${b.label}`}
          parts={[
            { label: 'live tuples', value: b.tuple_percent, hue: 6, display: `${b.tuple_percent} %` },
            { label: 'dead tuples', value: b.dead_tuple_percent, hue: 8, display: `${b.dead_tuple_percent} %` },
            { label: 'free space', value: b.free_percent, hue: 4, display: `${b.free_percent} %` },
            { label: 'headers, pointers', value: Math.max(0, 100 - b.tuple_percent - b.dead_tuple_percent - b.free_percent), hue: 7, display: `${(100 - b.tuple_percent - b.dead_tuple_percent - b.free_percent).toFixed(2)} %` },
          ]}
        />
      ))}
      <p>
        The UPDATE doubled the table: every page was full, so no update was HOT and every new version went to a new page. VACUUM turned the dead
        half into free space ({bloat[2].free_percent} %) but the file kept its {bloat[2].pages.toLocaleString()} pages. VACUUM FULL wrote a new,
        compact file — its relfilenode changed from {bloat[2].relfilenode} to {bloat[3].relfilenode} — in {Math.round(V.vacuumFullMs)} ms here,
        holding an <code>ACCESS EXCLUSIVE</code> lock that blocks even SELECTs.
      </p>
      <p>
        Plain VACUUM does shrink the file when the free pages are at its end. After deleting the second half of the rows:{' '}
        <code>{V.truncate.line}</code>
      </p>
      <Callout tone="warn" title="VACUUM FULL is a repair tool">
        It rewrites the table and all its indexes, needs room for a full copy, and locks the table out for the whole time. Prefer letting
        autovacuum keep up; to compact a busy table online, the <code>pg_repack</code> extension (not recorded here) rebuilds it with only brief
        locks.
      </Callout>

      <h2>Autovacuum</h2>
      <p>The autovacuum launcher wakes every <code>autovacuum_naptime</code> (1 min) and starts a worker for each table over its threshold.</p>
      <CodeBlock
        title="when a table is vacuumed or analyzed (PostgreSQL 18)"
        language="text"
        code={`vacuum  when  dead tuples    > min(autovacuum_vacuum_max_threshold,
                                     autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor × reltuples)
                                 = min(100,000,000, ${DEFAULTS.threshold} + ${DEFAULTS.scaleFactor} × reltuples)
vacuum  when  inserts         > ${DEFAULTS.insertThreshold} + ${DEFAULTS.insertScaleFactor} × reltuples × (1 − relallfrozen / relpages)
analyze when  rows changed    > ${DEFAULTS.analyzeThreshold} + ${DEFAULTS.analyzeScaleFactor} × reltuples`}
      />
      <p>Recorded with a 1,000-row table (naptime set to 1 s so the recording would not wait):</p>
      <BarChart
        title={`DELETE 300 rows: ${av.deleted.dead} dead > ${thresholdAt(av.deleted.reltuples)} → vacuumed`}
        bars={[{ label: 'dead tuples', value: av.deleted.dead, hue: 8 }]}
        max={Math.max(av.deleted.dead, thresholdAt(av.deleted.reltuples)) * 1.2}
        marker={{ value: thresholdAt(av.deleted.reltuples), label: `threshold 50 + 0.2 × ${av.deleted.reltuples}` }}
      />
      <BarChart
        title={`Then DELETE 150 more: ${av.stillBelow.dead} dead < ${thresholdAt(av.stillBelow.reltuples)} → not vacuumed (still ${av.stillBelow.dead} after 6 s)`}
        bars={[{ label: 'dead tuples', value: av.stillBelow.dead, hue: 8 }]}
        max={Math.max(av.deleted.dead, thresholdAt(av.deleted.reltuples)) * 1.2}
        marker={{ value: thresholdAt(av.stillBelow.reltuples), label: `threshold 50 + 0.2 × ${av.stillBelow.reltuples} (reltuples after autoanalyze)` }}
      />
      <CodeBlock title="recorded: the server log with log_autovacuum_min_duration = 0" language="text" code={V.autovacuumLog} />
      <VacuumAutovacuumCalc />
      <CodeBlock
        title="per-table settings for a big, busy table"
        language="sql"
        code={`ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.01,   -- 1 % dead instead of 20 %
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.02
);
-- see what autovacuum is doing
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, autovacuum_count
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;
SELECT * FROM pg_stat_progress_vacuum;`}
      />
      <Table
        head={['Setting', 'Default', 'Meaning']}
        rows={[
          ['autovacuum_max_workers', String(setting('autovacuum_max_workers')), 'workers at the same time (18: can be raised up to autovacuum_worker_slots without a restart)'],
          ['autovacuum_vacuum_cost_delay', '2 ms', 'pause after each batch of I/O work, so vacuum does not swamp the disks'],
          ['autovacuum_work_mem', '-1 (maintenance_work_mem)', 'memory for dead TIDs; too little means extra index passes'],
          ['log_autovacuum_min_duration', '10 min', 'log every autovacuum slower than this (0 = all)'],
        ]}
      />

      <h2>What stops vacuum</h2>
      <p>VACUUM may only remove versions that no running snapshot can need, so one old snapshot holds back cleanup in every table.</p>
      <Timeline
        title="Recorded outputs, schematic timing: a REPEATABLE READ report holds a snapshot while rows are deleted"
        lanes={[
          { id: 'report', label: 'report session' },
          { id: 'writer', label: 'writer' },
          { id: 'vacuum', label: 'VACUUM' },
        ]}
        segments={[{ lane: 'report', from: 0, to: 6, label: 'snapshot open', hue: 2 }]}
        events={[
          { lane: 'writer', at: 1, label: 'DELETE 5,000 rows', hue: 1 },
          { lane: 'vacuum', at: 1.3, label: `${notRemovable.toLocaleString()} dead, not removable`, hue: 8 },
          { lane: 'report', at: 6, label: 'COMMIT', hue: 6 },
          { lane: 'vacuum', at: 6.5, label: `${removedLater.toLocaleString()} removed`, hue: 6 },
        ]}
        end={7}
        unit="s"
      />
      <CodeBlock title="recorded: VACUUM (VERBOSE) while the report is open, then after it commits" language="text" code={`${V.held.blocked}\n\n${V.held.released}`} />
      <CodeBlock title="recorded: finding the session that holds the horizon back" language="text" code={V.held.activity} />
      <Table
        head={['Holds vacuum back', 'Fix']}
        rows={[
          ['a long-running query or transaction', 'statement_timeout, shorter reports, or run them on a replica'],
          ['a session idle in transaction after BEGIN', 'idle_in_transaction_session_timeout (e.g. 1 min)'],
          ['an abandoned replication slot', 'drop it; max_slot_wal_keep_size; watch pg_replication_slots'],
          ['a replica with hot_standby_feedback = on running long queries', 'shorter queries there, or accept query cancellations'],
          ['a forgotten prepared transaction', 'COMMIT / ROLLBACK PREPARED; check pg_prepared_xacts'],
        ]}
      />

      <h2>Freezing and xid wraparound</h2>
      <p>
        Freezing marks a tuple as visible to every transaction forever, so that its 32-bit xmin can be reused safely after the counter wraps
        around.
      </p>
      <StatTiles
        title={`Recorded: three tuples before and after VACUUM (FREEZE), after ${fb.age.toLocaleString()} transactions`}
        stats={[
          { label: 't_infomask before', value: hex4(fb.items[0].t_infomask), sub: infomaskFlags(fb.items[0].t_infomask).join(', '), hue: 3 },
          { label: 't_infomask after', value: hex4(fa.items[0].t_infomask), sub: `${infomaskFlags(fa.items[0].t_infomask).join(', ')} — xmin still ${fa.items[0].xmin}`, hue: 5 },
          { label: 'age(relfrozenxid)', value: `${fb.age.toLocaleString()} → ${fa.age}`, sub: 'oldest unfrozen xid the table may contain', hue: 4 },
          { label: 'visibility map', value: fa.vm.all_frozen ? 'all-frozen' : 'not frozen', sub: `before: ${fb.vm.all_frozen ? 'all-frozen' : fb.vm.all_visible ? 'all-visible' : 'nothing set'}`, hue: 6 },
        ]}
      />
      <CodeBlock title="recorded: how far each database is from forced vacuuming" language="text" code={V.datfrozenText} />
      <p>
        Normal vacuums freeze tuples older than <code>vacuum_freeze_min_age</code> ({(setting('vacuum_freeze_min_age') / 1e6).toFixed(0)} million).
        Once a table’s oldest unfrozen xid is older than <code>vacuum_freeze_table_age</code> ({(setting('vacuum_freeze_table_age') / 1e6).toFixed(0)}{' '}
        million) a vacuum scans every page that is not all-frozen; past <code>autovacuum_freeze_max_age</code> (
        {(setting('autovacuum_freeze_max_age') / 1e6).toFixed(0)} million) autovacuum forces one, even if it is disabled. PostgreSQL 18 also freezes
        some all-visible pages eagerly during normal vacuums, spreading the work out.
      </p>
      <VacuumXidCircle recordedAge={V.datfrozen.find((d) => d.datname === 'lab')!.age} freezeMaxAge={setting('autovacuum_freeze_max_age')} />
      <CodeBlock title="recorded: the tables closest to forced vacuuming (worth an alert)" language="text" code={V.wraparoundCheck} />
      <Callout tone="warn" title="Never disable autovacuum">
        Without it, dead tuples pile up until queries slow down, and eventually the server stops accepting writes to protect itself from
        wraparound. If it is too slow, give it more workers or a higher <code>autovacuum_vacuum_cost_limit</code> — not less work.
      </Callout>

      <h2>Checklist</h2>
      <p>What to set up and watch on every server.</p>
      <Table
        head={['Check', 'How']}
        rows={[
          ['Autovacuum on and keeping up', 'n_dead_tup and last_autovacuum in pg_stat_user_tables; pg_stat_progress_vacuum'],
          ['Big tables vacuumed in small bites', 'per-table autovacuum_vacuum_scale_factor 0.01–0.05'],
          ['No old snapshots', 'alert on xact_start older than a few minutes in pg_stat_activity; idle_in_transaction_session_timeout'],
          ['No abandoned replication slots', 'pg_replication_slots: active = false and growing restart_lsn lag'],
          ['Far from wraparound', 'alert when age(datfrozenxid) passes ~500 million'],
          ['Updates stay HOT', 'n_tup_hot_upd / n_tup_upd; fillfactor 80–90 on update-heavy tables'],
          ['Bloat under control', 'pgstattuple (or estimates) on the biggest tables; VACUUM FULL or pg_repack only when needed'],
        ]}
      />
      <p>
        Monitoring queries for all of these are collected in <a href="#/postgres/monitoring">Monitoring and tuning</a>.
      </p>

      <Recap
        points={[
          'Old versions stay on the page until pruning or VACUUM; a dead tuple is one no snapshot can see any more.',
          'HOT updates (no indexed column changed, room on the same page) add no index entries; reads prune HOT chains on full pages.',
          'VACUUM scans the heap, cleans every index, then frees line pointers; the file shrinks only when its end is empty. VACUUM FULL rewrites it under an exclusive lock.',
          'Autovacuum vacuums a table when dead tuples exceed 50 + 0.2 × rows (capped at 100 million); lower the scale factor for big tables.',
          'One old snapshot or slot stops cleanup everywhere; freezing keeps 32-bit xids safe, and autovacuum must never be turned off.',
        ]}
      />
    </>
  )
}
