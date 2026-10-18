import { BarChart, Flow, Proportion, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { QueryPlanningHistogram } from '../components/QueryPlanningHistogram'
import { QueryPlanningJoinCost } from '../components/QueryPlanningJoinCost'
import { QueryPlanningJoinPlayground } from '../components/QueryPlanningJoinPlayground'
import { QueryPlanningPlanTree } from '../components/QueryPlanningPlanTree'
import { QueryPlanningScanView } from '../components/QueryPlanningScanView'
import { QUERIES } from '../data/queries'
import { executionMs, lineWith, rowsOf, totalCost } from '../simulation/queryPlanningPlan'
import { parseArray, type ColumnStats } from '../simulation/queryPlanningStats'

const Q = QUERIES
const setting = (name: keyof typeof Q.settings) => Number(Q.settings[name])
const table = (name: string) => Q.tables.find((t) => t.name === name)!
const column = (name: string) => Q.stats.find((s) => s.attname === name)!
const statsOf = (name: string): ColumnStats => {
  const c = column(name)
  return { nullFrac: c.null_frac, nDistinct: c.n_distinct, mcv: parseArray(c.mcv), mcf: c.mcf ?? [], histogram: parseArray(c.hist).map(Number) }
}
const planText = (p: { plan: readonly string[] }) => p.plan.join('\n')
/** The first match of a pattern in a recorded plan, to quote it exactly. */
const quote = (p: { plan: readonly string[] }, re: RegExp) => p.plan.map((l) => re.exec(l)?.[0]).find(Boolean) ?? ''
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`

const orders = table('orders')
const status = statsOf('status')
const seqPage = setting('seq_page_cost')
const cpuTuple = setting('cpu_tuple_cost')
const cpuOp = setting('cpu_operator_cost')
const byHandAll = orders.pages * seqPage + orders.tuples * cpuTuple
const byHandFilter = byHandAll + orders.tuples * cpuOp

const rows = {
  mcv: rowsOf(Q.estimates.mcv.plan),
  distinct: rowsOf(Q.estimates.distinct.plan),
  histogram: rowsOf(Q.estimates.histogram.plan),
  correlatedBefore: rowsOf(Q.correlated.before.plan),
  correlatedAfter: rowsOf(Q.correlated.after.plan),
  staleBefore: rowsOf(Q.stale.before.plan),
  staleAfter: rowsOf(Q.stale.after.plan),
}

const DESCRIBE: Record<string, string> = {
  'Seq Scan': 'Reads every page of the table in order and keeps the rows that pass the Filter.',
  'Parallel Seq Scan': 'Each process takes the next free block of the table, so together they read every page once.',
  'Index Scan': 'Descends the B-tree for the Index Cond, then fetches each matching row from the heap, in index order.',
  'Index Scan Backward': 'An index scan walking the leaf pages right to left: rows come out in descending order.',
  'Index Only Scan': 'Answers from the index alone; visits the heap only for pages not marked all-visible (Heap Fetches).',
  'Bitmap Index Scan': 'Collects the locations of all matching rows into a bitmap of pages — reads no table rows itself.',
  'Bitmap Heap Scan': 'Reads the pages in the bitmap once each, in physical order, and rechecks the condition on their rows.',
  'Nested Loop': 'For each row from the first (outer) child, runs the second (inner) child — typically an index lookup.',
  'Hash Join': 'Builds a hash table from the second child (the Hash node), then streams the first child and probes it.',
  Hash: 'Reads all its input into an in-memory hash table on the join key. Batches > 1 means it spilled to disk.',
  'Merge Join': 'Walks two inputs sorted on the join key side by side, like a zipper.',
  HashAggregate: 'Groups rows in a hash table, one entry per group (GROUP BY).',
  'Partial HashAggregate': 'Each parallel process groups its share of rows; the leader combines the partial results.',
  'Finalize GroupAggregate': 'Combines the partial groups from the workers into the final result, in sorted order.',
  Aggregate: 'Computes one aggregate over all input rows (count, sum…).',
  'Gather Merge': 'Collects rows from parallel workers and the leader, keeping their sort order.',
  Gather: 'Collects rows from parallel workers and the leader, in any order.',
  Sort: 'Sorts its input. Sort Method says how: quicksort in memory, top-N heapsort, or external merge on disk.',
  Limit: 'Stops asking its child for rows once it has enough — so the child may stop early.',
}

const SCAN_TABS = [
  { label: 'Seq Scan', p: Q.scans.seq, text: <>70 % of orders are delivered: reading everything in order is cheapest.</> },
  { label: 'Index Scan', p: Q.scans.index, text: <>One row by primary key: three tree levels and one heap page — <code>shared hit=4</code>.</> },
  { label: 'Index Only Scan', p: Q.scans.indexOnly, text: <>Only <code>id</code> is needed and it is in the index; the table was vacuumed, so <code>Heap Fetches: 0</code>.</> },
  { label: 'Bitmap Scan', p: Q.scans.bitmap, text: <>50 orders of one customer, spread over 50 pages: the index gives the page list, then each page is read once.</> },
] as const

export default function QueryPlanning() {
  const forced = Q.forced.runs
  const fastest = forced.reduce((a, r) => (r.ms < a.ms ? r : a))
  const workers0 = Q.parallel.timings.find((t) => t.workers === 0)!.ms
  const workers2 = Q.parallel.timings.find((t) => t.workers === 2)!.ms
  const spillSort = lineWith(Q.spill.small.plan, 'Sort Method')
  const memSort = lineWith(Q.spill.big.plan, 'Sort Method')
  const hashBatches = lineWith(Q.spill.hashSmall.plan, 'Batches')
  const hashFit = lineWith(Q.joins.hash.plan, 'Buckets')

  return (
    <>
      <LessonGoals
        goals={[
          'follow a query from SQL text through the planner to the executor',
          'read pg_stats and work out the planner’s row estimate yourself',
          'compute a Seq Scan cost by hand and match the number EXPLAIN prints',
          'tell seq, index, index-only and bitmap scans apart, and nested loop, hash and merge joins',
          'read EXPLAIN (ANALYZE, BUFFERS) and spot bad estimates, spills to disk and parallel workers',
        ]}
        before={
          <>
            <a href="#/postgres/storage">Pages, tuples and TOAST</a> (8 kB pages) and the joins of{' '}
            <a href="#/postgres/using-postgres">Using PostgreSQL day to day</a>
          </>
        }
      />

      <h2>From SQL text to rows</h2>
      <p>SQL says what you want, never how to get it — the planner decides how.</p>
      <p>
        For one query there are often hundreds of possible plans: which index, which join order, which join algorithm. The planner{' '}
        <strong>estimates</strong> how many rows each step will produce, turns that into a <strong>cost</strong>, and keeps the cheapest plan. All
        recordings in this lesson come from PostgreSQL {Q.version.split(' ')[0]} with a table of{' '}
        {orders.tuples.toLocaleString()} orders, 10,000 customers and {table('payments').tuples.toLocaleString()} payments.
      </p>
      <Flow
        title="The path of one query"
        cols={6}
        rows={2}
        width={900}
        nodes={[
          { id: 'sql', label: 'SQL text', sub: 'from the client', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'parse', label: 'parser', sub: 'syntax → tree', col: 1, row: 0 },
          { id: 'rewrite', label: 'rewriter', sub: 'views, rules', col: 2, row: 0 },
          { id: 'plan', label: 'planner', sub: 'cheapest plan', col: 3, row: 0, hue: 7 },
          { id: 'exec', label: 'executor', sub: 'runs the tree', col: 4, row: 0 },
          { id: 'stats', label: 'pg_statistic', sub: 'from ANALYZE', col: 3, row: 1, hue: 7, shape: 'store' },
          { id: 'heap', label: 'tables + indexes', sub: 'pages', col: 4, row: 1, hue: 3, shape: 'store' },
          { id: 'rows', label: 'rows', sub: 'to the client', col: 5, row: 0, hue: 6, shape: 'actor' },
        ]}
        edges={[
          { from: 'sql', to: 'parse', hue: 1, flow: true },
          { from: 'parse', to: 'rewrite' },
          { from: 'rewrite', to: 'plan' },
          { from: 'stats', to: 'plan', hue: 7, dashed: true },
          { from: 'plan', to: 'exec', hue: 7 },
          { from: 'exec', to: 'heap', hue: 3, both: true },
          { from: 'exec', to: 'rows', hue: 6, flow: true },
        ]}
        steps={[
          { title: 'Parse', body: <p>The parser checks the syntax and builds a tree; then names are looked up in the catalog: does table <code>orders</code> exist, what type is <code>amount</code>?</p>, active: ['sql', 'parse', 'sql>parse'] },
          { title: 'Rewrite', body: <p>Views are replaced by their definition, and rules (rare) are applied. The query is still “what”, not “how”.</p>, active: ['parse', 'rewrite', 'parse>rewrite'] },
          { title: 'Plan', body: <p>The planner lists the ways to run it, estimates rows for each step from the statistics, prices every option and keeps the cheapest. This is the step EXPLAIN shows.</p>, active: ['rewrite', 'plan', 'stats', 'rewrite>plan', 'stats>plan'] },
          { title: 'Execute', body: <p>The executor runs the plan tree: each node asks its children for rows, one at a time, and passes results up. Rows stream to the client as they come.</p>, active: ['plan', 'exec', 'heap', 'rows', 'plan>exec', 'exec>heap', 'exec>rows'] },
        ]}
        caption="Planning usually takes well under a millisecond; prepared statements can reuse a plan and skip it."
      />
      <TermList
        items={[
          { term: 'plan', definition: 'A tree of nodes (scans, joins, sorts…). Rows flow from the leaves up to the top node.' },
          { term: 'statistics', definition: 'Per-column summaries that ANALYZE stores: common values, distinct count, a histogram, correlation.' },
          { term: 'selectivity', definition: 'The fraction of rows a condition keeps. Estimated rows = selectivity × rows in the table.' },
          { term: 'cost', definition: 'The planner’s price for a plan, in arbitrary units where reading one page sequentially costs 1.0.' },
          { term: 'EXPLAIN', definition: 'Shows the chosen plan with its estimates. With ANALYZE it also runs the query and shows what really happened.' },
        ]}
      />

      <h2>What the planner knows: statistics</h2>
      <p>The planner never looks at your data while planning; it looks at a summary of it.</p>
      <p>
        <code>ANALYZE</code> (run by autovacuum, or by hand) reads a random sample of 300 × <code>default_statistics_target</code> ={' '}
        {(300 * setting('default_statistics_target')).toLocaleString()} rows and stores, for each column, what it found. The view{' '}
        <code>pg_stats</code> shows it readably:
      </p>
      <CodeBlock language="sql" code={Q.statsSql} />
      <CodeBlock language="text" title="recorded" code={Q.statsShow} />
      <Proportion
        title="most_common_vals of orders.status, with their recorded frequencies"
        parts={status.mcv.map((v, i) => ({ label: v, value: status.mcf[i], display: `frequency ${status.mcf[i].toFixed(3)}`, hue: (([6, 5, 1, 7, 8] as const)[i] ?? 3) }))}
      />
      <StatTiles
        stats={[
          { label: 'n_distinct of customer_id', value: column('customer_id').n_distinct.toLocaleString(), sub: 'positive: a count of distinct values', hue: 7 },
          { label: 'n_distinct of id', value: column('id').n_distinct, sub: '−1 means “every row distinct” (−0.5: half as many as rows)', hue: 7 },
          { label: 'histogram buckets of amount', value: parseArray(column('amount').hist).length - 1, sub: 'equal-frequency buckets between 101 bounds', hue: 7 },
          { label: 'correlation of created_at', value: column('created_at').correlation, sub: 'physical order = sort order: index range scans read neighbouring pages', hue: 3 },
        ]}
      />
      <Table
        head={['pg_stats column', 'What it is', 'Used for']}
        rows={[
          [<code key="k171-13">null_frac</code>, 'fraction of NULLs', 'IS NULL, and discounting NULLs from everything else'],
          [<code key="k172-13">n_distinct</code>, 'distinct values (negative: as a fraction of rows)', '= on values that are not common; GROUP BY sizes'],
          [<><code>most_common_vals</code>, <code>most_common_freqs</code></>, 'up to default_statistics_target (100) frequent values, with their shares', '= on those values: the frequency is the estimate'],
          [<code key="k174-13">histogram_bounds</code>, 'values splitting the rest into equal-frequency buckets', '<, >, BETWEEN'],
          [<code key="k175-13">correlation</code>, 'how well physical row order follows sort order (−1…1)', 'pricing index scans: neighbouring or scattered pages'],
        ]}
      />

      <h2>From statistics to row estimates</h2>
      <p>An estimate is a fraction (the selectivity) multiplied by the number of rows.</p>
      <Table
        head={['Condition', 'How the planner estimates', 'Estimated', 'Actual']}
        rows={[
          [<code key="k184-13">status = 'NEW'</code>, `a common value: its frequency ${status.mcf[status.mcv.indexOf('NEW')]} × ${orders.tuples.toLocaleString()}`, rows.mcv.est.toLocaleString(), rows.mcv.actual.toLocaleString()],
          [<code key="k185-13">customer_id = 42</code>, `not common: the rest of the rows ÷ ~${column('customer_id').n_distinct.toLocaleString()} distinct values`, rows.distinct.est.toLocaleString(), rows.distinct.actual.toLocaleString()],
          [<code key="k186-13">amount &lt; 50</code>, 'histogram: the share of buckets below 50', rows.histogram.est.toLocaleString(), rows.histogram.actual.toLocaleString()],
        ]}
      />
      <p>The histogram case, interactively — the same arithmetic the planner does, from the recorded bounds:</p>
      <QueryPlanningHistogram column="amount" stats={statsOf('amount')} rows={orders.tuples} recorded={{ x: 50, est: rows.histogram.est, actual: rows.histogram.actual }} />
      <Predict
        question={
          <p>
            Customers have <code>country</code> (5 values, each 20 %) and <code>city</code> (5 values, each 20 %). Every Paris customer is in FR. How
            many of 10,000 rows does the planner expect for <code>country = 'FR' AND city = 'Paris'</code>?
          </p>
        }
        options={['2,000', '400', '20', '10,000']}
        answer={1}
        explanation={
          <>
            It assumes columns are independent and multiplies: 0.2 × 0.2 × 10,000 = 400. The recorded plan says <code>rows={rows.correlatedBefore.est}</code>; the real
            answer is {rows.correlatedBefore.actual.toLocaleString()}.
          </>
        }
      />

      <h2>When estimates go wrong</h2>
      <p>Most slow queries are not caused by a missing index but by a wrong row estimate that led to the wrong plan.</p>
      <p>
        <strong>Correlated columns.</strong> City determines country, but the planner multiplies their selectivities. Extended statistics teach it the
        dependency:
      </p>
      <CodeBlock language="text" title={`recorded — before: ${Q.correlated.before.sql}`} code={planText(Q.correlated.before)} />
      <CodeBlock language="sql" code={Q.correlated.fix} />
      <CodeBlock language="text" title="recorded — pg_stats_ext: city → country holds for 100 % of rows (and back)" code={Q.correlated.dependencies} />
      <CodeBlock language="text" title="recorded — after" code={planText(Q.correlated.after)} />
      <p>
        <strong>Stale statistics.</strong> A table had 100,000 deliveries and was analysed; then 50,000 newer rows were bulk-loaded with
        autovacuum disabled. The histogram still ends at the old maximum, so “recent rows” look almost empty:
      </p>
      <CodeBlock language="text" title={`recorded — ${Q.stale.before.sql}`} code={planText(Q.stale.before)} />
      <CodeBlock language="text" title="recorded — after ANALYZE deliveries" code={planText(Q.stale.after)} />
      <BarChart
        title="Estimated vs actual rows (recorded)"
        bars={[
          { label: 'correlated: estimate', value: rows.correlatedBefore.est, hue: 8, note: 'columns assumed independent' },
          { label: 'correlated: + statistics', value: rows.correlatedAfter.est, hue: 6 },
          { label: 'correlated: actual', value: rows.correlatedBefore.actual, hue: 3 },
          { label: 'stale: estimate', value: rows.staleBefore.est, hue: 8, note: 'histogram ends before the new rows' },
          { label: 'stale: after ANALYZE', value: rows.staleAfter.est, hue: 6 },
          { label: 'stale: actual', value: rows.staleBefore.actual, hue: 3 },
        ]}
      />
      <Callout tone="warn" title="Why a bad estimate hurts">
        Here both plans stayed a Seq Scan, so nothing broke. In a join, an estimate of {rows.staleBefore.est.toLocaleString()} rows where there are{' '}
        {rows.staleBefore.actual.toLocaleString()} makes the planner pick a nested loop with {rows.staleBefore.actual.toLocaleString()} index lookups instead of one hash join — the classic “fast yesterday, slow today” query. Run <code>ANALYZE</code> after bulk
        loads; for columns that depend on each other use <code>CREATE STATISTICS</code> (<code>dependencies</code>, <code>ndistinct</code> or{' '}
        <code>mcv</code>); for skewed columns raise the target: <code>ALTER TABLE … ALTER COLUMN … SET STATISTICS 1000</code>.
      </Callout>

      <h2>The cost model</h2>
      <p>Cost is a price in made-up units, built from a few settings you can read and change.</p>
      <Table
        head={['Setting', 'Recorded value', 'Price of']}
        rows={[
          [<code key="k247-13">seq_page_cost</code>, Q.settings.seq_page_cost, 'reading one page as part of a sequential read — the unit'],
          [<code key="k248-13">random_page_cost</code>, Q.settings.random_page_cost, 'reading one page at a random place (index → heap)'],
          [<code key="k249-13">cpu_tuple_cost</code>, Q.settings.cpu_tuple_cost, 'processing one row'],
          [<code key="k250-13">cpu_index_tuple_cost</code>, Q.settings.cpu_index_tuple_cost, 'processing one index entry'],
          [<code key="k251-13">cpu_operator_cost</code>, Q.settings.cpu_operator_cost, 'evaluating one operator or function (=, &lt;, a hash)'],
          [<code key="k252-13">effective_cache_size</code>, `${(setting('effective_cache_size') * 8) / 1024 / 1024} GB`, 'how much the OS + shared buffers likely cache (only a hint)'],
        ]}
      />
      <p>
        Price a full scan of <code>orders</code> by hand. <code>pg_class</code> says how big it is:
      </p>
      <CodeBlock language="text" title="recorded — SELECT relpages, reltuples FROM pg_class WHERE relname = 'orders'" code={Q.cost.stats} />
      <Table
        head={['', 'By hand', 'EXPLAIN printed']}
        rows={[
          [
            <code key="k263-14">SELECT * FROM orders</code>,
            `${orders.pages.toLocaleString()} pages × ${seqPage} + ${orders.tuples.toLocaleString()} rows × ${cpuTuple} = ${byHandAll.toLocaleString()}`,
            totalCost(Q.cost.all).toLocaleString(),
          ],
          [
            <code key="k268-14">… WHERE status = 'NEW'</code>,
            `${byHandAll.toLocaleString()} + ${orders.tuples.toLocaleString()} × ${cpuOp} (one “=” per row) = ${byHandFilter.toLocaleString()}`,
            totalCost(Q.cost.filtered).toLocaleString(),
          ],
        ]}
      />
      <CodeBlock language="text" title="recorded — EXPLAIN SELECT * FROM orders WHERE status = 'NEW' (parallel query off)" code={Q.cost.filtered.join('\n')} />
      <Proportion
        title={`Where the ${byHandFilter.toLocaleString()} cost units of that Seq Scan come from`}
        parts={[
          { label: 'reading pages (seq_page_cost)', value: orders.pages * seqPage, hue: 3 },
          { label: 'handling rows (cpu_tuple_cost)', value: orders.tuples * cpuTuple, hue: 7 },
          { label: 'the filter (cpu_operator_cost)', value: orders.tuples * cpuOp, hue: 2 },
        ]}
      />
      <p>
        Read the header as <code>cost=startup..total</code>: startup is the price before the first row can come out (0 for a scan; the whole sort for
        a Sort), total is the price of all rows. <code>rows</code> is the estimate, <code>width</code> the average row size in bytes.
      </p>
      <Callout tone="tip" title="random_page_cost on SSDs">
        The default 4.0 says a random read costs four sequential ones — a guess from spinning-disk days, already discounted for caching. On SSDs
        and when the data fits in memory, values of 1.1–2 are common and make index scans look cheaper. Change it per tablespace or per database,
        and compare plans before and after.
      </Callout>

      <h2>Scan types</h2>
      <p>A scan node reads one table; there are four main ways it can do that.</p>
      <QueryPlanningScanView />
      <Tabs
        items={SCAN_TABS.map((t) => ({
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
        head={['Scan', 'Reads', 'Chosen when']}
        rows={[
          ['Seq Scan', 'all pages, in order', 'a large share of rows matches, the table is small, or there is no usable index'],
          ['Index Scan', 'tree + one heap visit per match, in key order', 'few rows match, or rows are needed in index order (ORDER BY … LIMIT)'],
          ['Bitmap Heap Scan', 'tree, then each matching page once, in page order', 'too many rows for an index scan, too few for a seq scan; or to combine indexes (BitmapAnd/Or)'],
          ['Index Only Scan', 'the tree; heap only for pages not all-visible', 'every column needed is in the index, and the table is well vacuumed'],
        ]}
      />

      <h2>Join algorithms</h2>
      <p>A join node takes rows from two children and pairs them up; PostgreSQL has three ways to do it.</p>
      <QueryPlanningJoinPlayground />
      <Table
        head={['Algorithm', 'Work', 'Memory', 'Best when']}
        rows={[
          ['Nested loop', 'outer rows × (one inner lookup)', 'none', 'the outer side is small and the inner side has an index on the key'],
          ['Hash join', 'read both once: build + probe', 'the inner side’s hash table (work_mem × hash_mem_multiplier)', 'large unsorted inputs joined on =; the smaller side fits in memory'],
          ['Merge join', 'one pass over two sorted inputs', 'none, if inputs come sorted (else a Sort)', 'both inputs are already sorted (indexes) or must be sorted anyway; also for ranges of large inputs'],
        ]}
      />
      <Tabs
        items={[
          { label: 'nested loop', content: <><CodeBlock language="text" title={`recorded — ${Q.joins.nested.sql}`} code={planText(Q.joins.nested)} /><p>10 orders, so 10 lookups in <code>customers_pkey</code> (<code>loops=10</code>, <code>Index Searches: 10</code>).</p></> },
          { label: 'hash join', content: <><CodeBlock language="text" title={`recorded — ${Q.joins.hash.sql}`} code={planText(Q.joins.hash)} /><p>All 10,000 customers go into a hash table ({hashFit}); then 500,000 orders stream past it.</p></> },
          { label: 'merge join', content: <><CodeBlock language="text" title={`recorded — ${Q.joins.merge.sql}`} code={planText(Q.joins.merge)} /><p>Both primary-key indexes already deliver rows in id order, and the LIMIT stops after 1,000 rows: no sort, no hash table.</p></> },
        ]}
      />
      <p>
        To compare them on one query, switch the other two off with <code>SET enable_hashjoin = off</code> (and friends) and record each — these
        settings are for experiments, not production:
      </p>
      <CodeBlock language="sql" code={Q.forced.sql} />
      <BarChart
        title="The planner’s estimated cost for each algorithm (recorded)"
        bars={forced.map((r) => ({ label: r.algorithm, value: r.cost, display: Math.round(r.cost).toLocaleString(), hue: r.node === Q.forced.chosen ? 6 : 7, note: r.node === Q.forced.chosen ? 'chosen by the planner' : 'forced' }))}
      />
      <BarChart
        title="Measured execution time, ms (recorded; all data in memory)"
        bars={forced.map((r) => ({ label: r.algorithm, value: r.ms, display: `${r.ms.toFixed(1)} ms`, hue: r.node === Q.forced.chosen ? 6 : 7, note: r.node === Q.forced.chosen ? 'chosen by the planner' : 'forced' }))}
      />
      <Callout tone="note" title="Cost is not time">
        The planner chose the {Q.forced.chosen.toLowerCase()} because its cost was lowest, yet the fastest recorded run was the {fastest.algorithm} ({fastest.ms.toFixed(0)} ms). Costs assume pages
        may come from disk (<code>random_page_cost = 4</code>); here everything was in shared buffers, where walking two indexes in order is cheap. That
        gap is what <code>random_page_cost</code> tuning is for — and why you measure with EXPLAIN ANALYZE instead of trusting costs.
      </Callout>
      <QueryPlanningJoinCost />

      <h2>Reading EXPLAIN (ANALYZE, BUFFERS)</h2>
      <p>EXPLAIN ANALYZE runs the query and prints, next to each estimate, what really happened.</p>
      <Table
        head={['Part', 'Example', 'Meaning']}
        rows={[
          [<code key="k360-13">cost=a..b</code>, <code key="k360-37">{quote(Q.joins.nested, /cost=[\d.]+\.\.[\d.]+/)}</code>, 'estimated startup..total cost'],
          [<code key="k361-13">rows= width=</code>, <code key="k361-40">{quote(Q.joins.nested, /rows=\d+ width=\d+/)}</code>, 'estimated rows out of this node, average row bytes'],
          [<code key="k362-13">actual time=a..b</code>, <code key="k362-44">{quote(Q.joins.nested, /actual time=[\d.]+\.\.[\d.]+/)}</code>, 'ms to the first row..last row, per loop, including children'],
          [<code key="k363-13">rows= loops=</code>, <code key="k363-40">{quote(Q.joins.nested, /rows=[\d.]+ loops=(?!1\))\d+/)}</code>, 'actual rows per loop (averaged, so decimals in PG 18), and how often the node ran'],
          [<code key="k364-13">Buffers: shared hit= read=</code>, <code key="k364-54">{quote(Q.joins.nested, /shared hit=\d+/)}</code>, 'pages found in shared buffers / read from the OS; dirtied, written; temp = spill files'],
          [<code key="k365-13">Rows Removed by Filter</code>, <code key="k365-50">{quote(Q.stale.before, /Rows Removed by Filter: \d+/).split(': ')[1]}</code>, 'rows read but thrown away — a hint an index could help'],
        ]}
      />
      <p>
        Read a plan from the most indented nodes outwards: they run first and feed their parents. Compare estimated and actual rows at every node —
        the first node where they differ by 10× or more is usually where the plan went wrong.
      </p>
      <QueryPlanningPlanTree
        plans={[
          { label: 'report', ...Q.report },
          { label: 'nested loop', ...Q.joins.nested },
          { label: 'parallel', ...Q.parallel.plan },
          { label: 'stale stats', ...Q.stale.before },
          { label: 'spilled sort', ...Q.spill.small },
        ]}
        describe={DESCRIBE}
      />
      <Callout tone="warn" title="ANALYZE really runs the statement">
        <code>EXPLAIN ANALYZE DELETE …</code> deletes. Wrap writes in <code>BEGIN; EXPLAIN ANALYZE …; ROLLBACK;</code>. Timing every row has overhead;
        use <code>TIMING OFF</code> when only row counts and buffers matter. For queries in production, <code>auto_explain</code> logs the plans of slow
        statements.
      </Callout>

      <h2>Parallel query</h2>
      <p>For big scans and aggregates, the leader process can start workers that each take a share of the table.</p>
      <Flow
        title="SELECT status, count(*), avg(amount) FROM orders GROUP BY status — with 2 workers"
        cols={4}
        rows={3}
        nodes={[
          { id: 'heap', label: 'orders', sub: 'blocks handed out', col: 0, row: 1, hue: 3, shape: 'store' },
          { id: 'w1', label: 'worker 1', sub: 'scan → 5 partial groups', col: 1, row: 0, hue: 2 },
          { id: 'lead', label: 'leader', sub: 'scan → 5 partial groups', col: 1, row: 1, hue: 1 },
          { id: 'w2', label: 'worker 2', sub: 'scan → 5 partial groups', col: 1, row: 2, hue: 2 },
          { id: 'gather', label: 'Gather Merge', sub: '15 rows, in the leader', col: 2, row: 1 },
          { id: 'final', label: 'Finalize', sub: '5 groups', col: 3, row: 1, hue: 6 },
        ]}
        edges={[
          { from: 'heap', to: 'w1', hue: 3, flow: true },
          { from: 'heap', to: 'lead', hue: 3, flow: true },
          { from: 'heap', to: 'w2', hue: 3, flow: true },
          { from: 'w1', to: 'gather', hue: 2 },
          { from: 'lead', to: 'gather', hue: 1 },
          { from: 'w2', to: 'gather', hue: 2 },
          { from: 'gather', to: 'final' },
        ]}
        caption="Each process groups its own share; the leader merges 3 × 5 partial groups into 5. The leader scans too, unless parallel_leader_participation is off."
      />
      <CodeBlock language="text" title={`recorded — ${Q.parallel.plan.sql}`} code={planText(Q.parallel.plan)} />
      <BarChart
        title={`Execution time by max_parallel_workers_per_gather (recorded, median of 3, ${Q.parallel.cpus} CPUs)`}
        bars={Q.parallel.timings.map((t) => ({ label: `setting ${t.workers}`, value: t.ms, display: `${t.ms.toFixed(1)} ms`, hue: t.workers === 0 ? 3 : 2, note: t.workers === 0 ? 'no workers: the leader scans alone' : t.workers > 2 ? 'the plan still uses 2 workers' : undefined }))}
      />
      <p>
        Two workers cut the time from {workers0.toFixed(0)} to {workers2.toFixed(0)} ms. Four were allowed but the plan still used two: the planner
        adds a worker each time the table triples past <code>min_parallel_table_scan_size</code> (8 MB), and this {mb(orders.bytes)} table earns
        two. Workers cost a process start (<code>parallel_setup_cost</code>) and per-row transfer (<code>parallel_tuple_cost</code>), so short queries
        never go parallel.
      </p>

      <h2>work_mem: sorts and hashes that spill</h2>
      <p>Each sort or hash node may use up to work_mem of memory; beyond that it writes temporary files.</p>
      <StatTiles
        stats={[
          { label: "work_mem = '1MB'", value: `${executionMs(Q.spill.small.plan).toFixed(0)} ms`, sub: spillSort, hue: 4 },
          { label: "work_mem = '64MB'", value: `${executionMs(Q.spill.big.plan).toFixed(0)} ms`, sub: memSort, hue: 6 },
          { label: 'with LIMIT 10', value: `${executionMs(Q.spill.topN.plan).toFixed(0)} ms`, sub: lineWith(Q.spill.topN.plan, 'Sort Method'), hue: 7 },
          { label: "hash join, work_mem = '256kB'", value: `${executionMs(Q.spill.hashSmall.plan).toFixed(0)} ms`, sub: hashBatches, hue: 4 },
        ]}
      />
      <Tabs
        items={[
          { label: 'external merge (1MB)', content: <CodeBlock language="text" title={`recorded — ${Q.spill.small.sql}`} code={planText(Q.spill.small)} /> },
          { label: 'quicksort (64MB)', content: <CodeBlock language="text" title="recorded" code={planText(Q.spill.big)} /> },
          { label: 'top-N heapsort', content: <CodeBlock language="text" title={`recorded — ${Q.spill.topN.sql}`} code={planText(Q.spill.topN)} /> },
          { label: 'hash in batches', content: <CodeBlock language="text" title={`recorded — ${Q.spill.hashSmall.sql}`} code={planText(Q.spill.hashSmall)} /> },
        ]}
      />
      <p>
        The spilled sort wrote and read back temp files (<code>temp read/written</code>) yet was not dramatically slower: the files sat in the OS cache.
        On a busy server they hit the disk. A top-N heapsort keeps only the best 10 rows, so <code>ORDER BY … LIMIT</code> needs almost no memory.
      </p>
      <Callout tone="warn" title="work_mem is per node, per process">
        One query with three sorts and two hashes, run by 4 parallel processes in 100 connections, can use work_mem many hundreds of times over.
        Keep the server default modest (4 MB here) and raise it for one session or role that runs big reports: <code>SET work_mem = '256MB'</code>.
        Hash nodes get <code>work_mem × hash_mem_multiplier</code> (2.0 by default). Watch <code>log_temp_files</code> and{' '}
        <code>temp_blks_written</code> in pg_stat_statements to find spills.
      </Callout>

      <h2>Checklist: when a query is slow</h2>
      <ul>
        <li>Run <code>EXPLAIN (ANALYZE, BUFFERS)</code> on the real query with real parameters, on production-sized data.</li>
        <li>Find the first node (deepest first) where estimated and actual rows differ by 10× or more. Fix the estimate: <code>ANALYZE</code>, extended statistics, a higher statistics target.</li>
        <li>Look for large <code>Rows Removed by Filter</code> on a Seq Scan — a candidate for an index (<a href="#/postgres/indexes">B-tree indexes</a>, <a href="#/postgres/index-types">other index types</a>).</li>
        <li>Look for <code>Disk:</code>, <code>external merge</code>, <code>Batches: 2+</code> or <code>temp written</code> — raise work_mem for that workload, or sort less.</li>
        <li>Nested loop with a large <code>loops=</code> on the inner side: was the outer row count misestimated?</li>
        <li>Lots of <code>read=</code> rather than <code>hit=</code>: the data is not cached; the second run will look much faster.</li>
        <li>Never leave <code>enable_*</code> settings off in production; fix the statistics or the costs instead.</li>
      </ul>

      <Recap
        points={[
          'The planner picks the cheapest plan by its own estimates; estimates come from pg_stats, which ANALYZE fills from a sample.',
          'Estimated rows = selectivity × rows: frequencies for common values, 1/n_distinct for others, histogram buckets for ranges. Correlated columns and stale statistics break it.',
          `A Seq Scan costs pages × seq_page_cost + rows × cpu_tuple_cost (+ cpu_operator_cost per condition): ${byHandFilter.toLocaleString()} for this table, exactly as EXPLAIN printed.`,
          'Seq, index, bitmap and index-only scans trade sequential reads against fewer pages; nested loop, hash and merge joins trade lookups, memory and sort order.',
          'Read EXPLAIN ANALYZE from the leaves up, compare estimated and actual rows, and watch for temp files when sorts and hashes outgrow work_mem.',
        ]}
      />
    </>
  )
}
