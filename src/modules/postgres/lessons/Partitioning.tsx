import { BarChart, Flow, Proportion, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { PartitioningPruningPlayground } from '../components/PartitioningPruningPlayground'
import { DURABILITY } from '../data/durability'

const P = DURABILITY.part
const MB = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
const kB = (b: number) => `${Math.round(b / 1024).toLocaleString()} kB`
const ms = (v: number) => `${v.toFixed(v < 1 ? 2 : 1)} ms`
const num = (text: string, re: RegExp) => Number(text.match(re)?.[1] ?? 0)
const pages = (text: string) => [...text.matchAll(/Buffers: shared (?:hit=(\d+))? ?(?:read=(\d+))?/g)][0]?.slice(1).reduce((n, v) => n + Number(v ?? 0), 0) ?? 0

/** Keeps the head and tail of a long recorded output and says how much was cut. */
function elide(text: string, head: number, tail: number, what: string): string {
  const lines = text.split('\n')
  if (lines.length <= head + tail + 1) return text
  return [...lines.slice(0, head), `   … ${lines.length - head - tail} lines cut: ${what} …`, ...lines.slice(-tail)].join('\n')
}

const rowsPerPart = P.sizes[0].rows
const partBytes = P.sizes[0].bytes
const del = P.dropVsDelete.delete
const drop = P.dropVsDelete.drop
const dropMs = drop.ms.reduce((a, b) => a + b, 0)
const month = { exec: num(P.prune.monthAnalyze, /Execution Time: ([\d.]+)/), pages: pages(P.prune.monthAnalyze) }
const year = { exec: num(P.prune.yearAnalyze, /Execution Time: ([\d.]+)/), pages: pages(P.prune.yearAnalyze) }
const nh = P.notHelp

export default function Partitioning() {
  return (
    <>
      <LessonGoals
        goals={[
          'split a big table by range, list or hash, and know which to pick',
          'read partition pruning in EXPLAIN — at planning time and at execution start',
          'add keys and indexes to a partitioned table, and handle rows that fit no partition',
          'remove a month of data with a catalog change instead of a row-by-row DELETE, and know when partitioning does not help',
        ]}
        before={
          <>
            <a href="#/postgres/query-planning">Query planning and EXPLAIN</a> and <a href="#/postgres/indexes">B-tree indexes</a>
          </>
        }
      />

      <h2>One table, many tables underneath</h2>
      <p>
        A partitioned table is a table whose rows are stored in several smaller tables, chosen by the value of one column. Queries and
        inserts still use the one name; PostgreSQL sends each row to the right partition and, where it can, reads only the partitions a query
        needs.
      </p>
      <TermList
        items={[
          { term: 'partitioned table', definition: 'The parent: it has columns and rules, but stores no rows itself.' },
          { term: 'partition', definition: 'An ordinary table attached to the parent, holding the rows whose key falls in its bounds.' },
          { term: 'partition key', definition: 'The column (or columns) that decide where a row goes, e.g. created_at.' },
          { term: 'pruning', definition: 'Leaving partitions out of a query because their bounds prove they cannot contain matching rows.' },
          { term: 'default partition', definition: 'Catches rows that fit no other partition.' },
          { term: 'detach', definition: 'Turning a partition back into a standalone table, in one quick catalog change.' },
        ]}
      />
      <Flow
        title="An INSERT is routed to the partition whose bounds contain its key"
        cols={4}
        rows={4}
        nodes={[
          { id: 'app', label: 'INSERT INTO events', sub: "created_at = '2026-03-14'", col: 0, row: 1, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'events', label: 'events', sub: 'partitioned · no rows', col: 1, row: 1, rowSpan: 2, hue: 7 },
          { id: 'jan', label: 'events_2026_01', sub: "FROM '2026-01-01' TO '2026-02-01'", col: 2, row: 0, span: 2, hue: 3, shape: 'store' },
          { id: 'feb', label: 'events_2026_02', sub: "FROM '2026-02-01' TO '2026-03-01'", col: 2, row: 1, span: 2, hue: 3, shape: 'store' },
          { id: 'mar', label: 'events_2026_03', sub: "FROM '2026-03-01' TO '2026-04-01'", col: 2, row: 2, span: 2, hue: 6, shape: 'store' },
          { id: 'more', label: '… 9 more months', sub: 'one table each', col: 2, row: 3, span: 2, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'app', to: 'events', hue: 1, flow: true },
          { from: 'events', to: 'jan', dashed: true, hue: 3 },
          { from: 'events', to: 'feb', dashed: true, hue: 3 },
          { from: 'events', to: 'mar', hue: 6, flow: true },
          { from: 'events', to: 'more', dashed: true, hue: 3 },
        ]}
        caption="The bounds are half-open: FROM is included, TO is not, so neighbouring months never overlap."
      />
      <p>Recorded: a table of events partitioned by month (two of the twelve CREATE statements shown).</p>
      <CodeBlock language="text" title="recorded" code={P.createRangeShown} />
      <CodeBlock language="text" title="recorded" code={P.describe} />
      <StatTiles
        title="What each recorded partition holds"
        stats={[
          { label: 'partitions', value: P.sizes.length, sub: 'one per month of 2026', hue: 7 },
          { label: 'rows per partition', value: rowsPerPart.toLocaleString(), sub: `${(rowsPerPart * P.sizes.length).toLocaleString()} in total`, hue: 3 },
          { label: 'size per partition', value: MB(partBytes), sub: 'heap only, before indexes', hue: 3 },
        ]}
      />

      <h2>Range, list or hash</h2>
      <p>The partitioning method decides how a key value maps to a partition.</p>
      <Table
        head={['Method', 'A row goes to the partition…', 'Good for', 'Example']}
        rows={[
          ['RANGE', 'whose FROM … TO interval contains the key', 'time series, retention by age', 'events by month'],
          ['LIST', 'whose list of values contains the key', 'a few known categories', 'customers by region'],
          ['HASH', 'with remainder = hash(key) mod MODULUS', 'spreading rows evenly when no natural range exists', 'carts by user id'],
        ]}
      />
      <Tabs
        items={[
          { label: 'LIST (region)', content: <CodeBlock language="text" title="recorded" code={P.list} /> },
          { label: 'HASH (user_id)', content: <CodeBlock language="text" title="recorded" code={P.hash} /> },
        ]}
      />
      <Proportion
        title="Recorded: 100,000 carts over 4 hash partitions"
        parts={P.hashCounts.map((h, i) => ({ label: h.name, value: h.rows, hue: (i % 2 ? 3 : 7) as 3 | 7 }))}
      />
      <Proportion
        title="Recorded: 70,000 customers over 3 list partitions"
        parts={P.listCounts.map((l, i) => ({ label: l.name, value: l.rows, hue: (i % 2 ? 7 : 3) as 3 | 7 }))}
      />
      <p>
        Hash spreads evenly but gives up ranges: a query for users 1–99 must read every hash partition (recorded above). Partitions can be
        partitioned again (for example by month, then by region), but every level multiplies the number of tables.
      </p>

      <h2>Partition pruning</h2>
      <p>
        Pruning is the reason partitioning speeds up queries: the planner compares the WHERE clause with each partition’s bounds and drops the
        partitions that cannot match.
      </p>
      <Predict
        question={
          <p>
            The table is partitioned by <code>created_at</code>. How many of the 12 partitions does{' '}
            <code>WHERE date_trunc('month', created_at) = '2026-03-01'</code> read?
          </p>
        }
        options={['1 — only March', '12 — all of them', '0 — it is answered from the catalog']}
        answer={1}
        explanation="Pruning only works when the query compares the partition key itself. date_trunc(created_at) is a different value, so the planner cannot match it to the bounds. Write created_at >= '2026-03-01' AND created_at < '2026-04-01' instead. Both plans are recorded below."
      />
      <Tabs
        items={[
          { label: 'range on the key', content: <CodeBlock language="text" title="recorded: one partition" code={P.prune.month} /> },
          { label: 'other column', content: <CodeBlock language="text" title="recorded: every partition, each through its own index" code={elide(P.prune.noKey, 9, 3, 'the same index scan on the other partitions')} /> },
          { label: 'expression on the key', content: <CodeBlock language="text" title="recorded: every partition" code={elide(P.prune.expr, 12, 3, 'the same scan on the other partitions')} /> },
          { label: 'pruning off', content: <CodeBlock language="text" title="recorded: enable_partition_pruning = off" code={elide(P.prune.off, 14, 3, 'the same scan on the other partitions')} /> },
        ]}
      />
      <BarChart
        title="Recorded with EXPLAIN (ANALYZE, BUFFERS): pages touched (shared hit + read)"
        bars={[
          { label: 'count one month (1 partition)', value: month.pages, display: `${month.pages.toLocaleString()} pages · ${ms(month.exec)}`, hue: 3 },
          { label: "kind = 'order', whole year (12)", value: year.pages, display: `${year.pages.toLocaleString()} pages · ${ms(year.exec)}`, hue: 3 },
        ]}
      />

      <h3>Pruning when the value is known only at run time</h3>
      <p>
        A prepared statement with a generic plan, or a filter such as <code>created_at &gt;= now() - interval '3 days'</code>, has no constant at
        planning time. The executor prunes instead, when it starts, and EXPLAIN reports how many partitions it removed:
      </p>
      <Tabs
        items={[
          { label: 'generic plan, $1', content: <CodeBlock language="text" title="recorded" code={P.prune.runtime} /> },
          { label: 'stable expression', content: <CodeBlock language="text" title="recorded" code={P.prune.stable} /> },
        ]}
      />
      <Callout tone="note" title="Subplans Removed">
        <code>Subplans Removed: 11</code> means 11 partitions were in the plan but skipped at execution start. Pruning can also happen during
        execution, for example per row of the outer side of a nested loop; EXPLAIN ANALYZE then shows partitions with <code>(never executed)</code>.
      </Callout>

      <PartitioningPruningPlayground />

      <h2>Keys, unique constraints and indexes</h2>
      <p>Each partition has its own indexes, so a constraint can only be checked inside one partition.</p>
      <p>
        That is why a primary key or unique constraint must include the partition key: uniqueness of <code>id</code> alone would need a check
        across all partitions, which PostgreSQL does not do. Recorded:
      </p>
      <CodeBlock language="text" title="recorded" code={P.pk} />
      <p>
        An index created on the parent is created on every partition, and on partitions added later. <code>CONCURRENTLY</code> is not allowed on
        the parent; the workaround is to create the parent index <code>ON ONLY</code> (invalid at first), build each partition’s index
        concurrently, and attach them — the parent index becomes valid when every partition has one.
      </p>
      <CodeBlock language="text" title="recorded" code={P.index} />
      <CodeBlock language="text" title="recorded (then the same for the other 11 months)" code={`${P.indexOnly}\n${P.indexOnlyValid}`} />

      <h2>Rows that fit no partition</h2>
      <p>A row whose key is outside every bound is rejected, unless a default partition exists.</p>
      <CodeBlock language="text" title="recorded" code={P.noPartition} />
      <CodeBlock language="text" title="recorded" code={P.withDefault} />
      <Callout tone="warn" title="Keep the default partition empty">
        Once the default partition holds a row for January 2027, creating the January 2027 partition fails (above): PostgreSQL would have to move
        the row. Creating a partition also scans the default partition to check it. Create partitions ahead of time, and alert when the default
        partition is not empty.
      </Callout>

      <h2>Dropping old data</h2>
      <p>Removing a whole partition is a catalog change, while DELETE has to visit and log every row.</p>
      <p>Recorded on two months of the same size ({rowsPerPart.toLocaleString()} rows each), with WAL volume measured from the LSN before and after:</p>
      <StatTiles
        stats={[
          { label: 'DELETE one month', value: ms(del.ms[0]), sub: `${MB(del.wal)} of WAL`, hue: 8, bar: { value: del.wal, max: del.wal } },
          { label: 'DETACH + DROP one month', value: ms(dropMs), sub: `${kB(drop.wal)} of WAL`, hue: 6, bar: { value: drop.wal, max: del.wal } },
          { label: 'WAL saved', value: `${Math.round(del.wal / drop.wal)}×`, sub: 'less to replicate and archive', hue: 4 },
        ]}
      />
      <BarChart
        title="Recorded WAL written to remove one month"
        unit=" MB"
        bars={[
          { label: 'DELETE … WHERE created_at in January', value: del.wal / 1024 / 1024, display: MB(del.wal), hue: 8 },
          { label: 'DETACH PARTITION + DROP TABLE', value: drop.wal / 1024 / 1024, display: MB(drop.wal), hue: 6 },
        ]}
      />
      <Tabs
        items={[
          { label: 'DELETE', content: <CodeBlock language="text" title="recorded" code={`${del.shown}\n${P.dropVsDelete.afterDelete}`} /> },
          { label: 'DETACH + DROP', content: <CodeBlock language="text" title="recorded" code={drop.shown} /> },
          { label: 'DETACH … CONCURRENTLY', content: <CodeBlock language="text" title="recorded" code={P.dropVsDelete.concurrently} /> },
        ]}
      />
      <p>
        The deleted month still takes {P.dropVsDelete.afterDelete.match(/\| (\d+ MB)/)?.[1] ?? 'its full size'} on disk: DELETE only marks rows dead,
        vacuum must clean them, and the space is reused, not returned. On a busy table the timing gap grows much larger than on this idle lab
        server, because DELETE also generates dead tuples, index work and replication traffic. A plain DETACH takes a strong lock on the parent
        briefly; <code>DETACH PARTITION … CONCURRENTLY</code> (not allowed while a default partition exists) waits for running queries instead of
        blocking them.
      </p>
      <Flow
        title="A monthly retention job (schematic)"
        cols={4}
        rows={1}
        nodes={[
          { id: 'next', label: 'create next month', sub: 'ahead of time', col: 0, row: 0, hue: 7 },
          { id: 'live', label: 'inserts land', sub: 'in the current month', col: 1, row: 0, hue: 3, shape: 'store' },
          { id: 'detach', label: 'detach oldest', sub: 'CONCURRENTLY', col: 2, row: 0, hue: 7 },
          { id: 'drop', label: 'archive, drop', sub: 'pg_dump, DROP TABLE', col: 3, row: 0, hue: 8 },
        ]}
        edges={[
          { from: 'next', to: 'live', hue: 3 },
          { from: 'live', to: 'detach', hue: 7 },
          { from: 'detach', to: 'drop', hue: 8 },
        ]}
        steps={[
          { title: 'Create partitions ahead', body: <p>A scheduled job (cron, pg_cron, or an extension such as pg_partman) creates next month’s partition days before it is needed, so no row ever falls into the default partition.</p>, active: ['next', 'next>live'] },
          { title: 'Writes go to the newest partition', body: <p>Inserts are routed by created_at; older partitions are read-only in practice and stay well packed.</p>, active: ['live'] },
          { title: 'Detach the oldest', body: <p><code>ALTER TABLE events DETACH PARTITION events_2025_10 CONCURRENTLY</code> — the table is now standalone and invisible to queries on events.</p>, active: ['live>detach', 'detach'] },
          { title: 'Archive and drop', body: <p>Dump it if the data must be kept elsewhere, then <code>DROP TABLE</code>: its files are unlinked. The recorded DETACH + DROP above wrote {kB(drop.wal)} of WAL, against {MB(del.wal)} for DELETE.</p>, active: ['detach>drop', 'drop'] },
        ]}
      />

      <h2>When partitioning does not help</h2>
      <p>Partitioning is a tool for managing big tables, not a general speed-up: a query that cannot prune pays for every partition.</p>
      <p>
        Recorded: {nh.rows.toLocaleString()} visits in {nh.partitions} daily partitions, against the same rows in one table with the same
        indexes (median of five runs each).
      </p>
      <BarChart
        title="Look up one visit by id (not the partition key), ms"
        bars={[
          { label: `${nh.partitions} partitions: planning`, value: nh.byIdPart.plan, display: ms(nh.byIdPart.plan), hue: 7 },
          { label: `${nh.partitions} partitions: execution`, value: nh.byIdPart.exec, display: ms(nh.byIdPart.exec), hue: 3 },
          { label: 'one table: planning', value: nh.byIdFlat.plan, display: ms(nh.byIdFlat.plan), hue: 7 },
          { label: 'one table: execution', value: nh.byIdFlat.exec, display: ms(nh.byIdFlat.exec), hue: 3 },
        ]}
      />
      <BarChart
        title="Count one day (the partition key), ms"
        bars={[
          { label: `${nh.partitions} partitions: plan + run`, value: nh.byDayPart.plan + nh.byDayPart.exec, display: ms(nh.byDayPart.plan + nh.byDayPart.exec), hue: 3 },
          { label: 'one table with an index on created_at', value: nh.byDayFlat.plan + nh.byDayFlat.exec, display: ms(nh.byDayFlat.plan + nh.byDayFlat.exec), hue: 3 },
        ]}
      />
      <CodeBlock language="text" title="recorded: one index scan per partition" code={nh.plan} />
      <p>
        Even the query that prunes to one day is no faster than a single indexed table here: a B-tree finds a day in a few page reads whatever
        the table size. Partitioning pays off when queries scan a large share of one partition, when old data is removed in bulk, and when
        vacuum and index maintenance on one huge table become the problem.
      </p>

      <h2>Design rules</h2>
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['Partition only big tables (tens of GB or more) with a clear access or retention pattern', 'Below that, one table with good indexes is simpler and as fast'],
          ['Pick the key your queries and your retention filter on, usually a timestamp', 'Pruning needs the key in the WHERE clause; drops need whole partitions to expire together'],
          ['Keep the number of partitions in the hundreds, not thousands', 'Planning time and memory grow with partitions that cannot be pruned'],
          ['Filter on the key itself, as a range — never on an expression of it', 'date_trunc(created_at) = … cannot prune'],
          ['Include the key in primary keys and unique constraints', 'Uniqueness is only enforced within one partition'],
          ['Create partitions ahead; keep the default partition empty and monitored', 'A row in the default partition blocks creating the matching partition'],
          ['Remove old data with DETACH … CONCURRENTLY and DROP, not DELETE', `Milliseconds and ${kB(drop.wal)} of WAL instead of a full scan and ${MB(del.wal)} (recorded above)`],
        ]}
      />

      <Recap
        points={[
          'A partitioned table routes each row to one partition by its key; the parent stores nothing.',
          'Pruning drops partitions whose bounds cannot match — at planning time for constants, at execution start for parameters and now().',
          'Primary keys must include the partition key; indexes on the parent are created on every partition.',
          'Rows outside every bound fail, or go to a default partition that you should keep empty.',
          'DETACH + DROP removes a month in milliseconds with almost no WAL; DELETE rewrites every row’s header and leaves the space behind.',
          'Queries that do not filter on the key get slower with every partition.',
        ]}
      />
    </>
  )
}
