import { Flow, Proportion, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { parseRemovals } from '../components/UsingCauses'
import { UsingPlayground } from '../components/UsingPlayground'
import { UsingRemovalStrip } from '../components/UsingRemovalStrip'
import { UsingTask } from '../components/UsingTask'
import { BASICS } from '../data/basics'
import { LANG_INFO, LANGS, micronaut, setup } from '../data/basicsSources'

const V = BASICS.versions
const U = BASICS.using
const num = (line: string, pattern: RegExp) => Number(line.match(pattern)?.[1] ?? NaN)

// moka: entry_count before and after maintenance (recorded)
const mokaBefore = num(U.rust.iterate[0], /= (\d+)/)
const mokaAfter = num(U.rust.iterate[1], /= (\d+)/)
// stats, recorded in Java
const javaStats = U.java.stats[0]
const hits = num(javaStats, /hitCount = (\d+)/)
const misses = num(javaStats, /missCount = (\d+)/)
// Micronaut: the recorded run
const MN = BASICS.micronaut
const finds = MN.filter((l) => l.includes('find(')).length
const methodRuns = num(MN.filter((l) => l.includes('method ran')).at(-1)!, /ran (\d+) time/)
const mnHits = num(MN.at(-1)!, /hitCount = (\d+)/)
const mnMisses = num(MN.at(-1)!, /missCount = (\d+)/)

/** The key each library removed for SIZE in the recorded removal run. */
const sizeVictim = (lang: 'java' | 'ts' | 'rust') => parseRemovals(U[lang].removal).find((r) => r.cause === 'SIZE')?.key ?? '?'

const REMOVAL_OPS = ['put a=v1', 'put a=v2', 'put b=v1', 'invalidate b', 'put c=v1', 'put d=v1', 'clock +2 min (Rust: sleep 300 ms)', 'clean up']

export default function Using() {
  return (
    <>
      <LessonGoals
        goals={[
          'build a bounded cache with a TTL in Caffeine, lru-cache and moka',
          'read, write, load through, invalidate, bulk-read and iterate — and know where the three APIs differ',
          'use a loading cache and an async cache so a miss is loaded once',
          'listen to removals and tell SIZE, EXPIRED, EXPLICIT and REPLACED apart',
          'cache a Micronaut service method with @Cacheable and invalidate it correctly',
        ]}
        before={<><a href="#/local-cache/why">What an in-process cache is</a>; basic Java, TypeScript or Rust</>}
      />
      <p>
        Every snippet below is an excerpt of a program that ran — Caffeine {V.caffeine} on Java {V.java}, lru-cache {V.lruCache} on Node{' '}
        {V.node}, moka {V.moka} on Rust {V.rust} — and every output block is what it printed. Pick your language in any tab.
      </p>

      <h2>Add the library</h2>
      <p>Each library is one dependency with no required configuration.</p>
      <Tabs
        items={LANGS.map((lang) => ({
          label: LANG_INFO[lang].label,
          content: <CodeBlock title={setup[lang].title} language={setup[lang].language} code={setup[lang].code} />,
        }))}
      />
      <p>
        lettuce, ioredis and redis only serve the latency measurement of the previous lesson. moka needs the <code>sync</code> and/or{' '}
        <code>future</code> feature for its caches; tokio is only there for the async example.
      </p>

      <h2>Build a cache</h2>
      <p>You choose the bound and the expiry when you build the cache; they cannot be forgotten later.</p>
      <UsingTask task="build" />
      <Table
        head={['', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['entry point', 'Caffeine.newBuilder()…build()', 'new LRUCache({ … })', 'Cache::builder()…build()'],
          ['size bound', 'maximumSize(n)', 'max: n', 'max_capacity(n)'],
          ['time to live', 'expireAfterWrite(Duration)', 'ttl: milliseconds', 'time_to_live(Duration)'],
          ['no bound given', 'an unbounded map', 'throws: max, maxSize or ttl required', 'an unbounded map'],
        ]}
      />
      <Callout tone="warn" title="Unbounded by default">
        <p>
          Caffeine and moka happily build a cache with no size limit — which is the HashMap leak from the previous lesson with extra steps. Always
          set a bound. lru-cache refuses to build without one.
        </p>
      </Callout>

      <h2>Read and write</h2>
      <p>A read either returns the value or says “not here”; a write stores a value under a key.</p>
      <UsingTask task="get-put" />
      <Table
        head={['', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['read', 'getIfPresent(k) → V or null', 'get(k) → V or undefined', 'get(&k) → Option<V> (a clone)'],
          ['write', 'put(k, v)', 'set(k, v)', 'insert(k, v)'],
          ['present?', 'asMap().containsKey(k)', 'has(k)', 'contains_key(&k)'],
        ]}
      />
      <Callout tone="tip" title="moka clones on read">
        <p>
          moka’s <code>get</code> returns a clone of the value. Store large values as <code>Arc&lt;T&gt;</code> so a clone is a reference-count
          increment, not a copy.
        </p>
      </Callout>

      <h2>Get with a loader</h2>
      <p>Most code should not call get and put itself: it should ask the cache for a key and say how to load it.</p>
      <Flow
        title="get(key, loader): computeIfAbsent semantics"
        cols={4}
        rows={2}
        nodes={[
          { id: 'a', label: 'caller A', sub: 'get("p7", load)', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'b', label: 'caller B', sub: 'get("p7", load)', col: 0, row: 1, hue: 2, shape: 'actor' },
          { id: 'cache', label: 'cache', sub: 'key p7', col: 1, row: 0, span: 2, rowSpan: 2, hue: 3, shape: 'store' },
          { id: 'src', label: 'loader', sub: 'database', col: 3, row: 0, rowSpan: 2, hue: 5, shape: 'store' },
        ]}
        edges={[
          { from: 'a', to: 'cache', hue: 1, flow: true },
          { from: 'b', to: 'cache', hue: 2, dashed: true },
          { from: 'cache', to: 'src', label: 'once', hue: 5, both: true },
        ]}
        steps={[
          { title: 'Miss: A loads', body: <p>p7 is absent. The cache runs A’s loader and holds the key while it runs.</p>, active: ['a', 'cache', 'src', 'a>cache', 'cache>src'] },
          { title: 'B asks meanwhile', body: <p>B asks for p7 before the load finishes. B does not run its own loader: it waits for A’s result (in Caffeine and moka; in Node nothing else runs during a synchronous load anyway).</p>, active: ['a', 'b', 'cache', 'src', 'a>cache', 'b>cache', 'cache>src'] },
          { title: 'Both get the value', body: <p>The value is stored once and returned to both. The loader ran once.</p>, active: ['a', 'b', 'cache', 'a>cache', 'b>cache'] },
        ]}
        caption="Caffeine’s get(key, loader) is atomic per key, like ConcurrentHashMap.computeIfAbsent; moka’s get_with is the same. lru-cache has no such call on a plain cache: check, load, set."
      />
      <UsingTask task="loader" />
      <Predict
        question={<p>Two threads both call <code>getIfPresent("p7")</code>, both see <code>null</code>, both load from the database and both <code>put</code>. How many database queries ran, and what changes with <code>get("p7", loader)</code>?</p>}
        options={['One — the cache deduplicates the puts', 'Two; with get(key, loader) only one, the other thread waits', 'Two either way: the cache cannot know they want the same thing']}
        answer={1}
        explanation={<>Check-then-act is a race: nothing stops both threads loading. <code>get(key, loader)</code> makes “look up, and load if absent” one atomic step per key, recorded above as “loader ran 1 time(s)” for two calls. The <a href="#/local-cache/loading">Loading</a> lesson measures it under real contention.</>}
      />
      <Callout tone="warn" title="Keep the loader simple">
        <p>
          While Caffeine runs a loader, other writes to nearby keys may wait, and the loader <strong>must not</strong> update other entries of the same
          cache (from Caffeine’s documentation of <code>get</code>). Load the value, return it, nothing else.
        </p>
      </Callout>

      <h2>Invalidate one key or everything</h2>
      <p>Invalidating removes an entry now, typically because the source changed.</p>
      <UsingTask task="invalidate" />
      <p>
        Names differ — <code>invalidate</code> / <code>invalidateAll</code> (Caffeine), <code>delete</code> / <code>clear</code> (lru-cache),{' '}
        <code>invalidate</code> / <code>invalidate_all</code> (moka) — but they all report the removal as EXPLICIT to a listener. moka’s counts are
        updated by maintenance, hence the <code>run_pending_tasks()</code> before reading <code>entry_count()</code>.
      </p>

      <h2>Read many keys at once</h2>
      <p>A bulk read returns what is cached and loads the rest — in Caffeine with one call to the source for all the misses.</p>
      <UsingTask task="bulk" />
      <Table
        head={['', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['what is cached', 'getAllPresent(keys)', 'loop over get(k)', 'loop over get(&k)'],
          ['load the misses', 'getAll(keys, missing → map): one batch call', 'your own batch load, then set', 'loop over get_with'],
        ]}
      />

      <h2>Size and iteration</h2>
      <p>Sizes are approximate while maintenance is pending, and iteration order is not recency order — except in lru-cache.</p>
      <UsingTask task="iterate" />
      <StatTiles
        title="Recorded: moka’s entry_count() right after four inserts"
        stats={[
          { label: 'before run_pending_tasks()', value: mokaBefore, sub: 'inserts still queued for maintenance', hue: 8 },
          { label: 'after run_pending_tasks()', value: mokaAfter, sub: 'the real number of entries', hue: 6 },
        ]}
      />
      <ul>
        <li><strong>Caffeine:</strong> <code>estimatedSize()</code>; <code>asMap()</code> iterates in no defined order. <code>policy().eviction().hottest(n)</code> lists entries the policy is most likely to keep — by frequency and recency, so not simply the last ones written.</li>
        <li><strong>lru-cache:</strong> <code>size</code> is exact; <code>entries()</code> and <code>keys()</code> go from most to least recently used (p1 came first after it was read).</li>
        <li><strong>moka:</strong> <code>entry_count()</code> lags until maintenance runs; <code>iter()</code> has no defined order.</li>
      </ul>

      <h2>A loading cache</h2>
      <p>A loading cache is given its loader once, at build time, so every read is a get-with-loader.</p>
      <UsingTask task="loading" />
      <p>
        Caffeine has a type for it (<code>LoadingCache</code>, built with <code>build(loader)</code>), lru-cache has <code>memoMethod</code> with{' '}
        <code>memo(key)</code>, and moka has none — a small function around <code>get_with</code> does the job.
      </p>

      <h2>An async cache</h2>
      <p>An async cache stores the pending result (a future or promise), so concurrent callers share one in-flight load without blocking a thread.</p>
      <Flow
        title="Three concurrent reads of a cold key, one load"
        cols={3}
        rows={3}
        rowHeight={66}
        nodes={[
          { id: 'c1', label: 'caller 1', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'c2', label: 'caller 2', col: 0, row: 1, hue: 2, shape: 'actor' },
          { id: 'c3', label: 'caller 3', col: 0, row: 2, hue: 2, shape: 'actor' },
          { id: 'f', label: 'pending p5', sub: 'one future / promise', col: 1, row: 1, hue: 3, shape: 'queue' },
          { id: 'src', label: 'slow source', sub: '20 ms', col: 2, row: 1, hue: 5, shape: 'store' },
        ]}
        edges={[
          { from: 'c1', to: 'f', hue: 1, flow: true },
          { from: 'c2', to: 'f', hue: 2, flow: true },
          { from: 'c3', to: 'f', hue: 2, flow: true },
          { from: 'f', to: 'src', label: 'once', hue: 5, both: true },
        ]}
        caption="The first caller creates the pending entry; the others receive the same future (Caffeine), promise (lru-cache fetch) or wait on the same init future (moka get_with)."
      />
      <UsingTask task="async" />
      <Callout tone="note" title="Which one to use">
        <p>
          In an async application (Micronaut with reactive or async controllers, Node, tokio), use the async cache: a sync loader would block an event
          loop or a runtime worker. lru-cache’s <code>fetch()</code> also supports stale-while-revalidate and abort signals; see{' '}
          <a href="#/local-cache/expiry">Expiry and refresh</a>.
        </p>
      </Callout>

      <h2>Listening to removals</h2>
      <p>A removal listener is told every time an entry leaves the cache, and why.</p>
      <p>The same eight operations ran on a cache of maximum size 2 with a one-minute TTL (moka: 200 ms with real time) in each library:</p>
      <UsingRemovalStrip
        title="Recorded removals, in the order each library reported them"
        ops={REMOVAL_OPS}
        rows={LANGS.map((lang) => ({ label: LANG_INFO[lang].library, removals: parseRemovals(U[lang].removal) }))}
        caption="Each chip carries its cause as text; the library’s own name is in brackets where it differs."
      />
      <p>
        REPLACED, EXPLICIT and EXPIRED agree everywhere. The SIZE victim does not: lru-cache evicted <strong>{sizeVictim('ts')}</strong>, the least
        recently used; Caffeine evicted <strong>{sizeVictim('java')}</strong>; moka removed <strong>{sizeVictim('rust')}</strong>{sizeVictim('rust') === 'd' ? <>, the newcomer — it was never admitted</> : null}. Caffeine and moka judge by frequency as well as
        recency, and <strong>a</strong> had been written twice. Why they choose this way is the subject of{' '}
        <a href="#/local-cache/eviction">Eviction: LRU, LFU and W-TinyLFU</a>.
      </p>
      <UsingTask task="removal" />
      <Table
        head={['Cause', 'Caffeine', 'lru-cache reason', 'moka', 'Means']}
        rows={[
          ['SIZE', 'SIZE', 'evict', 'Size', 'evicted to stay within the bound'],
          ['EXPIRED', 'EXPIRED', 'expire', 'Expired', 'older than its TTL'],
          ['EXPLICIT', 'EXPLICIT', 'delete', 'Explicit', 'you invalidated it'],
          ['REPLACED', 'REPLACED', 'set', 'Replaced', 'a put overwrote the value (the key stays)'],
          ['—', 'COLLECTED', 'fetch', '—', 'Caffeine: a weak or soft reference was garbage-collected; lru-cache: a fetchMethod returned undefined or was aborted'],
        ]}
      />
      <Callout tone="note" title="When the listener runs">
        <p>
          Caffeine’s <code>removalListener</code> runs asynchronously on the cache’s executor (here forced onto the caller with{' '}
          <code>executor(Runnable::run)</code>); its <code>evictionListener</code> runs synchronously, as part of the removal. lru-cache calls{' '}
          <code>dispose</code> synchronously during the operation (<code>disposeAfter</code> once the cache is consistent again), and only notices
          expiry when the entry is touched or <code>purgeStale()</code> runs. moka calls its <code>eviction_listener</code> during maintenance.
        </p>
      </Callout>

      <h2>Statistics</h2>
      <p>The hit ratio tells you whether a cache is worth its memory; only Caffeine counts it for you.</p>
      <UsingTask task="stats" />
      <Proportion
        title={`Caffeine stats(): ${hits + misses} reads (recorded)`}
        parts={[
          { label: 'hits', value: hits, hue: 6 },
          { label: 'misses', value: misses, hue: 8 },
        ]}
      />
      <p>
        Caffeine: <code>recordStats()</code> at build time (off by default), then <code>stats()</code> for hits, misses, loads, load time and
        evictions. lru-cache: pass a <code>status</code> object to <code>get</code> to learn hit or miss per call. moka 0.12: no statistics — count
        them yourself. Exporting these to a metrics system is covered in <a href="#/local-cache/production">Statistics, frameworks and pitfalls</a>.
      </p>

      <h2>Micronaut: caching by annotation</h2>
      <p>With micronaut-cache-caffeine, a service method becomes cached by adding an annotation; Micronaut builds the Caffeine cache from configuration.</p>
      <Flow
        title="@Cacheable: the call goes through an interceptor first"
        cols={4}
        rows={2}
        nodes={[
          { id: 'ctl', label: 'caller', sub: 'service.find("p1")', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'proxy', label: 'interceptor', sub: 'generated at compile time', col: 1, row: 0, hue: 7 },
          { id: 'cache', label: 'cache "products"', sub: 'Caffeine', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'body', label: 'find() body', sub: 'database query', col: 2, row: 1, hue: 5 },
        ]}
        edges={[
          { from: 'ctl', to: 'proxy', hue: 1, flow: true },
          { from: 'proxy', to: 'cache', label: 'key: id', hue: 3, both: true },
          { from: 'proxy', to: 'body', label: 'on a miss', hue: 5, dashed: true },
        ]}
        steps={[
          { title: 'Hit', body: <p>The interceptor builds the key from the arguments, finds it in the cache and returns the value. The method body never runs.</p>, active: ['ctl', 'proxy', 'cache', 'ctl>proxy', 'proxy>cache'] },
          { title: 'Miss', body: <p>No entry: the interceptor calls the real method and stores what it returns under the key.</p>, active: ['ctl', 'proxy', 'cache', 'body', 'ctl>proxy', 'proxy>cache', 'proxy>body'] },
        ]}
      />
      <Tabs
        items={[
          { label: 'ProductService.java', content: <CodeBlock title="ProductService.java (the code that ran)" language="java" code={micronaut.service} /> },
          { label: 'application.yml', content: <CodeBlock title="application.yml" language="yaml" code={micronaut.config} /> },
          { label: 'build.gradle', content: <CodeBlock title="build.gradle (dependencies)" language="groovy" code={micronaut.build} /> },
        ]}
      />
      <CodeBlock title={`recorded: Micronaut ${V.micronautCore}, micronaut-cache-caffeine ${V.micronautCache}`} language="text" code={MN.join('\n')} />
      <StatTiles
        stats={[
          { label: 'calls to find()', value: finds, sub: 'from the application', hue: 1 },
          { label: 'method body ran', value: methodRuns, sub: 'the first call and after the real invalidation', hue: 5, bar: { value: methodRuns, max: finds } },
          { label: 'cache hits / misses', value: `${mnHits} / ${mnMisses}`, sub: 'from the Caffeine cache Micronaut built', hue: 6 },
        ]}
      />
      <Callout tone="warn" title="@CacheInvalidate builds its key from all the arguments">
        <p>
          <code>find(id)</code> caches under the key <em>id</em>. A plain <code>@CacheInvalidate</code> on <code>updatePrice(id, priceCents)</code>{' '}
          removes the key <em>(id, priceCents)</em>, which does not exist — recorded above: after <code>updatePriceWrongKey</code> the old price was
          still served. Name the key parameters: <code>@CacheInvalidate(parameters = "id")</code>.
        </p>
      </Callout>
      <p>
        <code>micronaut.caches.&lt;name&gt;</code> accepts <code>maximum-size</code>, <code>maximum-weight</code>, <code>expire-after-write</code>,{' '}
        <code>expire-after-access</code>, <code>initial-capacity</code> and <code>record-stats</code> (checked in micronaut-cache’s CacheConfiguration).
        The cache is per instance; invalidating across instances is still your job — see <a href="#/redis/tiered-caching">Multi-level caching</a>.
      </p>

      <h2>Try it: operate a bounded cache</h2>
      <p>
        A pure TypeScript model of a bounded LRU cache with a TTL and a fake clock. The same 16-step script was run against lru-cache {V.lruCache} and
        against this model during capture: the removals (key and cause) and the final recency order were{' '}
        {BASICS.modelCheck.matches ? 'identical' : 'different'}.
      </p>
      <UsingPlayground checked={BASICS.modelCheck.matches} />
      <p>Things to try:</p>
      <ul>
        <li>Put a, b, c, then get a, then put d: b is evicted (SIZE), not a — the get made a recent.</li>
        <li>Put a twice: the first value is reported as REPLACED, the key stays.</li>
        <li>Advance the clock twice: entries are past their TTL but still held until a get or cleanUp() removes them (EXPIRED) — lru-cache works this way; Caffeine and moka also expire during maintenance.</li>
        <li>Use get(key, loader) on the same key twice: one load, then a hit.</li>
      </ul>

      <h2>Cheat sheet</h2>
      <p>The same operation in each API.</p>
      <Table
        head={['Operation', 'Caffeine (Java)', 'lru-cache (TypeScript)', 'moka (Rust)']}
        rows={[
          ['build', 'Caffeine.newBuilder().maximumSize(n).expireAfterWrite(d).build()', 'new LRUCache({ max: n, ttl: ms })', 'Cache::builder().max_capacity(n).time_to_live(d).build()'],
          ['read', 'getIfPresent(k)', 'get(k)', 'get(&k)'],
          ['write', 'put(k, v)', 'set(k, v)', 'insert(k, v)'],
          ['read or load', 'get(k, k -> load(k))', 'get, else load + set', 'get_with(k, || load())'],
          ['loading cache', 'build(loader) → LoadingCache.get(k)', 'memoMethod + memo(k)', 'your function around get_with'],
          ['async', 'buildAsync(loader) → get(k): CompletableFuture', 'fetchMethod + await fetch(k)', 'future::Cache + get_with(k, fut).await'],
          ['remove one', 'invalidate(k)', 'delete(k)', 'invalidate(&k)'],
          ['remove all', 'invalidateAll()', 'clear()', 'invalidate_all()'],
          ['bulk', 'getAllPresent(ks), getAll(ks, loader)', 'loop', 'loop'],
          ['size', 'estimatedSize()', 'size', 'entry_count() (after run_pending_tasks)'],
          ['iterate', 'asMap().forEach (no order)', 'entries() (most recent first)', 'iter() (no order)'],
          ['removals', 'removalListener / evictionListener', 'dispose / disposeAfter', 'eviction_listener'],
          ['statistics', 'recordStats() + stats()', 'status object per call', 'none'],
          ['run maintenance now', 'cleanUp()', 'purgeStale()', 'run_pending_tasks()'],
        ]}
      />
      <TermList
        items={[
          { term: 'getIfPresent / get', definition: 'Read without loading: the value, or nothing.' },
          { term: 'get-with-loader', definition: 'Read, and on a miss run the loader once per key and store its result (computeIfAbsent semantics).' },
          { term: 'loading cache', definition: 'A cache built with its loader, so every get loads on a miss.' },
          { term: 'async cache', definition: 'A cache of futures/promises: concurrent callers share one in-flight load without blocking threads.' },
          { term: 'removal cause', definition: 'Why an entry left: SIZE, EXPIRED, EXPLICIT or REPLACED.' },
          { term: 'maintenance', definition: 'The batched work a concurrent cache does after reads and writes: eviction, expiry, listeners, counts.' },
        ]}
      />

      <h2>Checklist</h2>
      <ul>
        <li>Every cache has a size (or weight) bound and a TTL, set where it is built.</li>
        <li>Reads go through get-with-loader, a loading cache or an async cache — not get, then load, then put.</li>
        <li>Loaders are short and never touch other entries of the same cache.</li>
        <li>Async code uses the async cache.</li>
        <li>Removal listeners only log, count or clean up; they do not call back into the cache.</li>
        <li>Statistics are on (Caffeine) or counted (lru-cache, moka), and the hit ratio is watched.</li>
        <li>In Micronaut, <code>@CacheInvalidate</code> names the same key parameters as <code>@Cacheable</code>.</li>
      </ul>

      <Recap
        points={[
          'Build with a bound and a TTL: maximumSize + expireAfterWrite, max + ttl, max_capacity + time_to_live.',
          'Load through the cache — get(k, loader), memo/fetch, get_with — so a miss runs the loader once per key.',
          'Recorded: all three report REPLACED, EXPLICIT and EXPIRED alike, but chose different SIZE victims (LRU vs frequency-aware).',
          'Sizes and listeners follow maintenance in Caffeine and moka; lru-cache is exact and lazy about expiry.',
          `Micronaut’s @Cacheable ran the method ${methodRuns} times for ${finds} calls; @CacheInvalidate must use the same key parameters.`,
        ]}
      />
    </>
  )
}
