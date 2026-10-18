import { BarChart, ByteLayout, Flow, Proportion, StatTiles, type Hue } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { EvictionLineChart, type LineSeries } from '../components/EvictionLineChart'
import { EvictionLruList } from '../components/EvictionLruList'
import { EvictionPlayground } from '../components/EvictionPlayground'
import { EvictionSketch } from '../components/EvictionSketch'
import { POLICY_CAPTURE as D } from '../data/policies'
import { EVICTION_CODE, LIB_LABEL, type Lib } from '../data/policiesSources'

type TraceId = (typeof D.traces)[number]['id']
const LIBS: Lib[] = ['caffeine', 'lruCache', 'moka']
const SIZES = D.sizes

/** Hit ratio (%) a library recorded on a trace at a size. */
const lib = (name: string, trace: TraceId, size: number) => {
  const r = D.replays.find((x) => x.lib === name && x.trace === trace && x.size === size)!
  return (r.hits / r.requests) * 100
}
/** Hit ratio (%) of one of the lesson's models on the same trace. */
const model = (name: string, trace: TraceId, size: number) => {
  const r = D.models.find((x) => x.model === name && x.trace === trace && x.size === size)!
  return (r.hits / 1_000_000) * 100
}
const pct = (v: number) => `${v.toFixed(1)} %`
const order = D.order
const lastStep = order.requests.length - 1

// Caffeine's region sizes for a maximum of 1,000 (BoundedLocalCache.setMaximumSize, 3.1.8)
const MAX = 1000
const WINDOW = MAX - Math.floor(0.99 * MAX)
const PROTECTED = Math.floor(0.8 * (MAX - WINDOW))
const PROBATION = MAX - WINDOW - PROTECTED
// Caffeine's sketch: max(ceilingPowerOfTwo(maximum), 8) longs of sixteen 4-bit counters
const sketchBytes = (max: number) => Math.max(2 ** Math.ceil(Math.log2(max)), 8) * 8

/** Recorded hit ratio vs cache size, libraries plus the optimal ceiling. */
function librarySeries(trace: TraceId): LineSeries[] {
  const at = (f: (size: number) => number) => SIZES.map((s) => [s, f(s)] as const)
  return [
    { label: 'Caffeine', hue: 1, points: at((s) => lib('caffeine', trace, s)) },
    { label: 'moka', hue: 2, points: at((s) => lib('moka', trace, s)) },
    { label: 'lru-cache', hue: 3, points: at((s) => lib('lru-cache', trace, s)) },
    { label: 'optimal', hue: 7, dashed: true, points: at((s) => model('optimal', trace, s)) },
  ]
}

/** How far a model is from the library it imitates, over the four recorded sizes. */
function closeness(modelId: string, libName: string, trace: TraceId) {
  const diffs = SIZES.map((s) => model(modelId, trace, s) - lib(libName, trace, s))
  const mean = diffs.reduce((n, d) => n + Math.abs(d), 0) / diffs.length
  const worst = diffs.reduce((w, d) => (Math.abs(d) > Math.abs(w) ? d : w), 0)
  return `${mean.toFixed(1)} pp (worst ${worst > 0 ? '+' : ''}${worst.toFixed(1)})`
}

const windowSeries = (trace: TraceId, size: number): LineSeries[] => {
  const caffeine = D.replays.find((x) => x.lib === 'caffeine' && x.trace === trace && x.size === size)!
  const modelRun = D.modelWindows.find((x) => x.trace === trace && x.size === size)!
  const share = (points: readonly (readonly number[])[]) => points.map((p) => [p[0] / 1000, (p[1] / size) * 100] as const)
  return [
    { label: 'Caffeine (recorded)', hue: 1, points: share(caffeine.window ?? []) },
    { label: 'model', hue: 7, dashed: true, points: share(modelRun.window) },
  ]
}

