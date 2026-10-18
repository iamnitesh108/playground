import { BarChart, ByteLayout, Flow, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { MemoryLineChart } from '../components/MemoryLineChart'
import { MemorySizingCalculator } from '../components/MemorySizingCalculator'
import { MemoryWeightTrace } from '../components/MemoryWeightTrace'
import { all, one, versions } from '../data/runtimeQuery'
import { LANG_INFO, LANGS, SOFT, WEIGHT, type Lang } from '../data/runtimeSources'
import type { FootprintEvent, GcEvent, SoftEvent, WeightEvent } from '../data/runtimeTypes'
import { frequencyHitRatio, lruHitRatio } from '../simulation/memorySizing'
import { LruPolicy, replay, TinyLfuPolicy, zipfTrace } from '../simulation/productionWorkload'

// ---------- the recording ----------
const APP: Record<Lang, 'java' | 'ts' | 'rust'> = { java: 'java', ts: 'ts', rust: 'rust' }
const footprint = (lang: Lang) => all<FootprintEvent>(APP[lang], 'footprint')
const per = (lang: Lang, structure: string) => footprint(lang).find((f) => f.structure === structure)!.bytesPerEntry
const objects = {
  java: one<{ longKey: number; stringKey: number; productValue: number }>('java', 'objects'),
  ts: one<{ stringKey: number; productValue: number }>('ts', 'objects'),
  rust: one<{ stringKeyHeap: number; stringStruct: number }>('rust', 'objects'),
}
const weight = (lang: Lang) => all<WeightEvent>(APP[lang], 'weight')
const soft = (mode: string) => one<SoftEvent>('java', 'soft', mode)
const gcs = all<GcEvent>('java', 'gc')
const young = (g: GcEvent) => Object.entries(g.collections).filter(([k]) => k.includes('Young')).reduce((a, [, v]) => ({ count: a.count + v.count, ms: a.ms + v.ms }), { count: 0, ms: 0 })
const fullGcs = (g: GcEvent) => Object.entries(g.collections).filter(([k]) => !k.includes('Young')).reduce((n, [, v]) => n + v.count, 0)

const B = (v: number) => `${Math.round(v)} B`
const mbOf = (v: number) => `${v.toLocaleString()} MB`
const STRUCTURE_HUE = (s: string) => (s.startsWith('Caffeine,') || s.startsWith('lru-cache') || s.startsWith('moka') ? 3 : 1) as 3 | 1

/** Where the two weight-bound policies differ, recorded with the same steps in all three libraries. */
const WEIGHT_NOTE: Record<Lang, string> = {
  java: 'Caffeine (W-TinyLFU): a newcomer that is used less often than the victim is turned away; written again, it is more frequent and gets in.',
  ts: 'lru-cache (LRU): every newcomer gets in and the least recently used entries leave until the total fits.',
  rust: 'moka (TinyLFU admission): like Caffeine, a cold newcomer is rejected — here even on the second and third write.',
}

export default function Memory() {
  const caffeine = per('java', 'Caffeine, maximumSize')
  const lru = per('ts', 'lru-cache, max')
  const moka = per('rust', 'moka, max_capacity')
  const typical = {
    java: objects.java.stringKey + objects.java.productValue + caffeine,
    ts: objects.ts.stringKey + objects.ts.productValue + lru,
  }
  const [small, , big] = gcs
  const softRun = soft('soft')
  const strongRun = soft('strong')
  const weightRun = soft('weight')
  const softDrop = softRun.samples.reduce((worst, s, i, xs) => (i && xs[i - 1].entries - s.entries > worst.drop ? { drop: xs[i - 1].entries - s.entries, from: xs[i - 1].entries, to: s.entries } : worst), { drop: 0, from: 0, to: 0 })
  // model check: the LRU and TinyLFU models replay the very trace the recorded lru-cache and moka runs used
  const checkTrace = zipfTrace(20_000, 10_000, 0.99, 5)
  const lruReplay = replay(checkTrace, new LruPolicy(1_000))
  const tinyReplay = replay(checkTrace, new TinyLfuPolicy(1_000))
  const recordedLru = one<{ stats: { hitRate: number } }>('ts', 'stats').stats.hitRate
  const recordedMoka = one<{ stats: { hitRate: number } }>('rust', 'stats').stats.hitRate
  return (
    <>
      <LessonGoals
        goals={[
          'estimate what one cache entry really costs in Java, Node.js and Rust, from measured numbers',
          'bound a cache by bytes with a weigher, and predict which entry leaves',
          'explain why soft and weak values are usually the wrong tool',
          'describe what a large on-heap cache does to garbage-collection pauses',
          'size a cache from a memory budget and an expected hit ratio',
        ]}
        before={<>What an in-process cache is (<a href="#/local-cache/why">#/local-cache/why</a>), Eviction (<a href="#/local-cache/eviction">#/local-cache/eviction</a>) for LRU and W-TinyLFU; a rough idea of a heap and a garbage collector.</>}
      />

      <h2>What one entry costs</h2>
      <p>An entry costs its key, its value, and the bookkeeping the cache adds around them.</p>
      <p>
        The bookkeeping is the hash-table slot plus a node that links the entry into the eviction policy’s queues, and timestamps when expiry is
        on. It was measured the same way in each language: insert 1,000,000 entries whose keys and values already exist, and divide the
        growth of memory by 1,000,000 — the heap after a full garbage collection in Java ({versions.java}, compressed pointers) and Node.js (
        {versions.node}, heap plus typed-array memory), and the bytes a counting allocator saw in Rust.
      </p>
      <Tabs
        items={LANGS.map((lang) => ({
          label: LANG_INFO[lang].label,
          content: (
            <BarChart
              title={`Bytes the structure adds per entry, 1,000,000 entries (recorded, ${LANG_INFO[lang].library})`}
              unit=" B"
              bars={footprint(lang).map((f) => ({ label: f.structure, value: Math.round(f.bytesPerEntry), hue: STRUCTURE_HUE(f.structure) }))}
            />
          ),
        }))}
      />
      <TermList
        items={[
          { term: 'per-entry overhead', definition: 'Memory the cache uses for an entry beyond the key and value themselves: table slot, node, links, timestamps.' },
          { term: 'weight', definition: 'A number you assign to each entry (usually its size in bytes); the cache keeps the total under a maximum.' },
          { term: 'weigher', definition: 'The function that computes an entry’s weight when it is written.' },
          { term: 'soft / weak reference', definition: 'A Java reference the garbage collector may clear: weak as soon as nothing else points to the object, soft when memory runs low.' },
          { term: 'GC pause', definition: 'Time the garbage collector stops the application threads to do work it cannot do concurrently.' },
          { term: 'live set', definition: 'The objects still reachable when the collector runs; a big cache is a big live set.' },
        ]}
      />
      <p>The bounded caches cost more than a plain map because each entry also sits in the policy’s structures:</p>
      <Table
        head={['', 'plain map', 'bounded cache', 'with expiry', 'what is in the extra']}
        rows={[
          ['Java', `HashMap ${B(per('java', 'HashMap'))}`, `Caffeine maximumSize ${B(caffeine)}`, `+ expireAfterWrite ${B(per('java', 'Caffeine, maximumSize + expireAfterWrite'))}`, 'a node object with key, value, links for the access queues, policy state; unbounded Caffeine is a plain ConcurrentHashMap'],
          ['Node.js', `Map ${B(per('ts', 'Map'))}`, `lru-cache max ${B(lru)}`, `+ ttl ${B(per('ts', 'lru-cache, max + ttl'))}`, 'lru-cache keeps parallel arrays: key, value, next and previous index (typed arrays), plus its own Map; ttl adds start and ttl arrays'],
          ['Rust', `HashMap ${B(per('rust', 'HashMap'))}`, `moka ${B(moka)}`, `+ time_to_live ${B(per('rust', 'moka, max_capacity + time_to_live'))}`, 'reference-counted key and entry, deque nodes, per-entry atomics and timestamps, the frequency sketch'],
        ]}
      />
      <ByteLayout
        title="A typical entry: key “product:123456”, a small product as the value (recorded sizes, bytes)"
        rows={[
          { label: `Java · Caffeine: ${B(typical.java)}`, fields: [
            { label: 'String key', bytes: Math.round(objects.java.stringKey), hue: 1, content: 'key' },
            { label: 'Product record + name', bytes: Math.round(objects.java.productValue), hue: 5, content: 'value' },
            { label: 'Caffeine overhead', bytes: Math.round(caffeine), hue: 7, content: 'cache' },
          ] },
          { label: `Node.js · lru-cache: ${B(typical.ts)}`, fields: [
            { label: 'string key', bytes: Math.round(objects.ts.stringKey), hue: 1, content: 'key' },
            { label: 'object + name', bytes: Math.round(objects.ts.productValue), hue: 5, content: 'value' },
            { label: 'lru-cache overhead', bytes: Math.round(lru), hue: 7, content: 'cache' },
          ] },
          { label: `Rust · moka (u64 key and value): ${B(moka)}`, fields: [
            { label: 'moka overhead incl. 16 B of key and value', bytes: Math.round(moka), hue: 7, content: 'cache' },
          ] },
        ]}
        caption={`In Rust a String key adds ${objects.rust.stringStruct} B inline plus ${objects.rust.stringKeyHeap} B on the heap. Every number is a measured average over 1,000,000 objects.`}
      />
      <Predict
        question={<p>You cache 1,000,000 such products in Caffeine. Roughly how much heap is that?</p>}
        options={['About 100 MB: a product is 88 bytes', `About ${Math.round((typical.java * 1e6) / 1048576)} MB: key, value and cache overhead`, 'About 1 GB']}
        answer={1}
        explanation={`${B(objects.java.stringKey)} key + ${B(objects.java.productValue)} value + ${B(caffeine)} Caffeine overhead ≈ ${B(typical.java)} per entry. The cache’s own share is ${Math.round((caffeine / typical.java) * 100)} % — small values make the overhead count.`}
      />
      <Callout tone="note" title="Measure your own values">
        <p>
          Values are usually most of the memory, and they are rarely as small as here: a product with a description, images and prices can be
          kilobytes. In Java, JOL (<code>GraphLayout.parseInstance(value).totalSize()</code>) or a heap dump tells you; in Node.js a heap
          snapshot; in Rust, the size of the struct plus what its <code>String</code>s and <code>Vec</code>s point to.
        </p>
      </Callout>

      <h2>Bounding by bytes: weight</h2>
      <p>When values vary in size, a limit on entries says little about memory — bound the total weight instead.</p>
      <p>
        1,000 entries of 1 KB and 1,000 entries of 1 MB are both “1,000 entries”. All three libraries let you give each entry a weight —
        normally its size in bytes — and keep the sum under a maximum. Each was given the same 1 MB budget and the same writes:
      </p>
      <Tabs items={LANGS.map((lang) => ({ label: LANG_INFO[lang].label, content: <CodeBlock title={`${WEIGHT[lang].file} (the code that ran)`} language={LANG_INFO[lang].language} code={WEIGHT[lang].code} /> }))} />
      <Predict
        question={<p>The 1 MB cache holds a, b and c (300 KB each); a was read twice. You put d (200 KB). The total would be 1.1 MB. What happens in lru-cache, and what in Caffeine?</p>}
        options={['Both evict a, the oldest write', 'lru-cache evicts b (least recently used); Caffeine turns d away, because it has been used less than the entry it would replace', 'Both refuse d because it does not fit']}
        answer={1}
        explanation="Recorded below. An LRU always admits the newcomer and evicts from the cold end. Caffeine and moka compare how often the newcomer and the victim were used (their frequency sketch) and may keep the old entry instead."
      />
      <Tabs
        items={LANGS.map((lang) => ({
          label: LANG_INFO[lang].label,
          content: (
            <>
              <MemoryWeightTrace title={`Recorded: ${LANG_INFO[lang].library}, 1 MB budget, step by step`} steps={weight(lang)} budget={1_000_000} />
              <p>{WEIGHT_NOTE[lang]}</p>
            </>
          ),
        }))}
      />
      <Table
        head={['', 'Caffeine', 'lru-cache', 'moka']}
        rows={[
          ['set the budget', 'maximumWeight(bytes) + weigher((k, v) -> …)', 'maxSize + sizeCalculation: (v, k) => …', 'max_capacity(bytes) + weigher(|k, v| -> u32)'],
          ['weight type', 'int ≥ 0, per entry', 'positive integer', 'u32 per entry, u64 total'],
          ['when it is computed', 'when the entry is written', 'when the entry is set', 'when the entry is inserted'],
          ['entry bigger than the budget', 'stored, then evicted at once (recorded: SIZE)', 'not stored at all (maxEntrySize defaults to maxSize)', 'rejected (recorded: Size)'],
          ['who leaves', 'W-TinyLFU: the victim, or the newcomer if it is used less', 'least recently used, until it fits', 'TinyLFU admission: may reject the newcomer'],
        ]}
      />
      <Callout tone="warn" title="Weight is what you say it is">
        <p>
          The cache adds up the numbers your weigher returns; it does not measure memory. <code>value.length</code> for a byte array is close;
          for an object graph, estimate (or serialise once and use the byte count). The per-entry overhead above is not included, so a budget of
          100 MB of values with 1-byte values would still hold millions of entries and use far more than 100 MB.
        </p>
      </Callout>

      <h2>Soft and weak values</h2>
      <p>Caffeine can let the garbage collector decide what to drop; it is almost never what you want.</p>
      <p>
        With <code>softValues()</code> each value sits behind a <code>SoftReference</code>, which the JVM clears when it is short of memory.
        It sounds like a self-sizing cache. The recording put two hundred 1 MB values into a {softRun.heapMb} MB heap, three ways:
      </p>
      <CodeBlock title={`${SOFT.file} — the three caches (the code that ran)`} language="java" code={SOFT.code} />
      <MemoryLineChart
        title={`Recorded: entries in the cache while inserting 1 MB values, ${softRun.heapMb} MB heap`}
        xLabel="values inserted"
        yLabel="entries"
        series={[
          { label: 'softValues()', hue: 8, points: softRun.samples.map((s) => [s.inserted, s.entries] as const) },
          { label: 'maximumWeight(48 MB)', hue: 6, points: weightRun.samples.map((s) => [s.inserted, s.entries] as const) },
          { label: 'unbounded, strong values', hue: 2, dashed: true, points: strongRun.samples.map((s) => [s.inserted, s.entries] as const) },
        ]}
        markers={[{ x: Number(strongRun.outcome.match(/after (\d+)/)?.[1] ?? 90), label: 'OutOfMemoryError', hue: 8 }]}
        caption={`Unbounded: ${strongRun.outcome}. Soft: ${softRun.gcs} collections, and the cache dropped from ${softDrop.from} to ${softDrop.to} entries at once. Weight-bounded: a steady 48, ${weightRun.gcs} collections.`}
      />
      <ul>
        <li><strong>Eviction happens in bulk, under pressure.</strong> Nothing is evicted until the heap is nearly full; then the collector clears most soft values in one go — the hit ratio collapses exactly when the system is struggling.</li>
        <li><strong>The collector picks, not the policy.</strong> The JVM clears soft references roughly by age of last use across the whole heap, ignoring how often an entry was used.</li>
        <li><strong>It costs the collector work</strong> — {softRun.gcs} collections against {weightRun.gcs} for the weight-bounded cache in this run: the heap runs full before anything is let go.</li>
        <li><strong>Values compare by identity</strong> (<code>==</code>): Caffeine documents this for soft and weak values, and for <code>weakKeys()</code> the keys too, so equal-but-different key objects miss.</li>
      </ul>
      <Callout tone="warn" title="Caffeine says so too">
        <p>
          Its documentation for <code>softValues()</code>: “in most circumstances it is better to set a per-cache maximum size instead of using
          soft references”. Weak keys or values have a narrow use — caching something about an object exactly as long as that object lives
          elsewhere. lru-cache and moka have no equivalent; JavaScript has <code>WeakMap</code> and <code>WeakRef</code> for that narrow use.
        </p>
      </Callout>

      <h2>What a big cache does to the garbage collector</h2>
      <p>A cache is a large set of long-lived objects, and the collector has to work around it.</p>
      <p>
        Java and Node.js collectors are generational: new objects are collected often and cheaply (young collections), and objects that survive
        are promoted to an old generation collected rarely. Cache entries are the opposite of request garbage: they live for minutes. Each one
        replaced creates new objects that the old entries point to, which every young collection has to account for (G1 tracks these
        old-to-young references in remembered sets). The recording ran the same request loop — read a key with Zipf popularity, load it on a
        miss, make 2–4 KB of request garbage — for {small.seconds} s with three cache sizes, on G1 with a {mbOf(small.heapMaxMb)} heap:
      </p>
      <BarChart
        title="Average young-collection pause (recorded, G1)"
        unit=" ms"
        bars={gcs.map((g) => ({ label: `${g.entries.toLocaleString()} entries (${mbOf(g.liveHeapMb)} live)`, value: +(young(g).ms / Math.max(1, young(g).count)).toFixed(1), hue: 3 }))}
      />
      <BarChart
        title="Longest pause (recorded, G1)"
        unit=" ms"
        bars={gcs.map((g) => ({ label: `${g.entries.toLocaleString()} entries`, value: g.maxPauseMs, hue: 4 }))}
      />
      <Table
        head={['Cache size', 'Live heap after fill', 'Hit ratio', 'Requests in 10 s', 'Young collections', 'Total pause', 'Full collections']}
        rows={gcs.map((g) => [
          `${g.entries.toLocaleString()} × 1 KB`,
          mbOf(g.liveHeapMb),
          `${Math.round(g.hitRatio * 100)} %`,
          `${(g.requests / 1e6).toFixed(1)} M`,
          young(g).count,
          `${young(g).ms} ms`,
          fullGcs(g),
        ])}
      />
      <p>
        Read both sides. The bigger cache made each young collection several times longer and the worst pause{' '}
        {Math.round(big.maxPauseMs / Math.max(1, small.maxPauseMs))}× longer. It also hit {Math.round(big.hitRatio * 100)} % instead of{' '}
        {Math.round(small.hitRatio * 100)} %, so it loaded — and allocated — far less, and collected less often. Whether that trade is good
        depends on what a miss costs you; what it shows is that cache size is a GC setting too. One run per size on one machine, with other work
        running: compare the shape, not the milliseconds.
      </p>
      <StatTiles
        stats={[
          { label: 'live heap with the big cache', value: mbOf(big.liveHeapMb), sub: `of ${mbOf(big.heapMaxMb)}: ${Math.round((big.liveHeapMb / big.heapMaxMb) * 100)} % before any request`, hue: 3, bar: { value: big.liveHeapMb, max: big.heapMaxMb } },
          { label: 'longest pause, big vs small', value: `${big.maxPauseMs} vs ${small.maxPauseMs} ms`, sub: 'G1 young collections', hue: 8 },
          { label: 'hit ratio, big vs small', value: `${Math.round(big.hitRatio * 100)} vs ${Math.round(small.hitRatio * 100)} %`, sub: 'the reason to pay for it', hue: 6 },
        ]}
      />
      <Callout tone="note" title="Node.js and Rust (not recorded)">
        <p>
          V8 is generational too: a cache of millions of small objects makes its mark-compact (major) collections longer, and Node’s default old
          space is limited (set with <code>--max-old-space-size</code>). Values held as <code>Buffer</code>s live outside the JavaScript heap
          and are cheaper for the collector to skip. Rust has no collector: an evicted entry is freed on the spot. Its costs are allocator
          fragmentation and the CPU time of freeing, not pauses.
        </p>
      </Callout>

      <h2>Sizing a cache</h2>
      <p>The right size is where one more megabyte stops buying a meaningful number of hits.</p>
      <p>
        Popularity is usually skewed: a few keys get most reads (a Zipf distribution). The hit ratio of a cache holding the <em>C</em> most
        popular of <em>N</em> keys is their share of all requests — the best a frequency-based policy can do on a steady workload. An LRU keeps
        what was used recently instead, and does a little worse; Che’s approximation estimates it. The calculator puts that next to the memory,
        with each library’s recorded overhead per entry:
      </p>
      <MemorySizingCalculator
        libraries={[
          { id: 'caffeine', label: 'Caffeine', overhead: Math.round(caffeine) },
          { id: 'lru-cache', label: 'lru-cache', overhead: Math.round(lru) },
          { id: 'moka', label: 'moka', overhead: Math.round(moka) },
        ]}
      />
      <p>
        How good is the model? Replaying the exact 20,000-request trace of the recorded statistics run (10,000 keys, skew 0.99, 1,000
        entries), the LRU model gets {lruReplay.toFixed(3)} and lru-cache recorded {recordedLru.toFixed(3)}; the TinyLFU-admission model gets{' '}
        {tinyReplay.toFixed(3)} and moka recorded {recordedMoka.toFixed(3)}. The steady-state formulas give{' '}
        {lruHitRatio(10_000, 0.99, 1_000).toFixed(3)} (LRU) and {frequencyHitRatio(10_000, 0.99, 1_000).toFixed(3)} (best case): a short run
        also pays for every key’s first, unavoidable miss. Real traffic is not independent draws — sessions, bursts and daily cycles move the
        numbers — so measure the hit ratio in production (<a href="#/local-cache/production">Statistics, frameworks and pitfalls</a>).
      </p>
      <Flow
        title="Sizing in four steps"
        cols={4}
        rows={1}
        rowHeight={92}
        nodes={[
          { id: 'budget', label: 'memory budget', sub: 'e.g. 10–20 % of heap', col: 0, row: 0, hue: 3 },
          { id: 'entry', label: 'bytes per entry', sub: 'key + value + overhead', col: 1, row: 0, hue: 3 },
          { id: 'n', label: 'max entries', sub: 'budget ÷ entry', col: 2, row: 0, hue: 7 },
          { id: 'hit', label: 'check hit ratio', sub: 'curve, then production', col: 3, row: 0, hue: 6 },
        ]}
        edges={[
          { from: 'budget', to: 'entry', hue: 3 },
          { from: 'entry', to: 'n', hue: 7 },
          { from: 'n', to: 'hit', hue: 6, flow: true },
        ]}
        caption="If the hit ratio at that size is too low, the data does not fit an in-process cache: put the bulk in Redis and keep only the hottest keys local."
      />

      <h2>Off-heap and out-of-process options</h2>
      <p>When the hot set is too big for the heap, it can live outside it — at a price (not recorded here).</p>
      <Table
        head={['Option', 'What it is', 'Trade-off']}
        rows={[
          ['Off-heap store (Java)', 'Ehcache’s off-heap tier, Chronicle Map, OHC: entries in native memory the GC does not scan', 'every read deserialises a copy; you manage native memory limits'],
          ['Buffers outside the JS heap (Node.js)', 'store serialised values as Buffer; lru-cache’s sizeCalculation can weigh them by length', 'parse on every read; the bytes still count against the process'],
          ['Memory-mapped files', 'the OS page cache holds the data; the process maps it', 'good for read-mostly data sets; invalidation is yours'],
          ['A shared cache server', 'Redis as L2, the in-process cache as a small L1 (see Multi-level caching)', 'a network round trip per L1 miss, but one copy for all instances'],
        ]}
      />
      <p>
        See <a href="#/redis/tiered-caching">Multi-level caching</a> for the L1 + Redis design and <a href="#/redis/eviction">Redis eviction</a>{' '}
        for how the shared tier bounds its own memory.
      </p>

      <h2>Checklist</h2>
      <ul>
        <li>Bound every cache: by entries when values are similar in size, by weight (bytes) when they are not.</li>
        <li>Estimate bytes per entry as key + value + the library’s overhead ({B(caffeine)} Caffeine, {B(lru)} lru-cache, {B(moka)} moka, measured here) — then multiply by instances.</li>
        <li>Keep the cache to a modest share of the heap; watch GC pause times when you grow it.</li>
        <li>Prefer maximumSize / maximumWeight over soft or weak values.</li>
        <li>Pick the size from the hit-ratio curve: past the knee, extra memory buys few hits.</li>
        <li>When the hot set is bigger than a heap can hold, put it in a shared cache and keep a small L1.</li>
      </ul>

      <Recap
        points={[
          `Measured overhead per entry on top of key and value: Caffeine ${B(caffeine)}, lru-cache ${B(lru)}, moka ${B(moka)}; a small product entry in Java totals about ${B(typical.java)}.`,
          'A weigher bounds a cache by bytes; LRU (lru-cache) always admits and evicts the oldest, while Caffeine and moka can turn a cold newcomer away.',
          `Soft values let the GC evict in bulk under pressure (recorded: ${softDrop.from} → ${softDrop.to} entries at once); a size or weight bound is steady.`,
          `A big cache is a big live set: recorded young pauses grew from about ${(young(small).ms / Math.max(1, young(small).count)).toFixed(0)} ms to ${(young(big).ms / Math.max(1, young(big).count)).toFixed(0)} ms on average, with fewer collections because the hit ratio rose.`,
          'Size from a memory budget and a hit-ratio curve; the Zipf model matched the recorded lru-cache and moka runs closely.',
        ]}
      />
    </>
  )
}
