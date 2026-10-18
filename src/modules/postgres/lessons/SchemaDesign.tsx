import { BarChart, ByteLayout, Flow, Timeline, type ByteField, type TimelineEvent, type TimelineSegment } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { SchemaDesignMoney } from '../components/SchemaDesignMoney'
import { SchemaDesignNormalForms } from '../components/SchemaDesignNormalForms'
import { SchemaDesignOnDelete } from '../components/SchemaDesignOnDelete'
import { SchemaDesignTimeZones } from '../components/SchemaDesignTimeZones'
import { START } from '../data/start'
import own from './lesson.module.css'

const D = START.schema
const size = (type: string, nth = 0) => {
  const s = D.sizes.filter((x) => x.type === type)[nth]
  if (!s) throw new Error(`no recorded size for ${type}`)
  return s
}

const FIXED_ROWS = [
  { label: '1 to 4 bytes', types: ['boolean', 'smallint', 'integer', 'real', 'date'] },
  { label: '8 bytes', types: ['bigint', 'double precision', 'timestamp', 'timestamptz'] },
  { label: '16 bytes', types: ['interval', 'uuid'] },
]
const FIXED = FIXED_ROWS.flatMap((r) => r.types)
/** PostgreSQL's own short names, for the fields too narrow for the full one. */
const SHORT: Record<string, string> = { boolean: 'bool', smallint: 'int2' }

/** Known layouts of variable-length values; used only when they add up to the recorded size. */
function varlena(type: string, bytes: number, value: string): ByteField[] {
  const header: ByteField = { label: 'hdr', bytes: 1, hue: 7 }
  const parts: Record<string, ByteField[]> = {
    text: [header, { label: 'UTF-8 text', bytes: bytes - 1, hue: 3, content: value }],
    'varchar(20)': [header, { label: 'UTF-8 text', bytes: bytes - 1, hue: 3, content: value }],
    'char(20)': [header, { label: 'text', bytes: value.length, hue: 3, content: value }, { label: 'padding spaces', bytes: bytes - 1 - value.length, hue: 8 }],
    json: [header, { label: 'the text as typed', bytes: bytes - 1, hue: 3, content: value }],
    jsonb: [header, { label: 'binary: key index, then typed values', bytes: bytes - 1, hue: 3 }],
    'integer[]': [header, { label: 'array header', bytes: 20, hue: 7 }, { label: '1, 2, 3', bytes: 12, hue: 3 }],
    'numeric(12,2)': [header, { label: 'meta', bytes: 2, hue: 7 }, { label: 'digits 1234 5600', bytes: bytes - 3, hue: 3 }],
    numeric: [header, { label: 'meta', bytes: 2, hue: 7 }, { label: '4 decimal digits per 2 bytes', bytes: bytes - 3, hue: 3 }],
    inet: [header, { label: 'meta', bytes: 2, hue: 7 }, { label: 'IPv4', bytes: 4, hue: 3 }],
  }
  const p = parts[type]
  return p && p.reduce((n, f) => n + f.bytes, 0) === bytes ? p : [{ label: value, bytes, hue: 3 }]
}

const VARIABLE = D.sizes.filter((s) => !FIXED.includes(s.type) && s.bytes < 100)
const longText = size('text', 1)

const keyHue = { 'bigint identity': 6, 'uuid v7': 5, 'uuid v4': 8 } as const

const q = D.lockQueue
const qt = D.lockTimeout
const evHue = (e: { label: string; ok?: boolean }) => (e.ok === false ? 8 : e.ok ? 6 : 1)
const queueSegments: TimelineSegment[] = [
  { lane: 'A', from: q.events[0].at, to: q.commitAt, label: 'transaction open: holds a lock on items', hue: 3 },
  { lane: 'B', from: q.bStart, to: q.commitAt, label: 'waits for its ACCESS EXCLUSIVE lock', hue: 8, striped: true },
  { lane: 'C', from: q.cStart, to: q.commitAt, label: 'waits behind B', hue: 8, striped: true },
]
const timeoutEnd = qt.events.find((e) => e.lane === 'B' && e.ok === false)?.at ?? qt.bStart
const timeoutSegments: TimelineSegment[] = [
  { lane: 'A', from: qt.events[0].at, to: qt.commitAt, label: 'transaction open: holds a lock on items', hue: 3 },
  { lane: 'B', from: qt.bStart, to: timeoutEnd, label: 'waits 200 ms', hue: 8, striped: true },
]
const events = (list: readonly { lane: string; at: number; label: string; ok?: boolean }[]): TimelineEvent[] =>
  list.map((e) => ({ lane: e.lane, at: e.at, label: e.label.replace('ERROR: canceling statement due to lock timeout', 'lock timeout: ALTER gives up'), hue: evHue(e) }))
