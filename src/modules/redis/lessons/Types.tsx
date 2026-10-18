import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarList, CliSession, EncodingExplorer } from '../components'
import { CAPTURE } from '../data/captures'
import { BarChart, ByteLayout, Flow, StatTiles, type ByteField } from '@/shared/figures'

const T = CAPTURE.types
const cfg = T.config
const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

/** The fields and values of the recorded HSET in the tour, in order. */
const hsetArgs = (T.tour.find((s) => s.cmd?.startsWith('HSET user:1'))?.cmd ?? 'HSET user:1 name Ann').split(' ').slice(2)
/** A listpack: 6-byte header, then per short entry 1 encoding byte + the data + 1 back-length byte, then 1 end byte. */
const listpackFields: ByteField[] = [
  { label: 'header', content: 'total · count', bytes: 6, hue: 2 },
  ...hsetArgs.map((a, i): ByteField => ({ label: i % 2 === 0 ? 'field' : 'value', content: a, bytes: a.length + 2, hue: i % 2 === 0 ? 3 : 1 })),
  { label: 'end', content: 'FF', bytes: 1, hue: 2 },
]
const listpackTotal = listpackFields.reduce((n, f) => n + f.bytes, 0)

export default function Types() {
  const { atLimit, above } = T.hashJump
  return (
    <>
      <LessonGoals
        goals={[
          'pick the right data type for a job: string, list, hash, set, sorted set, stream',
          'explain why every type has two internal encodings, and where Redis switches',
          'use the encodings to save memory — with the limits of Redis 8, not of old tutorials',
        ]}
        before="Lesson 1 — Redis keeps data structures in memory"
      />

      <h2>A tour of the types</h2>
      <p>
        Every key holds one value of one type. <code>TYPE key</code> tells you the type; <code>OBJECT ENCODING key</code> tells you how Redis stores it
        in memory right now. Here is one of each, recorded:
      </p>
      <CliSession title="recorded (the stream entry id is replaced by a fixed one)" steps={T.tour} />
      <Table
        head={['Type', 'What it is', 'Typical use', 'Key commands']}
        rows={[
          ['string', 'bytes (text, a number, a serialized object), up to 512 MB', 'cache entries, counters, flags, locks', 'GET SET INCR APPEND SETRANGE'],
          ['list', 'ordered sequence; fast at both ends', 'queues, recent items, timelines', 'LPUSH RPUSH LPOP BLMOVE LRANGE'],
          ['hash', 'field → value map inside one key', 'objects: a user, a cart, a session', 'HSET HGET HINCRBY HGETALL'],
          ['set', 'unordered unique members', 'tags, membership, de-duplication', 'SADD SISMEMBER SINTER SCARD'],
          ['sorted set', 'unique members ordered by a score', 'leaderboards, priority queues, time indexes', 'ZADD ZRANGE ZRANK ZINCRBY'],
          ['stream', 'append-only log of entries with ids', 'event logs, queues with consumer groups', 'XADD XREADGROUP XACK'],
        ]}
      />
      <p>
        Bitmaps, HyperLogLog and geo indexes are not separate types: they are strings and sorted sets with special commands (lesson 15). Streams get
        their own lesson (13); internally a stream is a radix tree of listpacks, each holding up to {cfg['stream-node-max-entries']} entries or{' '}
        {cfg['stream-node-max-bytes']} bytes. Redis 8 also adds a <strong>vector set</strong> type (<code>VADD</code>, <code>VSIM</code>; the
        recorded build lists it as the <code>vectorset</code> module), and the full Redis 8 builds ship JSON, time series and probabilistic types as
        well. The six above are the core.
      </p>

      <h2>Two encodings per type</h2>
      <p>
        A small hash with three fields does not need a real hash table with buckets and pointers. Redis stores small values in a <strong>compact
        encoding</strong> — one contiguous block of memory, searched from start to end — and converts the value to a <strong>pointer-based
        structure</strong> when it grows past a limit. Scanning a few hundred bytes is as fast as hashing, and uses a fraction of the memory.
      </p>
      <TermList
        items={[
          { term: 'listpack', definition: 'A compact block of entries, each with a small header and a back-length so it can be read in both directions. Used for small lists, hashes, sets and sorted sets.' },
          { term: 'intset', definition: 'A sorted array of integers, for sets that hold only integers. Lookup is a binary search.' },
          { term: 'int / embstr / raw', definition: 'String encodings: a number stored as a number; a short string stored in the same allocation as its key and header; a separately allocated buffer.' },
          { term: 'hashtable, skiplist, quicklist', definition: 'The big encodings: a real hash table; a skiplist plus a hash table (lesson 4); a linked list of listpacks.' },
        ]}
      />
      <ByteLayout
        title={`The recorded hash user:1 as a listpack: ${hsetArgs.length / 2} fields in one ${listpackTotal}-byte block`}
        rows={[{ fields: listpackFields }]}
        caption="Drawn from the listpack format: a 6-byte header (total bytes, element count), each short entry = 1 encoding byte + data + 1 back-length byte (so it can be walked backwards), and an end byte. HGET scans it from the start."
      />
      <Flow
        title="The same hash once it is big: a hash table of separately allocated entries (schematic)"
        cols={4}
        rows={2}
        rowHeight={78}
        nodes={[
          { id: 'buckets', label: 'bucket array', sub: 'one pointer per bucket', col: 0, row: 0, rowSpan: 2, hue: 3, shape: 'log' },
          { id: 'e1', label: 'entry', sub: 'field ptr · value ptr · next', col: 1, row: 0, hue: 3 },
          { id: 'e2', label: 'entry', sub: 'field ptr · value ptr · next', col: 1, row: 1, hue: 3 },
          { id: 'f1', label: hsetArgs[0] ?? 'field', sub: 'field string', col: 2, row: 0, hue: 3 },
          { id: 'v1', label: hsetArgs[1] ?? 'value', sub: 'value string', col: 3, row: 0, hue: 1 },
          { id: 'f2', label: hsetArgs[2] ?? 'field', sub: 'field string', col: 2, row: 1, hue: 3 },
          { id: 'v2', label: hsetArgs[3] ?? 'value', sub: 'value string', col: 3, row: 1, hue: 1 },
        ]}
        edges={[
          { from: 'buckets', to: 'e1', label: 'hash(field)', hue: 3 },
          { from: 'buckets', to: 'e2', hue: 3 },
          { from: 'e1', to: 'f1', hue: 3 },
          { from: 'f1', to: 'v1', hue: 1, dashed: true },
          { from: 'e2', to: 'f2', hue: 3 },
          { from: 'f2', to: 'v2', hue: 1, dashed: true },
        ]}
        caption="Every arrow is a pointer to a separate allocation. Lookups no longer scan, but each field now costs pointers, allocator overhead and a bucket — that is the memory jump below."
      />
      <EncodingExplorer />

      <h2>Where the switch happens — recorded</h2>
      <p>Elements were added one at a time until <code>OBJECT ENCODING</code> changed. Memory is <code>MEMORY USAGE</code> of the key, in bytes:</p>
      <Table
        head={['Type', 'Encoding', 'Changes at', 'Memory just after']}
        rows={T.transitions.map((t) => [t.type, `${t.steps[0].encoding} → ${t.steps[1]?.encoding ?? '—'}`, `${t.steps[1]?.count ?? '—'} elements`, t.steps[1] ? `${t.steps[1].memory.toLocaleString()} B` : '—'])}
      />
      <Callout tone="tip" title="Read the limits from your server">
        <p>
          On this server <code>hash-max-listpack-entries</code> is <strong>{cfg['hash-max-listpack-entries']}</strong>,{' '}
          <code>set-max-listpack-entries</code> {cfg['set-max-listpack-entries']}, <code>set-max-intset-entries</code>{' '}
          {cfg['set-max-intset-entries']}, <code>zset-max-listpack-entries</code> {cfg['zset-max-listpack-entries']}, and every element must be at most{' '}
          {cfg['hash-max-listpack-value']} bytes. Lists use <code>list-max-listpack-size {cfg['list-max-listpack-size']}</code> = 8 KB per node. Check your
          own server with <code>CONFIG GET *listpack*</code>.
        </p>
      </Callout>
      <StatTiles
        title="One hash, one field more — recorded MEMORY USAGE"
        stats={[
          { label: `${atLimit.fields} fields, ${atLimit.encoding}`, value: kb(atLimit.memory), hue: 6, bar: { value: atLimit.memory, max: above.memory } },
          { label: `${above.fields} fields, ${above.encoding}`, value: kb(above.memory), hue: 8, bar: { value: above.memory, max: above.memory } },
          { label: 'for one more field', value: `${(above.memory / atLimit.memory).toFixed(1)}×`, sub: 'the whole hash is converted at once', hue: 2 },
        ]}
      />
      <BarChart
        title="Each type right after its encoding changed (recorded MEMORY USAGE of the key)"
        unit=" B"
        bars={T.transitions.filter((t) => t.steps[1]).map((t) => ({ label: `${t.type}: ${t.steps[1].count} elements`, value: t.steps[1].memory, display: kb(t.steps[1].memory), hue: 3 as const, note: `${t.steps[0].encoding} → ${t.steps[1].encoding}` }))}
      />
      <p>
        One extra field made the same hash about <strong>{(above.memory / atLimit.memory).toFixed(1)}×</strong> bigger: every field and value is now a
        separate allocation with pointers, plus the buckets. The length of a single element counts too — a hash with one field became a{' '}
        <code>{T.longValue.after}</code> as soon as one value was {T.longValue.valueBytes} bytes long.
      </p>

      <Predict
        question={<p>A hash grew to 600 fields, so it became a hash table. Then 599 fields are deleted. What is its encoding now?</p>}
        options={['listpack — it is small again', `${T.noWayBack.encoding} — it stays`, 'Redis deletes and recreates the key']}
        answer={1}
        explanation={
          <>
            Recorded: after deleting down to {T.noWayBack.fields} field the encoding was still <code>{T.noWayBack.encoding}</code>. Hashes, sets and
            sorted sets convert upward only: once big, the key keeps its big encoding until it is deleted and written again. Lists are the exception —
            since Redis 7.2 a quicklist that shrinks becomes a listpack again.
          </>
        }
      />

      <h3>Strings: int, embstr and raw</h3>
      <Table head={['Key', 'Value bytes', 'Encoding', 'MEMORY USAGE']} rows={T.strings.map((s) => [<code key="k">{s.key}</code>, s.bytes, s.encoding, `${s.memory} B`])} />
      <p>
        A value that is a 64-bit integer is stored as a number (<code>int</code>). Short strings are <code>embstr</code>: the key, the value and the
        object header in a single allocation. Older tutorials say “up to 44 bytes”, but in Redis 8 the key lives in that allocation too, so{' '}
        <strong>the limit depends on the key length</strong>:
      </p>
      <Table head={['Key', 'Key bytes', 'Longest embstr value']} rows={T.embstrLimit.map((e) => [<code key="k">{e.key}</code>, e.keyBytes, `${e.maxValueBytes} bytes`])} />
      <ByteLayout
        title="One 64-byte allocation: key + longest embstr value, from the recording; the rest is headers"
        scale={64}
        rows={T.embstrLimit.map((e) => ({
          label: `key ${e.key}`,
          fields: [
            { label: 'object + headers', bytes: 64 - e.keyBytes - e.maxValueBytes, hue: 2 },
            { label: 'key', content: e.key, bytes: e.keyBytes, hue: 3 },
            { label: 'value', content: `${e.maxValueBytes} bytes`, bytes: e.maxValueBytes, hue: 1 },
          ],
        }))}
        caption={`In every row key + value = ${T.embstrLimit[0].keyBytes + T.embstrLimit[0].maxValueBytes} bytes: a longer key leaves less room for the value. The header bytes are 64 minus the recorded key and value (their internal split is not shown).`}
      />
      <p>
        Modifying a string in place turns it into <code>raw</code>: <code>APPEND</code> changed a value from <code>{T.appendTurnsRaw.before}</code> to{' '}
        <code>{T.appendTurnsRaw.after}</code>. This matters little for one key and a lot for millions of small ones.
      </p>

      <h2>Using the encodings: small hashes instead of many keys</h2>
      <p>
        Every key costs an entry in the keyspace hash table, an object header and its name. Storing {T.bucketing.objects.toLocaleString()} small values
        as separate keys, and the same values as fields of hashes with 100 fields each (still <code>{T.bucketing.hashEncoding}</code>):
      </p>
      <BarList
        title={`Memory for ${T.bucketing.objects.toLocaleString()} small values`}
        bars={[
          { label: 'one key each (user:N:name)', value: T.bucketing.asKeysBytes, display: mb(T.bucketing.asKeysBytes) },
          { label: 'hashes of 100 (user:N/100)', value: T.bucketing.asHashesBytes, display: mb(T.bucketing.asHashesBytes), emphasis: true },
        ]}
      />
      <p>
        That is {(T.bucketing.asKeysBytes / T.bucketing.asHashesBytes).toFixed(1)}× less memory. The price: you cannot set a TTL on the whole small
        object any more (Redis 7.4+ can expire single hash fields, lesson 6), and the key names become less obvious. Use it for very many tiny values,
        not as a default.
      </p>

      <h2>Design rules</h2>
      <Table
        head={['If you need…', 'Use', 'Watch out for']}
        rows={[
          ['a cached object read and written whole', 'string (serialized)', 'rewriting the whole value to change one field'],
          ['an object whose fields change separately', 'hash', 'HGETALL on hashes with many thousands of fields'],
          ['a FIFO queue or the last N items', 'list (LPUSH + LTRIM, BLMOVE)', 'LINDEX / LRANGE in the middle of long lists are O(N)'],
          ['membership, tags, unique ids', 'set', 'SMEMBERS on huge sets; use SSCAN or SCARD'],
          ['ordering by a number: ranks, time, priority', 'sorted set', 'one huge sorted set becomes a hot, unshardable key'],
          ['an event log several readers process', 'stream', 'trim it (MAXLEN / MINID), or it grows forever'],
        ]}
      />
      <ul>
        <li>Keep collections below the listpack limits when you can: they are smaller and just as fast.</li>
        <li>Avoid “big keys” — one value of many megabytes blocks the server when it is read whole, deleted, expired or migrated.</li>
        <li>Name keys with a prefix and colons (<code>user:42:cart</code>): readable, and SCAN MATCH and ACL key patterns can select them.</li>
      </ul>

      <Recap
        points={[
          'Six core types: string, list, hash, set, sorted set, stream (Redis 8 adds vector sets). Pick the one whose commands match your access pattern.',
          `Small values use compact encodings (listpack, intset, embstr); past a limit — ${cfg['hash-max-listpack-entries']} hash fields, ${cfg['zset-max-listpack-entries']} sorted-set members, ${cfg['hash-max-listpack-value']}-byte elements — Redis converts them; hashes, sets and sorted sets never convert back, lists do when they shrink.`,
          `The conversion is expensive in memory: ${atLimit.fields} → ${above.fields} hash fields went from ${kb(atLimit.memory)} to ${kb(above.memory)}.`,
        ]}
      />
    </>
  )
}
