import { BarChart, Flow, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { javaSection, outputSection, START_APP, tsSection, type AppSection } from '../components/UsingPostgresApp'
import { UsingPostgresPaging } from '../components/UsingPostgresPaging'
import { UsingPostgresPipeline } from '../components/UsingPostgresPipeline'
import { UsingPostgresUri } from '../components/UsingPostgresUri'
import { START } from '../data/start'
import { run } from '../simulation/usingPostgresQuery'
import own from './lesson.module.css'

const U = START.using
const version = START.version.split(' ')[0]

const innerRows = run({ from: 'inner', where: 'none', group: 'none', having: 'none', order: 'key', limit: 'none' })[0].rows.length
const leftRows = run({ from: 'left', where: 'none', group: 'none', having: 'none', order: 'key', limit: 'none' })[0].rows.length
const deep = U.paging.points[U.paging.points.length - 1]

/** One task from Java and from TypeScript: the code that ran and what it printed. */
function Ways({ section }: { section: AppSection }) {
  const items = [
    ...(section !== 'errors'
      ? [
          {
            label: 'Java (JDBC)',
            content: (
              <>
                <CodeBlock title="UsageDemo.java (excerpt of the code that ran)" language="java" code={javaSection(section)} />
                <CodeBlock title="recorded output" language="text" code={outputSection(U.java, section)} />
              </>
            ),
          },
        ]
      : []),
    {
      label: 'TypeScript (pg)',
      content: (
        <>
          <CodeBlock title="demo.ts (excerpt of the code that ran)" language="ts" code={tsSection(section)} />
          <CodeBlock title="recorded output" language="text" code={outputSection(U.ts, section)} />
        </>
      ),
    },
  ]
  return <Tabs items={items} />
}

const CHEATS: [string, string, string, string][] = [
  ['Connect', 'psql "postgresql://app@localhost:5432/shop"', 'pool.getConnection()', 'await pool.connect() / pool.query()'],
  ['List tables, describe one', '\\dt   \\d orders', '—', '—'],
  ['Insert, get the new id', 'INSERT … RETURNING id', 'ps.executeQuery() on … RETURNING id', "(await pool.query('… RETURNING id', [v])).rows[0].id"],
  ['Read with a filter', "SELECT … WHERE city = 'Lisbon'", 'WHERE city = ? + ps.setString(1, v)', "WHERE city = $1, ['Lisbon']"],
  ['Change rows', 'UPDATE … SET … WHERE … RETURNING *', 'ps.executeUpdate()', 'result.rowCount'],
  ['Remove rows', 'DELETE FROM … WHERE …', 'ps.executeUpdate()', 'result.rowCount'],
  ['Combine tables', 'JOIN … ON …  /  LEFT JOIN', 'same SQL', 'same SQL'],
  ['Totals per group', 'GROUP BY … HAVING …', 'same SQL', 'same SQL'],
  ['All or nothing', 'BEGIN; … COMMIT; / ROLLBACK;', 'setAutoCommit(false), commit(), rollback()', "client.query('BEGIN') … 'COMMIT' / 'ROLLBACK'"],
  ['Insert or update', 'INSERT … ON CONFLICT (k) DO UPDATE SET … EXCLUDED.…', 'same SQL', 'same SQL'],
  ['Many rows at once', 'COPY … FROM STDIN  /  \\copy', 'addBatch() + executeBatch()', 'INSERT … SELECT … FROM unnest($1::int[])'],
  ['Next page', 'WHERE id > :last ORDER BY id LIMIT 20', 'same SQL, ? for :last', 'same SQL, $1 for :last'],
  ['Time a query', '\\timing on', '—', '—'],
  ['Wide row, readable', '\\x on', '—', '—'],
]

export default function UsingPostgres() {
  return (
    <>
      <LessonGoals
        goals={[
          'connect with psql, a connection URI, environment variables or a .pgpass file, and find your way around with \\d commands',
          'create tables and insert, read, change and delete rows — with RETURNING to see what changed',
          'join tables, total them per group, and know the order in which a SELECT is evaluated',
          'use transactions, upserts, COPY and keyset pagination',
          'do the same from Java (JDBC) and TypeScript (node-postgres), with parameters and a transaction helper',
        ]}
        before={
          <>
            A running server (see <a href="#/postgres/setup">Install and configure</a>). Nothing about internals: this page is about using
            PostgreSQL; the later lessons show how it works.
          </>
        }
      />

      <h2>The whole picture</h2>
      <p>Your program sends SQL over one connection, and PostgreSQL runs it against tables in one database.</p>
      <Flow
        title="From your code to a row, and back"
        cols={4}
        rows={2}
        rowHeight={82}
        nodes={[
          { id: 'you', label: 'psql or your code', sub: 'sends SQL text', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'drv', label: 'driver + pool', sub: 'JDBC, pg, libpq', col: 1, row: 0, hue: 1 },
          { id: 'srv', label: 'PostgreSQL', sub: 'one process per connection', col: 2, row: 0, hue: 3 },
          { id: 'db', label: 'database shop', sub: 'tables, rows', col: 3, row: 0, hue: 3, shape: 'store' },
          { id: 'res', label: 'result', sub: 'rows, or a tag like INSERT 0 1', col: 1, row: 1, span: 2, hue: 6 },
        ]}
        edges={[
          { from: 'you', to: 'drv', flow: true, hue: 1 },
          { from: 'drv', to: 'srv', label: 'SQL', flow: true, hue: 1 },
          { from: 'srv', to: 'db', both: true, hue: 3 },
          { from: 'srv', to: 'res', dashed: true, hue: 6 },
        ]}
        caption="Colours follow the module legend: client side, table data, success."
      />
      <TermList
        items={[
          { term: 'database', definition: 'A named container of tables. One server (a cluster) holds many; a connection is always to exactly one.' },
          { term: 'schema', definition: 'A namespace inside a database. Tables you create go to public unless you say otherwise.' },
          { term: 'role', definition: 'A user name with privileges. You connect as a role.' },
          { term: 'psql', definition: 'The command-line client that ships with PostgreSQL. Lines starting with a backslash (\\dt) are psql commands, not SQL.' },
          { term: 'transaction', definition: 'A group of statements that succeed or fail together. Without BEGIN, each statement is its own transaction.' },
          { term: 'NULL', definition: 'No value. It is not equal to anything — not even to NULL — so filters use IS NULL.' },
        ]}
      />
      <p>
        Every output on this page was recorded on PostgreSQL {version}: the psql sessions are real, and the Java and TypeScript tabs show the code
        that ran and what it printed.
      </p>

      <h2>Connecting</h2>
      <p>To connect you need five things: host, port, database, role and password.</p>
      <CodeBlock title="recorded: three ways to pass them" language="text" code={U.connect} />
      <p>
        The first try fails on purpose: the server asked for a password and psql had none to give. The URI form is worth learning, because every
        driver accepts it:
      </p>
      <UsingPostgresUri
        title="A connection URI, part by part"
        parts={[
          { text: 'postgresql://', label: 'scheme', hue: 1 },
          { text: 'app', label: 'role', hue: 1 },
          { text: ':' },
          { text: 'app-secret', label: 'password', hue: 8 },
          { text: '@' },
          { text: 'localhost', label: 'host', hue: 3 },
          { text: ':' },
          { text: '5432', label: 'port', hue: 3 },
          { text: '/' },
          { text: 'shop', label: 'database', hue: 3 },
          { text: '?' },
          { text: 'sslmode=require', label: 'options', hue: 7 },
        ]}
        caption="sslmode=require refuses to connect without TLS; the recording above used sslmode=disable because the lab container has no certificate. Characters such as @ : / in a password must be percent-encoded (@ becomes %40). JDBC uses jdbc:postgresql://host:5432/shop with user and password passed separately."
      />
      <Table
        head={['psql flag', 'Environment variable', 'Meaning']}
        rows={[
          [<code key="h">-h localhost</code>, <code key="e">PGHOST</code>, 'host name, IP, or a socket directory such as /var/run/postgresql'],
          [<code key="p">-p 5432</code>, <code key="e">PGPORT</code>, 'port (5432 is the default)'],
          [<code key="u">-U app</code>, <code key="e">PGUSER</code>, 'role; defaults to your operating-system user name'],
          [<code key="d">-d shop</code>, <code key="e">PGDATABASE</code>, 'database; defaults to the role name'],
          ['(prompted)', <code key="e">PGPASSWORD</code>, 'password — better kept in ~/.pgpass'],
          [<code key="c">-c 'SQL'</code>, '—', 'run one command and exit; -f file.sql runs a file'],
          [<code key="x">-X</code>, '—', 'ignore ~/.psqlrc, for scripts that must behave the same everywhere'],
        ]}
      />
      <p>
        For daily use, put the password in <code>~/.pgpass</code> (one <code>host:port:database:role:password</code> line, file mode 600) and the
        rest in environment variables. Then plain <code>psql</code> connects, and <code>\conninfo</code> — a table since version 18 — confirms where:
      </p>
      <CodeBlock title="recorded: .pgpass and environment variables" language="text" code={U.pgpass} />
      <Callout tone="warn" title="Passwords on the command line leak">
        A password inside a URI or in <code>PGPASSWORD=… psql</code> ends up in your shell history and, while the command runs, in the process
        list. Fine on a lab box; on a shared server use <code>.pgpass</code>.
      </Callout>

      <h2>Finding your way around psql</h2>
      <p>Backslash commands ask psql to describe what is in the database.</p>
      <Table
        head={['Command', 'Shows']}
        rows={[
          [<code key="1">\l</code>, 'databases on this server'],
          [<code key="2">\c other_db</code>, 'connect to another database (same server)'],
          [<code key="3">\dt</code>, 'tables in the current schemas — \\dt+ adds sizes'],
          [<code key="4">\d orders</code>, 'one table: columns, types, defaults, indexes, constraints — \\d+ adds storage and comments'],
          [<code key="5">\dn, \du, \di</code>, 'schemas, roles, indexes'],
          [<code key="6">\x on</code>, 'expanded display: one column per line, for wide rows'],
          [<code key="7">\timing on</code>, 'print how long each statement took'],
          [<code key="8">\e, \i file.sql</code>, 'edit the last query in $EDITOR; run a file'],
          [<code key="9">\?, \h SELECT, \q</code>, 'psql help, SQL syntax help, quit'],
        ]}
      />

      <h2>Creating the tables</h2>
      <p>A table is a list of typed columns; constraints say which values are allowed.</p>
      <Flow
        title="The sample schema used on this page"
        cols={3}
        rows={2}
        rowHeight={86}
        width={760}
        nodes={[
          { id: 'customers', label: 'customers', sub: 'id · name · email · city', col: 0, row: 0, hue: 3, shape: 'store' },
          { id: 'orders', label: 'orders', sub: 'id · customer_id · product_id · …', col: 1, row: 0, hue: 3, shape: 'store' },
          { id: 'products', label: 'products', sub: 'id · name · price', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'stock', label: 'stock', sub: 'product_id · quantity', col: 2, row: 1, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'orders', to: 'customers', label: 'customer_id', hue: 7 },
          { from: 'orders', to: 'products', label: 'product_id', hue: 7 },
          { from: 'stock', to: 'products', label: 'product_id', hue: 7 },
        ]}
        caption="Arrows are foreign keys: every orders.customer_id must exist in customers.id. The catalog colour marks them as rules the database enforces."
      />
      <CodeBlock title="recorded: CREATE TABLE" language="text" code={U.create} />
      <p>
        <code>GENERATED ALWAYS AS IDENTITY</code> makes the database number the rows. <code>numeric(10,2)</code> stores money exactly;{' '}
        <code>timestamptz</code> stores an instant. Why these types and not others is the subject of{' '}
        <a href="#/postgres/schema-design">Schema design and data types</a>. The index on <code>orders (customer_id)</code> makes “orders of this
        customer” fast; PostgreSQL does not create it for a foreign key by itself.
      </p>

      <h2>INSERT … RETURNING</h2>
      <p>INSERT adds rows; RETURNING hands back what was stored, including generated ids and defaults.</p>
      <CodeBlock title="recorded: INSERT" language="text" code={U.insert} />
      <p>
        The tag <code>INSERT 0 7</code> means seven rows were inserted (the 0 is a leftover from old versions). With RETURNING you never need a
        second query to learn the new id.
      </p>
      <h3>Looking at what you made</h3>
      <div className={own.grid2}>
        <CodeBlock title="recorded: \dt and \d" language="text" code={U.meta} />
        <CodeBlock title="recorded: \x and \timing" language="text" code={U.expanded} />
      </div>

      <h2>SELECT: reading rows</h2>
      <p>SELECT names the columns you want, FROM the table, WHERE the condition, ORDER BY the order and LIMIT how many.</p>
      <CodeBlock title="recorded: SELECT" language="text" code={U.select} />
      <Callout tone="note" title="No ORDER BY, no order">
        Without ORDER BY, rows come back in whatever order is cheapest — often insertion order on a small table, until one day it is not. Add ORDER
        BY whenever the order matters, and a unique column last (<code>ORDER BY amount DESC, id</code>) so ties are decided too.
      </Callout>

      <Predict
        question={
          <p>
            In <code>SELECT name, count(*) AS n FROM … WHERE … GROUP BY name HAVING count(*) {'>'} 1 ORDER BY n LIMIT 3</code>, which clause does
            PostgreSQL evaluate first, after FROM?
          </p>
        }
        options={['SELECT — it is written first', 'WHERE', 'ORDER BY', 'LIMIT']}
        answer={1}
        explanation="Logically a query runs FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. That is why WHERE cannot use an alias defined in SELECT, but ORDER BY can. Try it on the sample rows:"
      />
      <UsingPostgresPipeline recorded={U.playground} />
      <p>
        This is the <em>logical</em> order — what the result must look like. The planner may do the work differently (use an index to skip the
        sort, stop early for LIMIT) as long as the result is the same; <a href="#/postgres/query-planning">Query planning and EXPLAIN</a> shows how.
      </p>

      <h2>UPDATE and DELETE</h2>
      <p>UPDATE changes columns of the rows its WHERE matches; DELETE removes them. Both report how many rows they touched.</p>
      <CodeBlock title="recorded: UPDATE" language="text" code={U.update} />
      <Callout tone="warn" title="UPDATE 4 — every row">
        The last statement has no WHERE, so it changed every product. In psql, start risky changes with <code>BEGIN;</code>, check the row count
        and a SELECT, then COMMIT or ROLLBACK (see transactions below).
      </Callout>
      <CodeBlock title="recorded: DELETE" language="text" code={U.delete} />
      <p>
        The foreign key protects the orders: Ann cannot be deleted while orders point to her. <code>DELETE 0</code> is not an error — nothing
        matched. The choices for what should happen instead (cascade, set NULL) are in{' '}
        <a href="#/postgres/schema-design">Schema design and data types</a>.
      </p>

      <h2>Joins: combining tables</h2>
      <p>A join pairs each row of one table with the matching rows of another, using a condition such as <code>c.id = o.customer_id</code>.</p>
      <CodeBlock title="recorded: JOIN and LEFT JOIN" language="text" code={U.join} />
      <StatTiles
        title="The same customers and orders, two kinds of join"
        stats={[
          { label: 'JOIN rows', value: innerRows, sub: 'only customers that have orders', hue: 3 },
          { label: 'LEFT JOIN rows', value: leftRows, sub: 'every customer; Dev once, with NULLs', hue: 1 },
          { label: 'customers without orders', value: leftRows - innerRows, sub: 'LEFT JOIN … WHERE o.id IS NULL', hue: 8 },
        ]}
      />
      <Table
        head={['Join', 'Keeps']}
        rows={[
          [<code key="j">JOIN</code>, 'pairs that match the ON condition (also written INNER JOIN)'],
          [<code key="l">LEFT JOIN</code>, 'every row of the left table; NULLs where the right table has no match'],
          [<code key="r">RIGHT JOIN</code>, 'the mirror image; usually rewritten as a LEFT JOIN'],
          [<code key="f">FULL JOIN</code>, 'every row of both, NULLs on either side'],
          [<code key="c">CROSS JOIN</code>, 'every combination — 4 customers × 4 products = 16 rows'],
        ]}
      />
      <Callout tone="warn" title="A WHERE on the right table undoes a LEFT JOIN">
        <code>LEFT JOIN orders o … WHERE o.status = 'paid'</code> removes the NULL rows again, because <code>NULL = 'paid'</code> is not true. Put
        such a condition into the ON clause to keep customers without paid orders. Try it above: “customers LEFT JOIN orders” with “status = 'paid'”.
      </Callout>

      <h2>GROUP BY and aggregates</h2>
      <p>GROUP BY collapses rows that share a value into one row per group; aggregate functions compute one value per group.</p>
      <CodeBlock title="recorded: GROUP BY" language="text" code={U.group} />
      <p>
        The error is the rule to remember: after GROUP BY, every selected column must be a group key or inside an aggregate — there are several
        amounts per name, and PostgreSQL will not pick one for you. HAVING filters groups after aggregation; WHERE filters rows before.
      </p>
      <Table
        head={['Aggregate', 'Returns']}
        rows={[
          [<code key="1">count(*)</code>, 'rows in the group'],
          [<code key="2">count(col)</code>, 'rows where col is not NULL'],
          [<code key="3">sum, avg, min, max</code>, 'ignore NULLs; sum of no rows is NULL (use coalesce(sum(x), 0))'],
          [<code key="4">string_agg(name, ', ')</code>, 'values joined into one text'],
          [<code key="5">array_agg(id)</code>, 'values as an array'],
          [<code key="6">count(*) FILTER (WHERE status = 'paid')</code>, 'an aggregate over part of the group'],
        ]}
      />

      <h2>Transactions</h2>
      <p>A transaction makes several statements one unit: either all of them take effect at COMMIT, or none of them do.</p>
      <Flow
        title="What psql’s prompt is telling you"
        cols={3}
        rows={2}
        rowHeight={86}
        nodes={[
          { id: 'idle', label: 'shop=\u200c>', sub: 'no transaction open', col: 0, row: 0, hue: 1 },
          { id: 'tx', label: 'shop=*\u200c>', sub: 'inside a transaction', col: 1, row: 0, hue: 6 },
          { id: 'failed', label: 'shop=!\u200c>', sub: 'failed: only ROLLBACK helps', col: 2, row: 0, hue: 8 },
          { id: 'done', label: 'changes kept or undone', sub: 'COMMIT or ROLLBACK', col: 1, row: 1, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'idle', to: 'tx', label: 'BEGIN', hue: 6 },
          { from: 'tx', to: 'failed', label: 'ERROR', hue: 8 },
          { from: 'tx', to: 'done', label: 'COMMIT', hue: 6 },
          { from: 'failed', to: 'done', label: 'COMMIT = ROLLBACK', hue: 8 },
          { from: 'done', to: 'idle', hue: 1, dashed: true },
        ]}
        steps={[
          { title: 'Autocommit', body: <p>Outside BEGIN, every statement is its own transaction and is committed when it finishes.</p>, active: ['idle'] },
          { title: 'BEGIN', body: <p>From here on, changes are visible only to this session until COMMIT. The prompt gets a <code>*</code>.</p>, active: ['idle', 'tx', 'idle>tx'] },
          { title: 'COMMIT', body: <p>All changes become visible to everyone at once, and are durable.</p>, active: ['tx', 'done', 'tx>done'] },
          { title: 'An error inside', body: <p>One failed statement fails the whole transaction (<code>!</code>). Every further statement is refused until it ends.</p>, active: ['tx', 'failed', 'tx>failed'] },
          { title: 'COMMIT after an error', body: <p>…is answered with ROLLBACK: nothing from this transaction is kept, not even the statements that worked.</p>, active: ['failed', 'done', 'failed>done'] },
        ]}
      />
      <div className={own.grid2}>
        <CodeBlock title="recorded: ROLLBACK undoes a DELETE" language="text" code={U.rollback} />
        <CodeBlock title="recorded: an error inside a transaction" language="text" code={U.aborted} />
      </div>
      <Predict
        question={<p>Inside BEGIN, the first INSERT worked and the second failed. You type COMMIT. How many of the two rows are saved?</p>}
        options={['One — the one that worked', 'None', 'Both — COMMIT forces them']}
        answer={1}
        explanation="PostgreSQL answers COMMIT with ROLLBACK (see the tag in the recording) and keeps nothing. In code, catch the error and call rollback yourself; to keep going after an expected error, use SAVEPOINT name … ROLLBACK TO name."
      />
      <p>
        What other sessions see while your transaction is open — and what happens when two transactions change the same row — is covered in{' '}
        <a href="#/postgres/mvcc">Rows are versions (MVCC)</a>, <a href="#/postgres/isolation">Isolation levels</a> and{' '}
        <a href="#/postgres/locks">Concurrent writes and locks</a>.
      </p>

      <h2>Upsert: INSERT … ON CONFLICT</h2>
      <p>An upsert inserts a row, or — if a row with the same unique key already exists — updates it or does nothing.</p>
      <Flow
        title="One statement, three outcomes"
        cols={3}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'ins', label: 'INSERT (1, 5)', sub: 'product 1, quantity 5', col: 0, row: 1, hue: 1 },
          { id: 'chk', label: 'key 1 exists?', sub: 'unique index lookup', col: 1, row: 1, hue: 7 },
          { id: 'new', label: 'insert the row', sub: 'no conflict', col: 2, row: 0, hue: 6 },
          { id: 'upd', label: 'DO UPDATE', sub: 'quantity = 10 + 5', col: 2, row: 1, hue: 6 },
          { id: 'none', label: 'DO NOTHING', sub: 'INSERT 0 0', col: 2, row: 2, hue: 4 },
        ]}
        edges={[
          { from: 'ins', to: 'chk', hue: 1, flow: true },
          { from: 'chk', to: 'new', label: 'no', hue: 6 },
          { from: 'chk', to: 'upd', label: 'yes', hue: 6 },
          { from: 'chk', to: 'none', label: 'yes', hue: 4 },
        ]}
        caption="EXCLUDED is the row you tried to insert; stock.quantity is the row already there. The check and the update are atomic: two sessions upserting the same key cannot both insert."
      />
      <CodeBlock title="recorded: ON CONFLICT" language="text" code={U.upsert} />
      <p>
        <code>RETURNING old.…, new.…</code> is new in PostgreSQL 18: one statement tells you the value before and after. ON CONFLICT needs a unique
        index or constraint on exactly the conflict columns. Retries and idempotency keys are covered in{' '}
        <a href="#/postgres/constraints">Constraints and idempotency</a>.
      </p>

      <h2>COPY: many rows in and out</h2>
      <p>COPY streams rows in a file format (CSV, text, binary) — far faster than one INSERT per row.</p>
      <CodeBlock title="recorded: COPY and \copy" language="text" code={U.copy} />
      <Table
        head={['', 'Reads or writes files on', 'Needs']}
        rows={[
          [<code key="1">COPY t FROM '/path'</code>, 'the database server', 'superuser or pg_read_server_files / pg_write_server_files'],
          [<code key="2">COPY t FROM STDIN</code>, 'the client connection (what drivers use)', 'INSERT privilege only'],
          [<code key="3">\copy t FROM 'file.csv'</code>, 'the machine running psql', 'INSERT privilege only — psql sends it through STDIN'],
        ]}
      />

      <h2>Pagination: OFFSET or keyset</h2>
      <p>To show page 5,000 of a list, you can skip rows (OFFSET) or continue after the last row you showed (keyset).</p>
      <BarChart
        title={`Time to fetch 20 rows after skipping N, recorded on one million rows (EXPLAIN ANALYZE, median of five)`}
        unit=" ms"
        bars={U.paging.points.flatMap((p) => [
          { label: `OFFSET ${p.offset.toLocaleString('en')}`, value: p.offsetMs, display: `${p.offsetMs} ms`, hue: 8 as const, note: `${p.offsetBuffers.toLocaleString('en')} pages read` },
          { label: `keyset > ${p.offset.toLocaleString('en')}`, value: p.keysetMs, display: `${p.keysetMs} ms`, hue: 6 as const, note: `${p.keysetBuffers} pages read` },
        ])}
      />
      <p>
        At {deep.offset.toLocaleString('en')} rows skipped, OFFSET took {deep.offsetMs} ms and read {deep.offsetBuffers.toLocaleString('en')}{' '}
        pages; keyset took {deep.keysetMs} ms and read {deep.keysetBuffers}. OFFSET has to walk past every skipped row — the plan (one run at 500,000; the chart shows
        the median of five) has the index scan producing 500,020 rows to return 20:
      </p>
      <div className={own.grid2}>
        <CodeBlock title="recorded: OFFSET 500000" language="text" code={U.paging.offsetPlan} />
        <CodeBlock title="recorded: WHERE id > 500000" language="text" code={U.paging.keysetPlan} />
      </div>
      <UsingPostgresPaging points={U.paging.points} />
      <CodeBlock
        title="keyset on a non-unique sort column: compare (column, id) as a pair"
        language="sql"
        code={`-- needs an index on (created_at, id); :last_created_at and :last_id come from the last row shown
SELECT id, created_at, payload
FROM events
WHERE (created_at, id) > (:last_created_at, :last_id)
ORDER BY created_at, id
LIMIT 20;`}
      />
      <p>
        Keyset cannot jump to “page 37” directly and needs a sort key with an index. OFFSET is fine for the first few pages of a small list; use
        keyset for infinite scrolling, exports and anything deep.
      </p>

      <h2>The same tasks from code</h2>
      <p>Applications borrow a connection from a pool, send SQL with parameters, and give the connection back.</p>
      <Flow
        title="One request in an application"
        cols={5}
        rows={1}
        rowHeight={86}
        width={760}
        nodes={[
          { id: 'req', label: 'request', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'pool', label: 'pool', sub: 'borrow', col: 1, row: 0, hue: 1, shape: 'queue' },
          { id: 'tx', label: 'transaction', sub: 'BEGIN … COMMIT', col: 2, row: 0, hue: 6 },
          { id: 'pg', label: 'PostgreSQL', col: 3, row: 0, hue: 3, shape: 'store' },
          { id: 'back', label: 'release', sub: 'back to pool', col: 4, row: 0, hue: 1 },
        ]}
        edges={[
          { from: 'req', to: 'pool', hue: 1, flow: true },
          { from: 'pool', to: 'tx', hue: 1, flow: true },
          { from: 'tx', to: 'pg', both: true, hue: 3 },
          { from: 'pg', to: 'back', hue: 1, dashed: true },
        ]}
        caption="Opening a connection costs a new server process, so programs keep a few open in a pool — see Connection pooling."
      />
      <p>
        The Java program uses plain JDBC with the HikariCP pool; the TypeScript one uses <code>pg</code> (node-postgres) and its built-in pool.
        Both ran against the tables above. Pick a task:
      </p>
      <Tabs
        items={[
          { label: 'Connect', content: <Ways section="connect" /> },
          { label: 'Insert', content: <Ways section="insert" /> },
          { label: 'Select', content: <Ways section="select" /> },
          { label: 'Errors', content: <Ways section="errors" /> },
          { label: 'Transaction', content: <Ways section="transaction" /> },
          { label: 'Batch', content: <Ways section="batch" /> },
          { label: 'Upsert', content: <Ways section="upsert" /> },
          { label: 'Keyset', content: <Ways section="keyset" /> },
        ]}
      />
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['Always pass values as parameters (? in JDBC, $1 in pg)', 'The value never becomes SQL text, so it cannot change the query — the recorded injection attempt found nothing.'],
          ['Close or release what you borrow', 'try-with-resources in Java, finally { client.release() } in TypeScript. A leaked connection is gone from the pool for good.'],
          ['One transaction = one connection', 'BEGIN on one pooled connection and the next query on another are two different sessions. The helper keeps them on one client.'],
          ['Expect numeric and bigint as strings in node-pg', 'They may not fit a JavaScript number; parse them deliberately (or use a decimal library for money).'],
          ['Handle errors by SQLSTATE', '23505 unique violation, 23503 foreign key, 40001 serialization failure (retry), 40P01 deadlock (retry).'],
          ['Batch writes', 'One round trip per row is slow. JDBC: addBatch with reWriteBatchedInserts=true. pg: arrays + unnest, or COPY.'],
        ]}
      />
      <Tabs
        items={[
          { label: 'UsageDemo.java', content: <CodeBlock title="start-app-java/src/main/java/demo/start/UsageDemo.java" language="java" code={START_APP.java['UsageDemo.java']} /> },
          { label: 'build.gradle', content: <CodeBlock title="start-app-java/build.gradle" language="groovy" code={START_APP.java['build.gradle']} /> },
          { label: 'demo.ts', content: <CodeBlock title="start-app-ts/demo.ts (node demo.ts, Node 24)" language="ts" code={START_APP.ts['demo.ts']} /> },
          { label: 'package.json', content: <CodeBlock title="start-app-ts/package.json" language="json" code={START_APP.ts['package.json']} /> },
        ]}
      />

      <h2>Checklist</h2>
      <p>Habits that prevent the usual accidents.</p>
      <Table
        head={['Do', 'Instead of']}
        rows={[
          ['BEGIN, then UPDATE/DELETE, check the count, then COMMIT', 'running a bare UPDATE and hoping the WHERE was right'],
          ['RETURNING to get ids and changed values', 'a second SELECT that may see other sessions’ changes'],
          ['ORDER BY with a unique last column', 'relying on the order rows happen to come back in'],
          ['ON CONFLICT for insert-or-update', 'SELECT, then INSERT or UPDATE — two sessions can both decide to insert'],
          ['COPY or batches for bulk loads', 'thousands of single-row INSERTs, each its own transaction'],
          ['keyset pagination for deep pages', 'OFFSET 100000'],
          ['.pgpass and environment variables', 'passwords in commands, URIs in shell history'],
          ['parameters in application code', 'building SQL by string concatenation'],
        ]}
      />

      <h2>Cheat sheet</h2>
      <p>The everyday tasks side by side.</p>
      <Table
        head={['Task', 'psql / SQL', 'Java (JDBC)', 'TypeScript (pg)']}
        rows={CHEATS.map(([task, sql, java, ts]) => [task, <code key="s">{sql}</code>, java === 'same SQL' || java === '—' ? java : <code key="j">{java}</code>, ts === 'same SQL' || ts === '—' ? ts : <code key="t">{ts}</code>])}
      />

      <Recap
        points={[
          'Connect with host, port, database, role and password — as flags, a URI, environment variables or .pgpass.',
          'RETURNING shows what INSERT, UPDATE and DELETE did; the tag (UPDATE 4) says how many rows.',
          'A SELECT is evaluated FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.',
          'Inside BEGIN, one error fails the transaction; COMMIT then rolls back.',
          'ON CONFLICT is the atomic upsert; COPY loads many rows; keyset pagination stays fast at any depth.',
          'From code: a pool, parameters for every value, one connection per transaction, and always release it.',
        ]}
      />
    </>
  )
}