/**
 * The lock_timeout run, with labels that fit: B starts and gives up 200 ms apart, and C starts and finishes
 * at the same moment, so each pair shares one label.
 */
const timeoutEvents = (list: readonly { lane: string; at: number; label: string; ok?: boolean }[]): TimelineEvent[] => {
  const cDone = list.find((e) => e.lane === 'C' && e.ok)
  return events(
    list
      .filter((e) => e !== cDone)
      .map((e) =>
        e.lane === 'B' && e.ok === undefined
          ? { ...e, label: 'ALTER' }
          : e.lane === 'C' && cDone && e.at === cDone.at
            ? { ...e, label: 'SELECT … WHERE id = 1 — done at once', ok: true }
            : e,
      ),
  )
}
const lanes = [
  { id: 'A', label: 'A: report' },
  { id: 'B', label: 'B: migration' },
  { id: 'C', label: 'C: app query' },
]

const MIGRATION_SQL = `-- in the migration's session: fail fast instead of queueing everyone behind you
SET lock_timeout = '2s';
SET statement_timeout = '30s';

ALTER TABLE items ADD COLUMN note text;                                   -- instant
ALTER TABLE items ADD COLUMN active boolean NOT NULL DEFAULT false;       -- instant since PG 11

ALTER TABLE items ADD CONSTRAINT items_qty_check CHECK (qty >= 0) NOT VALID;  -- instant, new rows checked
ALTER TABLE items VALIDATE CONSTRAINT items_qty_check;                        -- scans, but lets writes continue

ALTER TABLE items ADD CONSTRAINT items_sku_not_null NOT NULL sku NOT VALID;   -- new in PG 18
ALTER TABLE items VALIDATE CONSTRAINT items_sku_not_null;

CREATE INDEX CONCURRENTLY items_sku_idx ON items (sku);   -- not inside a transaction block`