export default function Eviction() {
  const z = (name: string) => lib(name, 'zipf-0.8', 1000)
  return (
    <>
      <LessonGoals
        goals={[
          'explain why a full cache needs a policy, and what “hit ratio” measures',
          'describe FIFO, LRU and LFU, and the traffic that defeats each one',
          'explain TinyLFU (a Count-Min sketch at the door) and Caffeine’s W-TinyLFU (window, probation, protected, hill climbing)',
          'say which policy Caffeine, moka and lru-cache use, and read recorded hit ratios to pick one',
        ]}
        before={<>Using it day to day (<a href="#/local-cache/using">#/local-cache/using</a>). Redis’s approximate LRU and LFU (<a href="#/redis/eviction">Redis: Eviction</a>) is a useful contrast, not a requirement.</>}
      />

      <h2>Why a cache needs a policy</h2>
      <p>A bounded cache is full most of the time, so every miss that loads a new entry must push an old one out.</p>
      <p>
        The <strong>eviction policy</strong> picks that entry. A good policy keeps the entries that will be asked for again soon; a bad one throws
        them away and pays for the next load. Same memory, same traffic, very different results:
      </p>
      <StatTiles
        title={`Recorded: the same 1,000,000 requests (Zipf 0.8) into a cache of ${MAX.toLocaleString()} entries`}
        stats={[
          { label: 'lru-cache (LRU)', value: pct(z('lru-cache')), sub: 'hit ratio', hue: 3, bar: { value: z('lru-cache'), max: 100 } },
          { label: 'moka (TinyLFU)', value: pct(z('moka')), sub: 'hit ratio', hue: 2, bar: { value: z('moka'), max: 100 } },
          { label: 'Caffeine (W-TinyLFU)', value: pct(z('caffeine')), sub: 'hit ratio', hue: 1, bar: { value: z('caffeine'), max: 100 } },
          { label: 'optimal (knows the future)', value: pct(model('optimal', 'zipf-0.8', MAX)), sub: 'the ceiling', hue: 7, bar: { value: model('optimal', 'zipf-0.8', MAX), max: 100 } },
        ]}
      />
      <p>
        Caffeine answered {(z('caffeine') - z('lru-cache')).toFixed(0)} more requests out of every hundred than lru-cache did, with the same
        number of entries. Every one of those is a database query that did not happen.
      </p>
      <TermList
        items={[
          { term: 'hit ratio', definition: 'Hits ÷ requests. The one number an eviction policy is judged by.' },
          { term: 'eviction', definition: 'Removing an entry to make room. Caffeine and moka report it as cause SIZE; lru-cache calls dispose with reason "evict".' },
          { term: 'admission', definition: 'Deciding whether a new entry gets in at all. LRU always admits; TinyLFU may reject the newcomer and keep the old entry.' },
          { term: 'recency', definition: 'How long ago a key was last used. LRU bets that recent keys are used again.' },
          { term: 'frequency', definition: 'How often a key was used. LFU bets that popular keys stay popular.' },
          { term: 'scan', definition: 'A burst of keys read once and never again (a batch job, a crawler, a report).' },
          { term: 'optimal (Belady)', definition: 'Evict the key needed furthest in the future. Impossible in practice (it needs the future), but computable on a recorded trace: the ceiling.' },
        ]}
      />

      <h2>FIFO and LRU</h2>
      <p>The two oldest policies only look at time: when a key arrived, or when it was last used.</p>
      <p>
        <strong>FIFO</strong> evicts the oldest insertion, even if it is read constantly. <strong>LRU</strong> (least recently used) evicts the entry
        that has gone longest without a read. LRU is a hash map plus a doubly linked list: a hit unlinks the node and appends it at the tail
        (most recent); an eviction takes the head. Both are O(1). lru-cache builds the list from typed arrays of indexes
        (<code>next</code>, <code>prev</code>), preallocated to <code>max</code>, so a full cache allocates nothing new for its links.
      </p>
      <EvictionLruList requests={order.requests} max={order.max} lruCache={order.lruCache} caffeine={order.caffeine} moka={order.moka} />
      <Predict
        question={<p>Four entries fit. The app reads a, b, c, d, then a and b again, then x, y, z once each (a small scan), then a and b. In lru-cache, do the last two reads hit?</p>}
        options={['Both hit: a and b were the most used keys', 'Both miss: the scan pushed them out', 'a misses, b hits']}
        answer={order.lruCache[lastStep].hit ? 0 : 1}
        explanation={`Recorded: lru-cache ${order.lruCache[lastStep - 1].hit ? 'hit' : 'missed'} a and ${order.lruCache[lastStep].hit ? 'hit' : 'missed'} b — three one-off keys were enough to push both out, because LRU only knows “recent”. Caffeine ${order.caffeine[lastStep].hit ? 'hit both' : 'missed'}, and moka ${order.moka[lastStep].hit ? 'hit both' : 'missed'}: their frequency sketch knew x, y and z were seen once.`}
      />
      <Table
        head={['Request', 'lru-cache keeps (most recent first)', 'Caffeine keeps', 'moka keeps']}
        rows={order.requests.map((k, i) => [
          <code key="k">{k}</code>,
          `${order.lruCache[i].contents.join(' ')}${order.lruCache[i].evicted.length ? ` · evicted ${order.lruCache[i].evicted.join(' ')}` : ''}`,
          `${order.caffeine[i].contents.join(' ')}${order.caffeine[i].evicted.length ? ` · evicted ${order.caffeine[i].evicted.join(' ')}` : ''}`,
          `${order.moka[i].contents.join(' ')}${order.moka[i].evicted.length ? ` · ${order.moka[i].evicted.includes(k) ? 'rejected' : 'evicted'} ${order.moka[i].evicted.join(' ')}` : ''}`,
        ])}
      />
      <Tabs items={LIBS.map((l) => ({ label: LIB_LABEL[l], content: <CodeBlock title={EVICTION_CODE[l][0].title} language={EVICTION_CODE[l][0].language} code={EVICTION_CODE[l][0].code} /> }))} />
      <Callout tone="analogy" title="A desk with four slots">
        LRU is a desk where every document you touch goes on top and the bottom one falls off. Skim three flyers and your two working files are
        gone. Caffeine is the same desk with a doorman who asks each flyer “have I seen you before?”.
      </Callout>

      <h2>LFU, and why pure frequency fails</h2>
      <p>LFU (least frequently used) counts hits and evicts the entry with the fewest.</p>
      <p>On steady, skewed traffic that is exactly right: popular keys collect hits and stay. It has two problems:</p>
      <ul>
        <li>
          <strong>Stale popularity.</strong> Counts never fade. Yesterday’s hot keys keep their high counts and squat in the cache while today’s keys
          are evicted after a single hit each.
        </li>
        <li>
          <strong>Counter memory.</strong> A true LFU must remember counts for keys that are <em>not</em> cached too, or a key that keeps being evicted
          never builds up a count. That is a map entry per key ever seen. The model here keeps counts only while a key is cached, which is cheaper and
          suffers more from the first problem.
        </li>
      </ul>
      <BarChart
        title={`Shifting hot set, ${MAX.toLocaleString()} entries: the hot keys move every 100,000 requests`}
        max={100}
        unit=" %"
        bars={[
          { label: 'LFU (model)', value: +model('lfu', 'shift', MAX).toFixed(1), hue: 5, note: 'old counts pin yesterday’s keys' },
          { label: 'FIFO (model)', value: +model('fifo', 'shift', MAX).toFixed(1), hue: 4 },
          { label: 'lru-cache (LRU)', value: +lib('lru-cache', 'shift', MAX).toFixed(1), hue: 3 },
          { label: 'moka (TinyLFU)', value: +lib('moka', 'shift', MAX).toFixed(1), hue: 2 },
          { label: 'Caffeine (W-TinyLFU)', value: +lib('caffeine', 'shift', MAX).toFixed(1), hue: 1 },
          { label: 'optimal', value: +model('optimal', 'shift', MAX).toFixed(1), hue: 7 },
        ]}
      />
      <p>
        Recorded libraries, modelled LFU and FIFO (no library here offers them). LFU kept {pct(model('lfu', 'shift', MAX))}; even FIFO did better. The
        fix is to let counts <em>age</em>, which is what TinyLFU does.
      </p>

      <h2>The scan problem</h2>
      <p>A scan is a burst of one-off keys, and LRU treats each of them as the most valuable entry in the cache.</p>
      <p>
        Every scanned key goes to the head of the list and pushes a useful key out. The <em>Zipf + scans</em> trace mixes Zipf 0.8 traffic with a
        20,000-key scan every 100,000 requests. The <em>loop</em> trace is the worst case: 6,000 keys read in order, over and over. An LRU smaller
        than the loop evicts every key just before it is needed again.
      </p>
      <BarChart
        title={`Recorded: Zipf + scans, ${MAX.toLocaleString()} entries`}
        max={100}
        unit=" %"
        bars={[
          { label: 'lru-cache (LRU)', value: +lib('lru-cache', 'scan', MAX).toFixed(1), hue: 3 },
          { label: 'moka (TinyLFU)', value: +lib('moka', 'scan', MAX).toFixed(1), hue: 2 },
          { label: 'Caffeine (W-TinyLFU)', value: +lib('caffeine', 'scan', MAX).toFixed(1), hue: 1 },
          { label: 'optimal', value: +model('optimal', 'scan', MAX).toFixed(1), hue: 7 },
        ]}
      />
      <BarChart
        title="Recorded: a loop of 6,000 keys, 5,000 entries"
        max={100}
        unit=" %"
        bars={[
          { label: 'lru-cache (LRU)', value: +lib('lru-cache', 'loop', 5000).toFixed(1), hue: 3, display: pct(lib('lru-cache', 'loop', 5000)) },
          { label: 'moka (TinyLFU)', value: +lib('moka', 'loop', 5000).toFixed(1), hue: 2 },
          { label: 'Caffeine (W-TinyLFU)', value: +lib('caffeine', 'loop', 5000).toFixed(1), hue: 1 },
          { label: 'optimal', value: +model('optimal', 'loop', 5000).toFixed(1), hue: 7 },
        ]}
      />
      <Predict
        question={<p>A nightly job reads 6,000 rows in the same order every time, through an LRU cache that holds 5,000. What hit ratio do you expect?</p>}
        options={['About 83 % — most of the rows fit', 'About 50 %', 'Almost 0 %']}
        answer={2}
        explanation={`Recorded: lru-cache ${pct(lib('lru-cache', 'loop', 5000))}. When row 5,001 arrives, the least recently used row is row 1 — the very next one the loop needs. Every read evicts the next read. Caffeine kept ${pct(lib('caffeine', 'loop', 5000))} by refusing to let newcomers in.`}
      />

      <h2>TinyLFU: a frequency sketch at the door</h2>
      <p>TinyLFU keeps an approximate count for every key it has seen, cached or not, in a few bytes per entry.</p>
      <p>
        The counts live in a <strong>Count-Min sketch</strong>: a few rows of small counters. A request increments one counter per row, chosen by
        hashing the key; the estimate is the smallest of those counters. Other keys may share a counter, so estimates can only be too high, and
        taking the minimum keeps the error small. Each counter is 4 bits (0–15): TinyLFU only needs to tell “hot” from “not hot”.
      </p>
      <EvictionSketch />
      <ByteLayout
        title="Caffeine 3.1.8 packs the sketch: a key’s four counters live in one 64-byte block (one cache line) of eight longs"
        rows={[{ label: 'one block', fields: Array.from({ length: 8 }, (_, i) => ({ label: `long ${i}`, bytes: 8, hue: 7 as Hue, content: '16 counters' })) }]}
      />
      <ByteLayout
        title="…and each 64-bit long holds sixteen 4-bit counters, two per byte"
        rows={[{ label: 'one long', fields: Array.from({ length: 8 }, (_, i) => ({ label: `c${2 * i} c${2 * i + 1}`, bytes: 1, hue: (i % 2 ? 7 : 3) as Hue, content: '4+4 bits' })) }]}
        caption="Schematic of FrequencySketch: a lookup reads four counters from one cache line, so it touches memory once."
      />
      <p>Two more rules make it work:</p>
      <ul>
        <li>
          <strong>Aging.</strong> After <code>10 × maximum</code> increments (Caffeine’s <code>sampleSize</code>; moka uses the same), every counter is
          halved. Old popularity fades within a few samples, which fixes LFU’s stale counts.
        </li>
        <li>
          <strong>Admission.</strong> When the cache is full, the newcomer (the candidate) is compared with the entry the policy would evict (the
          victim). The candidate gets in only if its estimated frequency is <em>higher</em>; on a tie the victim stays. A one-off scanned key has a
          count of 1 and loses to anything that was used twice.
        </li>
      </ul>
      <Table
        head={['Maximum entries', 'Sketch size in Caffeine', 'Per entry']}
        rows={[1_000, 10_000, 100_000, 1_000_000].map((m) => [m.toLocaleString(), `${(sketchBytes(m) / 1024).toLocaleString()} KiB`, `${(sketchBytes(m) / m).toFixed(1)} bytes`])}
      />
      <p>
        Computed from <code>FrequencySketch.ensureCapacity</code>: <code>max(ceilingPowerOfTwo(maximum), 8)</code> longs. A few bytes per entry,
        against the tens or hundreds of bytes the entry itself costs (see <a href="#/local-cache/memory">Memory, weight and garbage collection</a>).
      </p>
      <Callout tone="note" title="When the sketch starts">
        Both libraries allocate the sketch lazily: Caffeine when the cache first reaches half its maximum, moka when its weighted size reaches half of{' '}
        <code>max_capacity</code>. Until then every key is admitted; a small cache that never fills never pays for one.
      </Callout>

      <h2>W-TinyLFU in Caffeine</h2>
      <p>Caffeine puts a small LRU window in front of TinyLFU, so new keys get a chance to prove themselves.</p>
      <p>
        Pure TinyLFU rejects a brand-new key that will be popular a moment later (a news story, a just-created cart): its count is still 1. The
        window holds new keys for a short while; only when one falls out of the window does it face the admission test against the main space’s
        victim. The main space is a <strong>segmented LRU</strong>: entries start in <em>probation</em> and move to <em>protected</em> on their next hit.
      </p>
      <Proportion
        title={`Caffeine’s regions for maximumSize(${MAX.toLocaleString()}), computed from BoundedLocalCache (3.1.8)`}
        parts={[
          { label: 'window (LRU)', value: WINDOW, hue: 7, display: `${WINDOW} entries` },
          { label: 'probation (main, SLRU)', value: PROBATION, hue: 3, display: `${PROBATION} entries` },
          { label: 'protected (main, SLRU)', value: PROTECTED, hue: 6, display: `${PROTECTED} entries` },
        ]}
      />
      <Flow
        title="One miss through W-TinyLFU"
        cols={4}
        rows={2}
        nodes={[
          { id: 'new', label: 'new key', sub: 'missed, loaded', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'window', label: 'window', sub: 'LRU · 1 %', col: 1, row: 0, hue: 7 },
          { id: 'gate', label: 'admission', sub: 'sketch: f(cand) > f(victim)?', col: 2, row: 0, hue: 7 },
          { id: 'probation', label: 'probation', sub: 'main · 20 %', col: 3, row: 0, hue: 3 },
          { id: 'out', label: 'evicted', sub: 'candidate or victim', col: 2, row: 1, hue: 8, shape: 'actor' },
          { id: 'protected', label: 'protected', sub: 'main · 80 %', col: 3, row: 1, hue: 6 },
        ]}
        edges={[
          { from: 'new', to: 'window', hue: 1, flow: true },
          { from: 'window', to: 'gate', label: 'LRU out', hue: 7 },
          { from: 'gate', to: 'probation', label: 'wins', hue: 6 },
          { from: 'gate', to: 'out', label: 'loses', hue: 8 },
          { from: 'probation', to: 'protected', label: 'hit', hue: 6, both: true },
        ]}
        steps={[
          { title: 'Into the window', body: <p>Every new key enters the small LRU window, unconditionally. A key that is hit again while there just moves to the window’s tail.</p>, active: ['new', 'window', 'new>window'] },
          { title: 'Out of the window: a candidate', body: <p>When the window is over its share, its least recent key becomes the <em>candidate</em> and is moved to the tail of probation.</p>, active: ['window', 'gate', 'window>gate'] },
          { title: 'Candidate vs victim', body: <p>If the cache is over its maximum, the candidate is compared with probation’s least recent key, the <em>victim</em>, by sketch frequency. Higher wins; the victim wins ties. The loser is evicted.</p>, active: ['gate', 'probation', 'out', 'gate>probation', 'gate>out'] },
          { title: 'Proven: protected', body: <p>A hit on a probation entry promotes it to protected. When protected is over its 80 %, its least recent entry is demoted back to probation, where it can become a victim again.</p>, active: ['probation', 'protected', 'probation>protected'] },
        ]}
        caption="The window catches bursts of new popular keys (recency); the sketch and the segmented main space keep frequently used keys (frequency)."
      />
      <h3>Hill climbing: how big should the window be?</h3>
      <p>
        Some traffic rewards recency (a bigger window), some rewards frequency (a smaller one). Caffeine measures its hit rate over each sample of{' '}
        <code>10 × maximum</code> requests. If the rate went up since the last sample it keeps moving the window in the same direction, otherwise it
        reverses. The step starts at 6.25 % of the maximum, shrinks by 2 % each sample, and is reset to 6.25 % when the hit rate changes by 5 points or more (the traffic changed). The
        recorded window (read from Caffeine’s internals by reflection, for this demo only) moves while the traffic runs:
      </p>
      <EvictionLineChart
        title="Recorded: Caffeine’s window size during the Zipf + scans trace, 2,500 entries"
        series={windowSeries('scan', 2500)}
        xScale="linear"
        xLabel="requests (thousands)"
        yLabel="window, % of maximum"
        formatX={(v) => `${v.toFixed(0)}k`}
        formatY={(v) => `${v.toFixed(0)} %`}
        caption="Dashed: the lesson’s model with the same climbing rules. Both begin at 1 % and grow the window several times during the run; they do not move in lockstep (the model has no read buffers, and its sketch differs)."
      />

      <h2>What moka and lru-cache do</h2>
      <p>The three libraries sit at three points on the same scale: pure recency, frequency-gated LRU, and the adaptive mix.</p>
      <Table
        head={['', 'Caffeine 3.1.8', 'moka 0.12', 'lru-cache 11']}
        rows={[
          ['Policy', 'W-TinyLFU: window LRU + TinyLFU admission + segmented LRU main', 'TinyLFU admission + one LRU (the “window” deque exists in the source but is “Not used yet”)', 'LRU'],
          ['Frequency sketch', 'yes, 4-bit Count-Min, halved every 10 × max', 'yes, a port of Caffeine’s', 'no'],
          ['Adapts to the traffic', 'yes, hill climbing on the window size', 'no', 'no'],
          ['Other choices', '—', <><code>eviction_policy(EvictionPolicy::lru())</code></>, '—'],
          ['Applies reads and writes', 'buffered, drained in maintenance (on an executor)', 'buffered, drained by housekeeping on the calling thread', 'immediately, in the call'],
          ['Against hash flooding', 'admits a candidate with frequency ≥ 6 at random, 1 in 128', 'no (a TODO in the source)', 'n/a'],
        ]}
      />
      <p>
        Verified in the sources: Caffeine’s <code>BoundedLocalCache.evictFromMain</code> and <code>admit</code>; moka’s{' '}
        <code>sync/base_cache.rs</code> (<code>admit</code> compares the candidate with as many probation victims as its weight needs);
        lru-cache’s <code>#evict</code>, which always removes the head. moka’s LRU option recorded within a few tenths of a point of lru-cache on
        every trace — the same policy, applied in batches.
      </p>
      <Tabs items={LIBS.map((l) => ({ label: LIB_LABEL[l], content: <>{EVICTION_CODE[l].slice(1).map((s) => <CodeBlock key={s.title} title={s.title} language={s.language} code={s.code} />)}</> }))} />

      <h2>Recorded: six traces, three libraries</h2>
      <p>Each trace is 1,000,000 requests, generated deterministically and replayed through all three libraries at four sizes.</p>
      <p>
        A request is a read; a miss is followed by a put, like a cache in front of a database. The optimal line is Belady’s algorithm computed on
        the same trace. Caffeine {D.versions.caffeine} (Java {D.versions.java}), lru-cache {D.versions.lruCache} (Node {D.versions.node}), moka{' '}
        {D.versions.moka} ({D.versions.rust}); one run each. Hit ratios do not depend on the machine, but Caffeine and moka are slightly
        non-deterministic (random admission, time-based housekeeping), so a re-run can differ by a few tenths of a point.
      </p>
      <Tabs
        items={D.traces.map((t) => ({
          label: t.label,
          content: (
            <>
              <p>{t.description}</p>
              <EvictionLineChart
                title={`Recorded hit ratio, ${t.label}`}
                series={librarySeries(t.id)}
                xLabel="cache size (entries)"
                yLabel="hit ratio"
                formatX={(v) => v.toLocaleString()}
                yMax={100}
              />
            </>
          ),
        }))}
      />
      <Table
        head={['Trace', ...SIZES.map((s) => `${s.toLocaleString()} entries`)]}
        rows={D.traces.map((t) => [
          t.label,
          ...SIZES.map((s) => `C ${lib('caffeine', t.id, s).toFixed(0)} · m ${lib('moka', t.id, s).toFixed(0)} · L ${lib('lru-cache', t.id, s).toFixed(0)}`),
        ])}
      />
      <p>C = Caffeine, m = moka, L = lru-cache, hit ratio in %. What the numbers say:</p>
      <ul>
        <li>On skewed traffic, scans and loops, the frequency-aware caches beat LRU at the same size: by a few points on strongly skewed traffic in a large cache, by almost 80 points on the loop.</li>
        <li>
          On the shifting hot set at large sizes, plain LRU wins (lru-cache {pct(lib('lru-cache', 'shift', 5000))} vs Caffeine{' '}
          {pct(lib('caffeine', 'shift', 5000))} at 5,000 entries): when popularity moves fast and the cache can hold the whole new hot set,
          remembering old frequency costs more than it saves. Caffeine’s window adapts, but only part of the way.
        </li>
        <li>moka is within a point or two of Caffeine on most traces. It trails on the mildest skew (Zipf 0.6), and on the loop it is ahead at some sizes and behind at others: with every key equally frequent, small differences decide each tie.</li>
      </ul>

      <h2>How close are the models?</h2>
      <p>The lesson’s simulators (src/modules/local-cache/simulation) replayed the same traces; here is how far each one is from the library it imitates.</p>
      <Table
        head={['Trace', 'LRU model vs lru-cache', 'TinyLFU model vs moka', 'W-TinyLFU model vs Caffeine']}
        rows={D.traces.map((t) => [t.label, closeness('lru', 'lru-cache', t.id), closeness('tinylfu', 'moka', t.id), closeness('wtinylfu', 'caffeine', t.id)])}
      />
      <p>Mean absolute difference over the four sizes, in percentage points (pp); worst case in brackets (+ means the model hit more often).</p>
      <ul>
        <li><strong>LRU</strong> is exact: the model and lru-cache agree on every request.</li>
        <li>
          <strong>TinyLFU</strong> and <strong>W-TinyLFU</strong> are within one or two points on most traces. They differ where details matter: the
          models use their own hash functions and four separate rows of byte-sized counters, start the sketch at once instead of at half capacity,
          apply every request immediately instead of through buffers, and skip Caffeine’s random admission. On the loop, where every key has
          almost the same frequency, those details decide every tie, and the gap grows to ten points.
        </li>
      </ul>

      <h2>Policy playground</h2>
      <p>Replay a trace through all five models, then watch W-TinyLFU make every decision on a tiny cache.</p>
      <EvictionPlayground />

      <h2>Design rules</h2>
      <p>A short checklist for choosing and sizing a policy.</p>
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['Default to the library’s policy: Caffeine’s W-TinyLFU, moka’s TinyLFU', 'They match or beat LRU on nearly every recorded trace, and you cannot get the hit ratio back by adding memory cheaply.'],
          ['Expect scans if anything reads in bulk (exports, reindexing, crawlers)', 'An LRU loses its hot keys to every scan; give batch jobs their own cache or none, or use a frequency-aware cache.'],
          ['Use LRU (lru-cache, or moka’s EvictionPolicy::lru()) when recency is the whole story', 'Streams, “recently viewed”, fast-moving hot sets that fit in the cache: the shift trace shows LRU winning there.'],
          ['Size from the hit-ratio curve, not from a guess', 'Hit ratio flattens as the cache grows; record your own traffic (key per line) and replay it at a few sizes, as here.'],
          ['Measure the hit ratio in production', 'recordStats() in Caffeine, entry counts and your own hit/miss counters in moka and lru-cache (see Statistics, frameworks and pitfalls).'],
          ['Do not expect “most recently put stays”', 'With TinyLFU a new key can be rejected immediately; tests that put and then get under a full cache must allow for it.'],
        ]}
      />
      <Callout tone="warn" title="A rejected put is still a put">
        Under W-TinyLFU and TinyLFU, <code>put</code> on a full cache may evict the entry you just wrote (Caffeine’s removal listener reports cause
        SIZE for it; moka’s eviction listener does the same). Nothing is wrong: the cache judged the old entry more valuable. Never use a size-bounded
        cache as the only copy of data.
      </Callout>
      <Callout tone="tip" title="Related">
        The multi-level cache (<a href="#/redis/tiered-caching">Redis: Multi-level caching</a>) puts one of these caches in front of Redis; its hit
        ratio decides how many requests ever leave the process. Redis itself evicts with sampled LRU or LFU (<a href="#/redis/eviction">Redis: Eviction</a>).
        Time-based removal is the next lesson: <a href="#/local-cache/expiry">Expiry and refresh</a>.
      </Callout>

      <Recap
        points={[
          'A full cache evicts on every miss; the policy decides the hit ratio for a given amount of memory.',
          'LRU is a map plus a doubly linked list; one scan or a loop slightly larger than the cache flushes it.',
          'LFU keeps popular keys but clings to stale popularity and needs counts for keys it no longer holds.',
          'TinyLFU keeps approximate 4-bit counts for every key in a Count-Min sketch, halves them every 10 × maximum requests, and admits a newcomer only if it is more frequent than the victim.',
          'Caffeine’s W-TinyLFU adds a 1 % LRU window and a segmented main space (20 % probation, 80 % protected), and resizes the window by hill climbing; moka uses TinyLFU with a plain LRU; lru-cache is pure LRU.',
          'Recorded on 1,000,000-request traces, the frequency-aware caches won on skewed traffic, scans and loops; LRU won only on a fast-shifting hot set that fit in the cache.',
        ]}
      />
    </>
  )
}
