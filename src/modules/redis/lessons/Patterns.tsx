import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarChart, Flow, StatTiles } from '@/shared/figures'
import { CliSession } from '../components'
import { PatternsBitmap } from '../components/PatternsBitmap'
import { PatternsGeoMap } from '../components/PatternsGeoMap'
import { CAPTURE } from '../data/captures'
import styles from './lesson.module.css'

const P = CAPTURE.patterns
const B = CAPTURE.types.bucketing
const hllMillion = P.hll[P.hll.length - 1]
const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
const perKey = Math.round(B.asKeysBytes / B.objects)
const perField = Math.round(B.asHashesBytes / B.objects)
const fragmentation = CAPTURE.operations.infoMemory.match(/mem_fragmentation_ratio:(\S+)/)?.[1]

/** Quoted strings of a recorded reply, in order. */
const quoted = (out: string) => [...out.matchAll(/"([^"]*)"/g)].map((m) => m[1])
const stepOf = (steps: readonly { readonly cmd?: string; readonly out?: string }[], prefix: string) => steps.find((s) => s.cmd?.startsWith(prefix))
// geo: the places as added, the search point and radius, and the distances the search returned
const geoAdd = stepOf(P.geo, 'GEOADD')!.cmd!.split(' ').slice(2)
const geoSearch = stepOf(P.geo, 'GEOSEARCH')!
const searchArgs = geoSearch.cmd!.split(' ')
const found = quoted(geoSearch.out!)
const distOf = new Map(found.flatMap((v, i) => (i % 2 === 0 ? [[v, Number(found[i + 1])] as const] : [])))
const PLACES = Array.from({ length: geoAdd.length / 3 }, (_, i) => ({ name: geoAdd[i * 3 + 2], lon: Number(geoAdd[i * 3]), lat: Number(geoAdd[i * 3 + 1]), dist: distOf.get(geoAdd[i * 3 + 2]) }))
// leaderboard: the top three as ZREVRANGE … WITHSCORES returned them
const top = quoted(stepOf(P.leaderboard, 'ZREVRANGE')!.out!)
const TOP = Array.from({ length: top.length / 2 }, (_, i) => ({ member: top[i * 2], score: Number(top[i * 2 + 1]) }))
// a bitmap schematic: users 0–23 on two days, and their AND
const DAY1 = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0] as const
const DAY2 = [1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0] as const
const BOTH = DAY1.map((b, i) => (b && DAY2[i] ? 1 : 0) as 0 | 1)

