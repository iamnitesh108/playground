import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarChart, Flow, Proportion, Timeline } from '@/shared/figures'
import { CachePlayground } from '../components/CachePlayground'
import { CAPTURE } from '../data/captures'
import { simulateCache, type Strategy } from '../simulation/cache'

const stat = (k: string) => Number(CAPTURE.operations.infoStats.match(new RegExp(`^${k}:(\\d+)`, 'm'))?.[1] ?? 0)
const hits = stat('keyspace_hits')
const misses = stat('keyspace_misses')

/** The playground's model with its default load: 2,000 reads/s of one key, TTL 5 s, a 300 ms rebuild, 12 s. */
const STAMPEDE = (['none', 'lock', 'early-refresh', 'stale-while-revalidate'] as Strategy[]).map((strategy) => ({ strategy, ...simulateCache({ strategy, requestsPerSecond: 2000, ttlSeconds: 5, rebuildMs: 300, durationSeconds: 12, beta: 1 }) }))
const STRATEGY_LABEL: Record<Strategy, string> = { none: 'plain cache-aside', lock: 'rebuild lock', 'early-refresh': 'early refresh', 'stale-while-revalidate': 'serve stale' }

export default function Caching() {
  return (
    <>
      <LessonGoals
        goals={[
          'choose between cache-aside, read-through, write-through, write-behind and refresh-ahead',
          'invalidate without serving stale data forever',
          'prevent stampedes, penetration and avalanches',
          'handle hot keys and big keys, and measure whether the cache works',
        ]}
        before="Lesson 6 — TTLs; lesson 7 — eviction; lesson 9 — locks"
      />

      <h2>What a cache is for</h2>
      <p>
        A cache keeps a copy of data whose source of truth lives elsewhere — usually a database — so that most reads skip the slow path.
        Everything difficult about caching comes from that word <em>copy</em>: the copy can be missing, stale, or wanted by too many clients at
        once.
      </p>
      <TermList
        items={[
          { term: 'hit / miss', definition: 'The key was in the cache / it was not, and the slow source had to be asked.' },
          { term: 'hit ratio', definition: 'hits ÷ (hits + misses). The single number that tells you whether the cache earns its memory.' },
          { term: 'TTL', definition: 'How long a copy may live before Redis deletes it (lesson 6). It bounds how stale a copy can get.' },
          { term: 'invalidation', definition: 'Removing or replacing a copy because the source changed.' },
          { term: 'stampede', definition: 'Many requests miss the same key at once and all rebuild it from the source.' },
        ]}
      />
      <Flow
        title="Cache-aside read: the fast path and the slow path"
        cols={4}
        rows={2}
        rowHeight={80}
        nodes={[
          { id: 'app', label: 'application', sub: 'getProduct(42)', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'redis', label: 'Redis', sub: 'product:42:v3', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'db', label: 'database', sub: 'source of truth', col: 2, row: 1, hue: 4, shape: 'store' },
          { id: 'reply', label: 'response', sub: 'to the user', col: 3, row: 0, rowSpan: 2, hue: 6 },
        ]}
        edges={[
          { from: 'app', to: 'redis', label: 'GET / SET … EX', flow: true, hue: 1 },
          { from: 'app', to: 'db', label: 'SELECT', flow: true, hue: 4 },
          { from: 'redis', to: 'reply', flow: true, hue: 6 },
        ]}
        steps={[
          { title: 'Hit: one round trip', body: <p>The key is there: <code>GET</code> returns the copy and the database is never asked. This is the path most reads should take.</p>, active: ['app', 'redis', 'reply', 'app>redis', 'redis>reply'] },
          { title: 'Miss: ask the source of truth', body: <p><code>GET</code> returned nil, so the application reads the row from the database — the slow path.</p>, active: ['app', 'redis', 'db', 'app>redis', 'app>db'] },
          { title: 'Fill the cache with a TTL', body: <p>The application stores the row with <code>SET … EX</code> (plus jitter) and answers. The next reader hits; the TTL bounds how stale the copy can get. The database never talks to Redis: the application does both.</p>, active: ['app', 'redis', 'app>redis'] },
        ]}
      />

      <h2>The five patterns</h2>
      <Table
        head={['Pattern', 'Read path', 'Write path', 'Staleness', 'If Redis is down']}
        rows={[
          ['cache-aside (lazy)', 'app reads Redis; on miss reads the DB and SETs with a TTL', 'app writes the DB, then DELetes the key', 'until the DEL or TTL', 'reads go to the DB (slower, still correct)'],
          ['read-through', 'the cache layer loads from the DB on a miss', 'as cache-aside', 'same', 'same, if the layer falls back'],
          ['write-through', 'read Redis', 'write the DB and Redis in the same request', 'small; a failed second write leaves a gap', 'writes must handle the failure'],
          ['write-behind', 'read Redis', 'write Redis; flush to the DB later in batches', 'the DB is behind', 'unflushed writes can be lost'],
          ['refresh-ahead', 'read Redis', 'a job rewrites hot keys before they expire', 'up to the refresh interval', 'reads go to the DB'],
        ]}
      />
      <Flow
        title="Who writes where: the write paths of four patterns"
        cols={4}
        rows={2}
        rowHeight={80}
        nodes={[
          { id: 'app', label: 'application', sub: 'a write request', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'redis', label: 'Redis', sub: 'the copy', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'db', label: 'database', sub: 'source of truth', col: 2, row: 1, hue: 4, shape: 'store' },
          { id: 'job', label: 'background job', sub: 'flusher / refresher', col: 3, row: 0, rowSpan: 2, hue: 1 },
        ]}
        edges={[
          { from: 'app', to: 'db', label: 'UPDATE', flow: true, hue: 4 },
          { from: 'app', to: 'redis', label: 'DEL / SET', flow: true, hue: 3 },
          { from: 'redis', to: 'job', label: 'later', hue: 1, dashed: true },
          { from: 'job', to: 'db', label: 'batch', hue: 1, dashed: true },
        ]}
        steps={[
          { title: 'Cache-aside: database first, then DEL', body: <p>The write goes to the database; the copy is deleted, and the next read reloads it. Redis down = slower, still correct.</p>, active: ['app', 'db', 'redis', 'app>db', 'app>redis'] },
          { title: 'Write-through: both in the same request', body: <p>The application writes the database and sets the new value in Redis. If the second write fails, the copy is wrong until its TTL.</p>, active: ['app', 'db', 'redis', 'app>db', 'app>redis'] },
          { title: 'Write-behind: Redis now, the database later', body: <p>The write lands in Redis only; a job flushes changes to the database in batches. Fast — and unflushed writes are lost if Redis loses them.</p>, active: ['app', 'redis', 'job', 'db', 'app>redis', 'redis>job', 'job>db'] },
          { title: 'Refresh-ahead: a job keeps hot keys warm', body: <p>A scheduler reads the database and rewrites known hot keys before they expire, so readers never miss them.</p>, active: ['job', 'db', 'redis', 'job>db'] },
        ]}
      />
      <p>
        <strong>Cache-aside</strong> is the default for a reason: Redis holds nothing that cannot be rebuilt, a Redis outage only makes things
        slower, and only data that is actually read gets cached.
      </p>
      <CodeBlock
        title="cache-aside, read and write"
        language="ts"
        code={`async function getProduct(id: string) {
  const key = \`product:\${id}:v3\`                  // v3 = version of the cached shape
  const cached = await redis.get(key)
  if (cached !== null) return JSON.parse(cached)  // hit
  const row = await db.products.find(id)          // miss: ask the source of truth
  // TTL with jitter, so keys loaded together do not expire together
  await redis.set(key, JSON.stringify(row), { EX: 3600 + randomInt(0, 300) })
  return row
}

async function renameProduct(id: string, name: string) {
  await db.products.update(id, { name })          // 1. the source of truth first
  await redis.del(\`product:\${id}:v3\`)            // 2. then drop the copy
}`}
      />

      <h2>Invalidation: delete, do not update</h2>
      <p>
        On a write, deleting the key is safer than writing the new value into it.
      </p>
      <p>
        Updating races: request A updates the DB to 1, request B
        updates it to 2, B sets the cache to 2, A (delayed) sets the cache to 1 — the cache now says 1 until the TTL, the DB says 2. With
        delete, the next reader loads whatever the DB holds.
      </p>
      <Timeline
        title="Update-on-write race (schematic): the older value is written last"
        lanes={[
          { id: 'a', label: 'request A' },
          { id: 'b', label: 'request B' },
          { id: 'db', label: 'database' },
          { id: 'cache', label: 'Redis copy' },
        ]}
        segments={[
          { lane: 'a', from: 0, to: 15, label: 'UPDATE 1', hue: 1 },
          { lane: 'a', from: 15, to: 60, label: 'delayed (GC, network)', hue: 8, striped: true },
          { lane: 'b', from: 18, to: 33, label: 'UPDATE 2', hue: 1 },
          { lane: 'b', from: 33, to: 45, label: 'SET 2', hue: 3 },
          { lane: 'db', from: 15, to: 33, label: '1', hue: 4 },
          { lane: 'db', from: 33, to: 100, label: '2', hue: 4 },
          { lane: 'cache', from: 45, to: 60, label: '2', hue: 6 },
          { lane: 'cache', from: 60, to: 100, label: '1 — stale until the TTL', hue: 8 },
        ]}
        events={[{ lane: 'a', at: 60, label: 'SET 1 arrives last', hue: 8 }]}
        end={100}
        unit="ms"
      />
      <Timeline
        title="Delete-on-write still has a smaller race (schematic): a slow reader writes the old row back"
        lanes={[
          { id: 'reader', label: 'reader' },
          { id: 'writer', label: 'writer' },
          { id: 'cache', label: 'Redis copy' },
        ]}
        segments={[
          { lane: 'reader', from: 0, to: 10, label: 'miss, reads old row', hue: 1 },
          { lane: 'reader', from: 10, to: 55, label: 'paused', hue: 8, striped: true },
          { lane: 'writer', from: 20, to: 30, label: 'UPDATE', hue: 4 },
          { lane: 'writer', from: 30, to: 38, label: 'DEL', hue: 3 },
          { lane: 'cache', from: 38, to: 55, label: 'empty', hue: 6 },
          { lane: 'cache', from: 55, to: 100, label: 'old value — heals at TTL', hue: 8 },
        ]}
        events={[
          { lane: 'reader', at: 55, label: 'SET old', hue: 8 },
          { lane: 'writer', at: 80, label: 'delayed 2nd DEL fixes it', hue: 6 },
        ]}
        end={100}
        unit="ms"
      />
      <Callout tone="warn" title="Delete is not perfectly safe either">
        A reader can miss, read the old row, be paused, and write the old value <em>after</em> the writer’s DEL. Three things shrink that window:
        a TTL (so the error heals), deleting a second time a moment later (“delayed double delete”), and versioned keys
        (<code>product:42:v3</code>, or a version number from the row) so an old value is written under a key nobody reads any more.
      </Callout>
      <Predict
        question={<p>The cache uses update-on-write: after <code>UPDATE</code> the app <code>SET</code>s the new value. Two writes to the same product run concurrently. What can happen?</p>}
        options={['Nothing: Redis is single-threaded, so the writes are ordered', 'The cache can keep the older value while the database has the newer one', 'Redis rejects the second SET']}
        answer={1}
        explanation="Redis orders the two SETs, but in the order they arrive, which need not be the order the database applied the updates. The older value can arrive last and stay until the TTL. Deleting instead of setting removes the race for writers."
      />

      <h2>Stampedes</h2>
      <p>
        A popular key expires. In the next few milliseconds, hundreds of requests miss and each one runs the expensive query. The database sees
        a spike exactly when it can least afford it. Try the strategies:
      </p>
      <CachePlayground />
      <BarChart
        title="Database queries in 12 s for one hot key — the playground's model at its default load (2,000 reads/s, TTL 5 s, 300 ms rebuild)"
        bars={STAMPEDE.map((r) => ({
          label: STRATEGY_LABEL[r.strategy],
          value: r.dbQueries,
          hue: r.strategy === 'none' ? 8 : 6,
          note: `${r.waited.toLocaleString()} requests waited for the database, ${r.servedStale.toLocaleString()} got a stale copy`,
        }))}
      />
      <Table
        head={['Strategy', 'How', 'Trade-off']}
        rows={[
          ['rebuild lock', 'the first miss takes SET lock:key token NX PX …; others wait briefly and retry the read (lesson 9)', 'waiting requests are slower; lock TTL must exceed rebuild time'],
          ['early refresh', 'refresh before expiry with a probability that grows near the TTL (XFetch)', 'a few extra rebuilds; no request waits'],
          ['serve stale', 'keep the value past its soft expiry; one request rebuilds while others get the old copy', 'clients see slightly old data for one rebuild time'],
          ['refresh-ahead job', 'a scheduler rewrites known hot keys', 'only works for keys you know are hot'],
        ]}
      />

      <h2>Penetration, avalanches, hot and big keys</h2>
      <h3>Penetration: asking for things that do not exist</h3>
      <p>
        Requests for ids that are not in the database always miss, so every one of them reaches the database — an easy way to overload it,
        by accident or on purpose. Cache the negative answer too (<code>SET product:999999 "" EX 60</code>, a short TTL), and reject impossible
        ids early.
      </p>
      <p>
        A Bloom filter of existing ids answers “definitely not” cheaply. Since Redis 8 the official builds (packages and container
        images) include the probabilistic types (<code>BF.ADD</code>, <code>BF.EXISTS</code> …); the build used for these recordings was compiled
        without them, so check <code>MODULE LIST</code> on yours — otherwise a bitmap-based filter you write, or one on the client side, does the job.
      </p>
      <h3>Avalanche: many keys expiring together</h3>
      <p>
        Keys loaded together — after a deploy, a restart or a bulk import — with the same TTL expire together, and the stampede happens on
        thousands of keys at once. Add random jitter to every TTL (the <code>randomInt(0, 300)</code> above) and warm the cache gradually.
      </p>
      <h3>Hot keys</h3>
      <p>
        One key read tens of thousands of times a second lands on one Redis thread (and in a cluster, one shard). Options: a short-lived copy in
        the application’s memory (seconds), reading from replicas, or splitting the key into N copies (<code>config:flags:0…7</code>) and picking
        one at random.
      </p>
      <p>
        To find hot keys: since Redis 8.6 the server tracks them itself with <code>HOTKEYS START</code> / <code>HOTKEYS GET</code> /{' '}
        <code>HOTKEYS STOP</code> (by CPU time and network bytes, no special policy needed — the recorded <code>INFO</code> even has a Hotkeys
        section); on older versions <code>redis-cli --hotkeys</code> works when an LFU eviction policy is set.
      </p>
      <h3>Big keys</h3>
      <p>
        A cached value of megabytes costs network time on every read and blocks the thread while it is written, deleted or evicted. Cache the
        part the page needs, split collections into pages, and find offenders with <code>redis-cli --bigkeys</code> (lesson 16).
      </p>

      <h2>Is it working? Measure the hit ratio</h2>
      <p>Redis counts hits and misses for every read of a key. From the recorded server in lesson 16:</p>
      <Proportion
        title="Reads of a key on the recorded server: hits and misses"
        parts={[
          { label: 'keyspace_hits', value: hits, hue: 6 },
          { label: 'keyspace_misses', value: misses, hue: 8 },
        ]}
      />
      <CodeBlock title="INFO stats (excerpt)" language="text" code={CAPTURE.operations.infoStats.split('\n').filter((l) => /keyspace_|evicted|expired/.test(l)).join('\n')} />
      <p>
        Hit ratio = {hits.toLocaleString()} ÷ ({hits.toLocaleString()} + {misses.toLocaleString()}) ={' '}
        <strong>{((hits / (hits + misses)) * 100).toFixed(1)}%</strong>. These counters are server-wide; for one kind of data, count hits and
        misses in your own code with a label per cache. A falling hit ratio together with rising <code>evicted_keys</code> means the cache is
        too small for its working set.
      </p>
      <Callout tone="note" title="Client-side caching">
        With <code>CLIENT TRACKING ON</code>, Redis remembers which keys a connection read and sends it an invalidation message when one of them
        changes. Client libraries use this to keep a small in-process cache that is invalidated by the server, which helps a lot with hot keys.
      </Callout>

      <h2>What to cache, and how</h2>
      <ul>
        <li>Cache results that are read far more than written and are expensive to compute: rendered fragments, aggregates, lookups across services.</li>
        <li>Store the shape the reader needs: a hash when fields are read separately, a serialized string when the whole object is read at once. Version the key when the shape changes.</li>
        <li>Prefer compact serialization; every byte is RAM (lesson 3 shows how much small objects cost).</li>
        <li>Never make correctness depend on the cache: the source of truth must be able to answer alone.</li>
      </ul>
      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Default to cache-aside with delete-on-write and a TTL on every key.</li>
          <li>Add jitter to TTLs; cache negative results with a short TTL.</li>
          <li>Protect hot, expensive keys from stampedes with a lock, early refresh or stale serving.</li>
          <li>Set <code>maxmemory</code> and an <code>allkeys-*</code> eviction policy for a pure cache (lesson 7).</li>
          <li>Watch hit ratio, evictions and the latency of the slow path; plan for Redis being down.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'Cache-aside keeps Redis disposable: on a miss load and SET with a TTL; on a write update the source, then DEL the key.',
          'Deleting beats updating on write; TTLs, a second delete and versioned keys shrink the remaining race.',
          'Stampedes need coordination (lock, early refresh, stale serving); avalanches need TTL jitter; penetration needs negative caching.',
          'Hot keys need local copies, replicas or splitting; big keys need splitting; the hit ratio tells you whether any of it pays off.',
        ]}
      />
    </>
  )
}
