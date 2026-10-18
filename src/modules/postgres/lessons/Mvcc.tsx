import { Flow, StatTiles, type FlowEdge, type FlowNode } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { SessionPlayer } from '../components/SessionPlayer'
import { MvccSnapshotLine } from '../components/MvccSnapshotLine'
import { MvccVisibilityChecker } from '../components/MvccVisibilityChecker'
import { INTERNALS } from '../data/internals'
import { hex4, infomaskFlags } from '../simulation/mvccVisibility'
import { scenario, xidAt, xmaxAt } from './frames'

const frames = scenario('mvcc-update')
const a = xidAt(frames, 2, 'A')
const del = xmaxAt(frames, 7, 2)
const M = INTERNALS.mvcc

const NOTES = [
  <>Session A opens a transaction. It has no transaction id yet: PostgreSQL assigns one (an <strong>xid</strong>) only when a transaction first writes.</>,
  <>
    A updates row 1 and gets xid {a}. The old version at lp 1 is <strong>not overwritten</strong>: its <code>xmax</code> is set to {a}{' '}
    (“deleted by {a}”) and its <code>ctid</code> now points to (0,3), where the new version lives with <code>xmin = {a}</code> and balance 150.
  </>,
  <>
    B reads and still sees 100. For B, the new version’s <code>xmin</code> ({a}) is in progress, so it is invisible; the old version’s{' '}
    <code>xmax</code> is in progress too, so the old version still counts. B was not blocked: <strong>readers never wait for writers</strong>.
  </>,
  <>A reads its own change: a transaction always sees what it wrote itself.</>,
  <>
    A commits. Look at the page: <strong>nothing in it changed</strong>. Only the status of {a} flipped to committed (it is kept in the commit
    log, <code>pg_xact</code>). Committing is cheap because no row has to be touched.
  </>,
  <>B reads again. Now {a} is committed, so the old version is deleted and the new one is live: B sees 150.</>,
  <>
    A deletes row 2 (as its own one-statement transaction, xid {del}). A DELETE writes no new version — it only sets <code>xmax = {del}</code>{' '}
    on lp 2. The row’s bytes are still on the page.
  </>,
  <>
    B sees only row 1. The page holds three tuples, but two of them are now <strong>dead</strong>: no transaction can ever see them again.
    Removing them is VACUUM’s job — next lesson.
  </>,
]

// the recorded version chain of row 1: three UPDATEs, each its own transaction
const chain = M.chain.filter((t) => t.id === 1)
const CHAIN_NODES: FlowNode[] = [
  { id: 'idx', label: 'index entry', sub: 'id = 1 → (0,1)', col: 0, row: 0, hue: 7 },
  ...chain.map((t, i) => ({
    id: `lp${t.lp}`,
    label: `lp ${t.lp}: balance ${t.balance}`,
    sub: `xmin ${t.xmin} · xmax ${t.xmax} · ${t.xmax === '0' ? 'live' : 'dead'}`,
    col: i < 2 ? i + 1 : 4 - i,
    row: i < 2 ? 0 : 1,
    hue: (t.xmax === '0' ? 6 : 8) as 6 | 8,
  })),
]
const CHAIN_EDGES: FlowEdge[] = [
  { from: 'idx', to: `lp${chain[0].lp}`, hue: 7 },
  ...chain.slice(1).map((t, i) => ({ from: `lp${chain[i].lp}`, to: `lp${t.lp}`, label: `ctid ${chain[i].ctid}`, hue: 3 as const })),
]
const chainSteps = chain.map((t, i) => ({
  title: i === 0 ? 'The original row' : `UPDATE #${i}: balance ${t.balance}`,
  body:
    i === 0 ? (
      <p>Row 1 was inserted by xid {t.xmin}. The index points at its line pointer, lp {t.lp}.</p>
    ) : (
      <p>
        Transaction {t.xmin} wrote a new version at lp {t.lp} (xmin {t.xmin}) and stamped the previous one with xmax {t.xmin} and ctid → (0,{t.lp}).
        The index still points at lp {chain[0].lp}: these were HOT updates (next lesson).
      </p>
    ),
  active: ['idx', ...chain.slice(0, i + 1).map((c) => `lp${c.lp}`), `idx>lp${chain[0].lp}`, ...chain.slice(1, i + 1).map((c, k) => `lp${chain[k].lp}>lp${c.lp}`)],
}))

// who inserted which row while the snapshot was taken (see capture-internals.mjs)
const OWNERS: Record<number, string> = { 1: 'ann — inserted earlier', 2: 'ben — session A, open', 3: 'cat — session B, committed', 4: 'dan — session C, open' }

