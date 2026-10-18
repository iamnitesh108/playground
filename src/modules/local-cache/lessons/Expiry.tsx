import { BarChart, Flow, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { ExpiryHistogram } from '../components/ExpiryHistogram'
import { ExpiryPerEntry, ExpiryRefreshRun, ExpiryTwoClocks } from '../components/ExpiryRecorded'
import { ExpirySimulator } from '../components/ExpirySimulator'
import { POLICY_CAPTURE as D } from '../data/policies'
import { EXPIRY_CODE, LIB_LABEL, type Lib, type Snippet } from '../data/policiesSources'

const E = D.expiry
const LIBS: Lib[] = ['caffeine', 'lruCache', 'moka']

/** A recorded run as a transcript: one line per operation or listener call. */
type Line = { t?: number; event: string; op?: string; result?: unknown; key?: string; cause?: string; reason?: string }
const transcript = (lines: readonly Line[], unit: string) =>
  lines
    .map((l) => {
      const at = `t=${String(l.t)}${unit}`.padEnd(9)
      return l.event === 'op' ? `${at} ${l.op} → ${String(l.result)}` : `${at}   listener: ${l.key} removed (${l.cause ?? l.reason})`
    })
    .join('\n')

const codeTabs = (snippets: Partial<Record<Lib, Snippet>>, extra?: Partial<Record<Lib, string>>) =>
  LIBS.filter((l) => snippets[l]).map((l) => ({
    label: LIB_LABEL[l],
    content: (
      <>
        <CodeBlock title={snippets[l]!.title} language={snippets[l]!.language} code={snippets[l]!.code} />
        {extra?.[l] && <CodeBlock title="recorded output" language="text" code={extra[l]!} />}
      </>
    ),
  }))

// Caffeine's (and moka's) timer wheel: 64 buckets of 2^30 ns, 64 of 2^36 ns, 32 of 2^42 ns, 4 of 2^47 ns, then one overflow bucket
const SPANS_NS = [2 ** 30, 2 ** 36, 2 ** 42, 2 ** 47, 4 * 2 ** 47, 4 * 2 ** 47]
const BUCKETS = [64, 64, 32, 4, 1]
const LEVEL_NAMES = ['seconds wheel', 'minutes wheel', 'hours wheel', 'days wheel', 'overflow']
const human = (ns: number) => {
  const s = ns / 1e9
  return s < 60 ? `${s.toFixed(2)} s` : s < 3600 ? `${(s / 60).toFixed(2)} min` : s < 86400 ? `${(s / 3600).toFixed(2)} h` : `${(s / 86400).toFixed(1)} d`
}
/** TimerWheel.schedule: the first level whose next span is larger than the time left. */
const levelOf = (seconds: number) => {
  const ns = seconds * 1e9
  for (let i = 0; i < 4; i++) if (ns < SPANS_NS[i + 1]) return i
  return 4
}

const sched = E.caffeine.scheduler
const noScheduler = sched.find((s) => !s.scheduler)!
const shortTtl = sched.find((s) => s.scheduler && s.ttlMs === 300)!
const longTtl = sched.find((s) => s.scheduler && s.ttlMs === 2000)!
const autopurge = E.lruCache.autopurge.find((l) => l.event === 'dispose')!
const mokaIdle = E.moka.idle.find((l) => l.event === 'listener')!
const perEntryPuts = E.caffeine.perEntry.filter((l) => l.event === 'put')
const caffeinePrice = E.caffeine.perEntry.find((l) => l.event === 'removed' && l.key === 'price:7')!
const mokaPrice = E.moka.perEntry.find((l) => l.event === 'removed' && l.key === 'price:7')!
const jitter = (on: boolean) => E.caffeine.jitter.find((j) => j.jitter === on)!.loadsPerSecond
const slowest = (lines: readonly { mode: string; event: string; ms?: number }[], mode: string) =>
  Math.max(...lines.filter((l) => l.mode === mode && l.event === 'read').slice(1).map((l) => l.ms ?? 0))

export default function Expiry() {
  const peakPlain = Math.max(...jitter(false))
  const peakJitter = Math.max(...jitter(true).slice(1))
  return (
    <>
      <LessonGoals
        goals={[
          'choose between expire-after-write (TTL), expire-after-access (TTI) and a lifetime per entry, in Caffeine, lru-cache and moka',
          'explain why an expired entry is invisible at once but removed later, and what removes it (maintenance, a scheduler, a timer, housekeeping)',
          'describe the hierarchical timer wheel behind per-entry expiry',
          'use refresh (stale-while-revalidate) so readers stop waiting for reloads, and jitter so entries do not all expire together',
        ]}
        before={<>Using it day to day (<a href="#/local-cache/using">#/local-cache/using</a>) and, for why caches go stale at all, <a href="#/redis/caching">Redis: Caching patterns</a>.</>}
      />

      <h2>Three clocks an entry can have</h2>
      <p>Size limits decide what to drop when memory runs out; expiry decides what to drop because it is too old to trust.</p>
      <p>
        An entry can expire a fixed time after it was <strong>written</strong> (time to live, TTL), a fixed time after it was last <strong>read</strong>{' '}
        (time to idle, TTI), or at a time chosen <strong>per entry</strong> (a session lives 30 minutes, a price 5 seconds). All three libraries offer
        all three, under different names and with different defaults — checked in each library’s source:
      </p>
      <Table
        head={['', 'Caffeine 3.1.8', 'lru-cache 11', 'moka 0.12']}
        rows={[
          ['After write (TTL)', <code key="c">expireAfterWrite(Duration)</code>, <code key="l">ttl: ms</code>, <code key="m">time_to_live(Duration)</code>],
          ['After access (TTI)', <code key="c">expireAfterAccess(Duration)</code>, <><code>ttl</code> + <code>updateAgeOnGet: true</code></>, <code key="m">time_to_idle(Duration)</code>],
          ['Per entry', <><code>expireAfter(Expiry)</code>: create, update, read</>, <code key="l">set(k, v, {'{ ttl }'})</code>, <><code>expire_after(impl Expiry)</code>: create, read, update</>],
          ['Default', 'no expiry', <><code>ttl</code> 0 = no TTL; <code>updateAgeOnGet</code>, <code>allowStale</code>, <code>ttlAutopurge</code> false; <code>ttlResolution</code> 1 ms</>, 'no expiry'],
          ['Serve stale while reloading', <><code>refreshAfterWrite</code> (loading caches only)</>, <><code>fetch()</code> with <code>allowStale</code></>, 'not built in'],
          ['Remove without being asked', <><code>scheduler(Scheduler…)</code></>, <><code>ttlAutopurge: true</code> (a timer per entry)</>, <>no; housekeeping on later calls, or <code>run_pending_tasks()</code></>],
        ]}
      />
      <p>
        Caffeine refuses to combine <code>expireAfter</code> with the fixed ones (“expireAfterWrite may not be used with variable expiration”), and{' '}
        <code>refreshAfterWrite</code> on a cache without a loader (“refreshAfterWrite requires a LoadingCache”).
      </p>
      <TermList
        items={[
          { term: 'TTL (time to live)', definition: 'Expire a fixed time after the value was written. Bounds how old a value can be.' },
          { term: 'TTI (time to idle)', definition: 'Expire a fixed time after the last read. Keeps busy entries forever, so it bounds memory, not staleness.' },
          { term: 'variable expiry', definition: 'A lifetime computed per entry (from the key or value), e.g. the max-age a server sent.' },
          { term: 'stale', definition: 'Older than the source of truth. Every cached value is potentially stale; TTL caps for how long.' },
          { term: 'refresh', definition: 'Reload a value in the background while still serving the old one (stale-while-revalidate).' },
          { term: 'maintenance / housekeeping', definition: 'The work a cache does after reads and writes: apply buffered events, evict, and remove expired entries.' },
        ]}
      />
      <p>The difference shows when an entry is read regularly and then left alone. Each library was recorded reading one entry with both clocks:</p>
      <Tabs
        items={[
          {
            label: LIB_LABEL.caffeine,
            content: <ExpiryTwoClocks title="Recorded (hand-moved Ticker): 5 s lifetime, read every 2 s until 10 s, then once at 16 s" rows={E.caffeine.writeVsAccess} variants={[{ key: 'afterWrite', label: 'expireAfterWrite', sliding: false }, { key: 'afterAccess', label: 'expireAfterAccess', sliding: true }]} unit="s" lifetime={5} />,
          },
          {
            label: LIB_LABEL.lruCache,
            content: <ExpiryTwoClocks title="Recorded (real time): ttl 500 ms, read every 200 ms until 1 s, then once at 1.6 s" rows={E.lruCache.ageOnGet} variants={[{ key: 'plain', label: 'ttl', sliding: false }, { key: 'updateAgeOnGet', label: 'ttl + updateAgeOnGet', sliding: true }]} unit="ms" lifetime={500} />,
          },
          {
            label: LIB_LABEL.moka,
            content: <ExpiryTwoClocks title="Recorded (real time): 500 ms, read every 200 ms until 1 s, then once at 1.6 s" rows={E.moka.ttlVsTti} variants={[{ key: 'timeToLive', label: 'time_to_live', sliding: false }, { key: 'timeToIdle', label: 'time_to_idle', sliding: true }]} unit="ms" lifetime={500} />,
          },
        ]}
      />
      <Tabs items={codeTabs(EXPIRY_CODE.lifetimes)} />
      <Callout tone="warn" title="TTI alone never bounds staleness">
        A value read every few seconds under a 5-minute time to idle is never reloaded: it can be days old. Use TTI to drop entries nobody uses; use a
        TTL (or refresh) whenever the value can change at the source. Caffeine and moka let you set both.
      </Callout>

      <h2>Invisible is not removed</h2>
      <p>An expired entry stops being returned the moment it expires, but it stays in memory until something cleans it up.</p>
      <p>
        No library walks its entries on a timer by default. A read checks the entry’s own expiry time and treats an expired one as a miss; removing it
        (and calling the removal listener) happens in the cache’s maintenance, which runs after reads and writes. Until then the entry still counts
        towards the size. Recorded with two entries and a short lifetime, then one read after both expired:
      </p>
      <Predict
        question={<p>Caffeine, <code>expireAfterWrite(5 s)</code>, entries a and b written at 0 s. At 6 s, before any other call, what does <code>estimatedSize()</code> return?</p>}
        options={['0 — both expired', '2 — both are still stored', '1']}
        answer={1}
        explanation={`Recorded: ${E.caffeine.lazy.find((l) => l.op === 'estimatedSize()')!.result}. The entries are invisible to get but still stored. The next read of a found the expired entry, returned null and triggered maintenance, which removed a and b (the listener fired for both at that read).`}
      />
      <Tabs items={codeTabs(EXPIRY_CODE.lazy, { caffeine: transcript(E.caffeine.lazy, ' s'), lruCache: transcript(E.lruCache.lazy, 'ms'), moka: transcript(E.moka.lazy, 'ms') })} />
      <ul>
        <li>
          <strong>Caffeine</strong>: size 2 after expiry; the read of <code>a</code> returned null and ran maintenance, which removed both (with{' '}
          <code>executor(Runnable::run)</code> the listener runs on the reading thread; by default it runs on ForkJoinPool.commonPool, a moment later).
        </li>
        <li>
          <strong>lru-cache</strong>: <code>get(a)</code> deleted only <code>a</code> (dispose reason <code>expire</code>); <code>b</code> stayed counted in{' '}
          <code>size</code> until <code>purgeStale()</code>. Stale entries otherwise leave only through normal LRU eviction.
        </li>
        <li>
          <strong>moka</strong>: <code>entry_count()</code> said 0 even right after the inserts — moka applies writes in its housekeeping, so the count lags.
          The <code>get</code> at 300 ms ran the housekeeping (300 ms had passed since the last run) and the listener fired for both.
        </li>
      </ul>

      <h2>Who cleans up an idle cache?</h2>
      <p>If nobody touches the cache after entries expire, the answer differs per library — and matters if the listener closes resources.</p>
      <BarChart
        title="Recorded (real time): when the removal listener fired for an entry nobody read again"
        unit=" ms"
        max={4100}
        bars={[
          { label: `Caffeine, no scheduler (TTL ${noScheduler.ttlMs} ms)`, value: noScheduler.waitedMs, display: `not within ${(noScheduler.waitedMs / 1000).toFixed(1)} s`, hue: 8, note: 'nothing ran maintenance' },
          { label: `Caffeine + Scheduler (TTL ${shortTtl.ttlMs} ms)`, value: shortTtl.firedAfterMs ?? 0, hue: 1, note: 'the scheduler waits at least 1.07 s' },
          { label: `Caffeine + Scheduler (TTL ${longTtl.ttlMs} ms)`, value: longTtl.firedAfterMs ?? 0, hue: 1 },
          { label: 'lru-cache ttlAutopurge (ttl 200 ms)', value: autopurge.afterMs ?? 0, hue: 3, note: 'a setTimeout of ttl + 1 ms per entry' },
          { label: 'moka (TTL 200 ms), next call at 1 s', value: mokaIdle.afterMs ?? 0, hue: 2, note: 'fired inside the next get' },
        ]}
      />
      <ul>
        <li>
          <strong>Caffeine</strong> without a scheduler never removed it: after {(noScheduler.waitedMs / 1000).toFixed(1)} s the size was still{' '}
          {noScheduler.estimatedSize}. With <code>Scheduler.systemScheduler()</code> it fired at {shortTtl.firedAfterMs} ms for a 300 ms TTL — Caffeine’s{' '}
          <code>Pacer</code> never schedules sooner than 2<sup>30</sup> ns (1.07 s) ahead, to batch work — and on time ({longTtl.firedAfterMs} ms) for 2 s.
        </li>
        <li>
          <strong>lru-cache</strong> with <code>ttlAutopurge</code> fired after {autopurge.afterMs} ms: one <code>setTimeout</code> per entry. The docs warn it
          “may significantly degrade performance” for many entries; without it, nothing is removed until touched.
        </li>
        <li>
          <strong>moka</strong> has no background thread in 0.12: housekeeping runs inside cache calls once 64 reads or writes are pending or 300 ms have
          passed. The listener fired at {mokaIdle.afterMs} ms, inside the first call after the idle second. Call <code>run_pending_tasks()</code> from your
          own timer if removal must be prompt.
        </li>
      </ul>
      <Tabs items={codeTabs(EXPIRY_CODE.cleaner)} />

      <h2>Timer wheels: per-entry expiry in O(1)</h2>
      <p>With one fixed lifetime, entries expire in the order they were written, so a queue is enough; with a lifetime per entry, they do not.</p>
      <p>
        For TTL and TTI Caffeine keeps entries in write-order and access-order lists and removes from the head while the head is expired. For a
        lifetime per entry it uses a <strong>hierarchical timer wheel</strong> (moka ported the same design): five rings of buckets with coarser and
        coarser spans. An entry is filed in a bucket by how far away its expiry is. As time advances, buckets that come due on a coarse ring are
        emptied into finer rings (a cascade), and due buckets on the finest ring expire their entries. Scheduling, rescheduling and removal are O(1).
      </p>
      <Table
        head={['Ring', 'Buckets', 'Each bucket spans', 'The ring covers']}
        rows={BUCKETS.map((b, i) => [LEVEL_NAMES[i], b, human(SPANS_NS[i]), i < 4 ? human(SPANS_NS[i] * b) : 'everything later'])}
      />
      <Flow
        title="Caffeine’s timer wheel with the recorded per-entry lifetimes"
        cols={5}
        rows={3}
        rowHeight={78}
        nodes={[
          ...perEntryPuts.map((p, i) => ({ id: p.key, label: p.key, sub: `lives ${human((p.ttlSeconds ?? 0) * 1e9)}`, col: i, row: 0, hue: 3 as const })),
          ...LEVEL_NAMES.map((name, i) => ({ id: `w${i}`, label: name, sub: `${BUCKETS[i]} × ${human(SPANS_NS[i])}`, col: i, row: 1, hue: 7 as const, shape: 'queue' as const })),
          { id: 'gone', label: 'removed', sub: 'listener: EXPIRED', col: 0, row: 2, hue: 8, shape: 'actor' },
        ]}
        edges={[
          ...perEntryPuts.map((p) => ({ from: p.key, to: `w${levelOf(p.ttlSeconds ?? 0)}`, hue: 3 as const })),
          { from: 'w1', to: 'w0', label: 'cascade', hue: 7 },
          { from: 'w2', to: 'w1', label: 'cascade', hue: 7 },
          { from: 'w3', to: 'w2', hue: 7 },
          { from: 'w4', to: 'w3', hue: 7 },
          { from: 'w0', to: 'gone', label: 'due', hue: 8, flow: true },
        ]}
        steps={[
          { title: 'File by distance', body: <p>Each entry goes to the first ring whose span can hold its remaining time: 5 s into the seconds wheel, 90 s and 30 min into the minutes wheel, 2 h into the hours wheel.</p>, active: [...perEntryPuts.map((p) => p.key), ...perEntryPuts.map((p) => `${p.key}>w${levelOf(p.ttlSeconds ?? 0)}`), 'w0', 'w1', 'w2'] },
          { title: 'Time advances in maintenance', body: <p>Every maintenance run moves each ring forward to the current time. Nothing happens per entry while its bucket is not due — that is what makes the wheel cheap.</p>, active: ['w0', 'w1', 'w2', 'w3', 'w4'] },
          { title: 'Cascade', body: <p>When a coarse bucket comes due, its entries are not expired yet — they are re-filed into a finer ring, closer to their exact time.</p>, active: ['w1', 'w0', 'w2', 'w1>w0', 'w2>w1'] },
          { title: 'Due on the finest ring', body: <p>When a seconds-wheel bucket is passed, its entries that have expired are removed and the listener is called; the rest are re-filed. So removal happens at a bucket boundary, up to about a second after the expiry time.</p>, active: ['w0', 'gone', 'w0>gone'] },
        ]}
        caption="Bucket spans are powers of two in nanoseconds (TimerWheel.SPANS); moka’s timer_wheel.rs uses the same five rings."
      />
      <p>The recordings show the bucket boundary. Both read the entry as absent from the exact expiry time, but removed it at the next tick of the seconds wheel:</p>
      <Tabs
        items={[
          {
            label: LIB_LABEL.caffeine,
            content: (
              <>
                <ExpiryPerEntry title="Recorded (hand-moved Ticker, 100 ms steps, cleanUp each step): price:7, the first 7 s" lines={E.caffeine.perEntry} unit="s" scale={1} end={7} />
                <Table
                  head={['Key', 'Lifetime', 'Filed in', 'Invisible from', 'Removed (listener)']}
                  rows={perEntryPuts.map((p) => {
                    const at = (event: string) => E.caffeine.perEntry.find((l) => l.event === event && l.key === p.key)?.t
                    return [<code key="k">{p.key}</code>, human((p.ttlSeconds ?? 0) * 1e9), LEVEL_NAMES[levelOf(p.ttlSeconds ?? 0)], `${at('invisible')} s`, `${at('removed')} s`]
                  })}
                />
                <p>
                  <code>price:7</code> (5 s) was invisible at 5.0 s and removed at {caffeinePrice.t} s, when the clock passed the end of its 1.07 s bucket
                  (5 × 1.07 = 5.37 s). The others ({perEntryPuts.slice(1).map((p) => p.key).join(', ')}) were removed at their exact second in 1 s steps.
                </p>
              </>
            ),
          },
          {
            label: LIB_LABEL.moka,
            content: (
              <>
                <ExpiryPerEntry title="Recorded (real time, run_pending_tasks every 50 ms)" lines={E.moka.perEntry} unit="ms" scale={1} end={4500} />
                <p>
                  moka has no hand-moved clock outside its own tests (its mock clock is crate-private), so this ran in real time. <code>price:7</code> (300 ms) was
                  invisible at 300 ms and removed at {mokaPrice.afterMs} ms — the first 1.07 s tick. Each removal lands just after a multiple of 1.07 s.
                </p>
              </>
            ),
          },
        ]}
      />
      <Tabs items={codeTabs(EXPIRY_CODE.perEntry)} />
      <Callout tone="note" title="lru-cache has no wheel">
        lru-cache stores a start time and a TTL per entry (in two arrays sized to max) and checks them on access; with <code>ttlAutopurge</code> it adds one timer per
        entry. Fine for thousands of entries; for many more with short lifetimes, leave autopurge off and let LRU eviction push stale entries out.
      </Callout>

      <h2>Refresh instead of expire</h2>
      <p>When an entry expires, the next reader pays for the reload; refresh makes the reload happen in the background instead.</p>
      <p>
        With <code>refreshAfterWrite</code>, an entry older than the refresh time is still returned, and the read that noticed it starts a reload on the
        cache’s executor. The new value replaces the old one when it arrives. Readers never wait (except for the very first, cold load), at the price of
        one more read of the old value. This is <strong>stale-while-revalidate</strong>. Recorded: one reader every 100 ms, a load of 200 ms, a 1 s lifetime.
      </p>
      <Tabs
        items={[
          {
            label: LIB_LABEL.caffeine,
            content: (
              <ExpiryRefreshRun
                title="Recorded: expireAfterWrite vs refreshAfterWrite (1 s, load 200 ms)"
                lines={E.caffeine.refresh}
                modes={[{ mode: 'expireAfterWrite', label: 'expire', background: false }, { mode: 'refreshAfterWrite', label: 'refresh', background: true }]}
              />
            ),
          },
          {
            label: LIB_LABEL.lruCache,
            content: (
              <ExpiryRefreshRun
                title="Recorded: fetch() with ttl 1 s, without and with allowStale (load 200 ms)"
                lines={E.lruCache.fetch}
                modes={[{ mode: 'ttl only', label: 'ttl', background: false }, { mode: 'allowStale', label: 'allowStale', background: true }]}
              />
            ),
          },
          {
            label: LIB_LABEL.moka,
            content: (
              <>
                <ExpiryRefreshRun title="Recorded: get_with after time_to_live 1 s (load 200 ms)" lines={E.moka.reload} modes={[{ mode: 'time_to_live', label: 'time_to_live', background: false }]} />
                <p>moka 0.12 has no refresh: after expiry, <code>get_with</code> runs the loader and the caller waits (other callers of the same key wait for the same load).</p>
              </>
            ),
          },
        ]}
      />
      <StatTiles
        title="Recorded: the slowest read after the first (cold) load"
        stats={[
          { label: 'Caffeine expireAfterWrite', value: `${slowest(E.caffeine.refresh, 'expireAfterWrite').toFixed(0)} ms`, sub: 'a reader waits for each reload', hue: 8 },
          { label: 'Caffeine refreshAfterWrite', value: `${slowest(E.caffeine.refresh, 'refreshAfterWrite').toFixed(1)} ms`, sub: 'the old value, reload in the background', hue: 6 },
          { label: 'lru-cache fetch, allowStale', value: `${slowest(E.lruCache.fetch, 'allowStale').toFixed(1)} ms`, sub: `without allowStale: ${slowest(E.lruCache.fetch, 'ttl only').toFixed(0)} ms`, hue: 6 },
          { label: 'moka get_with', value: `${slowest(E.moka.reload, 'time_to_live').toFixed(0)} ms`, sub: 'no refresh: waits for the load', hue: 8 },
        ]}
      />
      <Tabs items={codeTabs(EXPIRY_CODE.refresh)} />
      <Callout tone="tip" title="Refresh plus expire">
        Refresh only happens when someone reads. Pair it with a longer expiry (e.g. refresh after 1 minute, expire after 10) so an entry nobody reads still
        goes away, and a value is never older than the expiry even if every reload fails. In Caffeine a failed refresh keeps the old value and logs the
        error; in lru-cache see <code>allowStaleOnFetchRejection</code>.
      </Callout>

      <h2>Jitter: do not let everything expire at once</h2>
      <p>Entries loaded together with the same TTL expire together, and the reloads hit the database together.</p>
      <p>
        After a deploy or a cache clear, thousands of entries are loaded within a second. With one fixed TTL they all expire in the same second, every
        TTL, for as long as the traffic keeps them hot. A random ±10 % on each entry’s lifetime spreads the reloads out, and the spread widens with
        every round. Recorded with Caffeine on a hand-moved clock: 1,000 keys, each read once per simulated second for 3 minutes, 60 s lifetime.
      </p>
      <ExpiryHistogram
        title="Recorded (Caffeine, hand-moved Ticker): loads per second"
        unit="loads"
        step="s"
        rows={[
          { label: 'expireAfterWrite(60 s)', values: jitter(false), hue: 8 },
          { label: 'expireAfter: 60 s ± 10 % per entry', values: jitter(true), hue: 5 },
        ]}
        caption={`Fixed TTL: ${peakPlain.toLocaleString()} loads in one second, every 60 s. With jitter, after the cold start, the busiest second had ${peakJitter} loads.`}
      />
      <Tabs items={[{ label: LIB_LABEL.caffeine, content: <CodeBlock title={EXPIRY_CODE.jitter.title} language={EXPIRY_CODE.jitter.language} code={EXPIRY_CODE.jitter.code} /> }]} />
      <p>
        In lru-cache, pass a jittered <code>ttl</code> to each <code>set</code>; in moka, return it from <code>Expiry::expire_after_create</code>. Refresh
        helps too: background reloads of hot keys never pile up on readers.
      </p>

      <h2>Choosing a TTL</h2>
      <p>A TTL is a promise about staleness: no value is older than this, measured from when it was loaded.</p>
      <Table
        head={['Data', 'Typical choice', 'Why']}
        rows={[
          ['Reference data (countries, feature flags, config)', 'minutes, refresh', 'Rarely changes; readers should never wait.'],
          ['Product page, profile', 'seconds to a minute, plus invalidation', 'Changes sometimes; a short TTL is the safety net for missed invalidations (see Multi-level caching).'],
          ['Prices, stock, balances', 'seconds, or do not cache', 'Users act on the value; the source of truth decides.'],
          ['Sessions, tokens', 'per entry, from their own expiry', 'The lifetime is part of the data; use variable expiry.'],
          ['Expensive reports', 'TTI to free memory + TTL for freshness', 'Kept only while someone looks at them.'],
        ]}
      />
      <p>
        Shorter TTLs mean fresher values and more loads; longer ones mean fewer loads and older values. Refresh moves the reload off the reader; it does not
        make values fresher. The simulator below shows the trade-off on one key.
      </p>

      <h2>Playground: TTL, TTI and refresh</h2>
      <p>Change the policy and the timings and watch who waits and how stale the answers get.</p>
      <ExpirySimulator />

      <h2>Design rules</h2>
      <p>The checklist for expiry in an in-process cache.</p>
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['Set a size limit and a TTL', 'Size bounds memory; TTL bounds staleness. TTI alone bounds neither for busy keys.'],
          ['Prefer refresh (Caffeine refreshAfterWrite, lru-cache fetch + allowStale) for hot keys', 'Readers stop paying for reloads; pair it with a longer expiry.'],
          ['Add jitter when many entries are loaded together', 'A fixed TTL turns one burst of loads into a burst every TTL.'],
          ['Do not rely on the removal listener firing on time', 'Expired entries are removed in maintenance: on later calls, or by a Caffeine Scheduler, lru-cache ttlAutopurge, or your own moka run_pending_tasks().'],
          ['Do not use size or entry_count as “live entries”', 'They include expired entries not yet cleaned up (and moka’s count lags its writes).'],
          ['Test with a fake clock', 'Caffeine’s Ticker and lru-cache’s perf option let tests move time by hand; moka needs real sleeps.'],
        ]}
      />
      <Callout tone="analogy" title="Milk in the fridge">
        The date on the carton (TTL) is what makes the milk “expired”; it still sits in the fridge until someone opens the door and throws it out
        (maintenance). Refresh is buying a new carton when the old one is getting close, and drinking the old one until the new one is home.
      </Callout>
      <Callout tone="tip" title="Related">
        Next: <a href="#/local-cache/loading">Loading, single-flight and concurrency</a>. Redis expires keys lazily and with an active sampling cycle (
        <a href="#/redis/eviction">Redis: Eviction</a>); a multi-level cache combines an L1 TTL with invalidation (<a href="#/redis/tiered-caching">Redis: Multi-level caching</a>).
      </Callout>

      <Recap
        points={[
          'TTL (expire after write) bounds staleness; TTI (expire after access) bounds memory for idle entries; a per-entry Expiry handles data that carries its own lifetime.',
          'Expired entries are invisible at once but removed only in maintenance: recorded, Caffeine and lru-cache kept counting them, and moka’s count lagged.',
          'An idle cache is cleaned only with a Caffeine Scheduler (not sooner than 1.07 s), lru-cache ttlAutopurge (a timer per entry), or your own moka run_pending_tasks().',
          'Per-entry expiry uses a hierarchical timer wheel (Caffeine and moka): O(1), with removal at the next ~1.07 s bucket boundary.',
          'Refresh serves the old value while reloading in the background: recorded, readers stopped waiting 200 ms; moka has no refresh.',
          'Jitter spreads expiries: recorded, 1,000 loads in one second every minute became a few dozen per second.',
        ]}
      />
    </>
  )
}
