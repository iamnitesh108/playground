import { BarChart, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { IndexTypesBrinView } from '../components/IndexTypesBrinView'
import { IndexTypesGinView } from '../components/IndexTypesGinView'
import { QUERIES } from '../data/queries'
import { lineWith } from '../simulation/queryPlanningPlan'
import styles from './lesson.module.css'

const Q = QUERIES
const planText = (p: { plan: readonly string[] }) => p.plan.join('\n')
/** Pages a plan touched: hit + read on its top Buffers line. */
const pagesOf = (p: { plan: readonly string[] }) => {
  const line = lineWith(p.plan, 'Buffers: shared')
  return Number(/hit=(\d+)/.exec(line)?.[1] ?? 0) + Number(/read=(\d+)/.exec(line)?.[1] ?? 0)
}
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`)
const productIndex = (name: string) => Q.sizes.products.find((s) => s.name === name)!.bytes
const gistSize = (name: string) => Q.gist.sizes.find((s) => s.name === name)!.bytes

/** Booking ranges from the recorded psql output, in hours after midnight of the first day shown. */
const ranges = (text: string) => [...text.matchAll(/\["?([\d-]+ [\d:]+)\+00"?,"?([\d-]+ [\d:]+)\+00"?\)/g)].map((m) => [m[1], m[2]] as const)
const [okRange] = ranges(Q.gist.ok)
const [attempt, existing] = ranges(Q.gist.conflict)
const day0 = Date.parse(`${okRange[0].slice(0, 10)}T00:00:00Z`)
const hours = (ts: string) => (Date.parse(`${ts.replace(' ', 'T')}Z`) - day0) / 3_600_000
const label = (ts: string) => ts.slice(5, 16)

const brinPages = Math.round(Q.brin.sizes.heap / 8192)
const BRIN_TABLE = { rows: Q.brin.rows, pages: brinPages, step: 3, pagesPerRange: 128 }

export default function IndexTypes() {
  const p = Q.partial
  const g = Q.gin
  const b = Q.brin
  return (
    <>
      <LessonGoals
        goals={[
          'shrink an index to the rows you query with a partial index, and index an expression',
          'search JSONB, arrays, words and substrings with GIN, and know why GIN is bigger and slower to update',
          'prevent overlapping bookings with a GiST exclusion constraint, and find nearest neighbours',
          'index a huge append-only table with a BRIN index a thousand times smaller than a B-tree',
          'pick the right index type from a comparison of recorded sizes and plans',
        ]}
        before={
          <>
            <a href="#/postgres/indexes">B-tree indexes</a> and reading plans from <a href="#/postgres/query-planning">Query planning and EXPLAIN</a>
          </>
        }
      />

      <h2>Beyond “one B-tree per column”</h2>
      <p>PostgreSQL has several index types, each built for a different kind of question.</p>
      <p>
        A B-tree answers <code>=</code>, <code>&lt;</code>, <code>BETWEEN</code> and <code>ORDER BY</code> on sortable values — most of the time
        that is all you need. But “which products have <em>this</em> attribute”, “which rows contain <em>this</em> word”, “do these two time ranges{' '}
        <em>overlap</em>” and “which store is <em>nearest</em>” are not questions about sort order. All recordings below are from PostgreSQL{' '}
        {Q.version.split(' ')[0]}.
      </p>
      <TermList
        items={[
          { term: 'access method', definition: 'The kind of index: btree, hash, gin, gist, spgist, brin. Chosen with CREATE INDEX … USING gin (…).' },
          { term: 'operator class', definition: 'Which operators an index supports for a type, e.g. jsonb_ops vs jsonb_path_ops, or gin_trgm_ops for LIKE.' },
          { term: 'partial index', definition: 'An index with a WHERE clause: it contains only the rows that match it.' },
          { term: 'lossy', definition: 'An index that may return rows that do not match; EXPLAIN shows a Recheck and “Rows Removed by Index Recheck”.' },
          { term: 'posting list', definition: 'In GIN: the sorted list of rows that contain one key (a word, a JSON key/value, an array element).' },
        ]}
      />

      <h2>Partial indexes</h2>
      <p>A partial index stores only the rows your queries ask for.</p>
      <p>
        Only 2 % of orders are <code>NEW</code>, but the order queue queries exactly those, all the time. Index just them:
      </p>
      <CodeBlock language="sql" code={p.ddl} />
      <BarChart
        title="Index on created_at (recorded size)"
        bars={[
          { label: 'all 500,000 orders', value: p.sizes.full, display: size(p.sizes.full), hue: 7 },
          { label: "WHERE status = 'NEW'", value: p.sizes.partial, display: size(p.sizes.partial), hue: 6 },
        ]}
      />
      <Tabs
        items={[
          { label: "status = 'NEW'", content: <CodeBlock language="text" title={`recorded — ${p.plan.sql}`} code={planText(p.plan)} /> },
          { label: "status = 'PAID'", content: <CodeBlock language="text" title={`recorded — ${p.other.sql}`} code={planText(p.other)} /> },
        ]}
      />
      <p>
        The planner uses a partial index only when the query’s WHERE clause implies the index’s — <code>status = 'PAID'</code> cannot use it and fell
        back to the full index with a Filter. Partial indexes are also how you make something unique only among some rows:{' '}
        <code>CREATE UNIQUE INDEX ON users (email) WHERE deleted_at IS NULL</code>.
      </p>

      <h2>Expression indexes</h2>
      <p>An index can store the result of an expression instead of a column.</p>
      <p>
        A query on <code>lower(email)</code> cannot use an index on <code>email</code> — the planner only matches the exact expression.
      </p>
      <Tabs
        items={[
          { label: 'no index', content: <CodeBlock language="text" title={`recorded — ${Q.expression.before.sql}`} code={planText(Q.expression.before)} /> },
          { label: 'expression index', content: <><CodeBlock language="sql" code={Q.expression.ddl} /><CodeBlock language="text" title="recorded" code={planText(Q.expression.after)} /></> },
        ]}
      />
      <Callout tone="tip" title="Write the query exactly like the index">
        <code>WHERE lower(email) = …</code> uses it; <code>WHERE email ILIKE …</code> does not. Expressions must be immutable (no <code>now()</code>), and
        the planner needs statistics on them — ANALYZE collects them for each expression index.
      </Callout>

      <h2>GIN: many keys per row</h2>
      <p>GIN (generalised inverted index) indexes the parts of a value — words, JSON keys, array elements — each pointing to the rows that have it.</p>
      <IndexTypesGinView />
      <p>
        One product row from a {Q.products.rows.toLocaleString()}-row table ({size(Q.products.heap)}), with JSONB attributes and a <code>text[]</code> of tags:
      </p>
      <CodeBlock language="text" title="recorded" code={Q.products.sample} />
      <Tabs
        items={[
          {
            label: 'JSONB @>',
            content: (
              <>
                <CodeBlock language="sql" code={g.ddl.json} />
                <CodeBlock language="text" title={`recorded — ${g.json.sql}`} code={planText(g.json)} />
                <p>
                  <code>@&gt;</code> means “contains”: the index looks up three key/value pairs and intersects their rows. {pagesOf(g.json)} pages instead
                  of {pagesOf(g.before.json).toLocaleString()} for a Seq Scan.
                </p>
              </>
            ),
          },
          {
            label: 'jsonb_path_ops',
            content: (
              <>
                <CodeBlock language="sql" code={g.ddl.jsonPath} />
                <CodeBlock language="text" title="recorded — the same query" code={planText(g.jsonPath)} />
                <p>
                  <code>jsonb_path_ops</code> hashes each path-to-value into one key: smaller ({size(productIndex('products_attrs_path_idx'))} vs{' '}
                  {size(productIndex('products_attrs_idx'))}) and fewer index pages per search, but it only supports <code>@&gt;</code> (and jsonpath
                  matches), not “has key” operators like <code>?</code>.
                </p>
              </>
            ),
          },
          {
            label: 'broad match',
            content: (
              <>
                <CodeBlock language="text" title={`recorded — ${g.jsonBroad.sql}`} code={planText(g.jsonBroad)} />
                <p>
                  1 in 24 products is red and size M, but they are spread over almost every page: the index finds them quickly, then reading them costs as
                  much as a Seq Scan. Any index only pays off for selective conditions.
                </p>
              </>
            ),
          },
          {
            label: 'array @>',
            content: (
              <>
                <CodeBlock language="sql" code={g.ddl.tags} />
                <CodeBlock language="text" title={`recorded — ${g.tags.sql}`} code={planText(g.tags)} />
                <p>Arrays work the same way: one key per element. Here too the match (5 % of rows) is too broad to save heap pages.</p>
              </>
            ),
          },
          {
            label: 'full-text @@',
            content: (
              <>
                <CodeBlock language="sql" code={`ALTER TABLE products ADD COLUMN search tsvector\n  GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || description)) STORED;\n${g.ddl.fts}`} />
                <CodeBlock language="text" title="recorded — the stored tsvector: normalised words and their positions" code={g.tsvector} />
                <CodeBlock language="text" title={`recorded — ${g.fts.sql}`} code={planText(g.fts)} />
                <p>
                  The query is normalised the same way (<code>skiing</code> became <code>ski</code>); the index intersects three posting lists.
                </p>
              </>
            ),
          },
        ]}
      />

      <h3>Substrings with pg_trgm</h3>
      <p>
        <code>LIKE '%x%'</code> cannot use a B-tree: there is no prefix to search for. The <code>pg_trgm</code> extension splits text into three-letter
        pieces (trigrams) and indexes those with GIN:
      </p>
      <CodeBlock language="sql" code={`CREATE EXTENSION pg_trgm;\n${g.ddl.trgm}`} />
      <CodeBlock language="text" title="recorded — SELECT show_trgm('wool')" code={g.trigrams} />
      <Tabs
        items={[
          { label: 'Seq Scan', content: <CodeBlock language="text" title={`recorded — ${g.before.trgm.sql}`} code={planText(g.before.trgm)} /> },
          { label: 'trigram index', content: <CodeBlock language="text" title="recorded" code={planText(g.trgm)} /> },
        ]}
      />
      <BarChart
        title="Pages read (recorded)"
        bars={[
          { label: 'JSONB @>: Seq Scan', value: pagesOf(g.before.json), hue: 3 },
          { label: 'JSONB @>: GIN jsonb_ops', value: pagesOf(g.json), hue: 7 },
          { label: 'JSONB @>: GIN jsonb_path_ops', value: pagesOf(g.jsonPath), hue: 7 },
          { label: "ILIKE '%…%': Seq Scan", value: pagesOf(g.before.trgm), hue: 3 },
          { label: "ILIKE '%…%': GIN trigram", value: pagesOf(g.trgm), hue: 7 },
        ]}
      />
      <Callout tone="warn" title="The price of GIN">
        One row creates many index entries, so GIN indexes are large (the trigram index is {size(productIndex('products_description_trgm_idx'))} for a{' '}
        {size(Q.products.heap)} table) and slow to build ({g.buildMs.trgm} ms here vs {g.buildMs.tags} ms for the tags). To keep inserts fast, GIN collects
        new entries in a <em>pending list</em> (<code>fastupdate</code>, up to <code>gin_pending_list_limit</code>, 4 MB) and merges them later — searches
        must scan that list too, and an insert that triggers the merge is slow.
      </Callout>

      <h2>GiST: overlaps, containment and distance</h2>
      <p>GiST (generalised search tree) stores bounding boxes or ranges, so it can answer “overlaps”, “contains” and “nearest”.</p>
      <p>
        A room may not be double-booked. A UNIQUE constraint cannot express that — two bookings conflict when their time ranges <em>overlap</em>, not
        when they are equal. An exclusion constraint can (<code>btree_gist</code> lets GiST handle the plain <code>=</code> on <code>room_id</code>):
      </p>
      <CodeBlock language="sql" code={`CREATE EXTENSION btree_gist;\n${Q.gist.ddl}`} />
      <CodeBlock language="text" title="recorded — INSERT … VALUES (7, '[2026-03-10 14:00, 2026-03-11 11:00)') RETURNING room_id, during" code={Q.gist.ok} />
      <CodeBlock language="text" title="recorded — INSERT … VALUES (7, '[2026-03-10 18:00, 2026-03-12 11:00)')" code={Q.gist.conflict} />
      <Timeline
        title={`Room 7 from ${okRange[0].slice(0, 10)} (recorded bookings, hours)`}
        lanes={[
          { id: 'room', label: 'room 7 bookings' },
          { id: 'new', label: 'new request' },
        ]}
        segments={[
          ...[okRange, existing]
            .filter((r, i, all) => all.findIndex((x) => x[0] === r[0]) === i)
            .map((r) => ({ lane: 'room', from: hours(r[0]), to: hours(r[1]), label: `${label(r[0])} → ${label(r[1])}`, hue: 6 as const })),
          { lane: 'new', from: hours(attempt[0]), to: hours(attempt[1]), label: 'rejected: overlaps', hue: 8, striped: true },
        ]}
        end={Math.ceil(Math.max(hours(existing[1]), hours(attempt[1]), hours(okRange[1])) / 12) * 12}
        unit="h"
      />
      <p>
        The constraint is enforced by the GiST index, which also serves queries — overlap search among {Q.gist.rows.toLocaleString()} bookings:
      </p>
      <CodeBlock language="text" title={`recorded — ${Q.gist.overlap.sql}`} code={planText(Q.gist.overlap)} />
      <p>
        <strong>Nearest neighbour.</strong> With a GiST index on a <code>point</code>, <code>ORDER BY location &lt;-&gt; point</code> walks the tree
        nearest-first and stops after the LIMIT — no need to compute the distance to all {(100000).toLocaleString()} stores:
      </p>
      <CodeBlock language="text" title={`recorded — ${Q.gist.knn.sql}`} code={planText(Q.gist.knn)} />
      <CodeBlock language="text" title="recorded — the 3 nearest stores" code={Q.gist.knnRows} />
      <Callout tone="note" title="Real geography">
        <code>point</code> is flat x/y. For latitude and longitude on the earth, use the PostGIS extension (<code>geography</code> type), whose
        indexes are GiST too.
      </Callout>

      <h2>BRIN: tiny summaries for huge, ordered tables</h2>
      <p>BRIN (block range index) stores only the minimum and maximum of each range of 128 pages.</p>
      <p>
        An append-only <code>events</code> table: {b.rows.toLocaleString()} rows, one every 3 seconds, {size(b.sizes.heap)}. Rows arrive in time
        order, so <code>created_at</code> follows the physical order exactly (correlation {b.correlation}).
      </p>
      <CodeBlock language="sql" code={b.ddl} />
      <CodeBlock language="text" title="recorded — the first three summaries (pageinspect brin_page_items)" code={b.summary} />
      <IndexTypesBrinView table={BRIN_TABLE} />
      <StatTiles
        stats={[
          { label: 'B-tree on created_at', value: size(b.sizes.btree), sub: `built in ${b.btreeBuildMs} ms · ${pagesOf(b.btree)} pages for one hour`, hue: 7 },
          { label: 'BRIN on created_at', value: size(b.sizes.brin), sub: `built in ${b.brinBuildMs} ms · ${pagesOf(b.brin)} pages for one hour`, hue: 6 },
          { label: 'size ratio', value: `${Math.round(b.sizes.btree / b.sizes.brin).toLocaleString()}×`, sub: 'smaller, for the same table', hue: 6 },
          { label: 'pages read by BRIN, rows shuffled', value: pagesOf(b.shuffled).toLocaleString(), sub: `correlation ${b.shuffledCorrelation.toFixed(3)}: every range matches`, hue: 8 },
        ]}
      />
      <Tabs
        items={[
          { label: 'Seq Scan', content: <CodeBlock language="text" title={`recorded — ${b.seq.sql}`} code={planText(b.seq)} /> },
          { label: 'B-tree', content: <CodeBlock language="text" title="recorded" code={planText(b.btree)} /> },
          { label: 'BRIN', content: <CodeBlock language="text" title="recorded" code={planText(b.brin)} /> },
          { label: 'BRIN, shuffled table', content: <CodeBlock language="text" title={`recorded — ${b.shuffled.sql}`} code={planText(b.shuffled)} /> },
        ]}
      />
      <p>
        BRIN is lossy: it reads whole ranges (<code>Heap Blocks: lossy=…</code>) and rechecks every row in them, so it read {pagesOf(b.brin)} pages where
        the B-tree read {pagesOf(b.btree)}. In exchange it is {Math.round(b.sizes.btree / b.sizes.brin).toLocaleString()} times smaller and nearly free to
        maintain. On the shuffled copy every range spans the whole period and the index is useless.
      </p>
      <Predict
        question={<p>Which column of an <code>orders</code> table is a good BRIN candidate?</p>}
        options={['customer_id', 'status', 'created_at, in an insert-only table', 'email']}
        answer={2}
        explanation="BRIN needs values that follow the physical order of rows: timestamps or serial ids in tables that are only appended to. Updates and deletes that move rows around, or values in random order, destroy that correlation."
      />

      <h2>Hash indexes</h2>
      <p>A hash index stores a 4-byte hash of each value and answers only “equals”.</p>
      <CodeBlock language="sql" code={Q.hash.ddl} />
      <CodeBlock language="text" title={`recorded — ${Q.hash.plan.sql}`} code={planText(Q.hash.plan)} />
      <p>
        On these long <code>sku</code> strings it is smaller than the B-tree ({size(productIndex('products_sku_hash_idx'))} vs{' '}
        {size(productIndex('products_sku_btree_idx'))}) and a lookup touches a bucket page and the heap. Since PostgreSQL 10 hash indexes are
        WAL-logged and crash-safe. They cannot be unique, cover several columns, or serve ranges and ORDER BY, so a B-tree is usually still the
        default choice.
      </p>

      <h2>Choosing an index type</h2>
      <p>Pick by the question the query asks, then check the size and the plan.</p>
      <Table
        head={['Type', 'Answers', 'Typical use', 'Recorded size here']}
        rows={[
          ['B-tree', '= < > BETWEEN, ORDER BY; LIKE \'abc%\' with text_pattern_ops or the C collation', 'almost everything; unique constraints', `${size(b.sizes.btree)} (2,000,000 timestamps)`],
          ['partial B-tree', 'the same, for a subset of rows', 'queues, soft deletes, “active” rows', `${size(p.sizes.partial)} vs ${size(p.sizes.full)} full`],
          ['GIN', '@> ? && @@, LIKE \'%x%\' (pg_trgm)', 'JSONB, arrays, full-text search, substrings', `${size(productIndex('products_attrs_idx'))} JSONB · ${size(productIndex('products_search_idx'))} full-text`],
          ['GiST', '&& @> <-> (overlap, contains, distance)', 'ranges, exclusion constraints, geometry, nearest neighbour', `${size(gistSize('bookings_room_id_during_excl'))} (${Q.gist.rows.toLocaleString()} bookings)`],
          ['BRIN', '= < > on physically ordered values', 'huge append-only tables: logs, events, time series', size(b.sizes.brin)],
          ['hash', '= only', 'equality on long values', size(productIndex('products_sku_hash_idx'))],
        ]}
      />
      <BarChart
        title="Index sizes on the 200,000-row products table (recorded)"
        bars={Q.sizes.products.map((s) => ({
          label: s.name.replace('products_', '').replace('_idx', ''),
          value: s.bytes,
          display: size(s.bytes),
          hue: s.method === 'gin' ? 7 : s.method === 'hash' ? 5 : 3,
          note: `${s.method}`,
        }))}
      />
      <p className={styles.note}>Bar colour by access method: GIN, B-tree and hash; hover a bar for its method. The table itself is {size(Q.products.heap)}.</p>

      <h2>Checklist</h2>
      <ul>
        <li>Start from the query: which operator does it use (<code>=</code>, <code>@&gt;</code>, <code>&amp;&amp;</code>, <code>ILIKE '%…%'</code>)? That decides the index type and operator class.</li>
        <li>Most queries touch a known subset of rows? Make the index partial.</li>
        <li>Functions on columns in WHERE? Index the exact expression, or rewrite the query.</li>
        <li>JSONB queried only with <code>@&gt;</code>? Use <code>jsonb_path_ops</code>. Queried on one known key? A B-tree on <code>(attrs-&gt;&gt;'brand')</code> is smaller still.</li>
        <li>GIN on a write-heavy table: watch insert latency and the pending list; it is often worth it only for read-heavy data.</li>
        <li>Huge time-ordered table, queried by time ranges? Try BRIN before a B-tree — and keep the table append-only.</li>
        <li>Verify with EXPLAIN (ANALYZE, BUFFERS) that the index is used and reads fewer pages; check sizes with <code>pg_relation_size</code>.</li>
      </ul>

      <Recap
        points={[
          'Partial indexes cover only the rows a query asks for; expression indexes cover a computed value. Both must match the query’s WHERE exactly.',
          'GIN maps each word, element or key/value to the rows containing it: JSONB @>, arrays, full-text search and (with pg_trgm) LIKE \'%x%\'. Big and slower to update.',
          'GiST indexes ranges and shapes: overlap and nearest-neighbour search, and exclusion constraints that forbid overlapping bookings.',
          `BRIN keeps min/max per 128 pages: ${size(b.sizes.brin)} instead of ${size(b.sizes.btree)} — but only for values that follow the physical row order.`,
          'Hash indexes do only equality; B-tree remains the default.',
        ]}
      />
    </>
  )
}
