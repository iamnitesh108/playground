import type { ReactNode } from 'react'
import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { BTreePlayground } from '../components/BTreePlayground'
import { IndexesCompositeView } from '../components/IndexesCompositeView'
import { CAPTURE } from '../data/captures'
import { QUERIES } from '../data/queries'
import { lineWith } from '../simulation/queryPlanningPlan'

const Q = QUERIES
const planText = (p: { plan: readonly string[] }) => p.plan.join('\n')
/** Pages a plan touched: hit + read on its top Buffers line. */
const pagesOf = (p: { plan: readonly string[] }) => {
  const line = lineWith(p.plan, 'Buffers: shared')
  return Number(/hit=(\d+)/.exec(line)?.[1] ?? 0) + Number(/read=(\d+)/.exec(line)?.[1] ?? 0)
}
const heapFetches = (p: { plan: readonly string[] }) => Number(/Heap Fetches: (\d+)/.exec(lineWith(p.plan, 'Heap Fetches'))?.[1] ?? 0)
const kb = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString()} kB`
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const EXPLAIN: Record<string, ReactNode> = {
  'seq scan': <>No index on <code>customer_id</code> yet: PostgreSQL reads all 764 pages and throws away 99,980 rows to find 20.</>,
  'index on customer_id': (
    <>
      After <code>CREATE INDEX ON orders (customer_id)</code>: a <strong>bitmap</strong> scan. The index finds the 20 matching row addresses
      (2 index pages), sorts them by page, then reads 20 heap pages. 22 pages instead of 764.
    </>
  ),
  'primary key lookup': <>One row by primary key: root page, leaf page, heap page — <code>shared hit=3</code>. That is the tree height plus one.</>,
  'range on primary key': <>A range: descend once, then walk the leaf level left to right. 101 rows in 5 pages, because ids were inserted in order and sit together.</>,
  'low selectivity': (
    <>
      A quarter of all rows match. Fetching 25,000 rows through an index would visit almost every page anyway, in random order, so the planner
      chooses the sequential scan. <strong>An index only helps when it filters out most rows.</strong>
    </>
  ),
  'index-only': (
    <>
      Only <code>customer_id</code> is selected, and it is in the index: an <strong>index-only scan</strong>. <code>Heap Fetches: 0</code> —
      after VACUUM the visibility map says every page is all-visible, so the table is not touched at all.
    </>
  ),
  'composite: leading column': <>An index on <code>(customer_id, created_at)</code> serves a filter on both columns: both conditions are index conditions.</>,
  'composite: second column only': (
    <>
      Filtering only on the <em>second</em> column: the entries for one day are scattered across all customers, so here the planner chose a
      sequential scan. See the multi-column section below.
    </>
  ),
  'function on column': (
    <>
      <code>customer_id + 0 = 42</code> is not <code>customer_id = 42</code> to the planner: an expression on the column hides it from the
      index. The same happens with <code>lower(email)</code> or a cast — create an index on the expression instead (
      <a href="#/postgres/index-types">other index types</a>).
    </>
  ),
}

const MULTI_TABS = [
  { label: 'both columns', p: Q.multi.both, text: <>Both conditions become <code>Index Cond</code>: one descent, {pagesOf(Q.multi.both)} pages in all.</> },
  { label: 'first column', p: Q.multi.leading, text: <>The leading column alone uses the same index — no separate index on <code>customer_id</code> is needed.</> },
  { label: 'second only', p: Q.multi.second, text: <>One hour of orders, but only the second column is filtered: with 10,000 different customers, a Seq Scan was cheapest.</> },
  { label: 'skip scan (PG 18)', p: Q.multi.skip, text: <>Same query with an index on <code>(status, created_at)</code>: status has only 5 values, so PostgreSQL 18 skips through it — <code>Index Searches: {lineWith(Q.multi.skip.plan, 'Index Searches').split(': ')[1]}</code>, one small descent per value (plus a few to find the values).</> },
  { label: 'ORDER BY second', p: Q.multi.sorted, text: <>Within one customer, dates are sorted: <code>Index Scan Backward</code> and a Limit, no Sort node.</> },
] as const

export default function Indexes() {
  const { tableSize, btreeMeta, btreeRootStats, btreeLeafStats, plans } = CAPTURE
  const cov = Q.covering
  const writes = Q.writes
  const base = writes[0]
  const six = writes.at(-1)!
  const [fresh, deleted, rebuilt] = Q.bloat
  return (
    <>
      <LessonGoals
        goals={[
          'search and grow a B-tree by hand, including page splits',
          'explain why a lookup in 100,000 rows reads 3 pages',
          'order the columns of a multi-column index, and know when it can and cannot be used',
          'get index-only scans with INCLUDE and vacuum, and let an index replace a sort',
          'weigh what each index costs on writes, find bloated and unused ones, and build them without blocking',
        ]}
        before={
          <>
            <a href="#/postgres/storage">Pages, tuples and TOAST</a> and <a href="#/postgres/query-planning">Query planning and EXPLAIN</a>
          </>
        }
      />

      <h2>A sorted tree of pages</h2>
      <p>An index is a second, sorted copy of some columns that points back to the rows.</p>
      <p>
        A table is a heap: rows sit wherever there was space. To find <code>id = 31337</code> without an index, every page must be read. A{' '}
        <strong>B-tree index</strong> keeps the keys sorted in a tree of pages. Each entry in a leaf page holds a key and the row’s address (its
        ctid); each entry in an inner page holds a key and a pointer to a child page. A search starts at the root and follows one pointer per level.
      </p>
      <TermList
        items={[
          { term: 'leaf page', definition: 'The bottom level: one entry per row — key + ctid (page, line pointer). Each leaf links to both neighbours, so a range scan can walk the level forwards or backwards.' },
          { term: 'inner page', definition: 'A level above: separator keys and child pointers. The top inner page is the root.' },
          { term: 'page split', definition: 'A full page is split in two and a separator is added to the parent; when the root splits, the tree grows a level.' },
          { term: 'index condition', definition: 'A WHERE clause the tree can search for (Index Cond in EXPLAIN), as opposed to a Filter applied afterwards.' },
          { term: 'fillfactor', definition: 'How full CREATE INDEX packs leaf pages: 90 % for B-trees, leaving room for inserts before pages split.' },
        ]}
      />
      <p>
        Real pages hold hundreds of keys. Here each page holds only 3 or 4, so the tree grows quickly. Insert keys, watch pages <strong>split</strong>{' '}
        when they are full, and search to see the path:
      </p>
      <BTreePlayground />

      <h2>The real numbers</h2>
      <p>Because each page holds hundreds of keys, real trees are very flat.</p>
      <p>
        A table <code>orders</code> with 100,000 rows: the heap is {tableSize.heap} ({tableSize.pages} pages), its primary-key index is{' '}
        {tableSize.pkey}. <code>pageinspect</code> shows the index’s shape:
      </p>
      <StatTiles
        stats={[
          { label: 'levels above the leaves', value: btreeMeta.level, sub: 'level 0 = leaves; here a root directly above them', hue: 7 },
          { label: 'entries in the root', value: btreeRootStats.live_items, sub: 'one per leaf page', hue: 7 },
          { label: 'entries in a leaf', value: btreeLeafStats.live_items, sub: `${btreeLeafStats.avg_item_size} bytes each: 8-byte header with the ctid + 4-byte key padded to 8`, hue: 7 },
          { label: 'heap pages', value: tableSize.pages, sub: 'what a Seq Scan reads', hue: 3 },
        ]}
      />
      <Predict
        question={<p>How many pages does a lookup by primary key in this 100,000-row table read?</p>}
        options={['1', '3', '17 (log₂ of 100,000)', '764']}
        answer={1}
        explanation={`Root → leaf → the heap page with the row. With hundreds of keys per page (${btreeLeafStats.live_items} per leaf here), each extra level multiplies the reach by a few hundred: depth grows very slowly. The 500,000-row table of the planning lesson has one more level: 4 pages.`}
      />

      <h2>When the planner uses an index</h2>
      <p>An index is only used when it is cheaper than reading the table, and only for conditions it can search for.</p>
      <p>
        All plans below were recorded on the 100,000-row table with <code>EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)</code>:
      </p>
      <Tabs
        items={plans.map((p) => ({
          label: p.label,
          content: (
            <>
              <CodeBlock language="text" title={`recorded — ${p.sql}`} code={p.plan.join('\n')} />
              <p>{EXPLAIN[p.label]}</p>
            </>
          ),
        }))}
      />
      <Callout tone="note" title="PostgreSQL 18 output">
        Row counts show decimals (<code>rows=20.00</code>, averaged over loops), and index scans report <code>Index Searches</code> — how many times
        the tree was descended.
      </Callout>

      <h2>Multi-column indexes: the leftmost prefix</h2>
      <p>A multi-column index is sorted by its first column, then by the second within equal firsts — so column order matters.</p>
      <IndexesCompositeView />
      <p>
        Recorded on the 500,000-order table with an index on <code>(customer_id, created_at)</code>:
      </p>
      <Tabs
        items={MULTI_TABS.map((t) => ({
          label: t.label,
          content: (
            <>
              <CodeBlock language="text" title={`recorded — ${t.p.sql}`} code={planText(t.p)} />
              <p>{t.text}</p>
            </>
          ),
        }))}
      />
      <Table
        head={['Index (a, b, c) serves…', 'Yes / no']}
        rows={[
          [<code key="k175-13">WHERE a = ?</code>, 'yes — the leftmost prefix'],
          [<code key="k176-13">WHERE a = ? AND b = ?</code>, 'yes'],
          [<code key="k177-13">WHERE a = ? AND b &gt; ? ORDER BY b</code>, 'yes — the range and the order come from the index'],
          [<code key="k178-13">WHERE a &gt; ? AND b = ?</code>, 'partly: a is the search range, b is checked on each entry in it'],
          [<code key="k179-13">WHERE b = ?</code>, 'not well: a full index scan, or a skip scan in PostgreSQL 18 if a has few distinct values'],
          [<><code>ORDER BY a, b</code> or <code>ORDER BY a DESC, b DESC</code></>, 'yes, forwards or backwards; ORDER BY a, b DESC needs an index (a, b DESC)'],
        ]}
      />
      <Callout tone="tip" title="Which column first?">
        Put columns compared with <code>=</code> first and the range or ORDER BY column last. Among equality columns, choose the one that most queries
        filter by. “Most selective first” matters much less than “usable by the most queries”.
      </Callout>

      <h2>Covering indexes and index-only scans</h2>
      <p>If every column a query needs is in the index, PostgreSQL can skip the table — as long as the visibility map allows it.</p>
      <p>
        <code>INCLUDE</code> adds columns to the leaf entries that are not part of the key: they cannot be searched, but they can be returned.
      </p>
      <CodeBlock language="sql" code={cov.ddl} />
      <Flow
        title="An index-only scan, per matching entry"
        cols={4}
        rows={2}
        nodes={[
          { id: 'entry', label: 'index entry', sub: 'key + INCLUDE cols', col: 0, row: 0, hue: 7 },
          { id: 'vm', label: 'visibility map', sub: '2 bits per page', col: 1, row: 0, hue: 7, shape: 'store' },
          { id: 'out', label: 'return row', sub: 'from the index', col: 3, row: 0, hue: 6, shape: 'actor' },
          { id: 'heap', label: 'heap page', sub: 'check visibility', col: 2, row: 1, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'entry', to: 'vm', label: 'page?' },
          { from: 'vm', to: 'out', label: 'all-visible', hue: 6 },
          { from: 'vm', to: 'heap', label: 'not', hue: 8, dashed: true },
          { from: 'heap', to: 'out', hue: 3 },
        ]}
        steps={[
          { title: 'Page is all-visible', body: <p>The visibility map has a bit per heap page, set by VACUUM when every row on it is visible to everyone. Bit set: return the values straight from the index.</p>, active: ['entry', 'vm', 'out', 'entry>vm', 'vm>out'] },
          { title: 'Page changed since vacuum', body: <p>Bit clear (any insert, update or delete on that page clears it): the index cannot say whether this version is visible to us, so the heap page is read — a <code>Heap Fetch</code>.</p>, active: ['entry', 'vm', 'heap', 'out', 'entry>vm', 'vm>heap', 'heap>out'] },
        ]}
      />
      <StatTiles
        title="SELECT sum(amount) FROM orders WHERE customer_id BETWEEN 100 AND 199 — 5,000 rows (recorded)"
        stats={[
          { label: 'plain index (bitmap scan)', value: `${pagesOf(cov.plain).toLocaleString()} pages`, sub: `index + ${Number(lineWith(cov.plain.plan, 'Heap Blocks').split('=')[1]).toLocaleString()} heap pages`, hue: 3 },
          { label: 'INCLUDE (amount), after VACUUM', value: `${pagesOf(cov.vacuumed).toLocaleString()} pages`, sub: `Heap Fetches: ${heapFetches(cov.vacuumed)} · all-visible pages: ${cov.vmBefore.all_visible.toLocaleString()}`, hue: 6 },
          { label: 'after updating 10 % of rows', value: `${pagesOf(cov.afterUpdate).toLocaleString()} pages`, sub: `Heap Fetches: ${heapFetches(cov.afterUpdate).toLocaleString()} · all-visible pages: ${cov.vmAfterUpdate.all_visible}`, hue: 8 },
          { label: 'after VACUUM again', value: `${pagesOf(cov.again).toLocaleString()} pages`, sub: `Heap Fetches: ${heapFetches(cov.again)} · all-visible pages: ${cov.vmAfterVacuum.all_visible.toLocaleString()}`, hue: 6 },
        ]}
      />
      <Tabs
        items={[
          { label: 'plain index', content: <CodeBlock language="text" title={`recorded — ${cov.plain.sql}`} code={planText(cov.plain)} /> },
          { label: 'covering, vacuumed', content: <CodeBlock language="text" title="recorded" code={planText(cov.vacuumed)} /> },
          { label: 'after UPDATE', content: <CodeBlock language="text" title="recorded — UPDATE orders SET note = note || '.' WHERE id % 10 = 0" code={planText(cov.afterUpdate)} /> },
          { label: 'after VACUUM', content: <CodeBlock language="text" title="recorded" code={planText(cov.again)} /> },
        ]}
      />
      <p>
        The update touched one row in ten, but those rows are on every page, so every visibility-map bit was cleared and the index-only scan read
        the heap for each entry. There were {heapFetches(cov.afterUpdate).toLocaleString()} fetches for 5,000 rows: the full pages had no room for
        the new versions, so the updates were not HOT and left extra index entries pointing at the old, dead versions (
        <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM</a>). The table also grew from {Q.covering.vmBefore.all_visible.toLocaleString()} to{' '}
        {Q.covering.vmAfterVacuum.all_visible.toLocaleString()} pages.
      </p>
      <CodeBlock language="text" title="recorded — SELECT all_visible, all_frozen FROM pg_visibility_map_summary('orders') (extension pg_visibility)" code={cov.vmShow} />

      <h2>Letting an index replace a sort</h2>
      <p>A B-tree returns rows in key order, so ORDER BY … LIMIT can stop after a few entries instead of sorting everything.</p>
      <Tabs
        items={[
          { label: 'no index on created_at', content: <CodeBlock language="text" title={`recorded — ${Q.sortAvoid.without.sql}`} code={planText(Q.sortAvoid.without)} /> },
          { label: 'with an index', content: <CodeBlock language="text" title="recorded — after CREATE INDEX orders_created_idx ON orders (created_at)" code={planText(Q.sortAvoid.with)} /> },
        ]}
      />
      <BarChart
        title="Pages read for the 10 newest orders (recorded)"
        bars={[
          { label: 'Seq Scan + top-N sort', value: pagesOf(Q.sortAvoid.without), hue: 3 },
          { label: 'Index Scan Backward', value: pagesOf(Q.sortAvoid.with), hue: 7 },
        ]}
      />
      <p>
        This is what makes “latest N” pages, keyset pagination (<code>WHERE created_at &lt; $last ORDER BY created_at DESC LIMIT 20</code>) and
        merge joins cheap. A backward scan serves <code>DESC</code> just as well.
      </p>

      <h2>What an index costs on writes</h2>
      <p>Every index is another structure that each INSERT — and each non-HOT UPDATE — has to change and log.</p>
      <p>
        The same <code>INSERT … SELECT</code> of 200,000 orders into an empty table with 0, 1, 3 and 6 B-tree indexes (median of three runs):
      </p>
      <BarChart
        title="Rows inserted per second (recorded)"
        bars={writes.map((w) => ({ label: `${w.indexes} index${w.indexes === 1 ? '' : 'es'}`, value: w.rowsPerSec, display: `${w.rowsPerSec.toLocaleString()}/s`, hue: w.indexes === 0 ? 3 : 7, note: w.columns.join(' · ') || 'heap only' }))}
      />
      <BarChart
        title="WAL written for the 200,000 rows, MB (recorded)"
        bars={writes.map((w) => ({ label: `${w.indexes} index${w.indexes === 1 ? '' : 'es'}`, value: w.wal / 1024 / 1024, display: mb(w.wal), hue: 4 }))}
      />
      <StatTiles
        stats={[
          { label: 'slower with 6 indexes', value: `${(six.ms / base.ms).toFixed(1)}×`, sub: `${base.ms.toLocaleString()} ms → ${six.ms.toLocaleString()} ms`, hue: 8 },
          { label: 'more WAL', value: `${(six.wal / base.wal).toFixed(1)}×`, sub: `${mb(base.wal)} → ${mb(six.wal)} — also shipped to every replica`, hue: 4 },
          { label: 'index size vs table', value: `${(six.idx / six.heap).toFixed(1)}×`, sub: `${mb(six.idx)} of indexes on a ${mb(six.heap)} table`, hue: 7 },
        ]}
      />
      <Predict
        question={<p>A table has 6 indexes. An UPDATE changes one column that is in none of them, and the page has free space. How many index entries are written?</p>}
        options={['0', '1', '6']}
        answer={0}
        explanation={
          <>
            A HOT update: the new version stays on the same page and no index changes, because no indexed column changed. If the page were full, or an
            indexed column changed, all 6 indexes would get a new entry. That is why indexing a column that is updated often costs more than it seems: it rules out HOT for those updates.
          </>
        }
      />

      <h2>Index bloat</h2>
      <p>Deleting rows empties index entries but does not shrink the index.</p>
      <p>
        An index on <code>customer_id</code> of a 500,000-row table; then three of every four rows were deleted and the table vacuumed. VACUUM
        removed the dead entries — but the pages stayed, each a quarter full. Only pages that become completely empty are recycled.
      </p>
      <BarChart
        title="Index size (recorded, pgstatindex)"
        bars={Q.bloat.map((b) => ({ label: b.stage, value: b.bytes, display: kb(b.bytes), hue: b === deleted ? 8 : 7 }))}
      />
      <BarChart
        title="Average leaf density, % (recorded)"
        bars={Q.bloat.map((b) => ({ label: b.stage, value: b.density, display: `${b.density} %`, hue: b === deleted ? 8 : 6 }))}
        max={100}
      />
      <CodeBlock language="sql" code={`CREATE EXTENSION pgstattuple;\nSELECT pg_size_pretty(pg_relation_size(indexrelid)) AS size, avg_leaf_density, leaf_pages, deleted_pages\nFROM pg_index, pgstatindex(indexrelid::regclass) WHERE indexrelid = 'orders_w_customer_idx'::regclass;`} />
      <CodeBlock language="text" title="recorded — after REINDEX INDEX CONCURRENTLY orders_w_customer_idx" code={Q.bloatShow} />
      <p>
        {fresh.leaf_pages} leaf pages at {fresh.density} % became {deleted.leaf_pages} pages at {deleted.density} %; the rebuild packed the same
        entries into {rebuilt.leaf_pages}. Updates cause the same effect more slowly. Since PostgreSQL 13, B-trees deduplicate equal keys and since 14
        delete entries of dead versions bottom-up before splitting, so bloat grows much more slowly than it used to — but a big purge still calls for{' '}
        <code>REINDEX CONCURRENTLY</code>.
      </p>

      <h2>Building an index on a live table</h2>
      <p>A plain CREATE INDEX blocks every write to the table until it finishes; CONCURRENTLY does not.</p>
      <Timeline
        title="Plain vs concurrent build (schematic)"
        lanes={[
          { id: 'plain', label: 'CREATE INDEX' },
          { id: 'plainW', label: 'writes meanwhile' },
          { id: 'cic', label: '… CONCURRENTLY' },
          { id: 'cicW', label: 'writes meanwhile' },
        ]}
        segments={[
          { lane: 'plain', from: 0, to: 40, label: 'scan + sort + write', hue: 7 },
          { lane: 'plainW', from: 0, to: 40, label: 'blocked (ShareLock)', hue: 8, striped: true },
          { lane: 'plainW', from: 40, to: 100, label: 'run', hue: 6 },
          { lane: 'cic', from: 0, to: 8, label: 'wait', hue: 2 },
          { lane: 'cic', from: 8, to: 48, label: 'build: scan 1', hue: 7 },
          { lane: 'cic', from: 48, to: 56, label: 'wait', hue: 2 },
          { lane: 'cic', from: 56, to: 88, label: 'validate: scan 2', hue: 7 },
          { lane: 'cic', from: 88, to: 96, label: 'wait', hue: 2 },
          { lane: 'cicW', from: 0, to: 100, label: 'writes keep running', hue: 6 },
        ]}
        events={[
          { lane: 'plain', at: 40, label: 'valid', hue: 6 },
          { lane: 'cic', at: 96, label: 'valid', hue: 6 },
        ]}
        end={100}
        unit="%"
      />
      <p>
        A plain build takes a <code>SHARE</code> lock: reads continue, every INSERT, UPDATE and DELETE waits. Recorded: one session ran{' '}
        <code>BEGIN; CREATE INDEX … ON orders_w (amount)</code>, another tried an insert with a 1-second lock timeout:
      </p>
      <CodeBlock language="text" title="recorded — INSERT INTO orders_w … (SET lock_timeout = '1s')" code={Q.blocked} />
      <CodeBlock language="text" title="recorded — pg_locks on orders_w meanwhile" code={Q.blockedLocks} />
      <p>
        <code>CREATE INDEX CONCURRENTLY</code> takes a <code>SHARE UPDATE EXCLUSIVE</code> lock that allows writes. It scans the table twice and waits
        for older transactions in between, so it takes longer ({Q.concurrently.concurrentMs} ms vs {Q.concurrently.plainMs} ms here, on an idle table) and
        cannot run inside a transaction block. If it fails, it leaves an <strong>invalid</strong> index behind that still slows writes:
      </p>
      <CodeBlock language="text" title="recorded — CREATE UNIQUE INDEX CONCURRENTLY orders_w_customer_uq ON orders_w (customer_id)" code={Q.invalid.error} />
      <CodeBlock language="text" title="recorded — SELECT indexrelid::regclass AS index, indisvalid FROM pg_index WHERE indrelid = 'orders_w'::regclass" code={Q.invalid.describe} />
      <Callout tone="warn" title="Clean up after a failed concurrent build">
        Drop it with <code>DROP INDEX CONCURRENTLY orders_w_customer_uq</code> and build again; an invalid index is never used for reads but is still
        maintained on every write. Migration tools that wrap each step in a transaction must run CONCURRENTLY outside it.
      </Callout>

      <h2>Finding unused indexes</h2>
      <p>PostgreSQL counts how often each index is used, so unused ones can be found and dropped.</p>
      <CodeBlock language="sql" code={Q.unusedSql} />
      <CodeBlock language="text" title="recorded — after a reset and a short workload" code={Q.unused} />
      <p>
        <code>orders_customer_incl_idx</code> — the largest index — was not used once by this workload. Before dropping one in production: check
        the counters on every replica too (each server counts its own scans), make sure they cover a full business cycle (month-end reports!), keep
        indexes that enforce <code>UNIQUE</code> or a primary key, and drop with <code>DROP INDEX CONCURRENTLY</code>.
      </p>

      <h2>Design rules</h2>
      <ul>
        <li>Index for your queries, not your columns: start from the slow queries in pg_stat_statements and their EXPLAIN.</li>
        <li>One multi-column index usually beats several single-column ones: equality columns first, then the range or sort column.</li>
        <li>Don’t duplicate a leftmost prefix: with <code>(customer_id, created_at)</code>, a separate index on <code>customer_id</code> is redundant.</li>
        <li>Foreign-key columns usually need an index — for joins, and so deleting a parent does not scan the child table.</li>
        <li>Use <code>INCLUDE</code> for hot read paths, and keep the table vacuumed so index-only scans stay index-only.</li>
        <li>Every index costs writes, WAL, memory and vacuum time. Remove unused ones; on busy tables always build and drop CONCURRENTLY.</li>
      </ul>

      <Recap
        points={[
          'A B-tree keeps keys sorted in pages; a full page splits and pushes a separator key up. The tree grows at the root, and stays 3–4 levels deep for millions of rows.',
          'A multi-column index serves its leftmost prefix and gives rows in its sort order; a condition on a later column alone needs a skip scan or another index.',
          'Index-only scans skip the heap only for pages the visibility map marks all-visible — VACUUM keeps it that way.',
          `Each index slows writes: ${base.rowsPerSec.toLocaleString()} rows/s with none, ${six.rowsPerSec.toLocaleString()} with six (recorded).`,
          'Indexes do not shrink after deletes; REINDEX CONCURRENTLY rebuilds them, CREATE INDEX CONCURRENTLY builds without blocking writes.',
        ]}
      />
    </>
  )
}