export default function Mvcc() {
  return (
    <>
      <LessonGoals
        goals={[
          'see that an UPDATE writes a new row version instead of changing the old one',
          'read xmin, xmax and ctid on a real page and follow a version chain',
          'read a snapshot (xmin:xmax:running) and decide which version a transaction sees',
          'explain hint bits and why a SELECT can write to a page',
        ]}
        before={<>pages, line pointers and the tuple header from <a href="#/postgres/storage">Pages, tuples and TOAST</a></>}
      />

      <h2>Two people, one row</h2>
      <p>
        PostgreSQL never changes a row in place: it keeps <strong>several versions</strong> of it, and each transaction picks the version that is
        right for it.
      </p>
      <p>
        If one transaction is changing a row while another reads it, many databases make the reader wait. PostgreSQL lets both go ahead. This is{' '}
        <strong>multi-version concurrency control (MVCC)</strong>.
      </p>
      <TermList
        items={[
          { term: 'tuple', definition: 'One physical version of a row on a page.' },
          { term: 'xid', definition: 'Transaction id: a 32-bit counter, assigned at a transaction’s first write. Read-only transactions never get one.' },
          { term: 'xmin', definition: 'The xid that created this version (INSERT or UPDATE).' },
          { term: 'xmax', definition: 'The xid that deleted or replaced this version (DELETE or UPDATE), or that locked it; 0 if none.' },
          { term: 'ctid', definition: 'Where the newer version of this row is: (page, line pointer). Points to itself if this is the newest.' },
          { term: 'snapshot', definition: 'Which transactions count as finished for a statement (READ COMMITTED) or a whole transaction (REPEATABLE READ).' },
        ]}
      />

      <Predict
        question={
          <p>
            Table <code>accounts</code> has row <code>(1, 100)</code>. A transaction runs <code>UPDATE accounts SET balance = 150 WHERE id = 1</code>{' '}
            and commits. How many versions of row 1 are now physically on the page?
          </p>
        }
        options={['1 — the value was changed in place', '2 — the old one and the new one', '0 — the row moved to a new page']}
        answer={1}
        explanation="An UPDATE is a DELETE of the old version plus an INSERT of a new one, in one step. Both stay on the page until vacuum. Watch it happen:"
      />

      <SessionPlayer title="UPDATE, COMMIT and DELETE, seen from two sessions" frames={frames} columns={['id', 'balance']} notes={NOTES} />
      <p>
        Ignore the <em>HOT updated</em> and <em>heap-only</em> labels for now; <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM</a>{' '}
        explains them. Hover a transaction id to see its status.
      </p>

      <h2>Version chains</h2>
      <p>Each UPDATE adds one link: the old version’s ctid points to the new one, so a row’s history is a chain on the page.</p>
      <Flow
        title="Recorded: row 1 after three UPDATEs, each in its own transaction"
        cols={3}
        rows={2}
        nodes={CHAIN_NODES}
        edges={CHAIN_EDGES}
        steps={chainSteps}
        caption="Red: dead versions (xmax set and committed). Green: the live version (xmax 0). Every version still occupies bytes on the page."
      />
      <CodeBlock title="recorded: heap_page_items of the accounts page" language="text" code={M.chainText} />

      <h2>Snapshots</h2>
      <p>
        A snapshot is three things: <strong>xmin</strong> (every xid below it is finished), <strong>xmax</strong> (every xid from here on is
        invisible) and the list of xids <strong>running</strong> in between.
      </p>
      <p>
        Recorded with three other sessions: A inserted ben and stayed open, B inserted cat and committed, C inserted dan and stayed open. Then a
        fourth session asked for its snapshot:
      </p>
      <CodeBlock title="recorded" language="text" code={`${M.snapshotText}\n\n${M.snapshotRows}`} />
      <MvccSnapshotLine
        title="Recorded: that snapshot on the xid line, and the four tuples on the page"
        snapshot={M.snapshot.snap}
        rows={M.snapshotPage.map((t) => ({ xid: t.xmin, label: OWNERS[t.lp] ?? `lp ${t.lp}`, status: t.status }))}
      />
      <Callout tone="note" title="When is the snapshot taken?">
        In READ COMMITTED (the default) every statement takes a new one, so a later statement sees rows committed in between. In REPEATABLE READ
        and SERIALIZABLE the first statement’s snapshot is kept for the whole transaction — see <a href="#/postgres/isolation">Isolation levels</a>.
      </Callout>

      <h2>The visibility rule</h2>
      <p>A version is visible when its insert is finished for me and its delete is not.</p>
      <Flow
        title="Deciding one tuple"
        cols={4}
        rows={2}
        nodes={[
          { id: 't', label: 'tuple', sub: 'xmin, xmax', col: 0, row: 0, hue: 3, shape: 'actor' },
          { id: 'min', label: 'xmin done for me?', sub: 'committed before, or me', col: 1, row: 0, hue: 7 },
          { id: 'max', label: 'xmax done for me?', sub: 'committed before, or me', col: 2, row: 0, hue: 7 },
          { id: 'vis', label: 'visible', col: 3, row: 0, hue: 6 },
          { id: 'inv', label: 'invisible', sub: 'skip it', col: 1, row: 1, span: 2, hue: 8 },
        ]}
        edges={[
          { from: 't', to: 'min', hue: 3 },
          { from: 'min', to: 'max', label: 'yes', hue: 6 },
          { from: 'min', to: 'inv', label: 'no', hue: 8 },
          { from: 'max', to: 'vis', label: 'no / 0', hue: 6 },
          { from: 'max', to: 'inv', label: 'yes', hue: 8 },
        ]}
        steps={[
          { title: 'Check xmin', body: <p>Was the creating transaction committed before my snapshot (not in its running list and below its xmax) — or is it my own transaction? If it is running, aborted or committed later, the version does not exist for me.</p>, active: ['t', 'min', 't>min'] },
          { title: 'xmin failed: skip', body: <p>An insert I cannot see yet, or one that rolled back. Many versions are skipped this way while other transactions write.</p>, active: ['min', 'inv', 'min>inv'] },
          { title: 'Check xmax', body: <p>Is the version deleted for me? Only if the deleting transaction committed before my snapshot, or I deleted it myself. A delete in progress, rolled back or committed later does not count.</p>, active: ['min', 'max', 'min>max'] },
          { title: 'Visible or deleted', body: <p>Not deleted for me: visible. Deleted for me: skip it. For each row exactly one version passes (or none if it is deleted).</p>, active: ['max', 'vis', 'inv', 'max>vis', 'max>inv'] },
        ]}
        caption="The real code (HeapTupleSatisfiesMVCC) also handles subtransactions, the command id within my own transaction, row locks recorded in xmax and multixacts — they all reduce to these two checks."
      />
      <MvccVisibilityChecker />

      <h2>Hint bits: a SELECT that writes</h2>
      <p>
        Checking whether an xid committed means a lookup in <code>pg_xact</code>, so the first reader who finds out records the answer in the
        tuple’s <code>t_infomask</code>.
      </p>
      <StatTiles
        title="Recorded: one tuple’s t_infomask, before and after the first SELECT"
        stats={[
          { label: 'after INSERT … COMMIT', value: hex4(M.hintBefore.t_infomask), sub: infomaskFlags(M.hintBefore.t_infomask).join(', '), hue: 3 },
          { label: 'after the first SELECT', value: hex4(M.hintAfter.t_infomask), sub: infomaskFlags(M.hintAfter.t_infomask).join(', '), hue: 6 },
          { label: 'row locked with FOR UPDATE', value: hex4(M.lock.t_infomask), sub: `xmax = ${M.lock.xmax} (me) · ${infomaskFlags(M.lock.t_infomask).filter((f) => f.includes('XMAX')).join(', ')}`, hue: 1 },
        ]}
      />
      <p>
        <code>HEAP_XMIN_COMMITTED</code> appeared because the SELECT looked xmin {M.hintAfter.xmin} up and found it committed. Setting the bit
        dirties the page, so the first read after a big load writes pages too (and VACUUM sets the bits for all of them). The last tile shows that
        a row lock is stored the same way: <code>xmax</code> holds the locker’s xid, and <code>HEAP_XMAX_LOCK_ONLY</code> says it is a lock, not a
        delete.
      </p>

      <h2>Transaction ids run out</h2>
      <p>
        xids are 32-bit: about 4 billion values, compared in a circle. This server had reached xid {M.xid.xid8}; the 64-bit{' '}
        <code>pg_current_xact_id()</code> adds an epoch so it never repeats, but tuples store only the lower 32 bits.
      </p>
      <p>
        So very old tuples must be <strong>frozen</strong> — marked visible to everyone — before their xmin comes round again. VACUUM does this;{' '}
        <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM</a> shows it on a real page.
      </p>

      <h2>Design rules</h2>
      <p>What MVCC means for the way you write applications.</p>
      <Table
        head={['Rule', 'Because']}
        rows={[
          ['Keep transactions short; never leave a session “idle in transaction”', 'an open snapshot keeps every version it might need alive, for every table'],
          ['Do not UPDATE rows that did not change', 'every UPDATE writes a whole new version, even with identical values'],
          ['Prefer a few wide updates over many updates of the same row', 'each update leaves a dead version behind'],
          ['Expect long reports to see the data as of their start', 'that is their snapshot — under REPEATABLE READ for the whole transaction'],
          ['Count on readers and writers not blocking each other', 'only writers of the same row wait for each other (see Concurrent writes and locks)'],
        ]}
      />

      <Callout tone="note" title="What MVCC costs">
        Every UPDATE leaves an old version behind, so tables collect dead tuples that must be cleaned up, and old tuples must be frozen before the
        32-bit xids wrap around. Both are VACUUM’s job.
      </Callout>

      <Recap
        points={[
          'An UPDATE writes a new tuple and marks the old one with xmax and a ctid pointing forward; a DELETE only sets xmax.',
          'A snapshot is xmin:xmax:running xids; a version is visible if its xmin is done for me and its xmax is not.',
          'Readers do not block writers and writers do not block readers.',
          'COMMIT changes no tuple: it records the xid as committed in pg_xact; the first reader caches that as a hint bit.',
          'xids are 32-bit, so old tuples must be frozen by VACUUM.',
        ]}
      />
    </>
  )
}
