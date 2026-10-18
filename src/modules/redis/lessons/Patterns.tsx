import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarList, CliSession } from '../components'
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
      <Table
        head={['distinct added', 'PFCOUNT estimate', 'error', 'memory']}
        rows={P.hll.map((h) => [h.distinct.toLocaleString(), h.estimate.toLocaleString(), `${h.errorPercent}%`, kb(h.bytes)])}
      />
      <BarList
        title={`Memory to count ${P.setOfMillion.members.toLocaleString()} distinct visitors`}
        bars={[
          { label: 'set', value: P.setOfMillion.bytes, display: mb(P.setOfMillion.bytes) },
          { label: 'HyperLogLog', value: hllMillion.bytes, display: kb(hllMillion.bytes), emphasis: true },
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
      <CliSession title="recorded: stores near a point" steps={P.geo} />
      <p>
        <code>TYPE stores</code> answers <code>zset</code>: a geo set is a sorted set whose score is a 52-bit geohash of the position, so
        <code> ZREM</code>, <code>ZCARD</code> and the rest work on it. Search by radius or by box returns distances; keep one geo set per kind
        of place and the details in a hash per place.
      </p>

      <h2>Leaderboards, queues, locks and rate limits</h2>
      <CliSession title="recorded: a leaderboard" steps={P.leaderboard} />
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
