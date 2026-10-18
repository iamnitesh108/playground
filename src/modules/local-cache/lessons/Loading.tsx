import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { LoadingFlightPlayground } from '../components/LoadingFlightPlayground'
import { MemoryLineChart } from '../components/MemoryLineChart'
import { all, one, versions } from '../data/runtimeQuery'
import { BULK, LANG_INFO, LANGS, LOADING, REFRESH, SETUP, SYNCHRONIZED_LRU, type Excerpt, type Lang } from '../data/runtimeSources'
import type { AbsentEvent, BenchEvent, FailureEvent, RefreshEvent, StampedeEvent, ThroughputEvent } from '../data/runtimeTypes'

// ---------- the recording ----------
const APP: Record<Lang, 'java' | 'ts' | 'rust'> = { java: 'java', ts: 'ts', rust: 'rust' }
const stampede = (lang: Lang, mode: string) => one<StampedeEvent>(APP[lang], 'stampede', mode)
const SINGLE_FLIGHT_MODE: Record<Lang, string> = { java: 'get(key, loader)', ts: 'fetch()', rust: 'get_with' }
const FAILURE_MODE: Record<Lang, string> = { java: 'get(key, loader)', ts: 'fetch()', rust: 'try_get_with' }
const failure = (lang: Lang, mode = FAILURE_MODE[lang]) => one<FailureEvent>(APP[lang], 'failure', mode)
const asyncFailure = failure('java', 'AsyncCache')
const absent = (lang: Lang) => one<AbsentEvent>(APP[lang], 'absent')
const recursive = (lang: Lang) => String(one<{ result: string }>(APP[lang], 'recursive').result)
const recursiveTs = one<{ result: string; fetchMethodCalls: number }>('ts', 'recursive')
const bulk = one<{ bulkCalls: string[][]; requested: number }>('java', 'bulk')
const refreshOf = (app: 'java' | 'ts', mode: string) => one<RefreshEvent>(app, 'refresh', mode)
const javaAsync = stampede('java', 'AsyncCache')
const rustFuture = stampede('rust', 'future::Cache get_with')
const throughput = (app: 'java' | 'rust', lib: string) => all<ThroughputEvent>(app, 'throughput', (e) => e.lib === lib)
const nodeGetOps = all<BenchEvent>('ts', 'bench', (e) => e.lib === 'lru-cache' && e.op === 'get')[0]

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]
const ms = (v: number) => (v < 1 ? `${v.toFixed(2)} ms` : `${Math.round(v)} ms`)
const millions = (v: number) => (v === 0 ? '0' : `${(v / 1e6).toFixed(v < 1e7 ? 1 : 0)} M`)
const at = (lang: Lang, n: number) => throughput(lang === 'rust' ? 'rust' : 'java', lang === 'rust' ? 'moka' : 'Caffeine').find((t) => t.threads === n)!

function Excerpts({ items, lang }: { items: readonly Excerpt[]; lang: Lang }) {
  return (
    <>
      {items.map((e) => (
        <CodeBlock key={e.code} title={`${e.file} (the code that ran)`} language={LANG_INFO[lang].language} code={e.code} />
      ))}
    </>
  )
}

const codeTabs = (pick: Record<Lang, readonly Excerpt[]>) =>
  LANGS.map((lang) => ({ label: LANG_INFO[lang].label, content: <Excerpts items={pick[lang]} lang={lang} /> }))

/** A recorded failure as lanes: every caller's wait, the loads it ran, and the error it got. */
function FailureTimeline({ event, title }: { event: FailureEvent; title: string }) {
  const waits = [...event.waits].sort((a, b) => a - b)
  const loadMs = 100
  const serial = event.loaderCalls > 1
  return (
    <Timeline
      title={title}
      lanes={[{ id: 'src', label: 'database' }, ...waits.map((_, i) => ({ id: `c${i}`, label: `caller ${i + 1}` }))]}
      end={Math.ceil(Math.max(...waits) / 100) * 100 + 50}
      unit="ms"
      segments={[
        ...(serial
          ? waits.map((w) => ({ lane: 'src', from: w - loadMs, to: w, hue: 5 as const }))
          : [{ lane: 'src', from: 0, to: loadMs, hue: 5 as const, label: '1 load' }]),
        ...waits.flatMap((w, i) => [
          ...(w - loadMs > 2 ? [{ lane: `c${i}`, from: 0, to: serial ? w - loadMs : w, hue: 1 as const, striped: true }] : []),
          ...(serial || i === 0 ? [{ lane: `c${i}`, from: w - loadMs, to: w, hue: 5 as const, label: 'loads' }] : []),
        ]),
      ]}
      events={waits.map((w, i) => ({ lane: `c${i}`, at: w, label: 'error', hue: 8 as const }))}
    />
  )
}

const FAILURE_TABS: { label: string; event: FailureEvent }[] = [
  { label: 'Caffeine Cache.get', event: failure('java') },
  { label: 'Caffeine AsyncCache', event: asyncFailure },
  { label: 'lru-cache fetch()', event: failure('ts') },
  { label: 'moka try_get_with', event: failure('rust') },
]