export default function SchemaDesign() {
  return (
    <>
      <LessonGoals
        goals={[
          'pick column types by what they store and what they cost: integers, numeric vs float, text, timestamptz, uuid, jsonb, arrays, enums',
          'choose keys and constraints, including what ON DELETE does',
          'normalise a table to 3NF — and know when to denormalise on purpose',
          'change a schema on a busy table without blocking the application',
        ]}
        before={
          <>
            <a href="#/postgres/using-postgres">Using PostgreSQL day to day</a> — CREATE TABLE, INSERT and joins.
          </>
        }
      />

      <h2>Why the schema matters</h2>
      <p>
        The schema is the part of your application that is hardest to change later: types decide what can be stored, constraints decide what may be
        stored, and the table layout decides how much every query reads.
      </p>
      <TermList
        items={[
          { term: 'data type', definition: 'What a column holds and how it is stored: bigint is 8 bytes, text is a length plus the bytes.' },
          { term: 'constraint', definition: 'A rule the database enforces on every write: NOT NULL, CHECK, UNIQUE, PRIMARY KEY, FOREIGN KEY.' },
          { term: 'natural key', definition: 'An identifier from the real world: an email, an ISO country code, a SKU.' },
          { term: 'surrogate key', definition: 'An identifier the database makes up (an identity number or a uuid) with no meaning of its own.' },
          { term: 'normal form', definition: 'A rule against storing the same fact twice. 3NF: every column depends on the key, the whole key, and nothing but the key.' },
          { term: 'migration', definition: 'A versioned script that changes the schema (ALTER TABLE …) while the application keeps running.' },
        ]}
      />

      <h2>What each type costs</h2>
      <p>Every value takes a fixed or variable number of bytes on disk, and every byte is read again by every scan, index and backup.</p>
      <ByteLayout
        title="Fixed-size types — bytes per value, recorded with pg_column_size"
        rows={FIXED_ROWS.map((r) => ({
          label: r.label,
          fields: r.types.map((t) => ({ label: SHORT[t] ?? t, bytes: size(t).bytes, hue: t.startsWith('time') || t === 'date' || t === 'interval' ? 4 : t === 'uuid' ? 5 : 3 })),
        }))}
        caption="Drawn to scale: every field is as wide as its bytes (bool = boolean, int2 = smallint). Colours: numbers and booleans, time types, uuid. The size never depends on the value."
      />
      <ByteLayout
        title="Variable-length types — the same values, stored"
        rows={VARIABLE.map((s) => ({ label: `${s.type}  —  ${s.value}  (${s.bytes} bytes)`, fields: varlena(s.type, s.bytes, s.value) }))}
        caption="hdr: the 1-byte length header of a short value (under 127 bytes). meta: sign, scale and weight of a numeric; family and prefix length of an inet. Layouts inside a value follow the PostgreSQL source; totals are recorded."
      />
      <p>
        Longer values get a 4-byte header: {longText.value} took {longText.bytes} bytes. Values over about 2 kB are compressed or moved to a side
        table (TOAST) — see <a href="#/postgres/storage">Pages, tuples and TOAST</a>. <code>char(20)</code> pads every value with spaces to 20
        characters, which is why it is almost never what you want.
      </p>

      <h2>Numbers</h2>
      <p>Use integers for counts and ids, numeric for money and anything that must add up exactly, and floats only for measurements.</p>
      <Table
        head={['Type', 'Bytes', 'Range', 'Use for']}
        rows={[
          [<code key="s">smallint</code>, '2', '±32,767', 'rarely worth it: alignment often eats the saving'],
          [<code key="i">integer</code>, '4', '±2,147,483,647', 'quantities, small counters'],
          [<code key="b">bigint</code>, '8', '±9.2 × 10¹⁸', 'ids, and any counter that grows forever'],
          [<code key="n">numeric(p,s)</code>, 'variable', 'up to 131,072 digits before the point', 'money, rates — exact decimal arithmetic'],
          [<code key="r">real / double precision</code>, '4 / 8', '6 / 15 significant digits', 'measurements, scores, coordinates — never money'],
        ]}
      />
      <CodeBlock title="recorded: overflow and identity" language="text" code={D.text.ints} />
      <p>
        An <code>integer</code> id runs out at 2.1 billion — a limit real tables do reach, and changing the type later rewrites the table (below).
        Start ids as <code>bigint</code>.
      </p>
      <Predict
        question={<p>In PostgreSQL, what does <code>SELECT 0.1::float8 + 0.2::float8 = 0.3</code> return?</p>}
        options={['true', 'false', 'an error: you cannot compare floats']}
        answer={1}
        explanation="float8 is binary: 0.1 and 0.2 have no exact binary form, and their sum is 0.30000000000000004. numeric computes in decimal and gets 0.3 exactly. Recorded:"
      />
      <CodeBlock title="recorded: float vs numeric" language="text" code={D.money} />
      <SchemaDesignMoney recorded={D.sums} />
      <Callout tone="warn" title="Not the money type either">
        PostgreSQL has a <code>money</code> type, but its output depends on the server’s <code>lc_monetary</code> setting and it holds no currency.
        Use <code>numeric(12,2)</code> (or an integer number of cents) plus a currency column.
      </Callout>

      <h2>Text</h2>
      <p>
        In PostgreSQL <code>text</code> and <code>varchar(n)</code> are stored the same way; <code>n</code> only adds a length check.
      </p>
      <CodeBlock title="recorded: varchar and char" language="text" code={D.text.text} />
      <p>
        Inserting a value that is too long fails — but an explicit cast <code>::varchar(5)</code> silently cuts it. And <code>char(5)</code>{' '}
        pads with spaces that then vanish again when compared or concatenated. Prefer <code>text</code>, and if a limit is a real business rule,
        write it as <code>CHECK (length(code) {'<='} 5)</code>, which you can later change without touching the type.
      </p>

      <h2>Time</h2>
      <p>
        <code>timestamptz</code> stores an instant (as UTC); <code>timestamp</code> stores a date and a wall-clock time with no zone at all.
      </p>
      <SchemaDesignTimeZones rows={D.times} />
      <p>
        Despite its name, <code>timestamptz</code> does not store a time zone: it converts input to UTC using the session’s{' '}
        <code>TimeZone</code>, and converts back on output. Daylight saving time makes a day and 24 hours different things — 2026-03-29 is the
        night Lisbon moves its clocks forward:
      </p>
      <CodeBlock title="recorded: interval arithmetic across a DST change" language="text" code={D.timesPsql} />
      <Table
        head={['Type', 'Bytes', 'Use for']}
        rows={[
          [<code key="1">timestamptz</code>, '8', 'when something happened: created_at, paid_at, expires_at — almost always this one'],
          [<code key="2">timestamp</code>, '8', 'a wall-clock time that must not move, e.g. “the shop opens at 09:00” — rare'],
          [<code key="3">date</code>, '4', 'a calendar day: birthday, invoice date'],
          [<code key="4">interval</code>, '16', 'a duration: 1 day 2 hours (months, days and microseconds kept apart)'],
        ]}
      />

      <h2>Keys and ids</h2>
      <p>A primary key identifies a row forever, so it should never need to change.</p>
      <Table
        head={['Key', 'Good', 'Watch out']}
        rows={[
          ['natural (email, SKU)', 'meaningful, no extra column', 'real-world values change (people change email); then every foreign key must change too'],
          [<code key="i">bigint GENERATED ALWAYS AS IDENTITY</code>, '8 bytes, ordered, fast', 'reveals counts and order; needs the database to hand it out'],
          [<code key="7">uuid DEFAULT uuidv7()</code>, 'made anywhere, hard to guess, time-ordered', '16 bytes; the time of creation is readable in the id'],
          [<code key="4">uuid DEFAULT gen_random_uuid()</code>, 'made anywhere, random', 'random positions in the index: bigger index, more WAL'],
        ]}
      />
      <p>
        Use a surrogate key as the primary key and keep natural keys as <code>UNIQUE</code> columns. Prefer identity columns to the older{' '}
        <code>serial</code>: they are standard SQL, and <code>GENERATED ALWAYS</code> refuses hand-written ids (recorded above). Version 18 adds{' '}
        <code>uuidv7()</code>:
      </p>
      <CodeBlock title="recorded: uuid v4 and v7" language="text" code={D.text.uuid} />
      <p>The v7 values share their first digits because those encode the time. That decides how they land in a B-tree index:</p>
      <div>
        <BarChart
          title="Primary-key index size after 1,000,000 inserts (recorded)"
          unit=" MB"
          bars={D.keys.map((k) => ({ label: k.label, value: k.indexMB, hue: keyHue[k.label as keyof typeof keyHue], note: `table ${k.heapMB} MB` }))}
        />
        <BarChart
          title="Time and WAL for the same inserts (recorded)"
          unit=" ms"
          bars={D.keys.map((k) => ({ label: k.label, value: k.ms, display: `${k.ms.toLocaleString('en')} ms · ${k.walMB} MB WAL`, hue: keyHue[k.label as keyof typeof keyHue] }))}
        />
      </div>
      <p>
        New identity and v7 keys always go to the right-most index page, which fills up completely. Random v4 keys land on any page, splitting
        pages and leaving them half full — and every touched page is written to the WAL again after each checkpoint. How a B-tree splits is in{' '}
        <a href="#/postgres/indexes">B-tree indexes</a>.
      </p>

      <h2>boolean, jsonb, arrays and enums</h2>
      <p>These types are useful exactly when the data really has their shape.</p>
      <div className={own.grid2}>
        <CodeBlock title="recorded: json vs jsonb" language="text" code={D.text.json} />
        <CodeBlock title="recorded: arrays" language="text" code={D.text.arrays} />
      </div>
      <p>
        <code>json</code> keeps the text exactly as sent (duplicate keys, spaces); <code>jsonb</code> parses it once into a binary form — last
        duplicate key wins, keys are reordered (shorter first) — and supports containment (<code>@{'>'}</code>) and GIN indexes (see{' '}
        <a href="#/postgres/index-types">Other index types</a>). Use jsonb for attributes that differ per row (product options, external
        payloads); use real columns for anything you filter, join or constrain on every day.
      </p>
      <CodeBlock title="recorded: enums" language="text" code={D.text.enums} />
      <Table
        head={['For a fixed set of values', 'Good', 'Watch out']}
        rows={[
          [<code key="c">text + CHECK (status IN (…))</code>, 'simple; the list can change in one ALTER', 'list repeated if several tables need it'],
          [<code key="e">CREATE TYPE … AS ENUM</code>, '4 bytes, sorts in declared order', 'values can be added, never removed (recorded); renaming is ALTER TYPE … RENAME VALUE'],
          ['lookup table + foreign key', 'values are rows: add, retire, give them labels and colours', 'one more join; best when the list is data, not code'],
        ]}
      />
      <p>
        <code>boolean</code> is 1 byte and three-valued (true, false, NULL) — add <code>NOT NULL</code> unless “unknown” is a real answer. A
        status that will grow more states than two belongs in text or an enum, not in several booleans.
      </p>

      <h2>Constraints</h2>
      <p>Constraints let the database reject bad data on every write path — the application, a script, a hand-typed fix.</p>
      <CodeBlock title="recorded: NOT NULL, UNIQUE and CHECK" language="text" code={D.constraints} />
      <p>Each error names the constraint and the row, so give constraints names you will recognise in a log. A foreign key also decides what a DELETE of the referenced row does:</p>
      <SchemaDesignOnDelete runs={D.onDelete} />
      <Table
        head={['ON DELETE', 'When the customer is deleted', 'Use for']}
        rows={[
          ['NO ACTION (default)', 'error, checked at the end of the statement (or at commit if DEFERRABLE)', 'most references'],
          ['RESTRICT', 'error, checked immediately — cannot be deferred', 'when even a deferred fix must not be allowed'],
          ['CASCADE', 'the orders are deleted too', 'rows that are part of the parent: order_items of an order'],
          ['SET NULL / SET DEFAULT', 'orders stay, customer_id becomes NULL / the default', 'optional links: “assigned to” a user who leaves'],
        ]}
      />
      <p>
        Deeper — deferred constraints, exclusion constraints and using UNIQUE for idempotency — is in{' '}
        <a href="#/postgres/constraints">Constraints and idempotency</a>.
      </p>

      <h2>Normalisation</h2>
      <p>Normalising means storing each fact once, so it cannot disagree with a copy of itself.</p>
      <SchemaDesignNormalForms />
      <Flow
        title="The result: the sample schema in 3NF"
        cols={2}
        rows={2}
        rowHeight={90}
        nodes={[
          { id: 'customers', label: 'customers', sub: 'id · name · email · city', col: 0, row: 0, hue: 3, shape: 'store' },
          { id: 'orders', label: 'orders', sub: 'id · customer_id', col: 1, row: 0, hue: 3, shape: 'store' },
          { id: 'items', label: 'order_items', sub: 'order_id · product_id · qty · unit_price', col: 1, row: 1, hue: 3, shape: 'store' },
          { id: 'products', label: 'products', sub: 'id · name · price', col: 0, row: 1, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'orders', to: 'customers', label: 'N : 1', hue: 7 },
          { from: 'items', to: 'orders', label: 'N : 1', hue: 7 },
          { from: 'items', to: 'products', label: 'N : 1', hue: 7 },
        ]}
        caption="Arrows are foreign keys. order_items resolves the many-to-many between orders and products."
      />
      <h3>Denormalising on purpose</h3>
      <p>Sometimes a copy is worth it — when you decide which copy is the truth and how the other one is kept up to date.</p>
      <Table
        head={['Copy', 'Why', 'Kept right by']}
        rows={[
          ['order_items.unit_price', 'the price charged is a historical fact; the catalogue price will change', 'written once, never updated — not really a copy'],
          ['orders.total', 'listing orders without summing items each time', 'the same transaction that changes items, or a trigger'],
          ['a reporting table or materialized view', 'heavy aggregates read often, changed rarely', 'REFRESH MATERIALIZED VIEW CONCURRENTLY on a schedule'],
          ['a jsonb snapshot (shipping address on the order)', 'must show what was true at that moment', 'written once with the order'],
        ]}
      />

      <h2>Column order and padding</h2>
      <p>Values are aligned in the row to their type’s boundary, so a 1-byte boolean before an 8-byte bigint wastes 7 bytes.</p>
      <ByteLayout
        title={`The same six values in two column orders — rows of ${D.padding.padded} and ${D.padding.packed} bytes (recorded)`}
        scale={D.padding.padded}
        rows={[
          {
            label: '(a boolean, b bigint, c boolean, d bigint, e boolean, f bigint)',
            fields: [
              { label: 'row header', bytes: 24, hue: 7 },
              ...(['a', 'c', 'e'] as const).flatMap((b, i) => [
                { label: b, bytes: 1, hue: 3 as const },
                { label: 'pad', bytes: 7, hue: 8 as const },
                { label: ['b', 'd', 'f'][i], bytes: 8, hue: 3 as const },
              ]),
            ],
          },
          {
            label: '(b bigint, d bigint, f bigint, a boolean, c boolean, e boolean)',
            fields: [
              { label: 'row header', bytes: 24, hue: 7 },
              { label: 'b', bytes: 8, hue: 3 },
              { label: 'd', bytes: 8, hue: 3 },
              { label: 'f', bytes: 8, hue: 3 },
              { label: 'a c e', bytes: 3, hue: 3 },
            ],
          },
        ]}
        caption="Padding drawn from the alignment rules; the row totals are pg_column_size of the stored rows."
      />
      <p>
        Put fixed-width 8-byte columns first, then 4, 2 and 1-byte ones, then variable-length text. It matters for tables with hundreds of
        millions of rows; for small tables, readable column order wins. The tuple header and alignment are in{' '}
        <a href="#/postgres/storage">Pages, tuples and TOAST</a>.
      </p>

      <h2>Naming conventions</h2>
      <p>Consistent names make queries guessable and error messages readable.</p>
      <Table
        head={['Convention', 'Example', 'Why']}
        rows={[
          ['lower_snake_case, no quotes', 'order_items, created_at', 'Unquoted names are folded to lower case: CREATE TABLE "Orders" forces quotes forever.'],
          ['one convention for table names (plural or singular)', 'customers, orders', 'Pick one; mixing is what hurts.'],
          ['foreign key = referenced table + _id', 'customer_id', 'The join condition writes itself.'],
          ['timestamps end in _at, dates in _on or _date', 'paid_at, birth_date', 'The type is obvious from the name.'],
          ['booleans read as a question', 'is_active, has_discount', 'WHERE is_active reads as English.'],
          ['name constraints and indexes', 'orders_status_check, orders_customer_id_idx', 'The name appears in every error and plan.'],
          ['avoid reserved words', 'not user, order, group', 'They need quotes everywhere.'],
        ]}
      />

      <h2>Changing a schema safely</h2>
      <p>On a live table, the question is not only how long a change takes but which lock it holds while it does.</p>
      <BarChart
        title="Each change on a 1,000,000-row table, recorded — and whether the table was rewritten"
        unit=" ms"
        bars={D.migrations.map((m) => ({
          label: m.label,
          value: m.ms,
          display: `${m.ms} ms${m.rewrite ? ' · rewrite' : ''}`,
          hue: m.rewrite ? 8 : m.label.startsWith('CREATE INDEX') ? 7 : m.ms < 10 ? 6 : 4,
          note: m.sql,
        }))}
      />
      <p>
        Since version 11, <code>ADD COLUMN … DEFAULT</code> with a constant is instant: the default is stored once in the catalog and filled in
        when rows are read. A volatile default (<code>clock_timestamp()</code>, <code>gen_random_uuid()</code>) and most type changes rewrite every
        row under an <code>ACCESS EXCLUSIVE</code> lock. A rewrite is visible as a new file for the table (recorded through{' '}
        <code>pg_relation_filenode</code>).
      </p>
      <Predict
        question={
          <p>
            A report has a transaction open on <code>items</code>. A migration runs <code>ALTER TABLE items ADD COLUMN extra int</code> — an
            instant change. What happens to the application’s simple <code>SELECT … WHERE id = 1</code> that arrives next?
          </p>
        }
        options={['It runs normally: the ALTER has not done anything yet', 'It waits until the report finishes', 'It fails immediately']}
        answer={1}
        explanation="The ALTER waits for the report’s lock, and every later query on the table queues behind the waiting ALTER. Recorded with three sessions:"
      />
      <Timeline title="The lock queue, recorded" lanes={lanes} segments={queueSegments} events={events(q.events)} end={q.end + 200} playable />
      <p>
        While it waited, <code>pg_blocking_pids</code> showed{' '}
        {q.waiting.map((w, i) => (
          <span key={w.session}>
            {i > 0 && ' and '}
            {w.session} blocked by {w.blockedBy.join(', ')}
          </span>
        ))}
        . With a busy table this is an outage, caused by a migration that would have taken a millisecond. The fix is <code>lock_timeout</code>: the
        migration gives up and can be retried, and nobody queues behind it:
      </p>
      <Timeline title="The same, with SET lock_timeout = '200ms' in the migration (recorded)" lanes={lanes} segments={timeoutSegments} events={timeoutEvents(qt.events)} end={qt.end + 200} playable />
      <CodeBlock title="migration patterns that keep the table available" language="sql" code={MIGRATION_SQL} />
      <Table
        head={['Change', 'Safe way']}
        rows={[
          ['add a column', 'ADD COLUMN, with a constant default if needed; lock_timeout + retry'],
          ['add NOT NULL to an existing column', 'ADD CONSTRAINT … NOT NULL … NOT VALID, then VALIDATE (18+); or a NOT VALID CHECK (col IS NOT NULL) first'],
          ['add a foreign key or CHECK', 'NOT VALID, then VALIDATE CONSTRAINT in a separate step'],
          ['add an index', <span key="i">CREATE INDEX CONCURRENTLY — see <a href="#/postgres/indexes">B-tree indexes</a></span>],
          ['change a column type (int → bigint)', 'new column, backfill in batches, switch reads and writes, drop the old one'],
          ['rename a column or table', 'expand and contract: add the new name, write both, move readers, remove the old'],
          ['drop a column', 'first stop the application using it; DROP COLUMN itself is instant'],
        ]}
      />

      <h2>Design rules</h2>
      <p>A short list to check every new table against.</p>
      <Table
        head={['Rule', 'Because']}
        rows={[
          ['bigint identity (or uuidv7) primary keys', 'integer ids run out; random uuids bloat indexes'],
          ['numeric for money, never float or money', 'float sums drift; money depends on locale'],
          ['timestamptz for points in time', 'timestamp forgets which zone it meant'],
          ['text, with CHECK for real length limits', 'varchar(n) adds nothing but a limit that is hard to change'],
          ['NOT NULL unless unknown is a real value', 'NULL makes every comparison three-valued'],
          ['a named constraint for every rule', 'the database enforces it on every path, and the error says which rule'],
          ['index the foreign-key columns you join or delete by', 'PostgreSQL does not create them for you'],
          ['each fact stored once; copies only on purpose', 'copies drift apart'],
          ['migrations with lock_timeout, NOT VALID and CONCURRENTLY', 'an instant change can still queue every query'],
        ]}
      />

      <Recap
        points={[
          'Types have a cost in bytes: bigint 8, uuid 16, timestamptz 8; text is a header plus its bytes.',
          'numeric is exact; float8 is not — 0.1 + 0.2 = 0.30000000000000004.',
          'timestamptz stores an instant and shows it in the session’s zone; timestamp stores digits.',
          'Surrogate primary keys, natural keys as UNIQUE; uuidv7 over random uuids for index locality.',
          'Constraints and ON DELETE make the database guard the data; 3NF stores each fact once.',
          'Schema changes: watch the lock, not just the time — lock_timeout, NOT VALID + VALIDATE, CONCURRENTLY.',
        ]}
      />
    </>
  )
}
