import { BarChart, ByteLayout, Flow, StatTiles, type ByteField } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { HeapPageViewMap } from '../components/HeapPageViewMap'
import { StorageLayoutPlayground } from '../components/StorageLayoutPlayground'
import { StorageMaps } from '../components/StorageMaps'
import { INTERNALS, INTERNALS_VERSION } from '../data/internals'
import { fillPage, layoutTuple, SHORT, type TypeName } from '../simulation/storageLayout'

const S = INTERNALS.storage
const T = S.tuple
const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(1)} kB`)

// the recorded bytes of tuple 1, cut into its header fields and its column values
const bytes = T.hex.match(/../g)!
const hexOf = (from: number, n: number) => bytes.slice(from, from + n).join(' ')
const HEADER: { label: string; bytes: number }[] = [
  { label: 'xmin', bytes: 4 },
  { label: 'xmax', bytes: 4 },
  { label: 'cid', bytes: 4 },
  { label: 'ctid', bytes: 6 },
  { label: 'infomask2', bytes: 2 },
  { label: 'infomask', bytes: 2 },
  { label: 'hoff', bytes: 1 },
]
const headerFields: ByteField[] = []
{
  let at = 0
  for (const f of HEADER) {
    headerFields.push({ label: f.label, bytes: f.bytes, hue: 7, content: hexOf(at, f.bytes) })
    at += f.bytes
  }
  headerFields.push({ label: 'bitmap', bytes: T.t_hoff - 23, hue: 5, content: hexOf(23, T.t_hoff - 23) })
}
const dataFields: ByteField[] = []
{
  let at = T.t_hoff
  for (const [label, fixed] of [['id', 4], ['order_id', 4], ['amount', 0], ['status', 0]] as const) {
    // a short variable-length value starts with a 1-byte header: (total length << 1) | 1
    const n = fixed || parseInt(bytes[at], 16) >> 1
    dataFields.push({ label, bytes: n, hue: 3, content: hexOf(at, n) })
    at += n
  }
}
const le = (from: number, n: number) => parseInt(bytes.slice(from, from + n).reverse().join(''), 16)

// column order: the model's layouts, checked against the recorded lp_len
const PADDED: TypeName[] = ['boolean', 'bigint', 'boolean', 'bigint', 'smallint', 'integer']
const PADDED_NAMES = ['is_paid', 'id', 'is_gift', 'customer_id', 'qty', 'total_cents']
const PACKED_ORDER = [1, 3, 5, 4, 0, 2]
const layoutOf = (idx: readonly number[]) => layoutTuple(idx.map((i) => ({ name: PADDED_NAMES[i], type: PADDED[i] })))
const padded = layoutOf([0, 1, 2, 3, 4, 5])
const packed = layoutOf(PACKED_ORDER)
const rowFields = (l: typeof padded): ByteField[] =>
  l.fields.flatMap((f) => [
    ...(f.pad ? [{ label: 'pad', bytes: f.pad, hue: 8 as const, content: '·' }] : []),
    { label: f.name, bytes: f.size, hue: 3 as const, content: SHORT[f.type] },
  ])
const CHECK_BYTES: Record<string, number> = { "'paid'": 4, '19.99': 6 }
const checks = S.layoutChecks.map((c) => ({
  types: c.types.join(', '),
  recorded: c.lp_len,
  model: layoutTuple(c.types.map((t, i) => ({ name: `c${i}`, type: t as TypeName, bytes: CHECK_BYTES[c.values[i]] }))).len,
}))

const ff = S.fillfactor
const toastRows = S.toast
const comp = S.compression

const MAP_STAGES = [
  { label: 'after DELETE', note: 'Pages 2 and 3 were emptied, page 5 lost half its rows, page 8 every tenth. Neither map knows yet: the FSM still says “no free space” and no page is marked all-visible.', pages: S.mapsBefore },
  { label: 'after VACUUM', note: 'VACUUM recorded the free space of every page in the FSM (the next INSERT goes there) and marked every page all-visible. The emptied pages are trivially all-frozen too.', pages: S.mapsAfter },
  { label: 'after VACUUM FREEZE', note: 'Freezing marked every tuple as visible to all future transactions, so every page is now all-frozen: anti-wraparound vacuums can skip them all.', pages: S.mapsFrozen },
]

export default function Storage() {
  return (
    <>
      <LessonGoals
        goals={[
          'read a page’s header, line pointers and tuples with pageinspect',
          'name the fields of the 23-byte tuple header and find a NULL in the null bitmap',
          'order columns so rows waste no padding, and estimate rows per page',
          'choose a fillfactor, and say when a value is compressed or moved to TOAST',
          'explain what the free space map and the visibility map are for',
        ]}
        before={<>processes, shared buffers and files from <a href="#/postgres/architecture">How PostgreSQL runs</a></>}
      />

      <h2>A table is a row of 8 kB pages</h2>
      <p>
        Every table file is cut into pages (also called blocks) of {S.header.pagesize} bytes, numbered from 0. A page is the unit PostgreSQL
        reads, caches, locks and writes.
      </p>
      <p>
        This is page 0 of a <code>payments</code> table with five rows, drawn to scale from <code>pageinspect</code> ({INTERNALS_VERSION}). Each
        cell is 8 bytes:
      </p>
      <HeapPageViewMap
        title="Recorded: page 0 of payments, 8 bytes per cell"
        lower={S.header.lower}
        upper={S.header.upper}
        special={S.header.special}
        tuples={S.items.map((i) => ({ lp: i.lp, off: i.lp_off, len: i.lp_len, hoff: i.t_hoff }))}
        caption="Line pointers grow down from the header, tuples grow up from the end; the empty gap between lower and upper is free space. A thick edge marks where each tuple starts."
      />
      <TermList
        items={[
          { term: 'page header', definition: '24 bytes: the LSN of the last WAL record that changed the page, a checksum, flags, and the lower / upper / special offsets.' },
          { term: 'line pointer', definition: '4 bytes per tuple: its offset, length and state (normal, redirect, dead, unused). Indexes point at line pointers, not at bytes, so tuples can move within the page.' },
          { term: 'tuple', definition: 'One version of a row: a header, then the column values.' },
          { term: 'ctid', definition: 'A tuple’s address: (page, line pointer), e.g. (0,3).' },
          { term: 'special space', definition: 'Room at the end of the page for the access method. Heap pages have none; B-tree pages keep 16 bytes for sibling links.' },
        ]}
      />
      <CodeBlock title="recorded: the page header" language="text" code={S.headerText} />
      <Predict
        question={<p>The page holds 5 tuples. Why is <code>lower</code> = {S.header.lower}?</p>}
        options={['5 tuples × 8 bytes + 4', '24-byte header + 5 line pointers × 4 bytes', 'It is the offset of the first tuple']}
        answer={1}
        explanation={`24 + 5 × 4 = ${24 + 5 * 4}. The tuples start at upper = ${S.header.upper}, and everything between is free: ${S.header.upper - S.header.lower} bytes.`}
      />
      <CodeBlock title="recorded: the line pointers and tuples" language="text" code={S.itemsText} />
      <p>
        Index pages use the same layout. A B-tree page ends in special space: <code>special = {S.indexHeader.special}</code>, so its last{' '}
        {8192 - S.indexHeader.special} bytes hold the page’s left and right sibling links and its level.
      </p>
      <CodeBlock title="recorded: a B-tree leaf page" language="text" code={S.indexHeaderText} />
      <Callout tone="note" title="Checksums are on by default since PostgreSQL 18">
        <code>initdb</code> now enables data checksums. A page gets its checksum when it is written out, and every read from disk verifies it, so
        silent disk corruption is reported instead of returned. In memory the page above still showed checksum {S.checksumInMemory}; after a
        checkpoint and a fresh read:
      </Callout>
      <CodeBlock title="recorded" language="text" code={S.checksumText} />

      <h2>Inside a tuple</h2>
      <p>Every tuple starts with a 23-byte header that MVCC and VACUUM work with; the column values follow.</p>
      <ByteLayout
        title={`Recorded: the ${T.lp_len} bytes of tuple (0,1) — ${T.t_hoff}-byte header, then the values (hex)`}
        rows={[
          { label: 'header (t_hoff = 24: 23 bytes + 1-byte null bitmap)', fields: headerFields },
          { label: 'data: id, order_id, amount, status — note is NULL and takes no bytes', fields: dataFields },
        ]}
        scale={T.t_hoff}
        caption={`Integers are little-endian: t_xmin ${hexOf(0, 4)} = ${le(0, 4)}, id ${hexOf(T.t_hoff, 4)} = ${le(T.t_hoff, 4)}. The short values amount and status begin with a 1-byte length header.`}
      />
      <Table
        head={['Field', 'Bytes', 'Holds']}
        rows={[
          ['t_xmin', '4', <>the transaction that inserted this version — here {T.xmin} (see <a href="#/postgres/mvcc">MVCC</a>)</>],
          ['t_xmax', '4', 'the transaction that deleted or locked it, or 0'],
          ['t_cid', '4', 'command number inside the transaction (so a statement does not see its own later changes)'],
          ['t_ctid', '6', `page + line pointer of this or the newer version: ${T.ctid}`],
          ['t_infomask2', '2', `number of columns (${T.t_infomask2 & 0x7ff}) and HOT flags`],
          ['t_infomask', '2', `flags: has nulls, has variable-width values, commit hint bits… here 0x${T.t_infomask.toString(16).padStart(4, '0')}`],
          ['t_hoff', '1', 'where the data starts, always a multiple of 8'],
          ['null bitmap', '1 per 8 columns', `only when some column is NULL: bit = 1 for a value, 0 for NULL (pageinspect shows ${T.t_bits})`],
        ]}
      />
      <p>The bitmap fits into the padding after the 23 bytes — up to 8 columns. A ninth column makes it 2 bytes, and the header grows to 32:</p>
      <Table
        head={['Table', 'Row', 't_hoff', 'lp_len']}
        rows={S.bitmap.map((b) => [`${b.columns} int columns`, b.has_null ? 'one NULL' : 'no NULL', String(b.t_hoff), String(b.lp_len)])}
      />

      <h2>Alignment and column order</h2>
      <p>Each value must start at a multiple of its type’s alignment, so the order of columns decides how much padding a row carries.</p>
      <p>
        A <code>bigint</code> or <code>timestamptz</code> starts at a multiple of 8, an <code>integer</code> or <code>date</code> at 4, a{' '}
        <code>smallint</code> at 2; <code>boolean</code>, <code>uuid</code> and short text need no alignment. Two tables with the same six
        columns, recorded:
      </p>
      <ByteLayout
        title="The same columns in two orders (data part of the row)"
        rows={[
          { label: `declared order: ${padded.len - padded.hoff} data bytes (row ${padded.len})`, fields: rowFields(padded) },
          { label: `widest first: ${packed.len - packed.hoff} data bytes (row ${packed.len})`, fields: rowFields(packed) },
        ]}
      />
      <StatTiles
        stats={[
          { label: 'lp_len, declared order', value: `${S.columnOrder.padded.lp_len} B`, sub: `${S.columnOrder.padded.per_page} rows per page`, hue: 8 },
          { label: 'lp_len, widest first', value: `${S.columnOrder.packed.lp_len} B`, sub: `${S.columnOrder.packed.per_page} rows per page`, hue: 6 },
          { label: '100,000 rows, declared order', value: kb(S.columnOrder.padded.bytes), hue: 8, bar: { value: S.columnOrder.padded.bytes, max: S.columnOrder.padded.bytes } },
          { label: '100,000 rows, widest first', value: kb(S.columnOrder.packed.bytes), sub: `${Math.round((1 - S.columnOrder.packed.bytes / S.columnOrder.padded.bytes) * 100)} % smaller`, hue: 6, bar: { value: S.columnOrder.packed.bytes, max: S.columnOrder.padded.bytes } },
        ]}
      />
      <CodeBlock title="recorded: pg_column_size measures a row (with its 24-byte header)" language="text" code={S.columnOrderText} />
      <StorageLayoutPlayground />
      <p>The playground uses the same rules as the server; against eight real tables it gives the same row length every time:</p>
      <Table
        head={['Columns', 'lp_len recorded', 'playground']}
        rows={checks.map((c) => [c.types, String(c.recorded), `${c.model}${c.model === c.recorded ? ' ✓' : ' ✗'}`])}
      />
      <Callout tone="tip" title="Worth it?">
        On a narrow table that will hold hundreds of millions of rows, yes — order the columns when you create it (8-byte types, then 4, 2, 1,
        then text and numeric). On a table of thousands of rows, choose the order that reads best. Columns cannot be reordered later without
        rewriting the table.
      </Callout>

      <h2>fillfactor: room on each page</h2>
      <p>
        <code>fillfactor</code> tells INSERT to stop filling a page early, leaving room so that later UPDATEs of its rows can stay on the same
        page.
      </p>
      <StatTiles
        title={`Recorded: ${ff.rows.toLocaleString()} rows of ${S.columnOrder.packed.lp_len} bytes`}
        stats={[
          { label: 'fillfactor 100 (default)', value: `${ff.ff100.per_page} rows/page`, sub: `${ff.ff100.pages} pages, ${ff.ff100.free} B free on page 0`, hue: 3, bar: { value: ff.ff100.pages, max: ff.ff70.pages } },
          { label: 'fillfactor 70', value: `${ff.ff70.per_page} rows/page`, sub: `${ff.ff70.pages} pages, ${ff.ff70.free} B free on page 0`, hue: 6, bar: { value: ff.ff70.pages, max: ff.ff70.pages } },
          { label: 'the model predicts', value: `${fillPage(S.columnOrder.packed.lp_len, 100).rows} / ${fillPage(S.columnOrder.packed.lp_len, 70).rows}`, sub: 'rows per page at 100 / 70', hue: 7 },
        ]}
      />
      <p>
        That free space pays off with <strong>HOT updates</strong>, which only work when the new version fits on the same page — measured in{' '}
        <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM</a>. Typical values: 100 for tables that are only inserted into, 80–90 for tables
        with frequent updates. Set it with <code>CREATE TABLE … WITH (fillfactor = 90)</code>; <code>ALTER TABLE … SET</code> does not move existing rows —
        it applies to future inserts, and to rewrites such as <code>VACUUM FULL</code>.
      </p>

      <h2>TOAST: where large values go</h2>
      <p>
        A row must fit in a page, so values that make a row larger than about 2 kB are compressed and, if still too big, moved to a separate table
        in pieces. This is <strong>TOAST</strong> (The Oversized-Attribute Storage Technique).
      </p>
      <Flow
        title="What happens to a row over 2,032 bytes"
        cols={4}
        rows={2}
        nodes={[
          { id: 'row', label: 'new row', sub: '> 2,032 bytes', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'comp', label: 'compress', sub: 'pglz or lz4', col: 1, row: 0, hue: 7 },
          { id: 'fits', label: 'stored inline', sub: 'compressed, in the page', col: 2, row: 0, hue: 3 },
          { id: 'ext', label: 'move out of line', sub: 'largest values first', col: 1, row: 1, hue: 7 },
          { id: 'toast', label: S.toastTable.replace('pg_toast.', ''), sub: 'chunks of 1,996 B', col: 2, row: 1, hue: 3, shape: 'store' },
          { id: 'ptr', label: '18-byte pointer', sub: 'kept in the row', col: 3, row: 1, hue: 5 },
        ]}
        edges={[
          { from: 'row', to: 'comp', hue: 1 },
          { from: 'comp', to: 'fits', label: 'fits', hue: 6 },
          { from: 'comp', to: 'ext', label: 'still big', hue: 8 },
          { from: 'ext', to: 'toast', hue: 3, flow: true },
          { from: 'ptr', to: 'toast', hue: 5 },
        ]}
        steps={[
          { title: 'Too big for comfort', body: <p>When a row is larger than <code>TOAST_TUPLE_THRESHOLD</code> (2,032 bytes with 8 kB pages), PostgreSQL works on its variable-length values until the row is under the target (also 2,032 by default).</p>, active: ['row'] },
          { title: 'Compress', body: <p>The largest compressible values are compressed first, with the column’s method: <code>pglz</code> (default) or <code>lz4</code>. 2,100 × “x” became 35 bytes.</p>, active: ['row', 'comp', 'row>comp'] },
          { title: 'Fits now', body: <p>If the row is small enough, it stays in the heap page, compressed. 100,000 repeated bytes stayed inline as 1,158.</p>, active: ['comp', 'fits', 'comp>fits'] },
          { title: 'Move out of line', body: <p>Otherwise the largest values are moved to the table’s TOAST table, cut into chunks of up to 1,996 bytes, and the row keeps an 18-byte pointer. Random data does not compress, so it goes out uncompressed.</p>, active: ['comp', 'ext', 'toast', 'ptr', 'comp>ext', 'ext>toast', 'ptr>toast'] },
        ]}
      />
      <BarChart
        title="Recorded: length of each value vs bytes stored for it"
        bars={toastRows.flatMap((r) => [
          { label: `#${r.id} ${r.kind}, length`, value: Math.min(r.length, 13000), display: `${r.length.toLocaleString()} B${r.length > 13000 ? ' (bar clipped)' : ''}`, hue: 1 as const },
          {
            label: `#${r.id} stored`,
            value: r.stored,
            display: `${r.stored.toLocaleString()} B ${r.external ? 'in TOAST' : r.compression ? `inline, ${r.compression}` : 'inline'} · row ${r.row_bytes} B`,
            hue: (r.external ? 4 : r.compression ? 6 : 3) as 4 | 6 | 3,
          },
        ])}
        max={13000}
      />
      <CodeBlock title="recorded: how each value is stored" language="text" code={S.toastText} />
      <CodeBlock title={`recorded: the chunks in ${S.toastTable}`} language="text" code={S.toastChunksText} />
      <p>
        Value #3 (100,000 bytes) is clipped in the chart: it was compressed to {toastRows[2].stored.toLocaleString()} bytes and never left the page.
        Values #5 and #6 left the page completely: their row is only {toastRows[4].row_bytes} bytes. A query that does not select <code>body</code>{' '}
        never reads the TOAST table at all.
      </p>
      <h3>pglz or lz4</h3>
      <p>
        lz4 compresses faster; pglz often compresses smaller. {comp.rows.toLocaleString()} JSON-like values of ~3.5 kB each, recorded (times on
        one laptop, single runs): lz4 inserted them in {Math.round((1 - comp.lz4.insertMs / comp.pglz.insertMs) * 100)} % less time, but stored{' '}
        {Math.round((comp.lz4.stored / comp.pglz.stored - 1) * 100)} % more bytes than pglz.
      </p>
      <BarChart
        title="Recorded: stored bytes (all values)"
        bars={[
          { label: 'uncompressed', value: comp.pglz.raw, display: kb(comp.pglz.raw), hue: 1 },
          { label: 'pglz', value: comp.pglz.stored, display: kb(comp.pglz.stored), hue: 4 },
          { label: 'lz4', value: comp.lz4.stored, display: kb(comp.lz4.stored), hue: 6 },
        ]}
      />
      <BarChart
        title="Recorded: INSERT of all rows, ms"
        bars={[
          { label: 'pglz', value: comp.pglz.insertMs, display: `${Math.round(comp.pglz.insertMs)} ms`, hue: 4 },
          { label: 'lz4', value: comp.lz4.insertMs, display: `${Math.round(comp.lz4.insertMs)} ms`, hue: 6 },
        ]}
      />
      <CodeBlock
        title="choosing the method"
        language="sql"
        code={`CREATE TABLE docs (id int PRIMARY KEY, body text COMPRESSION lz4);
ALTER TABLE docs ALTER COLUMN body SET COMPRESSION lz4;   -- new values only
SET default_toast_compression = 'lz4';                      -- for new columns
ALTER TABLE docs ALTER COLUMN body SET STORAGE EXTERNAL;    -- out of line, never compressed`}
      />
      <Callout tone="note" title="Existing values keep their method">
        Changing a column’s compression affects new values only, and <code>INSERT … SELECT</code> copies compressed values as they are. Recorded:
        a value copied into an lz4 column from a pglz table:
      </Callout>
      <CodeBlock title="recorded" language="text" code={S.copyKeeps} />
      <Table
        head={['STORAGE', 'Compress?', 'Out of line?', 'Default for']}
        rows={[
          ['PLAIN', 'no', 'no', 'fixed-width types (int, timestamp…)'],
          ['MAIN', 'yes', 'only as a last resort', 'numeric'],
          ['EXTERNAL', 'no', 'yes', '— (good for pre-compressed data, fast substring)'],
          ['EXTENDED', 'yes', 'yes', 'text, bytea, jsonb'],
        ]}
      />

      <h2>The free space map and the visibility map</h2>
      <p>Two small files next to every table remember, per page, how much room it has and whether all its rows are visible to everyone.</p>
      <TermList
        items={[
          { term: 'free space map (_fsm)', definition: 'Free bytes per page, in steps of 32. INSERT and UPDATE ask it for a page with room before extending the file. VACUUM fills it in.' },
          { term: 'visibility map (_vm)', definition: 'Two bits per page. all-visible: every tuple is visible to every transaction — VACUUM can skip the page and index-only scans need not visit it. all-frozen: every tuple is frozen — even anti-wraparound vacuums skip it.' },
        ]}
      />
      <StorageMaps title="Recorded: 12 pages of a table, as pg_freespace and pg_visibility_map see them" stages={MAP_STAGES} full={S.columnOrder.packed.per_page} />
      <CodeBlock title="recorded: VACUUM (VERBOSE) — the lines about the maps" language="text" code={S.vacuumMaps} />
      <Callout tone="tip" title="Why index-only scans need VACUUM">
        An index entry does not say whether its row is visible to you. An index-only scan skips the heap only for pages the visibility map marks
        all-visible — and only VACUUM sets that bit. A table that is never vacuumed gets no index-only scans in practice.
      </Callout>

      <h2>Checklist</h2>
      <p>What to decide when you create a large table.</p>
      <Table
        head={['Decision', 'Rule of thumb']}
        rows={[
          ['Column order', 'for very large tables: 8-byte types, then 4, 2, 1-byte, then variable-length'],
          ['Types', 'the smallest type that is safe: integer vs bigint is 4 bytes per row and per index entry'],
          ['NULLs', 'free (one bit) — but only once a row has any NULL is the bitmap added'],
          ['fillfactor', '100 for insert-only tables; 80–90 for frequently updated ones'],
          ['Big values', 'keep them in their own column so queries that skip it never touch TOAST; lz4 for speed'],
          ['Measure', <span key="m"><code>pg_column_size()</code>, <code>pg_relation_size()</code>, <code>pgstattuple</code> and <code>pageinspect</code> show the real numbers</span>],
        ]}
      />

      <Recap
        points={[
          'A page is 8 kB: a 24-byte header, 4-byte line pointers growing down, tuples growing up from the end, free space between.',
          'Every tuple has a 23-byte header (xmin, xmax, cid, ctid, infomask, hoff) padded to 24, plus a null bitmap when it has NULLs.',
          'Values are aligned to their type: putting 8-byte columns first can make rows noticeably smaller.',
          'fillfactor leaves free space on each page so updates can stay on the page (HOT).',
          'Rows over ~2 kB get their large values compressed (pglz or lz4) and, if needed, moved to a TOAST table in ~2 kB chunks.',
          'VACUUM fills the free space map and sets all-visible / all-frozen bits in the visibility map.',
        ]}
      />
    </>
  )
}
