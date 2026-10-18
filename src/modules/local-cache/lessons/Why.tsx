import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { WhyDecision } from '../components/WhyDecision'
import { WhyLatencyCalculator } from '../components/WhyLatencyCalculator'
import { WhyLineChart } from '../components/WhyLineChart'
import { BASICS } from '../data/basics'
import { heapCode, LANG_INFO, LANGS, type Lang } from '../data/basicsSources'
import { formatNs } from '../simulation/whyLatency'

const V = BASICS.versions
const WHY = BASICS.why
const heapOf = (lang: Lang, kind: 'map' | 'cache') => WHY[lang].heap.filter((h) => h.kind === kind)
const last = <T,>(xs: readonly T[]) => xs[xs.length - 1]
const mapMb = (lang: Lang) => last(heapOf(lang, 'map')).mb
const cacheMb = (lang: Lang) => last(heapOf(lang, 'cache')).mb
const lat = (lang: Lang) => WHY[lang].latency
const NAMES: Record<Lang, { map: string; cache: string; get: string }> = {
  java: { map: 'HashMap', cache: 'Caffeine', get: 'getIfPresent' },
  ts: { map: 'Map', cache: 'LRUCache', get: 'get' },
  rust: { map: 'HashMap', cache: 'moka', get: 'get' },
}
const ratio = (lang: Lang) => Math.round(lat(lang)['redis-get'].ns / lat(lang)['cache-get'].ns)
const bytesPerEntry = (lang: Lang) => Math.round((cacheMb(lang) * 1048576) / last(heapOf(lang, 'cache')).size)
const total = last(heapOf('java', 'map')).inserted

function HeapView({ lang }: { lang: Lang }) {
  const n = NAMES[lang]
  return (
    <>
      <WhyLineChart
        title={`${LANG_INFO[lang].label}: heap after inserting distinct keys (recorded)`}
        xLabel="keys inserted"
        yLabel="MB"
        formatX={(x) => (x ? `${x / 1000}k` : '0')}
        formatY={(y) => `${y} MB`}
        series={[
          { label: `unbounded ${n.map}`, hue: 8, points: heapOf(lang, 'map').map((h) => [h.inserted, h.mb] as const) },
          { label: `${n.cache}, max 10,000`, hue: 6, points: heapOf(lang, 'cache').map((h) => [h.inserted, h.mb] as const) },
        ]}
        caption={lang === 'rust' ? 'Live bytes counted by a global allocator wrapper: Rust has no garbage collector, so this is exactly what is allocated.' : 'Heap in use after forcing a full garbage collection at each point.'}
      />
      <CodeBlock title={`${lang === 'java' ? 'Why.java' : lang === 'ts' ? 'why.ts' : 'why.rs'} — the loop that ran`} language={LANG_INFO[lang].language} code={heapCode[lang]} />
    </>
  )
}

function LatencyView({ lang }: { lang: Lang }) {
  const l = lat(lang)
  const n = NAMES[lang]
  const rows = [
    { label: `${n.cache} ${n.get} (hit)`, value: l['cache-get'].ns, hue: 6 as const },
    { label: `${n.map} lookup`, value: l['map-get'].ns, hue: 3 as const },
    { label: 'build the value again', value: l.compute.ns, hue: 5 as const },
    { label: 'Redis GET, localhost', value: l['redis-get'].ns, hue: 2 as const },
  ]
  return (
    <>
      <BarChart title={`${LANG_INFO[lang].label}: one read, median (recorded)`} bars={rows.map((r) => ({ ...r, display: formatNs(r.value) }))} />
      <StatTiles
        stats={[
          { label: 'cache hit', value: formatNs(l['cache-get'].ns), sub: 'no network, no copy to deserialise', hue: 6 },
          { label: 'Redis GET', value: formatNs(l['redis-get'].ns), sub: `p99 ${formatNs(l['redis-get'].p99 ?? 0)} — same machine, no real network`, hue: 2 },
          { label: 'Redis ÷ cache', value: `${ratio(lang).toLocaleString()}×`, sub: 'how many cache hits fit in one round trip', hue: 1 },
        ]}
      />
    </>
  )
}