export default function Patterns() {
  return (
    <>
      <LessonGoals
        goals={[
          'map common system-design needs onto the right Redis structure',
          'count unique things in kilobytes with HyperLogLog and bitmaps',
          'name keys and estimate memory before you build',
          'recognise when Redis is the wrong tool',
        ]}
        before="Lessons 3 and 4 — data types and sorted sets"
      />

      <h2>Think in structures, not in tables</h2>
      <p>
        A relational schema starts from the data; a Redis design starts from the <em>question</em>. For every read your system needs, pick the
        structure that answers it in one command, and name the key so the application can build it without a lookup. Every pattern below was
        run on the recorded server.
      </p>
      <TermList
        items={[
          { term: 'key pattern', definition: 'A naming scheme like object:id:field that the code can construct, e.g. session:9f3e2a or stats:2026-10-18.' },
          { term: 'HyperLogLog', definition: 'A fixed-size sketch (about 12 KB) that estimates how many distinct items were added, with a small error.' },
          { term: 'bitmap', definition: 'A string used as an array of bits: bit n set = item n is in the set.' },
          { term: 'geo set', definition: 'A sorted set whose scores encode longitude and latitude, searchable by radius or box.' },
        ]}
      />

      <h2>Sessions</h2>
      <p>One hash per session, one TTL on the whole key; every request refreshes the TTL (sliding expiration), logout deletes it.</p>
      <Flow
        title="A session's life: created, refreshed on every request, gone on logout or idle timeout"
        cols={4}
        rows={2}
        rowHeight={80}
        nodes={[
          { id: 'browser', label: 'browser', sub: 'cookie: 9f3e2a', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'app', label: 'application', sub: 'any instance', col: 1, row: 0, rowSpan: 2, hue: 1 },
          { id: 'hash', label: 'session:9f3e2a', sub: 'hash: user_id, role, csrf', col: 2, row: 0, span: 2, hue: 3, shape: 'store' },
          { id: 'ttl', label: 'TTL 1800 s', sub: 'idle timeout', col: 2, row: 1, hue: 4 },
          { id: 'gone', label: 'deleted', sub: 'DEL or expired', col: 3, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'browser', to: 'app', label: 'request', flow: true, hue: 1 },
          { from: 'app', to: 'hash', label: 'HGET', flow: true, hue: 3 },
          { from: 'app', to: 'ttl', label: 'EXPIRE', hue: 4 },
          { from: 'ttl', to: 'gone', label: 'runs out', hue: 8, dashed: true },
        ]}
        steps={[
          { title: 'Login: HSET + EXPIRE', body: <p>One hash holds the session fields; the key gets a 30-minute TTL. Any application instance can read it — the session is not tied to one server.</p>, active: ['app', 'hash', 'ttl', 'app>hash', 'app>ttl'] },
          { title: 'Every request: read it and refresh the TTL', body: <p>The cookie names the key; <code>HGET</code> reads the user, <code>EXPIRE … 1800</code> restarts the clock (sliding expiration).</p>, active: ['browser', 'app', 'hash', 'ttl', 'browser>app', 'app>hash', 'app>ttl'] },
          { title: 'Logout or 30 idle minutes', body: <p><code>DEL</code> ends it at once; otherwise the TTL runs out and Redis removes the key (lesson 6).</p>, active: ['ttl', 'gone', 'ttl>gone'] },
        ]}
      />
      <CliSession title="recorded: a session" steps={P.session} />
      <p className={styles.note}>
        Use <code>HSET</code> + <code>EXPIRE</code> together in a pipeline or <code>MULTI</code>. Field-level TTLs (<code>HEXPIRE</code>, lesson 6)
        let one field of a session, like a one-time token, expire on its own.
      </p>

      <h2>Counters and statistics</h2>
      <p>
        <code>INCR</code> and <code>HINCRBY</code> are atomic: thousands of clients can count without locks or lost updates. One hash per day
        groups a day’s counters and gets one TTL.
      </p>
      <Flow
        title="Why INCR needs no lock: one thread applies every increment in turn"
        cols={4}
        rows={3}
        rowHeight={60}
        nodes={[
          { id: 'c1', label: 'client 1', sub: 'INCR views', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'c2', label: 'client 2', sub: 'INCR views', col: 0, row: 1, hue: 1, shape: 'actor' },
          { id: 'c3', label: 'client 3', sub: 'INCR views', col: 0, row: 2, hue: 1, shape: 'actor' },
          { id: 'thread', label: 'main thread', sub: 'one command at a time', col: 1, row: 0, rowSpan: 3, span: 2, hue: 2 },
          { id: 'counter', label: 'views', sub: '+1, +1, +1', col: 3, row: 1, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'c1', to: 'thread', flow: true, hue: 1 },
          { from: 'c2', to: 'thread', flow: true, hue: 1 },
          { from: 'c3', to: 'thread', flow: true, hue: 1 },
          { from: 'thread', to: 'counter', label: 'read+add+write', flow: true, hue: 2 },
        ]}
      />
      <CliSession title="recorded: counters" steps={P.counters} />

      <h2>Membership and de-duplication</h2>
      <p><code>SADD</code> returns 1 if the member is new and 0 if it was already there, so “have I seen this?” and “remember it” are one atomic step.</p>
      <CliSession title="recorded: de-duplication with a set" steps={P.dedupe} />
      <CliSession title="recorded: tags as sets" steps={P.sets} />

      <h2>Counting unique things in a few kilobytes</h2>
      <p>
        Counting distinct visitors with a set stores every visitor. A HyperLogLog stores a sketch: it cannot list the visitors, but it estimates
        how many there were with a standard error of 0.81%, in a fixed sketch of 12 KB of registers ({kb(hllMillion.bytes)} reported by <code>MEMORY USAGE</code>, with overhead). Recorded, adding up to a million distinct ids:
      </p>
      <StatTiles
        stats={[
          { label: 'distinct ids added', value: hllMillion.distinct, hue: 1 },
          { label: 'PFCOUNT estimate', value: hllMillion.estimate, sub: `${hllMillion.errorPercent}% off`, hue: 3 },
          { label: 'HyperLogLog memory', value: kb(hllMillion.bytes), sub: 'fixed, however many ids', hue: 6 },
          { label: 'the same ids as a set', value: mb(P.setOfMillion.bytes), sub: `${Math.round(P.setOfMillion.bytes / hllMillion.bytes).toLocaleString()}× more`, hue: 8 },
        ]}
      />
      <Table
        head={['distinct added', 'PFCOUNT estimate', 'error', 'memory']}
        rows={P.hll.map((h) => [h.distinct.toLocaleString(), h.estimate.toLocaleString(), `${h.errorPercent}%`, kb(h.bytes)])}
      />
      <BarChart
        title="Estimate error as distinct ids grow (recorded) — the standard error is 0.81%"
        bars={P.hll.map((h) => ({ label: `${h.distinct.toLocaleString()} ids`, value: h.errorPercent, display: `${h.errorPercent}%`, hue: 3 }))}
        marker={{ value: 0.81, label: 'standard error 0.81%' }}
      />
      <BarChart
        title={`Memory to count ${P.setOfMillion.members.toLocaleString()} distinct visitors (recorded)`}
        bars={[
          { label: 'set', value: P.setOfMillion.bytes, display: mb(P.setOfMillion.bytes), hue: 8 },
          { label: 'HyperLogLog', value: hllMillion.bytes, display: kb(hllMillion.bytes), hue: 6, note: 'the bar is there — it is just 0.03% as long' },
        ]}
      />
      <p>
        Small HyperLogLogs use a sparse encoding (the {kb(P.hll[0].bytes)} at 1,000 items) and switch to the dense one once the sparse form grows past <code>hll-sparse-max-bytes</code> (3,000 bytes by default). Sketches
        merge: daily keys can be combined into a weekly count without double-counting visitors who came twice.
      </p>
      <CliSession title="recorded: merging days into a week" steps={P.hllMerge} />

      <Predict
        question={<p>You need “unique users per day” for a dashboard and also “was user 42 active on Tuesday?”. Which structure answers both?</p>}
        options={['A HyperLogLog per day', 'A bitmap per day, indexed by user id', 'A list per day']}
        answer={1}
        explanation="A HyperLogLog only estimates the count; it cannot answer membership. A bitmap per day answers both: GETBIT for one user, BITCOUNT for the day, BITOP for combinations — and costs one bit per possible user id."
      />

      <h2>Bitmaps: one bit per user</h2>
      <p>
        With numeric user ids, a day of activity is one bit per user. A million users fit in 125,000 bytes; the recorded key covers ids up to
        999,999:
      </p>
      <PatternsBitmap
        title="Schematic: users 0–23 on two days, and BITOP AND of them"
        rows={[
          { label: 'active:day-1', bits: DAY1 },
          { label: 'active:day-2', bits: DAY2 },
          { label: 'BITOP AND', bits: BOTH, result: true },
        ]}
        caption="SETBIT active:day user-id 1 sets one bit; GETBIT asks about one user; BITCOUNT counts a day; BITOP AND/OR combines days."
      />
      <CliSession title="recorded: daily active users" steps={P.bitmaps} />
      <p className={styles.note}>
        Why does <code>MEMORY USAGE</code> report more than 125,000 bytes? The string grew bit by bit through <code>SETBIT</code>, and Redis
        over-allocates a growing string (roughly doubling it while it is small) so that it does not reallocate on every write. The result of{' '}
        <code>BITOP</code>, written in one go, is exactly 125,000 bytes — its reply above is that length.
      </p>
      <p className={styles.note}>
        <code>BITOP AND</code> gives users active on both days; <code>OR</code> gives either. Bitmaps need dense numeric ids: a bitmap indexed by
        a random 64-bit id would be enormous.
      </p>

      <h2>Geo: nearest places</h2>
      <PatternsGeoMap
        title={`The recorded stores at their real coordinates; GEOSEARCH within ${searchArgs[6]} ${searchArgs[7]}`}
        center={{ lon: Number(searchArgs[3]), lat: Number(searchArgs[4]) }}
        radiusKm={Number(searchArgs[6])}
        places={PLACES}
      />
      <CliSession title="recorded: stores near a point" steps={P.geo} />
      <p>
        <code>TYPE stores</code> answers <code>zset</code>: a geo set is a sorted set whose score is a 52-bit geohash of the position, so
        <code> ZREM</code>, <code>ZCARD</code> and the rest work on it. Search by radius or by box returns distances; keep one geo set per kind
        of place and the details in a hash per place.
      </p>

      <h2>Leaderboards, queues, locks and rate limits</h2>
      <CliSession title="recorded: a leaderboard" steps={P.leaderboard} />
      <BarChart
        title="The top three after ZINCRBY, as ZREVRANGE … WITHSCORES returned them"
        bars={TOP.map((t, i) => ({ label: `#${i + 1} ${t.member}`, value: t.score, hue: 3 }))}
      />
      <p>
        Sorted sets keep members ordered by score with O(log n) updates and rank queries — lesson 4 shows the skiplist underneath. Queues and
        event streams are lesson 13; locks, rate limits and idempotency keys are lesson 9.
      </p>

      <h2>Naming keys</h2>
      <ul>
        <li>Use <code>:</code> to separate parts, most general first: <code>user:7:cart</code>, <code>rate:user:7:2026-10-18T10:41</code>.</li>
        <li>Put a version in keys whose value format may change: <code>product:42:v3</code>.</li>
        <li>In a cluster, wrap the part that must group keys in braces so they share a slot: <code>{'{user:7}'}:cart</code>, <code>{'{user:7}'}:orders</code> (lesson 12).</li>
        <li>Keep names short but readable; key names cost memory too, on every key.</li>
        <li>Never build keys from unbounded user input without a limit, and never use one key for unbounded growth (a list of every event ever).</li>
      </ul>

      <h2>Estimate memory before you build</h2>
      <p>Measure a sample, multiply, and leave room. From the recordings in lesson 3:</p>
      <BarChart
        title={`Memory per value, 100,000 small values (recorded)`}
        bars={[
          { label: 'separate string keys', value: perKey, display: `${perKey} B`, hue: 8 },
          { label: 'fields of small hashes', value: perField, display: `${perField} B`, hue: 6, note: `${B.hashEncoding} encoding: ${(B.asKeysBytes / B.asHashesBytes).toFixed(1)}× less memory` },
        ]}
      />
      <Table
        head={['Storing 100,000 small values as…', 'measured', 'per value']}
        rows={[
          ['separate string keys (user:i:name)', mb(B.asKeysBytes), `${perKey} bytes`],
          [`fields of hashes with 100 fields each (${B.hashEncoding})`, mb(B.asHashesBytes), `${perField} bytes`],
        ]}
      />
      <p>
        Every top-level key carries overhead (the key object, its dictionary entry, an expiry entry if it has a TTL). Grouping many tiny values
        into small hashes that stay in the listpack encoding cut memory by {(B.asKeysBytes / B.asHashesBytes).toFixed(1)}× here. Worked example:
        50 million user profiles of about 200 bytes would need roughly 50,000,000 × (200 + key overhead) ≈ 12–15 GB of data, plus
        fragmentation (the recorded <code>mem_fragmentation_ratio</code> was {fragmentation}), plus room for a fork during persistence — so a 32 GB node, or a cluster.
      </p>

      <h2>Pick a structure</h2>
      <Table
        head={['You need…', 'Use', 'Key commands']}
        rows={[
          ['a cached object, a flag, a token', 'string', 'SET … EX, GET, SET NX'],
          ['an object read field by field', 'hash', 'HSET, HGET, HINCRBY, HEXPIRE'],
          ['a counter', 'string or hash field', 'INCR, HINCRBY'],
          ['uniqueness / membership', 'set', 'SADD, SISMEMBER, SINTER'],
          ['ranking, top-N, time-ordered index', 'sorted set', 'ZADD, ZINCRBY, ZRANGE, ZRANK'],
          ['approximate distinct count', 'HyperLogLog', 'PFADD, PFCOUNT, PFMERGE'],
          ['yes/no per numeric id, cohorts', 'bitmap', 'SETBIT, BITCOUNT, BITOP'],
          ['nearby places', 'geo (sorted set)', 'GEOADD, GEOSEARCH'],
          ['a job queue', 'list', 'LPUSH, BLMOVE'],
          ['an event log with consumers', 'stream', 'XADD, XREADGROUP, XACK'],
          ['a lock or a rate limit', 'string / sorted set + script', 'SET NX PX, EVAL'],
        ]}
      />

      <h2>When not to use Redis</h2>
      <Callout tone="warn" title="Redis is the wrong tool when…">
        <ul>
          <li><strong>It would be the only copy of data you cannot lose</strong>, and nobody has decided which persistence and replication guarantees that needs (lessons 10 and 11) — even AOF with replicas can lose acknowledged writes on failover.</li>
          <li><strong>The data is much bigger than RAM</strong>, or mostly cold: you pay memory for every byte.</li>
          <li><strong>You need queries you did not plan for</strong>: joins, ad-hoc filters, aggregations over arbitrary fields. Redis answers the questions you built keys for.</li>
          <li><strong>Values are large blobs</strong> (files, images, big documents): they block the thread on every read and copy. Store them in object storage and cache only metadata.</li>
          <li><strong>Messages must be kept for days and replayed at volume</strong>: a disk-based log broker fits better (lesson 13).</li>
        </ul>
      </Callout>
      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Start from the reads: one question, one key, one command.</li>
          <li>Put a TTL on everything that is derived or temporary; bound everything that grows.</li>
          <li>Prefer sketches (HyperLogLog, bitmaps) when an estimate or a bit per id is enough.</li>
          <li>Estimate memory from a measured sample before launch, and plan the cluster layout around hash tags.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'Sessions are hashes with a TTL; counters are atomic INCRs; de-duplication is SADD returning 0 or 1.',
          `HyperLogLog counted ${hllMillion.distinct.toLocaleString()} distinct ids within ${hllMillion.errorPercent}% in ${kb(hllMillion.bytes)}; a set needed ${mb(P.setOfMillion.bytes)}.`,
          'Bitmaps answer membership and counts for numeric ids at one bit each; geo sets are sorted sets.',
          'Name keys so code can build them, estimate memory from samples, and keep Redis out of jobs that need joins, disks or unplanned queries.',
        ]}
      />
    </>
  )
}
