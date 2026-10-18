import { BarChart, Flow, Proportion, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { TieredPlayground } from '../components/TieredPlayground'
import { TieredTrace, type TraceStep } from '../components/TieredTrace'
import { TIERED } from '../data/tiered'
import { SOURCES, type Language } from '../data/tieredSources'

const LANGUAGES: Language[] = ['micronaut', 'ts', 'rust']
const APPS = TIERED.apps
const stepsOf = (lang: Language) => APPS[lang].steps as unknown as readonly TraceStep[]
const benchOf = (lang: Language, mode: 'pg' | 'redis' | 'tiered') => APPS[lang].bench.find((b) => b.mode === mode)!
const stampedeOf = (lang: Language, coalesce: boolean) => APPS[lang].stampede.find((s) => s.coalesce === coalesce)!

// the recorded Micronaut trace, by what each step shows
const steps = stepsOf('micronaut')
const find = (note: string) => steps.find((s) => s.note.includes(note))!
const cold = find('cold')
const own = find('A’s own memory')
const shared = find('A’s load helps B')
const update = find('invalidation published')
const evictions = steps.filter((s) => s.event.ev === 'evict')
const silent = find('forgets to publish')
const staleRead = find('still serves the old price')
const expired = find('stale copy expired')
const queryMs = Number(TIERED.explain.match(/Execution Time: ([\d.]+) ms/)?.[1] ?? 0)

const fmtUs = (us: number) => (us < 1000 ? `${us.toFixed(us < 10 ? 1 : 0)} µs` : `${(us / 1000).toFixed(2)} ms`)
const fmtMs = (ms: number) => (ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(1)} ms`)
const pct = (part: number, whole: number) => `${((part / whole) * 100).toFixed(0)} %`
const price = (cents: number) => `$${(cents / 100).toFixed(2)}`

const MODES = [
  { mode: 'pg', label: 'no cache', hue: 4 },
  { mode: 'redis', label: 'Redis only', hue: 2 },
  { mode: 'tiered', label: 'L1 + Redis', hue: 1 },
] as const

/** The recorded benchmark of one app: where reads were served and what they cost, per strategy. */
function BenchView({ lang }: { lang: Language }) {
  const tiered = benchOf(lang, 'tiered')
  const pg = benchOf(lang, 'pg')
  return (
    <>
      <Proportion
        title={`${SOURCES[lang].label}, L1 + Redis: where ${tiered.n.toLocaleString()} reads were answered`}
        parts={[
          { label: `L1 (${SOURCES[lang].l1})`, value: tiered.l1, hue: 1 },
          { label: 'Redis', value: tiered.l2, hue: 2 },
          { label: 'Postgres', value: tiered.pg, hue: 4 },
        ]}
      />
      <StatTiles
        stats={[
          { label: 'Postgres queries', value: tiered.pgQueries.toLocaleString(), sub: `no cache: ${pg.pgQueries.toLocaleString()} — ${pct(pg.pgQueries - tiered.pgQueries, pg.pgQueries)} fewer`, hue: 4, bar: { value: tiered.pgQueries, max: pg.pgQueries } },
          { label: 'median read (p50)', value: fmtUs(tiered.p50us), sub: `no cache: ${fmtUs(pg.p50us)}`, hue: 1 },
          { label: 'reads per second', value: tiered.readsPerSec.toLocaleString(), sub: `no cache: ${pg.readsPerSec.toLocaleString()} (one client, one at a time)`, hue: 6 },
        ]}
      />
      <BarChart
        title="Median read (p50), µs"
        bars={MODES.map((m) => ({ label: m.label, value: benchOf(lang, m.mode).p50us, display: fmtUs(benchOf(lang, m.mode).p50us), hue: m.hue }))}
      />
      <BarChart
        title="Slowest 1 % of reads (p99), µs"
        bars={MODES.map((m) => ({ label: m.label, value: benchOf(lang, m.mode).p99us, display: fmtUs(benchOf(lang, m.mode).p99us), hue: m.hue }))}
      />
    </>
  )
}

export default function TieredCaching() {
  const jt = benchOf('micronaut', 'tiered')
  const jpg = benchOf('micronaut', 'pg')
  const jr = benchOf('micronaut', 'redis')
  return (
    <>
      <LessonGoals
        goals={[
          'explain why systems put an in-process cache (L1) in front of Redis (L2) in front of the database',
          'write the read path and the write path in Micronaut, TypeScript and Rust',
          'keep every instance’s L1 correct with Pub/Sub invalidation and a short TTL',
          'stop stampedes with single-flight, and read the hit ratios and latencies that tell you it works',
        ]}
        before={<>Caching patterns (cache-aside, invalidation); Messaging (Pub/Sub); Clients — and, new to Caffeine, lru-cache or moka? the <a href="#/local-cache/why">In-process caching</a> module</>}
      />

      <h2>Three levels, one read</h2>
      <p>
        A multi-level (or tiered) cache answers a read from the fastest place that has the data. It is a standard system-design pattern, also
        called an <strong>L1/L2 cache</strong> or a <strong>near cache in front of a remote cache</strong>.
      </p>
      <Table
        head={['Level', 'Here', 'Where it lives', 'Median read (recorded)', 'Shared by']}
        rows={[
          ['L1: local (near) cache', 'Caffeine · lru-cache · moka', 'inside each app process (heap)', fmtUs(jt.p50us), 'one instance only'],
          ['L2: distributed cache', 'Redis', 'a separate server, over the network', fmtUs(jr.p50us), 'every instance'],
          ['Source of truth', 'PostgreSQL', 'database server, on disk', fmtUs(jpg.p50us), 'everything'],
        ]}
      />
      <p>
        Medians from the Micronaut benchmark below, all on one machine with no network in between — in production every Redis and Postgres
        read also pays a network round trip. The page is a join and an aggregate over {TIERED.rows.reviews.toLocaleString()} reviews; Postgres
        ran it in {queryMs} ms with EXPLAIN ANALYZE, and a cold read through all three levels took the app {fmtMs(cold.event.ms!)}.
      </p>
      <Flow
        title="The read path: fall through, fill on the way back"
        cols={4}
        rows={2}
        nodes={[
          { id: 'req', label: 'request', sub: 'GET /products/42', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'l1', label: 'L1 cache', sub: 'in this process', col: 1, row: 0, hue: 1 },
          { id: 'redis', label: 'Redis (L2)', sub: 'shared, TTL 300 s', col: 2, row: 0, hue: 2, shape: 'store' },
          { id: 'pg', label: 'Postgres', sub: 'source of truth', col: 3, row: 0, hue: 4, shape: 'store' },
          { id: 'resp', label: 'response', sub: 'product page', col: 0, row: 1, hue: 6, shape: 'actor' },
        ]}
        edges={[
          { from: 'req', to: 'l1', hue: 1, flow: true },
          { from: 'l1', to: 'redis', label: 'miss', hue: 2, both: true },
          { from: 'redis', to: 'pg', label: 'miss', hue: 4, both: true },
          { from: 'l1', to: 'resp', hue: 6 },
        ]}
        steps={[
          { title: 'L1 hit', body: <p>The product is in this process’s memory and not expired: answered in microseconds, no network at all. Most reads of popular products end here.</p>, active: ['req', 'l1', 'resp', 'req>l1', 'l1>resp'] },
          { title: 'L1 miss, Redis hit', body: <p>Another instance (or this one, earlier) loaded it into Redis. One round trip; the value is copied into L1 for the next read.</p>, active: ['req', 'l1', 'redis', 'resp', 'req>l1', 'l1>redis', 'l1>resp'] },
          { title: 'Both miss: Postgres', body: <p>The query runs; the result is written to Redis with <code>SET … EX 300</code> and to L1. Every level the read passed is now warm.</p>, active: ['req', 'l1', 'redis', 'pg', 'resp', 'req>l1', 'l1>redis', 'redis>pg', 'l1>resp'] },
        ]}
        caption="Each level on its own is cache-aside: look, and on a miss load from below and keep a copy."
      />
      <TermList
        items={[
          { term: 'L1 / near cache', definition: 'A cache in the app’s own memory. Fastest, but each instance has its own copy and its own misses.' },
          { term: 'L2 / remote cache', definition: 'A cache server (Redis) shared by all instances: one instance’s load helps the others, and it survives app restarts.' },
          { term: 'source of truth', definition: 'Where the data really lives (Postgres). Caches may be emptied at any time without losing anything.' },
          { term: 'invalidation', definition: 'Removing cached copies when the source changes. With L1, every instance must be told.' },
          { term: 'single-flight', definition: 'When many requests miss the same key at once, one loads it and the others wait for that result.' },
        ]}
      />

      <h2>Why not just Redis?</h2>
      <p>Each level fixes what the one below it cannot:</p>
      <ul>
        <li><strong>Redis takes load off Postgres</strong> and is shared, so ten instances do not each query the same product.</li>
        <li><strong>L1 takes load off Redis</strong> and removes even the network hop for the hottest keys — a viral product read 50,000 times a second would otherwise be one Redis key on one shard taking all of it (a hot key).</li>
        <li><strong>Redis keeps L1 cheap:</strong> an instance that starts or loses its L1 refills from Redis, not from Postgres.</li>
      </ul>
      <Callout tone="note" title="The price">
        <p>
          Every extra level is another copy that can be stale. L1 is the hardest: Redis has one copy to delete, but L1 has one copy per instance,
          in processes you cannot reach with a <code>DEL</code>. The write path below exists because of that.
        </p>
      </Callout>

      <h2>The read path in code</h2>
      <p>The same design in three languages, from the apps that produced every recording in this lesson.</p>
      <Tabs
        items={LANGUAGES.map((lang) => ({
          label: SOURCES[lang].label,
          content: (
            <>
              <CodeBlock title={`${SOURCES[lang].file} — read path (the code that ran)`} language={lang === 'micronaut' ? 'java' : lang} code={SOURCES[lang].read} />
              <CodeBlock title={`${SOURCES[lang].file} — the L1 and its invalidation listener`} language={lang === 'micronaut' ? 'java' : lang} code={SOURCES[lang].listen} />
              {SOURCES[lang].setup.map((s) => <CodeBlock key={s.title} title={s.title} language={s.language} code={s.code} />)}
            </>
          ),
        }))}
      />
      <Table
        head={['', 'Caffeine (Java)', 'lru-cache (Node)', 'moka (Rust)']}
        rows={[
          ['size bound', 'maximumSize', 'max', 'max_capacity'],
          ['expiry', 'expireAfterWrite / expireAfterAccess', 'ttl', 'time_to_live / time_to_idle'],
          ['eviction', 'W-TinyLFU (frequency + recency)', 'LRU', 'TinyLFU admission + LRU'],
          ['single-flight', 'cache.get(key, loader)', 'own map of promises (or fetch())', 'get_with(key, future)'],
          ['in this lesson', 'Micronaut 4.5', 'Node 24 (TypeScript)', 'tokio + redis-rs + tokio-postgres'],
        ]}
      />

      <h2>Two instances, recorded</h2>
      <p>
        Two instances of each app (A and B) shared one Redis and one Postgres; the L1 TTL was {TIERED.l1TtlMs / 1000} s. Every row is a real
        event, with the level that answered and how long the app took.
      </p>
      <Tabs
        items={LANGUAGES.map((lang) => ({
          label: SOURCES[lang].label,
          content: <TieredTrace title={`recorded: ${SOURCES[lang].label}, instances A and B (Redis ${TIERED.redisVersion}, PostgreSQL ${TIERED.postgresVersion})`} steps={stepsOf(lang)} />,
        }))}
      />
      <p>Read it top to bottom:</p>
      <ol>
        <li>A’s first read misses everything and pays for Postgres ({fmtMs(cold.event.ms!)}). Its second read never leaves the process ({fmtMs(own.event.ms!)}).</li>
        <li>B has never seen the product, yet does not touch Postgres: A already put it in Redis ({fmtMs(shared.event.ms!)}).</li>
        <li>A changes the price. Both A and B drop their L1 copy within the same millisecond, because both hear the invalidation.</li>
        <li>A write that forgets to publish leaves B serving the old price from memory, until the L1 TTL ends it.</li>
      </ol>

      <h2>The write path: invalidate everywhere</h2>
      <p>A write goes to the source of truth first, then removes every cached copy of the old value.</p>
      <Flow
        title="One price change, four steps"
        cols={4}
        rows={3}
        rowHeight={78}
        nodes={[
          { id: 'a', label: 'app A', sub: 'changes the price', col: 0, row: 1, hue: 1, shape: 'actor' },
          { id: 'pg', label: 'Postgres', sub: 'UPDATE, version + 1', col: 1, row: 0, span: 2, hue: 4, shape: 'store' },
          { id: 'redis', label: 'Redis', sub: 'DEL, then PUBLISH', col: 1, row: 2, span: 2, hue: 2, shape: 'store' },
          { id: 'la', label: 'A’s L1', sub: 'drops product:42', col: 3, row: 1, hue: 1 },
          { id: 'lb', label: 'B’s L1', sub: 'drops product:42', col: 3, row: 2, hue: 5 },
        ]}
        edges={[
          { from: 'a', to: 'pg', label: '1', hue: 4 },
          { from: 'a', to: 'redis', label: '2 · 3', hue: 2 },
          { from: 'redis', to: 'la', label: '4', hue: 7, flow: true, dashed: true },
          { from: 'redis', to: 'lb', label: '4', hue: 7, flow: true, dashed: true },
        ]}
        steps={[
          { title: '1. Write the source of truth', body: <p><code>UPDATE products SET price_cents = …, version = version + 1</code>. Until this commits, nothing else changes.</p>, active: ['a', 'pg', 'a>pg'] },
          { title: '2. Delete the Redis copy', body: <p><code>DEL product:42</code> — delete, do not overwrite: the next reader loads the committed row (see Caching patterns for the race an overwrite has).</p>, active: ['a', 'redis', 'a>redis'] },
          { title: '3. Publish the invalidation', body: <p><code>PUBLISH cache:invalidate product:42</code>. Redis forwards it to every subscribed instance — including A itself.</p>, active: ['a', 'redis', 'a>redis'] },
          { title: '4. Every instance drops its L1 copy', body: <p>Each instance’s listener removes the key from its L1. The next read there falls through to Redis, misses, and loads the new row.</p>, active: ['redis', 'la', 'lb', 'redis>la', 'redis>lb'] },
        ]}
        caption="Pub/Sub delivers to whoever is connected right now: an instance that is reconnecting misses the message. The L1 TTL is what bounds that."
      />
      <Tabs
        items={LANGUAGES.map((lang) => ({
          label: SOURCES[lang].label,
          content: <CodeBlock title={`${SOURCES[lang].file} — write path`} language={lang === 'micronaut' ? 'java' : lang} code={SOURCES[lang].write} />,
        }))}
      />
      <Timeline
        title={`Recorded (Micronaut): the invalidation reaches both instances, ms since the run started`}
        lanes={[
          { id: 'A', label: 'instance A' },
          { id: 'B', label: 'instance B' },
        ]}
        start={update.at - Math.ceil(update.event.ms!) - 2}
        end={Math.max(update.at, evictions[evictions.length - 1].at) + 4}
        unit="ms"
        segments={[{ lane: 'A', from: update.at - Math.ceil(update.event.ms!), to: update.at, label: `write path: ${fmtMs(update.event.ms!)}`, hue: 4 }]}
        events={evictions.map((e) => ({ lane: e.event.inst, at: e.at, label: 'L1 dropped', hue: 7 }))}
      />

      <h2>Stale reads and the L1 TTL</h2>
      <p>The L1 TTL is the safety net for every invalidation that does not arrive.</p>
      <Predict
        question={<p>A changes the price to {price(silent.event.price!)} but the code forgets the <code>PUBLISH</code>. B had the product in its L1. What does B’s next read return, and from where?</p>}
        options={['The new price, from Redis: the Redis copy was deleted', 'The old price, from B’s own L1, until its TTL runs out', 'An error: the versions do not match']}
        answer={1}
        explanation={`Recorded: B answered from L1 with ${price(staleRead.event.price!)} (version ${staleRead.event.version}) while Postgres had version ${silent.event.version}. Deleting the Redis copy does nothing for a copy inside another process.`}
      />
      <Timeline
        title={`Recorded (Micronaut): B serves a stale price until the ${TIERED.l1TtlMs / 1000} s L1 TTL expires`}
        lanes={[
          { id: 'db', label: 'Postgres' },
          { id: 'B', label: 'B’s L1' },
        ]}
        start={0}
        end={expired.at + 200}
        unit="ms"
        segments={[
          { lane: 'db', from: silent.at, to: expired.at + 200, label: `v${silent.event.version} ${price(silent.event.price!)} since the write without PUBLISH`, hue: 4 },
          { lane: 'B', from: staleRead.at - 10, to: expired.at, label: `still v${staleRead.event.version} ${price(staleRead.event.price!)} — stale`, hue: 8, striped: true },
        ]}
        events={[
          { lane: 'B', at: staleRead.at, label: 'stale read', hue: 8 },
          { lane: 'B', at: expired.at, label: `fresh: v${expired.event.version}`, hue: 6 },
        ]}
      />
      <Table
        head={['Defence', 'What it covers', 'Cost']}
        rows={[
          ['Pub/Sub invalidation on every write', 'normal writes: copies dropped within milliseconds', 'one PUBLISH per write; every instance subscribes'],
          ['Short L1 TTL (seconds)', 'lost messages, forgotten publishes, writes from other systems', 'more L1 misses, i.e. more Redis reads'],
          ['Clear L1 when the subscription reconnects', 'messages missed while disconnected', 'a burst of Redis reads after a reconnect'],
          ['Versions in the value', 'detecting staleness in logs and tests', 'a column and a field'],
        ]}
      />
      <Callout tone="warn" title="What not to put in L1">
        <p>
          Anything that must never be stale: balances, stock counts you sell from, permissions you check for security, one-time tokens. Read
          those from the database (or Redis alone, with a delete on write). L1 suits data that is read very often and may be a few seconds old:
          product pages, prices shown in lists, configuration, feature flags, reference data.
        </p>
      </Callout>

      <h2>Stampedes: single-flight per instance</h2>
      <p>
        When a popular key is missing, every request that arrives before the first load finishes would run the same query. The recorded test sent
        100 concurrent requests for one cold product to one instance:
      </p>
      <BarChart
        title="Postgres queries for 100 concurrent reads of one cold product (recorded)"
        bars={LANGUAGES.flatMap((lang) => [
          { label: `${SOURCES[lang].label}, no single-flight`, value: stampedeOf(lang, false).pgQueries, hue: 8 as const },
          { label: `${SOURCES[lang].label}, single-flight`, value: stampedeOf(lang, true).pgQueries, hue: 6 as const },
        ])}
      />
      <p>
        Without single-flight, every request that missed before the first load returned also queried
        ({LANGUAGES.map((l) => stampedeOf(l, false).pgQueries).join(', ')} of 100: how many depends on how many really ran at the same moment).
        With it, one load ran and the other 99 waited for its result. The libraries do the waiting: Caffeine’s <code>get(key, loader)</code> and
        moka’s <code>get_with</code>; in TypeScript a map of in-flight promises does the same.
      </p>
      <Callout tone="note" title="Only per instance">
        <p>
          Single-flight works inside one process. Ten instances can still send ten queries for the same cold key. If that matters, add a short
          Redis lock (<code>SET lock:product:42 … NX PX 2000</code>) around the database load, as in Caching patterns.
        </p>
      </Callout>

      <h2>Benchmark: no cache, Redis only, both (recorded)</h2>
      <p>
        Each app read {jt.n.toLocaleString()} products picked with Zipf popularity (a few products get most reads) from{' '}
        {TIERED.rows.products.toLocaleString()}, three times: straight from Postgres, through Redis only, and through L1 + Redis. Caches were empty
        at the start of each run.
      </p>
      <Tabs items={LANGUAGES.map((lang) => ({ label: SOURCES[lang].label, content: <BenchView lang={lang} /> }))} />
      <p>
        In the Micronaut run, {pct(jt.l1, jt.n)} of reads never left the process, and Postgres saw {jt.pgQueries.toLocaleString()} queries instead
        of {jpg.pgQueries.toLocaleString()} — the {jt.pgQueries.toLocaleString()} first reads of each distinct product. Redis alone saves the same
        queries but every read still makes a round trip ({jr.l2.toLocaleString()} of them, against {jt.l2.toLocaleString()} with L1 in front).
      </p>
      <Callout tone="warn" title="Read these numbers for what they are">
        <p>
          Everything ran on one machine: no network between the app, Redis and Postgres, an idle database, and data that fits in memory. That
          makes a plain Postgres read look nearly as cheap as a Redis read ({fmtUs(jpg.p50us)} vs {fmtUs(jr.p50us)} median here). In production
          each hop adds a network round trip (often 0.3–1 ms), the database is busy with writes, and queries are heavier — the playground below
          lets you add those. What the recording does show is real: L1 reads in about a microsecond, and the database load drops by{' '}
          {pct(jpg.pgQueries - jt.pgQueries, jpg.pgQueries)}.
        </p>
      </Callout>

      <h2>Playground: tune your own</h2>
      <p>
        A model of several instances reading through the three levels, with writes and invalidation. The L1 read time comes from the recording
        ({fmtUs(jt.p50us)}); set the network and query times to match your system.
      </p>
      <TieredPlayground l1Us={jt.p50us} />
      <p>Things to try:</p>
      <ul>
        <li>Set skew to 0.5 (every product about equally popular): L1 hits collapse, because 1,000 slots cannot hold the working set.</li>
        <li>Turn invalidation off with 20 writes/s: stale reads appear at once; lower the L1 TTL and they shrink, at the cost of more Redis calls.</li>
        <li>Raise the network round trip to 2 ms: Redis-only reads get slower, L1 reads do not.</li>
        <li>Add instances: Redis-only load grows with them; with L1, much less.</li>
      </ul>

      <h2>Sizing the levels</h2>
      <p>Each level gets a size and a TTL that match its job.</p>
      <Table
        head={['', 'L1 (in-process)', 'L2 (Redis)']}
        rows={[
          ['size', 'small and bounded: the hot set, e.g. 1,000–100,000 entries; it takes heap from every instance', 'large: most of the working set; bounded by maxmemory and an eviction policy'],
          ['TTL', 'seconds to a minute: it is the staleness you accept when an invalidation is lost', 'minutes to hours, with jitter so keys do not expire together'],
          ['on write', 'dropped via Pub/Sub', 'deleted by the writer'],
          ['when it is lost', 'instance restart: refills from Redis', 'Redis restart or failover: refills from Postgres — watch the database'],
          ['value size', `small objects (this product page: ${TIERED.valueBytes} bytes as JSON)`, `same bytes plus key overhead (MEMORY USAGE: ${TIERED.memoryUsage} bytes)`],
        ]}
      />

      <h2>When it fails</h2>
      <p>Each level fails differently, and the design should degrade, not fall over.</p>
      <Table
        head={['Failure', 'What happens', 'What to do']}
        rows={[
          ['Redis unavailable', 'L1 keeps serving hot keys; misses cannot reach Redis', 'short Redis timeouts; fall back to Postgres behind a concurrency limit or circuit breaker'],
          ['Pub/Sub disconnect', 'invalidations sent meanwhile are lost', 'clear L1 on reconnect; the L1 TTL bounds what is left'],
          ['Postgres slow', 'only misses wait; hit ratio decides how many', 'single-flight, a Redis lock for very hot keys, serve stale while refreshing'],
          ['Deploy / restart of all instances', 'every L1 is empty at once', 'Redis absorbs it; roll instances gradually'],
          ['Big value or hot key in Redis', 'one shard takes the load', 'L1 is the fix for hot keys; split big values'],
        ]}
      />

      <h2>Other ways to get an L1</h2>
      <ul>
        <li><strong>Framework caches:</strong> Micronaut <code>@Cacheable</code> with <code>micronaut-cache-caffeine</code>, or Spring Cache, give you L1 by annotation; the invalidation across instances is still yours to add.</li>
        <li><strong>Redis client-side caching</strong> (<code>CLIENT TRACKING</code>, see Clients): Redis itself tells each client when a key it cached has changed, so you need no channel of your own.</li>
        <li><strong>An L0 in front:</strong> HTTP caching and CDNs cache whole responses before they reach your app at all.</li>
      </ul>

      <h2>Checklist</h2>
      <ul>
        <li>Cache in L1 only data that is hot, small and allowed to be seconds old; keep balances and permissions out.</li>
        <li>Bound L1 by size and give it a short TTL; give Redis a longer TTL with jitter.</li>
        <li>On write: database first, then <code>DEL</code> in Redis, then publish the key; every instance subscribes and drops its copy.</li>
        <li>Clear L1 when the Pub/Sub connection reconnects.</li>
        <li>Use the library’s single-flight load; add a Redis lock only for keys that are expensive and hot across instances.</li>
        <li>Measure hit ratio per level, Postgres queries per second, and stale reads in tests (versions make them visible).</li>
      </ul>

      <Recap
        points={[
          'A multi-level cache answers from the in-process L1, then the shared Redis L2, then Postgres, filling each level on the way back.',
          'L1 removes the network hop and protects Redis from hot keys; Redis lets instances share loads and protects Postgres.',
          'Writes update Postgres, delete the Redis key and publish an invalidation that every instance’s L1 obeys; a short L1 TTL covers lost messages.',
          'Single-flight turns a stampede into one load per instance; recorded: 100 concurrent misses became one query.',
          'In the recorded benchmark L1 answered most reads in about a microsecond and Postgres saw a fraction of the queries.',
        ]}
      />
    </>
  )
}
