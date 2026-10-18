import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Flow, StatTiles, Timeline } from '@/shared/figures'
import { CliSession, DictPlayground } from '../components'
import { KeyspaceCursorFigure, KeyspaceRehashFigure, type HtTable } from '../components/KeyspaceFigures'
import { CAPTURE } from '../data/captures'
import { cursorOrder } from '../simulation/dict'
import styles from './lesson.module.css'

const K = CAPTURE.keyspace
const A = CAPTURE.architecture
const seq = K.cursorSequence
const bin = (n: number) => n.toString(2).padStart(Math.log2(seq.tableSize), '0')
const order = cursorOrder(seq.tableSize).slice(1)
const seen: readonly number[] = seq.cursors
const skipped = order.filter((c) => !seen.includes(c))

/** The "Dictionary HT" part of DEBUG HTSTATS: one entry per table (two while rehashing). */
const ht = (text: string): HtTable[] => {
  const dict = text.split('[Expires HT]')[0]
  const sizes = [...dict.matchAll(/table size: (\d+)/g)].map((m) => Number(m[1]))
  const elements = [...dict.matchAll(/number of elements: (\d+)/g)].map((m) => Number(m[1]))
  return sizes.map((size, i) => ({ size, elements: elements[i] ?? 0 }))
}

/** SCAN calls drawn on the timeline: a sample of the recorded loop, spread evenly over its duration. */
const SCAN_DRAWN = 25
const scanCall = A.scanFull.totalMs / A.scanFull.calls

