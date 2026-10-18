import { BarChart, Flow, Proportion, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { ProductionDashboard } from '../components/ProductionDashboard'
import { ProductionGlossary } from '../components/ProductionGlossary'
import { all, one, versions } from '../data/runtimeQuery'
import { LANG_INFO, LANGS, MEMO, MICRONAUT, PITFALLS, STATS, type Excerpt, type Lang } from '../data/runtimeSources'
import type { BadKeyEvent, BenchEvent, MeterRow, MutationEvent } from '../data/runtimeTypes'
import { frequencyHitRatio } from '../simulation/memorySizing'

// ---------- the recording ----------
interface CaffeineStats { requestCount: number; hitCount: number; missCount: number; hitRate: number; missRate: number; loadSuccessCount: number; loadFailureCount: number; totalLoadTime: number; averageLoadPenalty: number; evictionCount: number; evictionWeight: number }
const caffeine = one<{ stats: CaffeineStats; toString: string; requests: number; keys: number; maximumSize: number }>('java', 'stats')
const lruStats = one<{ stats: { hits: number; misses: number; hitRate: number; loads: number; evictions: number; size: number } }>('ts', 'stats').stats
const mokaStats = one<{ stats: { hits: number; misses: number; hitRate: number; evictions: number; entryCount: number; weightedSize: number } }>('rust', 'stats').stats
const meters = one<{ meters: MeterRow[] }>('java', 'meters').meters
const memo = one<{ calls: number; computed: number; results: number[] }>('ts', 'memo')
const mnSteps = one<{ steps: { call: string; ranMethod: boolean }[] }>('micronaut', 'micronaut').steps
const mnNative = one<{ class: string; maximum: number; expireAfterWriteSeconds: number; stats: string }>('micronaut', 'micronautNative')
const mnStampede = all<{ mode: string; callers: number; methodCalls: number }>('micronaut', 'micronautStampede')
const bench = (app: 'java' | 'ts' | 'rust', op: string) => all<BenchEvent>(app, 'bench', (e) => e.op === op && e.lib !== 'Map (no bound, no policy)')[0]
const mutation = (app: 'java' | 'ts' | 'rust', mode?: string) => one<MutationEvent>(app, 'mutation', mode)
const badKey = (app: 'java' | 'ts') => one<BadKeyEvent>(app, 'badKey')
const unbounded = (app: 'java' | 'ts' | 'rust') => String(one<{ result: string }>(app, 'unbounded').result)

const millions = (v: number) => `${(v / 1e6).toFixed(1)} M`
const pct = (v: number) => `${(v * 100).toFixed(1)} %`
const scrape = one<{ lines: string[] }>('java', 'prometheus').lines
const scraped = new Set(scrape.map((l) => l.slice(0, l.indexOf('{'))))
/** The name the recorded Prometheus scrape used for a meter (dots to underscores, plus _total or a unit). */
const promName = (m: MeterRow) => ['', '_total', '_seconds'].map((suffix) => m.name.replace(/\./g, '_') + suffix).find((n) => scraped.has(n)) ?? '—'

function Excerpts({ items, lang }: { items: readonly Excerpt[]; lang: Lang }) {
  return (
    <>
      {items.map((e) => (
        <CodeBlock key={e.code} title={`${e.file} (the code that ran)`} language={LANG_INFO[lang].language} code={e.code} />
      ))}
    </>
  )
}

export default function Production() {
  const s = caffeine.stats
  const userHit = frequencyHitRatio(1_000_000, 0.6, 10_000)
  const productHit = frequencyHitRatio(10_000, 0.9, 10_000 / 10)
  return (
    <>
      <LessonGoals
        goals={[
          'turn on and read cache statistics in Caffeine, and add them to lru-cache and moka',
          'export them as metrics and know which ones to alert on',
          'use @Cacheable in Micronaut (and Spring) without its two classic traps',
          'compare the three libraries on a recorded benchmark, with its caveats',
          'recognise the mistakes that hurt in production, and apply a short set of design rules',
        ]}
        before={<>The earlier lessons of this module, especially Loading (<a href="#/local-cache/loading">#/local-cache/loading</a>) and Memory (<a href="#/local-cache/memory">#/local-cache/memory</a>); metrics and dashboards in general.</>}
      />

      <h2>Measure first: cache statistics</h2>
      <p>A cache you do not measure is a guess; the hit rate is the number that says whether it earns its memory.</p>
      <p>
        Caffeine counts hits, misses, loads and evictions when you ask it to with <code>recordStats()</code> (off by default — counting costs a
        little). The recorded run sent {caffeine.requests.toLocaleString()} requests with Zipf popularity over {caffeine.keys.toLocaleString()}{' '}
        products to a cache of {caffeine.maximumSize.toLocaleString()}, with a 0.1 ms loader:
      </p>
      <StatTiles
        stats={[
          { label: 'hitRate', value: pct(s.hitRate), sub: `${s.hitCount.toLocaleString()} hits, ${s.missCount.toLocaleString()} misses (missRate ${pct(s.missRate)})`, hue: 6, bar: { value: s.hitRate, max: 1 } },
          { label: 'loadSuccessCount', value: s.loadSuccessCount.toLocaleString(), sub: `${s.loadFailureCount} failures`, hue: 5 },
          { label: 'average load penalty', value: `${(s.averageLoadPenalty / 1e6).toFixed(3)} ms`, sub: `${Math.round(s.averageLoadPenalty).toLocaleString()} ns, as Caffeine reports it`, hue: 5 },
          { label: 'evictionCount', value: s.evictionCount.toLocaleString(), sub: 'size-based removals', hue: 7 },
        ]}
      />
      <Table
        head={['CacheStats', 'Recorded', 'Meaning']}
        rows={[
          ['hitCount / missCount', `${s.hitCount.toLocaleString()} / ${s.missCount.toLocaleString()}`, 'lookups that found a value / did not (a miss may then load)'],
          ['hitRate / missRate', `${s.hitRate.toFixed(3)} / ${s.missRate.toFixed(3)}`, 'hits ÷ requests; 1.0 when there were no requests'],
          ['loadSuccessCount / loadFailureCount', `${s.loadSuccessCount.toLocaleString()} / ${s.loadFailureCount}`, 'loads that returned a value / threw or returned null'],
          ['totalLoadTime', `${s.totalLoadTime.toLocaleString()} ns`, 'time spent in loaders, in nanoseconds'],
          ['averageLoadPenalty', `${Math.round(s.averageLoadPenalty).toLocaleString()} ns`, 'totalLoadTime ÷ loads: what one miss costs a caller'],
          ['evictionCount / evictionWeight', `${s.evictionCount.toLocaleString()} / ${s.evictionWeight.toLocaleString()}`, 'entries removed by the size or weight bound (not by invalidate)'],
        ]}
      />
      <TermList
        items={[
          { term: 'hit rate', definition: 'Share of lookups answered from the cache. The headline number; watch it over time, not once.' },
          { term: 'load penalty', definition: 'How long a miss takes to load. Hit rate × penalty tells you what the cache saves.' },
          { term: 'eviction count', definition: 'Entries removed to stay under the bound. A high rate with a low hit rate means the cache is too small for the working set.' },
          { term: 'meter', definition: 'A named metric (counter, gauge, timer) in a metrics library such as Micrometer, exported to a monitoring system.' },
        ]}
      />
      <p>
        lru-cache and moka keep no hit/miss counters. lru-cache fills a per-call <code>status</code> object (was this fetch a hit, a miss, stale?)
        that a small wrapper can count; moka’s <code>entry().or_insert_with()</code> tells you whether this call inserted the value. Both have
        size numbers: lru-cache <code>size</code> and <code>calculatedSize</code>, moka <code>entry_count()</code> and{' '}
        <code>weighted_size()</code>.
      </p>
      <Tabs items={LANGS.map((lang) => ({ label: LANG_INFO[lang].label, content: <Excerpts items={STATS[lang]} lang={lang} /> }))} />
      <BarChart
        title="Hit rate on the same kind of workload (recorded: 20,000 Zipf requests, 10,000 keys, 1,000 entries)"
        unit=" %"
        bars={[
          { label: 'Caffeine (W-TinyLFU), recordStats', value: +(s.hitRate * 100).toFixed(1), hue: 6 },
          { label: 'lru-cache (LRU), wrapper', value: +(lruStats.hitRate * 100).toFixed(1), hue: 6 },
          { label: 'moka (TinyLFU), wrapper', value: +(mokaStats.hitRate * 100).toFixed(1), hue: 6 },
        ]}
        max={100}
      />
      <Callout tone="tip" title="What the numbers tell you">
        <p>
          A low hit rate with many evictions: the cache is too small, or the keys do not repeat (see the pitfalls below). A low hit rate with few
          evictions: entries expire before they are reused — the TTL is too short. A rising average load penalty: the source is slowing down,
          and every miss now hurts more.
        </p>
      </Callout>

      <h2>Exporting the numbers</h2>
      <p>Statistics become useful when a dashboard plots them and an alert watches them.</p>
      <Flow
        title="From cache counters to a dashboard"
        cols={5}
        rows={1}
        rowHeight={96}
        nodes={[
          { id: 'cache', label: 'Caffeine', sub: 'recordStats()', col: 0, row: 0, hue: 3 },
          { id: 'binder', label: 'Micrometer', sub: 'CaffeineCacheMetrics', col: 1, row: 0, hue: 1 },
          { id: 'reg', label: 'meter registry', sub: 'Prometheus format', col: 2, row: 0, hue: 1, shape: 'store' },
          { id: 'prom', label: 'Prometheus', sub: 'scrapes /metrics', col: 3, row: 0, hue: 4, shape: 'store' },
          { id: 'dash', label: 'dashboard', sub: 'hit rate, alerts', col: 4, row: 0, hue: 6, shape: 'actor' },
        ]}
        edges={[
          { from: 'cache', to: 'binder', hue: 3 },
          { from: 'binder', to: 'reg', hue: 1 },
          { from: 'prom', to: 'reg', label: 'pull', hue: 4, dashed: true },
          { from: 'prom', to: 'dash', hue: 6, flow: true },
        ]}
      />
      <p>
        <code>CaffeineCacheMetrics.monitor(registry, cache, "products")</code> registers these meters, tagged <code>cache=products</code>{' '}
        (recorded from the same run, values at the end):
      </p>
      <Table
        head={['Meter', 'Type', 'Tag', 'Recorded', 'Prometheus name', 'Description (from Micrometer)']}
        rows={meters.map((m) => [<code key="n">{m.name}</code>, m.type, m.tags || '—', m.value.toLocaleString(), <code key="p">{promName(m)}</code>, m.description])}
      />
      <CodeBlock title="Recorded: the cache lines of a Prometheus scrape (PrometheusMeterRegistry.scrape())" language="text" code={scrape.join('\n')} />
      <Callout tone="note" title="In frameworks and the other languages (not recorded)">
        <p>
          Spring Boot Actuator binds the caches it creates to Micrometer for you; Micronaut does the same with <code>micronaut-micrometer</code>{' '}
          on the classpath (micronaut-cache-caffeine ships a <code>CaffeineCacheMetricsBinder</code>). For lru-cache and moka, export the
          wrapper’s counters with your metrics library (prom-client, the <code>metrics</code> crate) — as monotonic counters, so the
          monitoring system can compute rates.
        </p>
      </Callout>
      <p>Alert on:</p>
      <ul>
        <li><strong>hit rate</strong> as a rate over a window — <code>sum(rate(cache_gets_total{'{'}result="hit"{'}'}[5m])) / sum(rate(cache_gets_total[5m]))</code> — compared with its normal level;</li>
        <li><strong>load rate and load duration</strong>: misses are load on your database;</li>
        <li><strong>size against the maximum</strong> and <strong>eviction rate</strong>: a full cache evicting fast is too small.</li>
      </ul>

      <h2>Playground: a hit-rate dashboard</h2>
      <p>The dashboard below is fed by a simulated minute of traffic with the events real dashboards show.</p>
      <ProductionDashboard />
      <p>Things to look for:</p>
      <ul>
        <li><strong>batch scan</strong>: with LRU the scan’s one-off keys push popular ones out; TinyLFU admission turns most of them away and loses less.</li>
        <li><strong>new favourites</strong>: LRU adapts at once; TinyLFU needs a few seconds to learn the new frequencies (its sketch ages old counts).</li>
        <li><strong>slow database</strong>: hit rate does not move, but averageLoadPenalty does — watch both.</li>
        <li><strong>deploy</strong>: an empty cache, a dip, and a burst of loads on the database; with many instances deployed at once, that burst multiplies.</li>
      </ul>
      <p>
        The two policies are the module’s models (LRU, and LRU behind a TinyLFU admission filter). Replaying the recorded statistics run’s
        trace, they reproduce lru-cache’s and moka’s recorded hit rates to the third decimal (see{' '}
        <a href="#/local-cache/memory">Memory, weight and garbage collection</a>).
      </p>

      <h2>Caching with annotations</h2>
      <p>Frameworks let you cache a method’s result with one annotation — and hide two traps in the defaults.</p>
      <p>
        Micronaut 4.5 with <code>micronaut-cache-caffeine</code> builds a Caffeine cache
        per name from configuration. The recorded app calls a <code>ProductService</code> whose methods are annotated:
      </p>
      <Tabs
        items={[
          { label: 'ProductService.java', content: <CodeBlock title="ProductService.java (the code that ran)" language="java" code={MICRONAUT.service} /> },
          { label: 'application.yml', content: <CodeBlock title="application.yml" language="yaml" code={MICRONAUT.config} /> },
          { label: 'build.gradle', content: <CodeBlock title="build.gradle (dependencies)" language="groovy" code={MICRONAUT.build} /> },
        ]}
      />
      <Table
        head={['Call (recorded, in order)', 'Did the method body run?', 'Why']}
        rows={mnSteps.map((st, i) => [
          <code key="c">{st.call}</code>,
          st.ranMethod ? 'yes' : 'no — answered from the cache',
          st.call.startsWith('find') && i === 0 ? 'first call for 42: a miss'
            : st.call.startsWith('changePriceWrongKey') ? 'the write ran; it invalidated key (42, 2499), which was never cached'
              : st.call.startsWith('changePrice ') ? 'the write ran and removed key 42'
                : st.call === 'find 42' && mnSteps[i - 1]?.call.startsWith('changePriceWrongKey') ? 'stale: the old entry for 42 survived the “invalidation”'
                  : st.ranMethod ? 'a miss: the method loads' : 'a hit',
        ])}
      />
      <Predict
        question={<p>20 threads call an <code>@Cacheable</code> method for the same missing id at once (the method takes 200 ms). How many times does the method body run with Micronaut’s defaults?</p>}
        options={['Once: the cache coalesces the calls', '20 times: the default is not atomic', 'Twice']}
        answer={1}
        explanation={`Recorded: ${mnStampede.map((m) => `${m.mode}: ${m.methodCalls} of ${m.callers}`).join('; ')}. With atomic = false Micronaut does a get, then runs the method on a miss, then a put — the stampede from the Loading lesson. atomic = true uses Caffeine’s get(key, loader).`}
      />
      <BarChart
        title="Method calls for 20 concurrent misses (recorded, Micronaut @Cacheable)"
        bars={mnStampede.map((m) => ({ label: m.mode, value: m.methodCalls, hue: m.methodCalls > 1 ? 8 : 6 }))}
      />
      <Table
        head={['micronaut.caches.<name>.…', 'Default', 'Caffeine equivalent']}
        rows={[
          ['maximum-size', 'none (unbounded)', 'maximumSize'],
          ['maximum-weight', 'none (needs a Weigher bean)', 'maximumWeight + weigher'],
          ['expire-after-write / expire-after-access', 'none', 'expireAfterWrite / expireAfterAccess'],
          ['initial-capacity', 'none', 'initialCapacity'],
          ['record-stats', 'false', 'recordStats()'],
          ['listen-to-removals / listen-to-evictions', 'false', 'removal / eviction listener'],
        ]}
      />
      <p>
        Recorded: the <code>products</code> cache was a Caffeine <code>{mnNative.class}</code> with maximum {mnNative.maximum.toLocaleString()} and
        expireAfterWrite {mnNative.expireAfterWriteSeconds} s, and its own statistics read <code>{mnNative.stats}</code>.
      </p>
      <Callout tone="warn" title="Two traps, both recorded">
        <p>
          <strong>Keys come from all parameters.</strong> <code>@CacheInvalidate</code> on <code>changePrice(id, priceCents)</code> builds the key
          from both parameters, so it removes nothing that <code>find(id)</code> cached. Name the parameter:{' '}
          <code>@CacheInvalidate(parameters = "id")</code>. <strong>Not atomic by default.</strong> Add <code>atomic = true</code> to{' '}
          <code>@Cacheable</code> for anything that can stampede.
        </p>
      </Callout>
      <Table
        head={['Framework', 'How', 'Single-flight', 'Recorded?']}
        rows={[
          ['Micronaut', '@Cacheable / @CachePut / @CacheInvalidate, micronaut-cache-caffeine, micronaut.caches.* config', '@Cacheable(atomic = true)', 'yes, above'],
          ['Spring', '@Cacheable / @CachePut / @CacheEvict, spring-boot-starter-cache + Caffeine, spring.cache.caffeine.spec=maximumSize=1000,expireAfterWrite=10m', '@Cacheable(sync = true)', 'not recorded'],
          ['Node.js', 'memoise a function with lru-cache’s memo() (synchronous) or fetch() (async)', 'fetch()', 'memo(), below'],
          ['Rust', 'the cached crate’s #[cached] attribute macro on a function (sized and timed stores)', 'see its docs', 'not recorded'],
        ]}
      />
      <CodeBlock title={`${MEMO.file} — lru-cache memo() (the code that ran)`} language="ts" code={MEMO.code} />
      <p>Recorded: {memo.calls} calls, {memo.computed} computations, results {memo.results.join(', ')}.</p>

      <h2>Benchmark: the three libraries</h2>
      <p>One thread, the same workload in each language: how many gets and puts per second.</p>
      <p>
        65,536 integer keys with Zipf popularity, a trace of 1,048,576 requests; get = reads that all hit, put = writes into a cache half that
        size, so it evicts as it goes. Median of 7 passes after 5 warm-up passes (which also warm up the JIT in Java and Node.js).
      </p>
      <BarChart
        title="Single-thread gets per second (recorded)"
        bars={[
          { label: `Caffeine (Java ${versions.java})`, value: bench('java', 'get').opsPerSec, display: millions(bench('java', 'get').opsPerSec), hue: 6 },
          { label: `lru-cache ${versions.lruCache} (Node ${versions.node})`, value: bench('ts', 'get').opsPerSec, display: millions(bench('ts', 'get').opsPerSec), hue: 2 },
          { label: `moka ${versions.moka} (Rust)`, value: bench('rust', 'get').opsPerSec, display: millions(bench('rust', 'get').opsPerSec), hue: 4 },
        ]}
      />
      <BarChart
        title="Single-thread puts per second, with eviction (recorded)"
        bars={[
          { label: 'Caffeine', value: bench('java', 'put').opsPerSec, display: millions(bench('java', 'put').opsPerSec), hue: 6 },
          { label: 'lru-cache', value: bench('ts', 'put').opsPerSec, display: millions(bench('ts', 'put').opsPerSec), hue: 2 },
          { label: 'moka', value: bench('rust', 'put').opsPerSec, display: millions(bench('rust', 'put').opsPerSec), hue: 4 },
        ]}
      />
      <Callout tone="warn" title="What this benchmark is not">
        <p>
          One machine ({versions.cores} cores, shared with other work), one run of 7 passes, integer keys, tiny values, one thread. moka is
          built for concurrency and does more per call (reference counts, a read log, timestamps); it scales with threads where a single-lock
          LRU does not (see <a href="#/local-cache/loading">Loading</a>). Every one of these is millions of operations per second — a
          network round trip to Redis is tens of microseconds. Choose by your language and features, not by this chart.
        </p>
      </Callout>

      <h2>Pitfalls</h2>
      <p>The mistakes below all compile and pass a quick test; each was recorded doing the wrong thing.</p>

      <h3>An unbounded cache</h3>
      <p>A cache without a bound is a memory leak with a hit rate.</p>
      <Table
        head={['Library', 'Without a bound (recorded)']}
        rows={[
          ['Caffeine', <code key="j">{unbounded('java')}</code>],
          ['lru-cache', <code key="t">{unbounded('ts')}</code>],
          ['moka', <code key="r">{unbounded('rust')}</code>],
        ]}
      />
      <p>lru-cache refuses; Caffeine and moka happily build an unbounded map. Always set a size or weight bound, and a TTL as well if the data changes.</p>

      <h3>Changing a cached object</h3>
      <p>A cache hands out the object it holds, so a caller that changes it changes it for everyone.</p>
      <Predict
        question={<p>A request gets cart 7 from the cache, sets its total to 0 for a one-off discount and adds a free gift — without calling put. What does the next request that reads cart 7 see?</p>}
        options={['The original cart: the change was never put back', 'The changed cart: it is the same object', 'It depends on the TTL']}
        answer={1}
        explanation={`Recorded (Caffeine): sameObject = ${mutation('java').sameObject}, the next reader sees ${mutation('java').otherSees}. Same in lru-cache: ${mutation('ts').otherSees}.`}
      />
      <Table
        head={['Library', 'Same object for the next reader?', 'What the next reader saw (recorded)']}
        rows={[
          ['Caffeine', String(mutation('java').sameObject), mutation('java').otherSees],
          ['lru-cache', String(mutation('ts').sameObject), mutation('ts').otherSees],
          ['moka, Cache<String, Cart>', String(mutation('rust', 'Cache<String, Cart>').sameObject), `${mutation('rust', 'Cache<String, Cart>').otherSees} — get() returned a clone`],
          ['moka, Cache<String, Arc<Mutex<Cart>>>', String(mutation('rust', 'Cache<String, Arc<Mutex<Cart>>>').sameObject), mutation('rust', 'Cache<String, Arc<Mutex<Cart>>>').otherSees],
        ]}
      />
      <Tabs items={LANGS.map((lang) => ({ label: LANG_INFO[lang].label, content: <Excerpts items={PITFALLS.mutation[lang]} lang={lang} /> }))} />
      <p>
        Cache immutable values: Java records with immutable fields (<code>List.copyOf</code>), <code>Object.freeze</code> or copies in
        JavaScript, and in Rust plain values — moka clones on <code>get</code>, so sharing needs an explicit <code>Arc</code>, which makes it
        visible in the type.
      </p>

      <h3>Keys that never match</h3>
      <p>A key that is not equal to an equal-looking key turns every read into a miss — and every miss into a new entry.</p>
      <Proportion
        title={`Recorded (Caffeine): 1,000 reads of 10 products with a key class lacking equals()/hashCode()`}
        parts={[
          { label: 'hits', value: badKey('java').badHits, hue: 6 },
          { label: 'misses (new entry each)', value: 1000 - badKey('java').badHits, hue: 8 },
        ]}
      />
      <Table
        head={['', 'Hits of 1,000', 'Entries for 10 products']}
        rows={[
          ['Caffeine, key class without equals/hashCode', badKey('java').badHits, badKey('java').badSize],
          ['Caffeine, record key', badKey('java').goodHits, badKey('java').goodSize],
          ['lru-cache, object literal as key', badKey('ts').badHits, badKey('ts').badSize],
          ['lru-cache, string key "eu:3"', badKey('ts').goodHits, badKey('ts').goodSize],
        ]}
      />
      <Tabs
        items={[
          { label: LANG_INFO.java.label, content: <CodeBlock title={`${PITFALLS.badKey.java.file} (the code that ran)`} language="java" code={PITFALLS.badKey.java.code} /> },
          { label: LANG_INFO.ts.label, content: <CodeBlock title={`${PITFALLS.badKey.ts.file} (the code that ran)`} language="ts" code={PITFALLS.badKey.ts.code} /> },
          { label: LANG_INFO.rust.label, content: <p>moka requires <code>K: Hash + Eq</code>, so a key without them does not compile; a hand-written <code>Hash</code> that disagrees with <code>Eq</code> would still break it. Derive both.</p> },
        ]}
      />
      <p>Also: never mutate a key after it is in the cache, and remember that Caffeine’s <code>weakKeys()</code> compares keys by identity.</p>

      <h3>Data with little reuse</h3>
      <p>Per-user or per-request data is often read once or twice, and a cache cannot help data that does not repeat.</p>
      <StatTiles
        stats={[
          { label: 'per-user profiles', value: pct(userHit), sub: 'model: 1 M users, skew 0.6, 10,000 entries', hue: 8, bar: { value: userHit, max: 1 } },
          { label: 'product pages', value: pct(productHit), sub: 'model: 10,000 products, skew 0.9, 1,000 entries', hue: 6, bar: { value: productHit, max: 1 } },
        ]}
      />
      <p>
        Best-case hit ratios from the Zipf model of the Memory lesson. A low hit rate with a full cache and high evictions is the signature in the
        statistics. Cache what many requests share; for per-user data, cache only the hot users (a small bound) or keep it in the session or in
        Redis.
      </p>

      <h3>TTL too long, and invalidation across instances</h3>
      <p>Each instance has its own copy, and a delete in one process does not reach the others.</p>
      <p>
        A price changed in the database stays wrong in every instance’s cache until its TTL ends. Keep TTLs as short as the data’s tolerance for
        staleness, and when it must be shorter than that, publish invalidations to every instance — the{' '}
        <a href="#/redis/tiered-caching">Multi-level caching</a> lesson records it with Redis Pub/Sub, and{' '}
        <a href="#/redis/caching">Caching patterns</a> covers the write paths.
      </p>
      <Table
        head={['Pitfall', 'How it shows in the statistics', 'Fix']}
        rows={[
          ['unbounded cache', 'size only grows; heap and GC time grow with it', 'maximumSize / max / max_capacity, or a weight'],
          ['mutable cached objects', 'nothing — wrong data instead', 'immutable values, or copy on read'],
          ['keys without equality', 'hit rate near 0, size = number of reads', 'records, strings, derived Hash + Eq'],
          ['low-reuse data', 'low hit rate, high evictions, full cache', 'cache shared data only; small bound for per-user data'],
          ['TTL too long / no cross-instance invalidation', 'nothing — stale reads', 'shorter TTL, Pub/Sub invalidation, versions in values'],
          ['@CacheInvalidate on the wrong key', 'nothing — stale reads after writes', 'parameters = "id" (Micronaut), key = "#id" (Spring)'],
          ['stampede on a hot miss', 'load bursts, spikes in load duration', 'get(key, loader), fetch(), get_with; atomic / sync in frameworks'],
          ['soft values', 'size collapses under memory pressure', 'a size or weight bound instead'],
        ]}
      />

      <h2>Design rules</h2>
      <ol>
        <li><strong>Bound it twice:</strong> a size (or weight) bound always, and a TTL whenever the source can change.</li>
        <li><strong>Load through the cache</strong> so concurrent misses coalesce; set <code>atomic</code>/<code>sync</code> in annotations.</li>
        <li><strong>Cache immutable values</strong> under keys with proper equality.</li>
        <li><strong>Turn statistics on and export them</strong>; alert on hit rate, load rate and load duration.</li>
        <li><strong>Size from a memory budget and the hit-ratio curve</strong>, and remember every instance holds its own copy.</li>
        <li><strong>Plan invalidation</strong>: TTL for what may be stale, explicit invalidation (across instances) for what may not, nothing in the cache for what must never be stale.</li>
        <li><strong>Treat the cache as optional</strong>: the system must stay correct (if slower) with an empty cache — after every deploy, it is.</li>
      </ol>

      <h2>Glossary</h2>
      <p>Every term this module uses, with a link to the lesson that explains it.</p>
      <ProductionGlossary />

      <Recap
        points={[
          `recordStats() gives Caffeine hit rate, loads, load penalty and evictions (recorded hit rate ${pct(s.hitRate)}); lru-cache and moka need a small counting wrapper.`,
          'Micrometer exports Caffeine’s statistics as cache.gets{result}, cache.puts, cache.evictions, cache.load… — alert on rates, not totals.',
          `Micronaut @Cacheable is not atomic by default (recorded: ${mnStampede[0].methodCalls} method calls for ${mnStampede[0].callers} misses) and @CacheInvalidate keys on all parameters unless told otherwise.`,
          'All three libraries do millions of operations per second on one thread; choose by language and features.',
          'The recorded pitfalls: unbounded caches, shared mutable values, keys without equality, low reuse, stale data across instances.',
        ]}
      />
    </>
  )
}