/** Recorded reads around expiry: which reads had to wait, and when the value changed. */
function RefreshTimeline({ app, modes, title }: { app: 'java' | 'ts'; modes: [string, string]; title: string }) {
  const runs = modes.map((m) => refreshOf(app, m))
  const end = Math.max(...runs.flatMap((r) => r.reads.map((x) => x.atMs + x.tookMs))) + 60
  return (
    <Timeline
      title={title}
      lanes={runs.map((r) => ({ id: r.mode, label: r.mode }))}
      end={Math.ceil(end / 100) * 100}
      unit="ms"
      segments={runs.flatMap((r) => r.reads.filter((x) => x.tookMs > 20).map((x) => ({ lane: r.mode, from: x.atMs, to: x.atMs + x.tookMs, hue: 8 as const, striped: true })))}
      events={runs.flatMap((r) =>
        r.reads
          .filter((x, i) => i === 0 || x.value !== r.reads[i - 1].value)
          .map((x) => ({ lane: r.mode, at: x.atMs + x.tookMs, label: x.value, hue: 6 as const })),
      )}
    />
  )
}

export default function Loading() {
  const jNaive = stampede('java', 'naive')
  const jSf = stampede('java', SINGLE_FLIGHT_MODE.java)
  const sync = failure('java')
  const syncWaits = [...sync.waits].sort((a, b) => a - b)
  const expire = refreshOf('java', 'expireAfterWrite')
  const refresh = refreshOf('java', 'refreshAfterWrite')
  const slowest = (r: RefreshEvent) => Math.max(...r.reads.slice(1).map((x) => x.tookMs))
  const lruAt = (n: number) => throughput('java', 'synchronized LinkedHashMap (LRU)').find((t) => t.threads === n)!
  const mutexAt = (n: number) => throughput('rust', 'Mutex<lru::LruCache>').find((t) => t.threads === n)!
  const chmAt = (n: number) => throughput('java', 'ConcurrentHashMap (no bound, no policy)').find((t) => t.threads === n)!
  return (
    <>
      <LessonGoals
        goals={[
          'explain the stampede that a popular missing key causes, and how single-flight turns many loads into one',
          'predict what Caffeine, lru-cache and moka do when the loader throws or finds nothing',
          'choose between blocking and async loading, bulk loads, and refresh-ahead',
          'avoid the recursive-load deadlock',
          'explain how Caffeine and moka stay fast with many threads, and why lru-cache needs no locks',
        ]}
        before={<>Using it day to day (<a href="#/local-cache/using">#/local-cache/using</a>) for get-with-loader; Expiry and refresh (<a href="#/local-cache/expiry">#/local-cache/expiry</a>); threads or async/await in your language.</>}
      />

      <h2>One miss, many callers</h2>
      <p>When a popular key is missing, everyone who asks for it at that moment misses together.</p>
      <p>
        A product page goes viral, or its entry just expired, and 50 requests arrive within a few milliseconds. With the plain
        “look, and on a miss load and put” code, all 50 see the miss before the first load finishes, so all 50 run the query. This is a{' '}
        <strong>cache stampede</strong> (also called a thundering herd or dog-piling), and it hits the database exactly when the key is most wanted.
      </p>
      <Flow
        title="The same 50 requests, without and with single-flight"
        cols={4}
        rows={3}
        rowHeight={78}
        nodes={[
          { id: 'a', label: 'request A', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'b', label: 'request B', col: 0, row: 1, hue: 2, shape: 'actor' },
          { id: 'n', label: 'requests C…', sub: '48 more', col: 0, row: 2, hue: 2, shape: 'actor' },
          { id: 'cache', label: 'cache', sub: 'product:42 missing', col: 1, row: 1, span: 2, hue: 3 },
          { id: 'db', label: 'database', sub: '200 ms per query', col: 3, row: 1, hue: 5, shape: 'store' },
        ]}
        edges={[
          { from: 'a', to: 'cache', hue: 1, flow: true },
          { from: 'b', to: 'cache', hue: 2, flow: true },
          { from: 'n', to: 'cache', hue: 2, flow: true },
          { from: 'cache', to: 'db', label: 'load', hue: 5, flow: true },
        ]}
        steps={[
          { title: 'Everyone misses', body: <p>A, B and the 48 others look up product:42 within the same few milliseconds. Nothing is cached yet, so all of them miss.</p>, active: ['a', 'b', 'n', 'cache', 'a>cache', 'b>cache', 'n>cache'] },
          { title: 'Without single-flight: 50 loads', body: <p>Each request runs its own query. The database gets 50 identical queries at once; every request waits about as long as one query, but the database does 50 times the work.</p>, active: ['a', 'b', 'n', 'cache', 'db', 'a>cache', 'b>cache', 'n>cache', 'cache>db'] },
          { title: 'With single-flight: 1 load, 49 waiters', body: <p>A’s miss starts the load and marks it as in flight. B and the others find the in-flight load and wait for its result instead of starting their own. One query; all 50 get the value at about the same time.</p>, active: ['a', 'cache', 'db', 'a>cache', 'cache>db'] },
        ]}
        caption="Single-flight (also: request coalescing, load deduplication) is per process: ten instances can still send ten queries."
      />
      <TermList
        items={[
          { term: 'cache stampede', definition: 'Many concurrent misses for the same key, each loading it from the source at the same time.' },
          { term: 'loader', definition: 'The function the cache calls to get a missing value: a query, an HTTP call, a computation.' },
          { term: 'single-flight', definition: 'Only one load per key runs at a time; other callers for that key wait for its result.' },
          { term: 'in-flight load', definition: 'A load that has started and not finished; in an async cache it is a future or promise others can wait on.' },
          { term: 'negative caching', definition: 'Caching “not found” (or an error) for a short time, so missing keys do not hit the source on every read.' },
          { term: 'refresh-ahead', definition: 'Reloading an entry in the background before it expires, while readers keep getting the old value.' },
        ]}
      />
      <Callout tone="analogy" title="One person goes to the counter">
        <p>
          A table of friends all want the same dish that is not ready. Without single-flight, everyone walks to the counter and orders it. With
          single-flight, one goes, the others wait at the table, and the one plate is shared when it arrives.
        </p>
      </Callout>

      <h2>Recorded: 50 callers, one cold key</h2>
      <p>Each app started 50 callers at the same moment on one missing key whose loader takes {jSf.loaderMs} ms.</p>
      <Predict
        question={<p>50 threads call Caffeine’s <code>cache.get(key, loader)</code> at the same moment; the loader takes 200 ms. How many times does the loader run, and about how long does the 50th thread wait?</p>}
        options={['50 times; each thread waits about 200 ms', 'Once; the 50th thread waits about 200 ms', 'Once; the 50th thread waits about 50 × 200 ms', '50 times, one after another']}
        answer={1}
        explanation={`Recorded: ${jSf.loaderCalls} loader call; the waits were all between ${ms(Math.min(...jSf.waits))} and ${ms(Math.max(...jSf.waits))}. The other 49 threads block on the key until the one load finishes, then all read the same value.`}
      />
      <BarChart
        title={`Loader calls for ${jSf.callers} concurrent callers (recorded)`}
        bars={[
          { label: 'Caffeine, check-load-put', value: jNaive.loaderCalls, hue: 8 },
          { label: 'Caffeine get(key, loader)', value: jSf.loaderCalls, hue: 6 },
          { label: 'Caffeine AsyncCache', value: javaAsync.loaderCalls, hue: 6, note: `${javaAsync.distinctFutures} CompletableFuture shared by all callers` },
          { label: 'lru-cache, check-load-set', value: stampede('ts', 'naive').loaderCalls, hue: 8 },
          { label: 'lru-cache fetch()', value: stampede('ts', 'fetch()').loaderCalls, hue: 6 },
          { label: 'moka, check-load-insert', value: stampede('rust', 'naive').loaderCalls, hue: 8 },
          { label: 'moka get_with (threads)', value: stampede('rust', 'get_with').loaderCalls, hue: 6 },
          { label: 'moka future get_with (tasks)', value: rustFuture.loaderCalls, hue: 6 },
        ]}
      />
      <Timeline
        title={`Recorded (Caffeine): who waited for what, ${jSf.callers} callers`}
        lanes={[
          { id: 'db1', label: 'naive: database' },
          { id: 'naive', label: 'naive: callers' },
          { id: 'db2', label: 'single-flight: database' },
          { id: 'sf', label: 'single-flight: callers' },
        ]}
        end={Math.ceil(Math.max(...jNaive.waits, ...jSf.waits) / 50) * 50 + 40}
        unit="ms"
        segments={[
          { lane: 'db1', from: 0, to: jNaive.loaderMs, hue: 8, striped: true, label: `${jNaive.loaderCalls} identical queries at once` },
          { lane: 'naive', from: 0, to: median(jNaive.waits), hue: 5, label: `all ${jNaive.loaderCalls} callers load` },
          { lane: 'db2', from: 0, to: jSf.loaderMs, hue: 5, label: `${jSf.loaderCalls} query` },
          { lane: 'sf', from: 0, to: median(jSf.waits), hue: 1, striped: true, label: `1 caller loads, ${jSf.callers - 1} wait` },
        ]}
        events={[
          { lane: 'naive', at: median(jNaive.waits), label: `median ${ms(median(jNaive.waits))}`, hue: 6 },
          { lane: 'sf', at: median(jSf.waits), label: `median ${ms(median(jSf.waits))}`, hue: 6 },
        ]}
      />
      <p>
        The wait is the same — about one load — but the database did {jNaive.loaderCalls} times less work. The library does the waiting for you:
      </p>
      <Tabs items={codeTabs({ java: [...LOADING.naive.java, ...LOADING.singleflight.java], ts: [...LOADING.naive.ts, ...LOADING.singleflight.ts], rust: [...LOADING.naive.rust, ...LOADING.singleflight.rust] })} />
      <Table
        head={['', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['single-flight call', <code key="j">cache.get(key, k -&gt; load(k))</code>, <code key="t">cache.fetch(key)</code>, <code key="r">cache.get_with(key, || load())</code>],
          ['where the loader is set', 'at the call (or once, in build(loader) for a LoadingCache)', 'once, as fetchMethod in the options', 'at the call'],
          ['how others wait', 'block on the key (ConcurrentHashMap.compute)', 'await the same in-flight promise', 'block (sync) or .await (future) on a per-key lock'],
          ['plain get + put', 'no coalescing', 'no coalescing', 'no coalescing'],
        ]}
      />
      <Callout tone="warn" title="Blocking compute holds the key">
        <p>
          Caffeine’s <code>get(key, loader)</code> runs the loader inside <code>ConcurrentHashMap.compute</code>. Its documentation asks for
          a loader that is “short and simple”: some updates by other threads may be blocked while it runs. Give the loader a timeout, and use an
          async cache when loads are slow.
        </p>
      </Callout>

      <h2>When the loader fails</h2>
      <p>A failed load caches nothing, but who sees the error — and how often the loader runs — differs.</p>
      <Predict
        question={<p>10 threads call Caffeine’s <code>cache.get(key, loader)</code> at once. The loader throws after 100 ms. How long does the slowest thread wait?</p>}
        options={['About 100 ms: they all get the one error', 'About 1,000 ms: each waiting thread runs the loader again, one after another', 'Forever: the key stays locked']}
        answer={1}
        explanation={`Recorded: ${sync.loaderCalls} loader calls and waits of ${syncWaits.map((w) => Math.round(w)).join(', ')} ms. When a compute throws, nothing is stored; the next blocked thread finds no value and runs its own loader — so a failing, slow dependency turns into one slow failure per waiting thread.`}
      />
      <p>In the timelines, a striped bar is a caller waiting, a pink bar a loader call running, and a red dot the moment the caller got the error.</p>
      <Tabs items={FAILURE_TABS.map((t) => ({ label: t.label, content: <FailureTimeline event={t.event} title={`Recorded: ${t.event.callers} callers, a loader that throws after 100 ms (${t.label})`} /> }))} />
      <Table
        head={['Library and call', 'Loader calls (10 callers)', 'Callers that got the error', 'Slowest caller', 'Cached after?']}
        rows={FAILURE_TABS.map((t) => [
          t.label,
          t.event.loaderCalls,
          `${t.event.errors}${t.event.sameErrorArc ? ' (the same Arc, shared)' : ''}`,
          ms(Math.max(...t.event.waits)),
          t.event.cachedAfter ? 'yes' : 'no — the next call loads again',
        ])}
      />
      <p>
        The shared-result caches (Caffeine’s <code>AsyncCache</code>, lru-cache’s <code>fetch()</code>, moka’s <code>try_get_with</code>) give
        every waiter the one failure and then forget it. Recorded error texts: <code>{asyncFailure.error}</code> (Caffeine async),{' '}
        <code>{failure('ts').error}</code> (lru-cache), <code>{failure('rust').error}</code> (moka).
      </p>
      <Tabs items={codeTabs(LOADING.failing)} />
      <Callout tone="tip" title="Failing fast under a stampede">
        <p>
          Nothing is cached after a failure, so the next request tries again. If the source is down that means a load attempt per request. Put a
          timeout on the loader, a circuit breaker in front of the source, and consider caching the failure for a second or two (negative caching,
          next section). lru-cache can also serve the old value when a refresh fails: <code>allowStaleOnFetchRejection</code>.
        </p>
      </Callout>

      <h2>Keys that do not exist</h2>
      <p>A key with no value in the source is a miss every time, unless you cache the “nothing”.</p>
      <p>
        Caffeine does not store <code>null</code>, lru-cache does not store <code>undefined</code>, and moka’s <code>optionally_get_with</code>{' '}
        does not store <code>None</code>. That is usually right — but a missing product requested 1,000 times a second is 1,000 queries a
        second. Wrapping the answer (<code>Optional</code>, a sentinel, <code>Option&lt;V&gt;</code> as the value) caches the absence too.
      </p>
      <BarChart
        title="Loader calls for 3 reads of a product that does not exist (recorded)"
        bars={LANGS.flatMap((lang) => [
          { label: `${LANG_INFO[lang].library}: ${lang === 'java' ? 'null' : lang === 'ts' ? 'undefined' : 'None'}`, value: absent(lang).nullLoaderCalls, hue: 8 as const },
          { label: `${LANG_INFO[lang].library}: ${lang === 'java' ? 'Optional.empty()' : lang === 'ts' ? 'sentinel value' : 'Option<V> value'}`, value: absent(lang).optionalLoaderCalls, hue: 6 as const },
        ])}
      />
      <Tabs items={codeTabs(LOADING.absent)} />
      <Callout tone="tip" title="Short TTL for “not found”">
        <p>
          A cached absence hides a product that is created a second later. Give negative entries a much shorter lifetime than real ones —
          Caffeine’s per-entry <code>expireAfter(Expiry)</code>, lru-cache’s <code>ttl</code> option on <code>set</code>, moka’s{' '}
          <code>expire_after</code> (see <a href="#/local-cache/expiry">Expiry and refresh</a>). Attackers can also request millions of random
          missing ids: a size bound protects the cache, and a short TTL keeps those entries from crowding out real ones for long.
        </p>
      </Callout>

      <h2>Loading many keys at once</h2>
      <p>A page that shows 50 products should not run 50 queries for the ones that are missing.</p>
      <Flow
        title={`Recorded (Caffeine LoadingCache): getAll of ${bulk.requested} keys, 2 already cached`}
        cols={4}
        rows={2}
        nodes={[
          { id: 'call', label: 'getAll(1…5)', sub: 'one call', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'cache', label: 'cache', sub: 'has 1 and 2', col: 1, row: 0, hue: 3 },
          { id: 'loader', label: 'loadAll', sub: bulk.bulkCalls[0].map((k) => k.replace('product:', '')).join(', '), col: 2, row: 0, hue: 5 },
          { id: 'db', label: 'database', sub: '1 query: id IN (…)', col: 3, row: 0, hue: 5, shape: 'store' },
          { id: 'out', label: `${bulk.requested} values`, sub: '2 hits + 3 loaded', col: 1, row: 1, hue: 6, shape: 'actor' },
        ]}
        edges={[
          { from: 'call', to: 'cache', hue: 1, flow: true },
          { from: 'cache', to: 'loader', label: 'misses', hue: 5 },
          { from: 'loader', to: 'db', hue: 5 },
          { from: 'cache', to: 'out', hue: 6 },
        ]}
        caption={`The recording: loadAll was called ${bulk.bulkCalls.length} time, with ${JSON.stringify(bulk.bulkCalls[0])}.`}
      />
      <CodeBlock title={`${BULK.file} — a LoadingCache with a bulk loader (the code that ran)`} language="java" code={BULK.code} />
      <Table
        head={['', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['bulk read', 'getAll(keys) on Cache / LoadingCache / AsyncCache', 'none: Promise.all(keys.map((k) => cache.fetch(k)))', 'none: get_with per key'],
          ['one query for the misses', 'yes: override CacheLoader.loadAll', 'only with your own batching (e.g. a DataLoader-style batcher as fetchMethod)', 'only with your own batching'],
          ['single-flight per key', 'yes', 'yes, each fetch()', 'yes, each get_with'],
        ]}
      />

      <h2>Async caches: futures instead of blocked threads</h2>
      <p>An async cache stores the in-flight load itself, so waiting costs a future, not a thread.</p>
      <p>
        Caffeine’s <code>AsyncCache</code> maps each key to a <code>CompletableFuture</code>: the first caller puts the future in, everyone else
        gets the same future (recorded: {javaAsync.distinctFutures} distinct future for {javaAsync.callers} callers). The load runs on an
        executor — by default <code>ForkJoinPool.commonPool()</code> — and a future that completes exceptionally is removed. lru-cache is async
        by nature: <code>fetch()</code> returns a promise. moka has a separate <code>moka::future::Cache</code> whose <code>get_with</code>{' '}
        takes an async block; recorded with {rustFuture.callers} tokio tasks: {rustFuture.loaderCalls} load.
      </p>
      <Table
        head={['', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['blocking API', 'Cache, LoadingCache', '— (get/set are synchronous, but never wait for a load)', 'moka::sync::Cache'],
          ['async API', 'AsyncCache, AsyncLoadingCache (CompletableFuture)', 'fetch() with fetchMethod (Promise)', 'moka::future::Cache (async/await)'],
          ['a waiting caller costs', 'a blocked thread (sync) or a callback (async)', 'a pending promise', 'a blocked thread (sync) or a suspended task (future)'],
          ['recorded loader calls, 50 callers', `${jSf.loaderCalls} (sync), ${javaAsync.loaderCalls} (async)`, stampede('ts', 'fetch()').loaderCalls, `${stampede('rust', 'get_with').loaderCalls} (sync), ${rustFuture.loaderCalls} (future)`],
        ]}
      />
      <Callout tone="note" title="Which to use">
        <p>
          In a reactive or async server (Netty, Node.js, tokio) use the async cache: a blocked event-loop thread blocks every request on it. In a
          thread-per-request server the sync API is simpler. Micronaut’s <code>@Cacheable</code> caches methods that return a{' '}
          <code>CompletableFuture</code> or a reactive <code>Publisher</code> asynchronously, and all others synchronously.
        </p>
      </Callout>

      <h2>Refresh-ahead instead of blocking</h2>
      <p>With expiry, the first reader after the deadline waits for the load; with refresh, nobody does.</p>
      <p>
        Both runs read one key every 100 ms; the loader takes {expire.loaderMs} ms and the entry gets old after {expire.afterMs} ms. With{' '}
        <code>expireAfterWrite</code> the expired entry is gone, so a reader waits for a new load. With <code>refreshAfterWrite</code> the first
        read after the deadline starts a reload in the background and still returns the old value at once. (The details, and how expiry is
        scheduled, are in <a href="#/local-cache/expiry">Expiry and refresh</a>.)
      </p>
      <RefreshTimeline app="java" modes={['expireAfterWrite', 'refreshAfterWrite']} title="Recorded (Caffeine): reads that waited (striped) and when the value changed" />
      <StatTiles
        stats={[
          { label: 'slowest read, expireAfterWrite', value: ms(slowest(expire)), sub: 'a reader paid for the reload', hue: 8 },
          { label: 'slowest read, refreshAfterWrite', value: ms(slowest(refresh)), sub: 'the reload ran in the background', hue: 6 },
          { label: 'slowest read, lru-cache ttl + allowStale', value: ms(slowest(refreshOf('ts', 'ttl + allowStale'))), sub: `plain ttl: ${ms(slowest(refreshOf('ts', 'ttl')))}`, hue: 6 },
        ]}
      />
      <Tabs
        items={[
          { label: LANG_INFO.java.label, content: <CodeBlock title={`${REFRESH.java.file} (the code that ran)`} language="java" code={REFRESH.java.code} /> },
          { label: LANG_INFO.ts.label, content: <><CodeBlock title={`${REFRESH.ts.file} (the code that ran)`} language="ts" code={REFRESH.ts.code} /><RefreshTimeline app="ts" modes={['ttl', 'ttl + allowStale']} title="Recorded (lru-cache): ttl alone vs ttl + allowStale with fetch()" /></> },
          { label: LANG_INFO.rust.label, content: <p>moka {versions.moka} has no refresh: its source has no refresh option (checked in the crate). Keep a TTL and refresh hot keys yourself — for example a task that re-inserts them before they expire — or accept the occasional blocked read (single-flight still makes it one load).</p> },
        ]}
      />
      <Callout tone="note" title="Refresh needs traffic">
        <p>
          Caffeine refreshes only when an entry is read after the refresh time; an entry nobody reads is not reloaded, and it still expires if you
          also set <code>expireAfterWrite</code>. Combine them: refresh after 1 minute, expire after 10, so hot keys stay fresh and cold ones leave.
        </p>
      </Callout>

      <h2>Do not load recursively</h2>
      <p>A loader that reads the same cache for the same key is waiting for itself.</p>
      <p>
        Building a product page might call the cache for the category, which calls the cache for the product… and if that chain comes back to a
        key that is being loaded, the load waits for itself. Each library was given a loader that asks the cache for its own key:
      </p>
      <Table
        head={['Library', 'Recorded result', 'Why']}
        rows={[
          ['Caffeine (get inside get)', <code key="j">{recursive('java')}</code>, 'ConcurrentHashMap detects a compute that re-enters itself and throws; Caffeine documents it (IllegalStateException for a detectable recursive update).'],
          ['moka (get_with inside get_with)', recursive('rust'), 'the inner call waits for the per-key lock that the outer call holds: a deadlock'],
          ['lru-cache (fetch inside fetchMethod)', `${recursiveTs.result} — after ${recursiveTs.fetchMethodCalls.toLocaleString()} fetchMethod calls`, 'each inner fetch() replaced the outer one and started a new fetchMethod, until the stack overflowed (RangeError) and the first promise was rejected'],
        ]}
      />
      <Tabs items={codeTabs(LOADING.recursive)} />
      <Callout tone="warn" title="Keep loaders independent">
        <p>
          Caffeine’s documentation says the loader “must not attempt to update any other mappings of this cache”. Load what you need first,
          outside the loader, or keep the two kinds of data in two caches. With a different key in the same cache, the recursion may work or hang
          depending on hash placement — do not rely on it.
        </p>
      </Callout>

      <h2>How they stay fast with many threads</h2>
      <p>A read must update the eviction policy, and doing that under one lock would serialise every thread.</p>
      <p>
        An LRU moves an entry to the front on every read, so a naive LRU writes shared state on every read. The classic Java version — a{' '}
        <code>LinkedHashMap</code> in access order behind <code>Collections.synchronizedMap</code> — takes one lock per read:
      </p>
      <CodeBlock title={`${SYNCHRONIZED_LRU.file} — the hand-made LRU used as the baseline`} language="java" code={SYNCHRONIZED_LRU.code} />
      <Flow
        title="Caffeine’s read and write paths (from its source)"
        cols={5}
        rows={3}
        rowHeight={80}
        nodes={[
          { id: 'ta', label: 'thread A', sub: 'get', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'tb', label: 'thread B', sub: 'put', col: 0, row: 2, hue: 2, shape: 'actor' },
          { id: 'map', label: 'ConcurrentHashMap', sub: 'the data', col: 1, row: 1, span: 2, hue: 3, shape: 'store' },
          { id: 'rb', label: 'read buffers', sub: 'striped rings, lossy', col: 2, row: 0, span: 2, hue: 7, shape: 'queue' },
          { id: 'wb', label: 'write buffer', sub: 'bounded queue', col: 2, row: 2, span: 2, hue: 7, shape: 'queue' },
          { id: 'pol', label: 'policy', sub: 'one lock', col: 4, row: 1, hue: 7 },
        ]}
        edges={[
          { from: 'ta', to: 'map', label: 'lookup', hue: 1 },
          { from: 'ta', to: 'rb', label: 'record', hue: 1, flow: true },
          { from: 'tb', to: 'map', label: 'put', hue: 2 },
          { from: 'tb', to: 'wb', label: 'record', hue: 2, flow: true },
          { from: 'rb', to: 'pol', label: 'drain', hue: 7, dashed: true },
          { from: 'wb', to: 'pol', label: 'drain', hue: 7, dashed: true },
        ]}
        steps={[
          { title: 'A read is a hash-map lookup', body: <p>The value comes straight from a <code>ConcurrentHashMap</code>: reads take no lock. The policy is not touched yet.</p>, active: ['ta', 'map', 'ta>map'] },
          { title: 'The read is recorded in a buffer', body: <p>“Key k was read” goes into one of several small ring buffers (16 slots each; the number of stripes grows with contention, up to 4 × the CPU count rounded to a power of two). If the buffer is full or contended, the record is simply dropped: the policy is a little less exact, nobody waits.</p>, active: ['ta', 'rb', 'ta>rb'] },
          { title: 'Writes are recorded too, but never dropped', body: <p>A put changes the map at once and queues “added k” in a bounded write buffer. Writes matter for correctness (size, eviction), so they are not lossy; if the buffer stays full, the writer does the maintenance itself.</p>, active: ['tb', 'map', 'wb', 'tb>map', 'tb>wb'] },
          { title: 'Maintenance drains in batches', body: <p>After a write, or when a read buffer fills, one thread takes the policy lock with <code>tryLock</code> and replays the buffered events into the policy: reorders queues, updates the frequency sketch, evicts, expires. By default this runs on <code>ForkJoinPool.commonPool()</code>. Everyone else carries on.</p>, active: ['rb', 'wb', 'pol', 'rb>pol', 'wb>pol'] },
        ]}
        caption="The design follows the BP-Wrapper paper cited in Caffeine’s source: batch the policy updates and take the lock once per batch, not once per read."
      />
      <p>
        moka {versions.moka} has the same shape (read in its source): a lock-free concurrent hash table, bounded channels that log reads and
        writes (a read record is discarded when the channel is full), and housekeeping that applies the logs to the policy when a thread wins a{' '}
        <code>try_lock</code> — run on the calling threads, as moka 0.12 starts no background threads. lru-cache needs none of this: your
        JavaScript runs on one thread, so a <code>get</code> can move the entry in its linked list directly, without locks.
      </p>
      <Tabs
        items={[
          {
            label: 'Java · Caffeine',
            content: (
              <MemoryLineChart
                title={`Reads per second by threads (recorded, ${versions.cores} cores)`}
                xLabel="threads reading at once"
                yLabel="reads / s"
                formatY={millions}
                series={[
                  { label: 'Caffeine', hue: 6, points: throughput('java', 'Caffeine').map((t) => [t.threads, t.readsPerSec] as const) },
                  { label: 'synchronized LinkedHashMap (LRU)', hue: 8, points: throughput('java', 'synchronized LinkedHashMap (LRU)').map((t) => [t.threads, t.readsPerSec] as const) },
                ]}
                caption="Median of 5 runs of 200 ms after a warm-up; 65,536 keys, all hits, Zipf popularity. One machine, other work running."
              />
            ),
          },
          {
            label: 'Rust · moka',
            content: (
              <MemoryLineChart
                title={`Reads per second by threads (recorded, ${versions.cores} cores)`}
                xLabel="threads reading at once"
                yLabel="reads / s"
                formatY={millions}
                series={[
                  { label: 'moka', hue: 6, points: throughput('rust', 'moka').map((t) => [t.threads, t.readsPerSec] as const) },
                  { label: 'Mutex<lru::LruCache>', hue: 8, points: throughput('rust', 'Mutex<lru::LruCache>').map((t) => [t.threads, t.readsPerSec] as const) },
                ]}
                caption="Median of 5 runs of 200 ms after a warm-up; the same keys and trace as the Java run."
              />
            ),
          },
          {
            label: 'TypeScript · lru-cache',
            content: (
              <p>
                One thread runs your JavaScript, so there is no “threads” axis: recorded {millions(nodeGetOps.opsPerSec)} gets per second on that
                thread (same keys and trace). To use more cores, Node runs more processes or worker threads — each with its own cache, which is
                the same situation as several app instances.
              </p>
            ),
          },
        ]}
      />
      <Table
        head={['Reads/s (recorded)', '1 thread', '2 threads', '4 threads', '8 threads']}
        rows={[
          ['Caffeine', ...[1, 2, 4, 8].map((n) => millions(at('java', n).readsPerSec))],
          ['synchronized LinkedHashMap (LRU)', ...[1, 2, 4, 8].map((n) => millions(lruAt(n).readsPerSec))],
          ['ConcurrentHashMap (no bound, no policy: the ceiling)', ...[1, 2, 4, 8].map((n) => millions(chmAt(n).readsPerSec))],
          ['moka', ...[1, 2, 4, 8].map((n) => millions(at('rust', n).readsPerSec))],
          ['Mutex<lru::LruCache>', ...[1, 2, 4, 8].map((n) => millions(mutexAt(n).readsPerSec))],
        ]}
      />
      <p>
        With one thread the single-lock LRU is the fastest of the bounded caches here — an uncontended lock is cheap. From two threads on it gets{' '}
        <em>slower</em> as threads are added, because every read now fights for the lock, while Caffeine and moka keep scaling.
        {at('java', 2).readsPerSec > 2 * at('java', 1).readsPerSec &&
          ' Caffeine’s jump from 1 to 2 threads is larger than 2×; one likely reason is that its read buffers start dropping records under contention, so each read does less policy work.'}{' '}
        Treat the absolute numbers as this machine’s; the shape is the lesson.
      </p>

      <h2>Playground: single-flight</h2>
      <p>The model behind the timelines above, with the three ways of loading as interchangeable strategies.</p>
      <LoadingFlightPlayground />
      <p>Things to try:</p>
      <ul>
        <li>naive with 12 callers arriving within 0 ms: 12 loads. Spread them over 400 ms with a 200 ms loader: the late ones hit.</li>
        <li>blocking compute, then make the loader throw: the slowest caller waits callers × loader time — the recorded Caffeine timeline.</li>
        <li>shared result with a failing loader: one load, every waiter gets the error at the same moment, and a caller arriving after it starts a new load.</li>
      </ul>
      <p>
        How close is the model? For 10 simultaneous callers and a 100 ms failing loader it predicts waits of 100, 200, … 1,000 ms for blocking
        compute (recorded: {syncWaits.map((w) => Math.round(w)).join(', ')} ms) and 100 ms for everyone with a shared result (recorded max:{' '}
        {ms(Math.max(...failure('ts').waits))} lru-cache, {ms(Math.max(...failure('rust').waits))} moka). It leaves out thread start-up and
        scheduling, which add a few milliseconds.
      </p>

      <h2>Design rules</h2>
      <ul>
        <li>Load through the cache: <code>get(key, loader)</code>, <code>fetch()</code>, <code>get_with</code>. Never “get, then load, then put” for anything popular.</li>
        <li>Give loaders a timeout. A slow source plus single-flight means every waiter waits as long as the slowest load.</li>
        <li>With Caffeine’s blocking <code>get</code>, a failing loader runs once per waiting thread, in a row; use <code>AsyncCache</code> for slow or flaky sources.</li>
        <li>Cache “not found” on purpose (Optional, sentinel, Option) with a short TTL, and bound the cache so random missing keys cannot fill it.</li>
        <li>Prefer one bulk query for the misses of a multi-key read (Caffeine <code>getAll</code> + <code>loadAll</code>; elsewhere a batcher).</li>
        <li>Use refresh (Caffeine <code>refreshAfterWrite</code>, lru-cache <code>allowStale</code> with fetch) for hot keys whose loads are slow, and keep an expiry as the upper bound.</li>
        <li>Never call the same cache from inside its own loader.</li>
        <li>Under many threads, use a concurrent cache (Caffeine, moka), not a map behind one lock.</li>
      </ul>
      <Tabs items={LANGS.map((lang) => ({ label: LANG_INFO[lang].label, content: <CodeBlock title={SETUP[lang].title} language={SETUP[lang].language} code={SETUP[lang].code} /> }))} />

      <Recap
        points={[
          `A popular missing key causes a stampede; single-flight makes it one load — recorded: ${jNaive.loaderCalls} loads became ${jSf.loaderCalls} in all three libraries.`,
          'A failed load is not cached. Shared-result caches give every waiter the same error; Caffeine’s blocking get runs the failing loader again for each waiting thread, one after another.',
          'null / undefined / None are not cached; wrap “not found” to cache it, with a short TTL.',
          'Async caches share a future or promise; refresh-ahead serves the old value while reloading; moka 0.12 has no refresh.',
          'A loader must not call its own cache: Caffeine throws “Recursive update”, moka deadlocks, lru-cache recurses until the stack overflows.',
          'Caffeine and moka record reads in lossy buffers and update the policy in batches under a try-lock, so they scale with threads where a single-lock LRU gets slower.',
        ]}
      />
    </>
  )
}