export default function Keyspace() {
  return (
    <>
      <LessonGoals
        goals={[
          'see how Redis finds a key: one hash table per database',
          'watch the table grow without pausing the server (incremental rehashing)',
          'use SCAN instead of KEYS, and know exactly what SCAN promises',
          'name keys so that they stay findable and cheap',
        ]}
        before="Lesson 1 — one thread runs every command"
      />

      <h2>Every key lives in one hash table</h2>
      <p>
        A Redis database is, at its heart, one big <strong>dictionary</strong>: a hash table from key to value. To find <code>user:42</code>, Redis
        hashes the key, takes the hash modulo the table size, and looks in that <strong>bucket</strong>. Keys whose hashes collide share a bucket as a
        short chain. Because the table size is always a power of two, “modulo” is just a bit mask — the lowest bits of the hash.
      </p>
      <TermList
        items={[
          { term: 'dict', definition: 'Redis’s hash table type. The keyspace of each database is one dict (keys with a TTL are also kept in a second dict of expiry times).' },
          { term: 'bucket', definition: 'One slot of the table; holds a short chain of entries whose hashes share the same low bits.' },
          { term: 'load factor', definition: 'Keys ÷ buckets. Redis grows the table when it reaches 1 — one key per bucket on average.' },
          { term: 'rehashing', definition: 'Moving entries from the old table into a new one twice as big — done a little at a time, not all at once.' },
        ]}
      />
      <Flow
        title="Finding user:42"
        cols={5}
        rows={1}
        rowHeight={96}
        nodes={[
          { id: 'key', label: 'user:42', sub: 'the key', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'hash', label: 'hash', sub: '64-bit SipHash', col: 1, row: 0, hue: 2 },
          { id: 'mask', label: 'low bits', sub: 'hash & (size − 1)', col: 2, row: 0, hue: 2 },
          { id: 'bucket', label: 'bucket', sub: 'short chain', col: 3, row: 0, hue: 3, shape: 'queue' },
          { id: 'value', label: 'value', sub: 'string, hash, list…', col: 4, row: 0, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'key', to: 'hash', flow: true, hue: 1 },
          { from: 'hash', to: 'mask', flow: true, hue: 2 },
          { from: 'mask', to: 'bucket', label: 'index', flow: true, hue: 2 },
          { from: 'bucket', to: 'value', label: 'match', flow: true, hue: 3 },
        ]}
        steps={[
          { title: 'Hash the key', body: <p>The key’s bytes go through a hash function and come out as one big number.</p>, active: ['key', 'hash', 'key>hash'] },
          { title: 'Keep the low bits', body: <p>The table size is a power of two, so “modulo size” is just a bit mask: the lowest bits of the hash pick the bucket.</p>, active: ['hash', 'mask', 'hash>mask'] },
          { title: 'Walk the bucket', body: <p>Keys whose hashes share those bits sit in the same bucket as a short chain; Redis compares names along it.</p>, active: ['mask', 'bucket', 'mask>bucket'] },
          { title: 'Found', body: <p>The matching entry points to the value object. On average this costs one bucket and one or two comparisons — O(1).</p>, active: ['bucket', 'value', 'bucket>value'] },
        ]}
      />
      <p>
        Redis can print the table’s shape with <code>DEBUG HTSTATS 0</code> (a debugging command, disabled by default in production). Here is a fresh
        database, then the same database holding 4 keys:
      </p>
      <div className={styles.grid2}>
        <CodeBlock title="empty database" language="text" code={K.htEmpty} />
        <CodeBlock title="after 4 SETs" language="text" code={K.ht4} />
      </div>

      <h2>Growing without stopping</h2>
      <p>
        4 keys in 4 buckets is a load factor of 1. The 5th key makes Redis allocate a <strong>second</strong> table of 8 buckets. It does not copy
        everything there at once — that could take seconds on a big database, and with one thread, every client would wait (lesson 1). Instead the
        dict keeps <strong>both</strong> tables for a while. New keys go into the new table; every later command that touches the dict moves one
        bucket across. Lookups check both tables.
      </p>
      <div className={styles.grid2}>
        <CodeBlock title="the 5th SET starts a rehash" language="text" code={K.ht5} />
        <CodeBlock title="a few commands later" language="text" code={K.ht5AfterAccess} />
      </div>
      <KeyspaceRehashFigure
        title="The same three moments, drawn from the recorded numbers"
        snapshots={[
          { label: '4 keys: table full (load factor 1)', tables: ht(K.ht4) },
          { label: 'the 5th SET: a second table, keys in both', tables: ht(K.ht5) },
          { label: 'a few commands later: moved, old table freed', tables: ht(K.ht5AfterAccess) },
        ]}
      />
      <p>The same thing at scale: a table of 65,536 buckets holding 65,536 keys, then one more key.</p>
      <div className={styles.grid2}>
        <CodeBlock title="full" language="text" code={K.htFull} />
        <CodeBlock title="one more SET" language="text" code={K.htRehashing} />
        <CodeBlock title="after 200 GETs" language="text" code={K.htRehashingLater} />
        <CodeBlock title="background rehashing on, half a second later" language="text" code={K.htDone} />
      </div>
      <KeyspaceRehashFigure
        title="At scale: the move is spread over many commands and cron ticks"
        snapshots={[
          { label: 'full', tables: ht(K.htFull) },
          { label: 'one more SET', tables: ht(K.htRehashing) },
          { label: 'after 200 GETs', tables: ht(K.htRehashingLater) },
          { label: 'background rehashing on, 500 ms later', tables: ht(K.htDone) },
        ]}
      />
      <p>
        The recording ran with <code>activerehashing no</code> first, so only commands moved buckets: 200 GETs moved a few hundred keys. With{' '}
        <code>activerehashing yes</code> (the default) the server’s background cron also spends about a millisecond per tick moving buckets — even then
        the move was only half done after 500 ms. That is the point: the cost is spread so thinly that no single command notices it.
      </p>
      <Callout tone="note" title="The price of incremental rehashing">
        While a rehash is in progress, both tables exist, so memory briefly grows by the size of the new bucket array (here 131,072 pointers ≈ 1 MB).
        While a child process is saving (RDB or AOF rewrite), Redis postpones resizing unless the table gets several times overfull, because writing to
        many pages would multiply copy-on-write memory — lesson 10.
      </Callout>

      <DictPlayground />

      <h2>KEYS: one command that reads everything</h2>
      <p>
        <code>KEYS pattern</code> walks every bucket of the table in one go and returns all matching keys. With one thread, nothing else runs until it
        finishes. On the recorded server with {A.keyspace.toLocaleString()} keys, <code>KEYS nomatch*</code> (which matches nothing — so this is pure
        scanning, no reply to build) took <strong>{A.keysMs} ms</strong>, and a PING sent meanwhile waited {A.keysPing.pingMs} ms.
      </p>
      <StatTiles
        stats={[
          { label: 'KEYS nomatch*, one call', value: `${A.keysMs} ms`, sub: `over ${A.keyspace.toLocaleString()} keys`, hue: 8 },
          { label: 'a PING sent meanwhile waited', value: `${A.keysPing.pingMs} ms`, sub: 'blocked behind KEYS', hue: 8, bar: { value: A.keysPing.pingMs, max: A.keysMs } },
          { label: 'SCAN loop, COUNT 1000', value: `${A.scanFull.calls.toLocaleString()} calls`, sub: `${A.scanFull.totalMs} ms in total`, hue: 2 },
          { label: 'average SCAN call', value: `${scanCall.toFixed(2)} ms`, sub: 'incl. round trip; others run between', hue: 6 },
        ]}
      />
      <Timeline
        title="Who can run, and when (KEYS and its PING recorded; the SCAN lane draws 25 of its calls)"
        start={0}
        end={A.scanFull.totalMs}
        lanes={[
          { id: 'keys', label: 'KEYS' },
          { id: 'ping1', label: 'PING during KEYS' },
          { id: 'scan', label: 'SCAN loop' },
          { id: 'ping2', label: 'PING during SCAN' },
        ]}
        segments={[
          { lane: 'keys', from: 0, to: A.keysPing.slowMs, label: 'one command', hue: 2 },
          { lane: 'ping1', from: A.keysPing.slowMs - A.keysPing.pingMs, to: A.keysPing.slowMs, label: 'waits', hue: 8, striped: true },
          ...Array.from({ length: SCAN_DRAWN }, (_, i) => ({ lane: 'scan', from: (i * A.scanFull.totalMs) / SCAN_DRAWN, to: (i * A.scanFull.totalMs) / SCAN_DRAWN + scanCall, hue: 2 as const })),
        ]}
        events={[
          { lane: 'ping1', at: A.keysPing.slowMs, label: 'PONG', hue: 6 },
          { lane: 'ping2', at: A.keysPing.slowMs - A.keysPing.pingMs, label: 'PONG at once', hue: 6 },
        ]}
        playable
      />
      <Table
        head={['', 'calls', 'time per call', 'others can run']}
        rows={[
          ['KEYS nomatch*', '1', `${A.keysMs} ms`, `only after ${A.keysMs} ms`],
          ['SCAN … COUNT 1000, full loop', A.scanFull.calls.toLocaleString(), `about ${(A.scanFull.totalMs / A.scanFull.calls).toFixed(2)} ms on average (incl. round trip)`, 'between every two calls'],
        ]}
      />
      <p>
        The full SCAN loop took {A.scanFull.totalMs} ms of wall time in total — <em>more</em> than KEYS — but in {A.scanFull.calls.toLocaleString()} small
        pieces, with other clients served in between. That trade is what you want on a server other people use.
      </p>

      <h2>SCAN: a cursor over the buckets</h2>
      <p>
        <code>SCAN cursor</code> returns a few keys and the next cursor. You start at 0 and stop when the server hands 0 back. Twenty keys, five at a time:
      </p>
      <CliSession steps={K.scan} title="recorded: a full SCAN of 20 keys" />
      <p>
        The cursor is not a key count or an offset — it is a <strong>bucket index</strong>, and it advances in a strange order. For a table of{' '}
        {seq.tableSize} buckets, calling <code>SCAN … COUNT 1</code> again and again returned these cursors:
      </p>
      <KeyspaceCursorFigure
        title={`SCAN over a table of ${seq.tableSize} buckets: the order it visits them`}
        size={seq.tableSize}
        order={order}
        seen={seen}
      />
      <p className={styles.note}>
        Recorded cursors, in order: {seq.cursors.map((c) => `${c} (${bin(c)})`).join(', ')}.
      </p>
      <p>
        The full order is {order.join(', ')}. Read each cursor’s bits from right to left and it counts up: 0, 1, 2, 3… with the bits <strong>reversed</strong>
        {skipped.length > 0 && <> (here the calls skipped {skipped.join(', ')}: COUNT 1 is a hint, and a call may visit more than one bucket)</>}. Why? When the table doubles, bucket <code>b</code> splits into <code>b</code> and <code>b + size</code> — the new
        highest bit. Counting from the high bit down means every bucket the scan already visited maps to buckets it will not visit again, in a table of
        any size. So a scan that runs across a resize still covers everything.
      </p>
      <Table
        head={['SCAN guarantees', 'SCAN does not guarantee']}
        rows={[
          ['A full iteration (cursor 0 → 0) returns every key that existed for the whole iteration', 'Keys added or deleted during the scan may or may not be returned'],
          ['It never blocks the server for long', 'No duplicates — a key can be returned more than once (e.g. when the table shrinks); de-duplicate in the client'],
          ['COUNT bounds the work per call (it is a hint, default 10)', 'An exact number of keys per call — a call may return fewer, more, or none'],
          ['MATCH and TYPE filter the keys', 'That the filter saves work — it is applied after the keys are fetched'],
        ]}
      />
      <CliSession steps={K.scanFilter} title="recorded: MATCH and TYPE" />
      <Predict
        question={<p>You run <code>SCAN 0 MATCH order:* COUNT 100</code> on a database with a million keys, of which ten match. The reply has an empty list of keys and cursor 34816. What does that mean?</p>}
        options={['There are no matching keys', 'Keep scanning from 34816 — those 100 buckets just had no match', 'The scan is broken and must restart']}
        answer={1}
        explanation="MATCH is applied after fetching, so a call can return nothing while there is more to scan. Only cursor 0 means the iteration is complete."
      />
      <Callout tone="tip" title="The same idea for big values">
        <code>HSCAN</code>, <code>SSCAN</code> and <code>ZSCAN</code> iterate the inside of one hash, set or sorted set with the same cursor rules —
        use them instead of <code>HGETALL</code> or <code>SMEMBERS</code> on values with thousands of elements (lesson 16 shows a single HGETALL in the slow log).
      </Callout>

      <h2>Databases and key names</h2>
      <p>
        A Redis server has 16 numbered databases by default (<code>databases 16</code>); <code>SELECT 3</code> switches a connection to number 3. They
        are just separate dicts in one process: they share memory, the event loop, persistence and ACLs, and Redis Cluster supports only database 0.
        So they are not isolation. Use one database and <strong>key prefixes</strong>, or separate servers when you really need isolation.
      </p>
      <Table
        head={['Convention', 'Example', 'Why']}
        rows={[
          ['type:id with colons', <code key="a">user:42</code>, 'Readable, groups related keys, easy to MATCH'],
          ['type:id:field for sub-objects', <code key="b">user:42:sessions</code>, 'One key per thing you read or expire separately'],
          ['a version or namespace when the format changes', <code key="c">v2:user:42</code>, 'Old and new code can run side by side; old keys expire'],
          ['hash tags for keys used together in Cluster', <code key="d">{'{user:42}'}:cart</code>, 'Same slot, so multi-key commands work (lesson 12)'],
          ['short, but not cryptic', <code key="e">u:42</code>, 'Every key name costs memory per key — at millions of keys, bytes count'],
        ]}
      />

      <h2>Design rules</h2>
      <Callout tone="warn" title="In production">
        <ul>
          <li>Never call <code>KEYS</code> on a live server; deny it with ACL (<code>-keys</code> or <code>-@dangerous</code>, lesson 16) — renaming is the <code>rename-command</code> config. Use <code>SCAN</code> in a loop until cursor 0.</li>
          <li>Treat SCAN results as “at least once”: make whatever you do per key idempotent.</li>
          <li>If you need to list a group of keys often, keep an index yourself (a set or sorted set of ids) instead of scanning the keyspace.</li>
          <li>Prefix keys by type and owner; don’t use numbered databases for isolation.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'Each database is one hash table; its size is a power of two and it doubles when it holds as many keys as buckets.',
          'Rehashing is incremental: two tables live side by side while each command (and a background tick) moves a bucket.',
          'KEYS reads the whole table in one blocking command; SCAN walks it in small steps with a reversed-bit cursor.',
          'A full SCAN returns every key present throughout — possibly twice, never with a promise about keys that change meanwhile.',
        ]}
      />
    </>
  )
}
