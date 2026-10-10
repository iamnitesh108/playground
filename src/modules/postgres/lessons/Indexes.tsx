import type { ReactNode } from 'react'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs } from '@/shared/ui'
import { BTreePlayground } from '../components'
import { CAPTURE } from '../data/captures'

const EXPLAIN: Record<string, ReactNode> = {
  'seq scan': (
    <>No index on <code>customer_id</code> yet: PostgreSQL reads all 764 pages and throws away 99,980 rows to find 20.</>
  ),
  'index on customer_id': (
    <>
      After <code>CREATE INDEX ON orders (customer_id)</code>: a <strong>bitmap</strong> scan. The index finds the 20 matching row addresses
      (2 index pages), sorts them by page, then reads 20 heap pages. 22 pages instead of 764.
    </>
  ),
  'primary key lookup': (
    <>One row by primary key: root page, leaf page, heap page — <code>shared hit=3</code>. That is the tree height plus one.</>
  ),
  'range on primary key': (
    <>A range: descend once, then walk the leaf level left to right. 101 rows in 5 pages, because ids were inserted in order and sit together.</>
  ),
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
  'composite: leading column': (
    <>An index on <code>(customer_id, created_at)</code> serves a filter on both columns: both conditions are index conditions.</>
  ),
  'composite: second column only': (
    <>
      Filtering only on the <em>second</em> column: the entries for one day are scattered across all customers, so here the planner chose a
      sequential scan. Put the column you filter by on its own first. (PostgreSQL 18 can “skip scan” such an index when the leading column has
      few distinct values; with 5,000 distinct customers the planner preferred a sequential scan.)
    </>
  ),
  'function on column': (
    <>
      <code>customer_id + 0 = 42</code> is not <code>customer_id = 42</code> to the planner: an expression on the column hides it from the
      index. The same happens with <code>lower(email)</code> or a cast — create an index on the expression instead.
    </>
  ),
}

export default function Indexes() {
  const { tableSize, btreeMeta, btreeRootStats, btreeLeafStats, plans } = CAPTURE
  return (
    <>
      <LessonGoals
        goals={[
          'search and grow a B-tree by hand, including page splits',
          'explain why a lookup in 100,000 rows reads 3 pages',
          'read EXPLAIN (ANALYZE, BUFFERS) and know when an index is not used',
        ]}
        before="Lesson 1 — 8 KB pages"
      />

      <h2>A sorted tree of pages</h2>
      <p>
        A table is a heap: rows sit wherever there was space. To find <code>id = 31337</code> without an index, every page must be read. A{' '}
        <strong>B-tree index</strong> keeps the keys sorted in a tree of pages. Each entry in a leaf page holds a key and the row’s ctid; each entry
        in an inner page holds a key and a pointer to a child page. A search starts at the root and follows one pointer per level.
      </p>
      <p>
        Real pages hold hundreds of keys. Here each page holds only 3 or 4, so the tree grows quickly. Insert keys, watch pages <strong>split</strong>{' '}
        when they are full, and search to see the path:
      </p>
      <BTreePlayground />

      <h2>The real numbers</h2>
      <p>
        A table <code>orders</code> with 100,000 rows: the heap is {tableSize.heap} ({tableSize.pages} pages), its primary-key index is{' '}
        {tableSize.pkey}. <code>pageinspect</code> shows the index’s shape:
      </p>
      <Table
        head={['', 'Recorded', 'Meaning']}
        rows={[
          ['root level', String(btreeMeta.level), 'Level 0 is the leaves, so: a root page above one level of leaves'],
          ['entries in the root', String(btreeRootStats.live_items), 'One per leaf page — the root points at all of them'],
          ['entries in a leaf', String(btreeLeafStats.live_items), `${btreeLeafStats.avg_item_size} bytes each: an 8-byte header holding the ctid, plus the 4-byte key padded to 8`],
        ]}
      />
      <Predict
        question={<p>How many pages does a lookup by primary key in this 100,000-row table read?</p>}
        options={['1', '3', '17 (log₂ of 100,000)', '764']}
        answer={1}
        explanation="Root → leaf → the heap page with the row. With ~367 keys per page, one more level would cover ~100 times as many rows: depth grows very slowly."
      />

      <h2>Reading plans</h2>
      <p>
        <code>EXPLAIN</code> shows the plan the planner chose; with <code>ANALYZE</code> it runs the query and adds what really happened, and{' '}
        <code>BUFFERS</code> counts pages: <em>hit</em> from shared buffers, <em>read</em> from the operating system. All plans below were recorded
        with <code>EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)</code>:
      </p>
      <Tabs
        items={plans.map((p) => ({
          label: p.label,
          content: (
            <>
              <CodeBlock title={p.sql} code={p.plan.join('\n')} />
              <p>{EXPLAIN[p.label]}</p>
            </>
          ),
        }))}
      />
      <Callout tone="note" title="PostgreSQL 18 output">
        Row counts show decimals (<code>rows=20.00</code>, averaged over loops), and index scans report <code>Index Searches</code> — how many times
        the tree was descended.
      </Callout>

      <h2>Indexes are not free</h2>
      <ul>
        <li>Every INSERT, and every non-HOT UPDATE, writes to every index of the table (lesson 3).</li>
        <li>Each index takes space and shared buffers. Look for unused ones: <code>pg_stat_user_indexes.idx_scan = 0</code>.</li>
        <li>
          On a busy table, build with <code>CREATE INDEX CONCURRENTLY</code>: it takes longer but does not block writes.
        </li>
        <li>The planner relies on statistics. After large data changes, run <code>ANALYZE</code> (autovacuum does it too).</li>
      </ul>

      <Recap
        points={[
          'A B-tree keeps keys sorted in pages; a full page splits and pushes a separator key up. The tree grows at the root.',
          'With hundreds of keys per page, 100,000 rows need a two-level tree: a lookup reads 3 pages.',
          'The planner skips an index when many rows match, when the leading column is not filtered, or when the column is inside an expression.',
          'Index-only scans avoid the heap when the visibility map says pages are all-visible.',
        ]}
      />
    </>
  )
}