export default function Why() {
  return (
    <>
      <LessonGoals
        goals={[
          'say what makes a cache more than a map: a bound, expiry, an eviction policy, loading and statistics',
          'explain, with recorded numbers, why a plain HashMap or Map used as a cache is a memory leak',
          'place an in-process cache next to Redis and a CDN, and compare latency, consistency, sharing, capacity and failure',
          'decide what belongs in a local cache — and what never does',
          'tell Caffeine, lru-cache and moka apart at a glance',
        ]}
        before={<>what a hash map is; ideally Redis <a href="#/redis/caching">Caching patterns</a> (cache-aside, TTL)</>}
      />

      <h2>A map with rules</h2>
      <p>
        An in-process cache is a key–value map that lives inside your application’s memory, plus rules that decide what stays in it. The map
        part gives the speed: a read is a hash lookup in the same process, with no network and no serialisation. The rules make it safe to keep
        running for months.
      </p>
      <Flow
        title="One cache, its rules at work"
        cols={4}
        rows={2}
        nodes={[
          { id: 'app', label: 'your code', sub: 'get("p42")', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'cache', label: 'cache', sub: 'map + rules, in heap', col: 1, row: 0, span: 2, hue: 3, shape: 'store' },
          { id: 'src', label: 'source', sub: 'database, service', col: 3, row: 0, hue: 5, shape: 'store' },
          { id: 'out', label: 'removed', sub: 'evicted or expired', col: 1, row: 1, hue: 8, shape: 'queue' },
          { id: 'stats', label: 'stats', sub: 'hits, misses, loads', col: 2, row: 1, hue: 7 },
        ]}
        edges={[
          { from: 'app', to: 'cache', hue: 1, flow: true, both: true },
          { from: 'cache', to: 'src', label: 'load', hue: 5, both: true },
          { from: 'cache', to: 'out', label: 'evict', hue: 8, dashed: true },
          { from: 'cache', to: 'stats', hue: 7, dashed: true },
        ]}
        steps={[
          { title: 'Hit', body: <p>The key is present and not expired: the value comes straight from memory. The policy notes that the key was used; the hit counter goes up.</p>, active: ['app', 'cache', 'stats', 'app>cache', 'cache>stats'] },
          { title: 'Miss: load', body: <p>The key is absent. The cache runs your loader once, stores the result and returns it. Other callers asking for the same key at that moment wait for that one load.</p>, active: ['app', 'cache', 'src', 'app>cache', 'cache>src'] },
          { title: 'Full: evict', body: <p>A new entry would exceed the bound. The eviction policy picks a victim (least recently used, least frequently used, or a mix) and removes it.</p>, active: ['cache', 'out', 'cache>out'] },
          { title: 'Too old: expire', body: <p>An entry older than its time to live is treated as absent and removed — the next read is a miss and loads a fresh value.</p>, active: ['cache', 'out', 'src', 'cache>out', 'cache>src'] },
        ]}
        caption="The five rules: a bound, expiry, an eviction policy, loading, and statistics. A plain map has none of them."
      />
      <Table
        head={['Rule', 'What it answers', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['bound', 'how big may it get?', 'maximumSize, maximumWeight', 'max, maxSize', 'max_capacity (+ weigher)'],
          ['expiry', 'how old may a value be?', 'expireAfterWrite / Access, expireAfter', 'ttl', 'time_to_live / idle, expire_after'],
          ['eviction policy', 'who leaves when it is full?', 'Window TinyLFU', 'least recently used', 'TinyLFU admission + LRU'],
          ['loading', 'what happens on a miss?', 'get(key, loader), LoadingCache', 'fetch() / memo()', 'get_with(key, init)'],
          ['statistics', 'is it working?', 'recordStats() → stats()', 'none built in (status per call)', 'none built in'],
        ]}
      />
      <TermList
        items={[
          { term: 'in-process (local) cache', definition: 'A cache in the application’s own heap. Each running instance has its own, private copy.' },
          { term: 'hit / miss', definition: 'A read the cache could answer / a read it could not, which goes to the source.' },
          { term: 'hit ratio', definition: 'hits ÷ all reads. The single number that says whether a cache pays off.' },
          { term: 'bound', definition: 'The maximum number of entries (or total weight) the cache may hold.' },
          { term: 'eviction', definition: 'Removing an entry to stay within the bound, chosen by the eviction policy.' },
          { term: 'expiry / TTL', definition: 'Removing an entry because it is too old, whatever the size.' },
          { term: 'loader', definition: 'The function the cache calls to fetch a missing value; at most one runs per key at a time.' },
        ]}
      />

      <h2>Why a HashMap is not a cache</h2>
      <p>A map used as a cache only ever grows, because nothing ever takes entries out.</p>
      <Predict
        question={<p>A service keeps user profiles in a plain map, keyed by user id, and never removes them. Over a month, {total.toLocaleString()} different users visit once each. What happens to the memory the map uses?</p>}
        options={['It levels off: the garbage collector frees entries nobody reads', 'It grows with every new user, until the process runs out of memory', 'It stays small: maps resize down when they are mostly unused']}
        answer={1}
        explanation={<>Every entry is still reachable from the map, so the garbage collector must keep it. Recorded below: {mapMb('java')} MB in Java, {mapMb('ts')} MB in Node and {mapMb('rust')} MB in Rust after {total.toLocaleString()} keys — and still climbing. The bounded caches stayed flat at a few MB.</>}
      />
      <p>
        Each program inserted {total.toLocaleString()} distinct keys (<code>user:1</code>, <code>user:2</code>, …) with an 80-byte JSON value,
        once into a plain map and once into a cache bounded at 10,000 entries, and measured the memory every 100,000 keys.
      </p>
      <Tabs items={LANGS.map((lang) => ({ label: LANG_INFO[lang].label, content: <HeapView lang={lang} /> }))} />
      <BarChart
        title={`Memory after ${total.toLocaleString()} distinct keys (recorded)`}
        unit=" MB"
        bars={LANGS.flatMap((lang) => [
          { label: `${LANG_INFO[lang].library === 'lru-cache' ? 'Node' : lang === 'java' ? 'Java' : 'Rust'}: unbounded ${NAMES[lang].map}`, value: mapMb(lang), display: `${mapMb(lang)} MB`, hue: 8 as const },
          { label: `${LANG_INFO[lang].library === 'lru-cache' ? 'Node' : lang === 'java' ? 'Java' : 'Rust'}: ${NAMES[lang].cache}, max 10,000`, value: cacheMb(lang), display: `${cacheMb(lang)} MB`, hue: 6 as const },
        ])}
      />
      <Callout tone="warn" title="The classic leak">
        <p>
          A <code>static Map</code> “cache” is one of the most common memory leaks in long-running services. It works in tests, works for a week,
          and then the heap fills, the garbage collector runs back to back, and the process dies. The fix is not a bigger heap; it is a bound.
        </p>
      </Callout>
      <Callout tone="analogy" title="A fridge, not a warehouse">
        <p>
          A cache is a small fridge next to the stove: it holds what you are about to use, and when it is full something old comes out. A map
          you never empty is a warehouse that keeps getting extended into the kitchen.
        </p>
      </Callout>

      <h2>Where it sits</h2>
      <p>A local cache is the cache closest to your code: inside the process, one per running instance.</p>
      <Flow
        title="The caches on a read’s path"
        cols={5}
        rows={3}
        rowHeight={80}
        nodes={[
          { id: 'browser', label: 'browser', sub: 'HTTP cache', col: 0, row: 1, hue: 1, shape: 'actor' },
          { id: 'cdn', label: 'CDN', sub: 'whole responses', col: 1, row: 1, hue: 7 },
          { id: 'a', label: 'instance A', sub: 'local cache', col: 2, row: 0, hue: 3 },
          { id: 'b', label: 'instance B', sub: 'local cache', col: 2, row: 1, hue: 3 },
          { id: 'c', label: 'instance C', sub: 'local cache', col: 2, row: 2, hue: 3 },
          { id: 'redis', label: 'Redis', sub: 'shared cache', col: 3, row: 1, hue: 2, shape: 'store' },
          { id: 'db', label: 'database', sub: 'source of truth', col: 4, row: 1, hue: 5, shape: 'store' },
        ]}
        edges={[
          { from: 'browser', to: 'cdn', hue: 1, flow: true },
          { from: 'cdn', to: 'a', hue: 7 },
          { from: 'cdn', to: 'b', hue: 7, flow: true },
          { from: 'cdn', to: 'c', hue: 7 },
          { from: 'a', to: 'redis', hue: 2, dashed: true },
          { from: 'b', to: 'redis', hue: 2, flow: true },
          { from: 'c', to: 'redis', hue: 2, dashed: true },
          { from: 'redis', to: 'db', hue: 5 },
        ]}
        caption="Schematic. Browser and CDN caches hold whole HTTP responses; the local cache holds objects inside each instance; Redis is one copy shared by all instances."
      />
      <p>What one read costs at each level, recorded on one machine (Redis on localhost, so the “network” is the loopback interface):</p>
      <Tabs items={LANGS.map((lang) => ({ label: LANG_INFO[lang].label, content: <LatencyView lang={lang} /> }))} />
      <Table
        head={['', 'Local cache', 'Redis', 'CDN / browser']}
        rows={[
          ['read latency', `${formatNs(lat('java')['cache-get'].ns)} (Caffeine, recorded)`, `${formatNs(lat('java')['redis-get'].ns)} on localhost (recorded); add a network round trip in production`, 'not recorded: ms, but it saves the whole request'],
          ['what it holds', 'objects, ready to use', 'bytes; you serialise and parse', 'whole HTTP responses'],
          ['sharing', 'one copy per instance', 'one copy for all instances', 'per edge location / per browser'],
          ['consistency', 'each copy goes stale on its own; you must reach every instance to invalidate', 'one copy: one DEL invalidates', 'purge APIs, or wait for max-age'],
          ['capacity', 'part of each instance’s heap: MB to a few GB', 'its own memory: GB, can be clustered', 'large, managed by the provider'],
          ['on failure / restart', 'empty: refills from below (cold start)', 'clients fall back to the database', 'requests go to the origin'],
        ]}
      />
      <Callout tone="note" title="Read the numbers for what they are">
        <p>
          One laptop ({V.cpu}), single-threaded loops, medians of {BASICS.runs} runs, each the median of many batches after a warm-up (JIT
          compiled in Java). The ratio is what transfers: a cache hit is two to three orders of magnitude cheaper than any network round trip, and a
          real network makes the gap bigger. Rebuilding this small value is as cheap as a cache hit — caching it would gain nothing.
        </p>
      </Callout>

      <h2>Try it: what a hit ratio buys</h2>
      <p>Average read time depends almost entirely on the misses, so the hit ratio decides everything.</p>
      <WhyLatencyCalculator
        recorded={Object.fromEntries(LANGS.map((lang) => [lang, { label: LANG_INFO[lang].label, cacheNs: lat(lang)['cache-get'].ns, redisNs: lat(lang)['redis-get'].ns }]))}
      />
      <p>
        At 90 % hits, one read in ten still pays the full miss, and the misses are almost all of the time spent. Going from 90 % to 99 % hits cuts
        the average roughly tenfold; going from 0 % to 50 % only halves it.
      </p>

      <h2>What it costs, what it wins</h2>
      <p>A local cache trades memory and freshness for speed and fewer calls to the source.</p>
      <StatTiles
        title="Recorded: what 10,000 small entries cost in memory"
        stats={LANGS.map((lang) => ({
          label: LANG_INFO[lang].label,
          value: `${cacheMb(lang)} MB`,
          sub: `≈ ${bytesPerEntry(lang)} bytes per entry (key, value and the cache’s own bookkeeping)`,
          hue: 3,
        }))}
      />
      <p>
        Multiply by the number of instances: 20 instances each caching the same 10,000 entries in Java hold{' '}
        {(cacheMb('java') * 20).toFixed(0)} MB between them — twenty copies of the same data.
      </p>
      <Timeline
        title="Schematic: one write, two instances, a 10 s TTL"
        lanes={[
          { id: 'db', label: 'database' },
          { id: 'a', label: 'instance A' },
          { id: 'b', label: 'instance B' },
        ]}
        start={0}
        end={14}
        unit="s"
        segments={[
          { lane: 'db', from: 0, to: 3, label: 'price 19.99', hue: 5 },
          { lane: 'db', from: 3, to: 14, label: 'price 17.99', hue: 5 },
          { lane: 'a', from: 0, to: 3, label: 'cached 19.99', hue: 3 },
          { lane: 'a', from: 3, to: 14, label: 'reloaded 17.99', hue: 6 },
          { lane: 'b', from: 0, to: 3, label: 'cached 19.99', hue: 3 },
          { lane: 'b', from: 3, to: 10, label: 'still 19.99 — stale', hue: 8, striped: true },
          { lane: 'b', from: 10, to: 14, label: '17.99', hue: 6 },
        ]}
        events={[
          { lane: 'db', at: 3, label: 'write', hue: 1 },
          { lane: 'a', at: 3, label: 'A invalidates its own copy', hue: 1 },
          { lane: 'b', at: 10, label: 'TTL expires', hue: 4 },
        ]}
      />
      <Table
        head={['Cost', 'Why', 'What limits it']}
        rows={[
          ['heap', 'entries live in the process; a big cache means more garbage-collection work (Java, Node)', 'a size or weight bound; see Memory, weight and GC'],
          ['staleness', 'a copy does not know the source changed', 'a short TTL, invalidation messages, or not caching that data'],
          ['per-instance duplication', 'N instances hold N copies and do N loads per key', 'a shared cache behind it (Redis)'],
          ['cold start', 'a new or restarted instance starts empty: every first read misses', 'a shared cache behind it, gradual rollouts, optional warm-up'],
        ]}
      />
      <ul>
        <li><strong>Win — latency:</strong> nanoseconds instead of a round trip; no serialisation, the object is ready to use.</li>
        <li><strong>Win — load on the source:</strong> each hit is a query or call that did not happen.</li>
        <li><strong>Win — hot keys:</strong> a key read 50,000 times a second is served from every instance’s memory instead of hammering one Redis shard.</li>
        <li><strong>Win — resilience:</strong> hot data stays readable for a while if the source is briefly slow or down.</li>
      </ul>

      <h2>What to cache, and what not to</h2>
      <p>Cache what is read often, costly to get and fine to be a little old.</p>
      <Table
        head={['Good fit', 'Poor fit']}
        rows={[
          ['product details, prices shown in lists', 'balances, stock you sell from'],
          ['configuration, feature flags, reference data (countries, currencies)', 'permissions checked for security, one-time tokens'],
          ['results of expensive computations or remote calls', 'values that are cheaper to compute than to look up'],
          ['a hot set that fits in a few MB to a few hundred MB', 'millions of large values, or data read once'],
          ['parsed templates, compiled patterns, metadata', 'per-request data that is never reused'],
        ]}
      />
      <WhyDecision />

      <h2>The three libraries at a glance</h2>
      <p>All three are bounded, thread-safe (or single-threaded by nature) maps with expiry, loaders and removal listeners; they differ in policy and concurrency.</p>
      <Table
        head={['', `Caffeine ${V.caffeine} (Java)`, `lru-cache ${V.lruCache} (Node.js)`, `moka ${V.moka} (Rust)`]}
        rows={[
          ['origin', 'Ben Manes, since 2014; Java 11+ (3.x)', 'Isaac Z. Schlueter (author of npm)', 'the moka-rs project; “inspired by Java Caffeine”'],
          ['policy', 'Window TinyLFU: an LRU window, a segmented-LRU main space and a frequency sketch; window size adapts (hill climbing)', 'least recently used', 'TinyLFU: frequency decides admission, LRU decides eviction (EvictionPolicy::lru() optional)'],
          ['bound required?', 'no — without maximumSize it is an unbounded map', 'yes — at least one of max, maxSize, ttl, or it throws', 'no — without max_capacity it is unbounded'],
          ['concurrency', 'ConcurrentHashMap; reads and writes logged to buffers and applied to the policy in batches under a lock, on an executor (ForkJoinPool.commonPool by default)', 'none needed: one JavaScript thread; storage pre-allocated for max entries', 'lock-free concurrent hash table; reads and writes queued and applied in batches; no background threads since 0.12 — callers do the maintenance'],
          ['async', 'AsyncCache, AsyncLoadingCache (CompletableFuture)', 'fetch() with a fetchMethod (Promise)', 'moka::future::Cache (async/await)'],
          ['expiry', 'eager, during maintenance (timer wheel for per-entry)', 'lazy: a stale entry is removed when touched, unless ttlAutopurge', 'during maintenance (timer wheel for per-entry)'],
          ['statistics', 'recordStats(), off by default', 'none; a status object per call', 'none (on the roadmap)'],
        ]}
      />
      <p>
        Checked against the downloaded sources and docs (Caffeine’s BoundedLocalCache and Caffeine.java, lru-cache’s index.d.ts and README,
        moka’s README and builders). Lessons <a href="#/local-cache/eviction">Eviction</a> and <a href="#/local-cache/loading">Loading</a> go inside
        the policies and the concurrency; <a href="#/local-cache/using">Using it day to day</a> shows the API side by side.
      </p>

      <h2>Design rules</h2>
      <p>The rules that keep a local cache an asset rather than a leak.</p>
      <ul>
        <li>Never use a plain map as a cache. Always set a bound (entries or weight) and an expiry.</li>
        <li>Choose the TTL as “how stale may this be?”, not “how long can I keep it?”.</li>
        <li>Cache what is read often, slower to get than a lookup, and allowed to be a little old; keep balances and permissions out.</li>
        <li>Budget memory per instance and multiply by the number of instances.</li>
        <li>Load through the cache (<code>get(key, loader)</code>) so a miss is loaded once, not once per caller.</li>
        <li>Measure the hit ratio; a cache under about 50 % hits is mostly overhead.</li>
        <li>Many instances, or expensive cold starts? Put Redis behind it — see <a href="#/redis/tiered-caching">Multi-level caching</a>.</li>
      </ul>

      <Recap
        points={[
          'An in-process cache is a map in your heap plus rules: a bound, expiry, an eviction policy, loading and statistics.',
          `A plain map used as a cache grows with every new key (recorded: ${mapMb('java')} MB in Java after ${total.toLocaleString()} keys); a bounded cache stays flat (${cacheMb('java')} MB).`,
          `A local hit took ${formatNs(lat('java')['cache-get'].ns)} in Caffeine against ${formatNs(lat('java')['redis-get'].ns)} for a Redis GET on the same machine — roughly ${ratio('java').toLocaleString()}× apart.`,
          'Each instance has its own copy: it costs heap on every instance, goes stale independently and starts empty.',
          'Caffeine (Window TinyLFU), lru-cache (LRU) and moka (TinyLFU + LRU) share the same ideas and differ in policy, concurrency and statistics.',
        ]}
      />
    </>
  )
}
