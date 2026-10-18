import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarList, CliSession, EvictionPlayground } from '../components'
import { CAPTURE } from '../data/captures'

const V = CAPTURE.eviction
const defaultPolicy = CAPTURE.operations.defaults['maxmemory-policy']
const baseline = V.hotCold.filter((r) => !('maxmemory-samples' in r))
const bySamples = V.hotCold.filter((r) => r.policy === 'allkeys-lru')
const lru = baseline.find((r) => r.policy === 'allkeys-lru')!

export default function Eviction() {
  return (
    <>
      <LessonGoals
        goals={[
          'set a memory limit and choose what happens when it is reached',
          'see why Redis approximates LRU and LFU, and what that does to hot keys',
          'size a Redis instance with room for everything that is not your data',
        ]}
        before="Lesson 6 — keys with a TTL"
      />

      <h2>A limit, and a decision</h2>
      <p>
        Redis keeps everything in RAM. <code>maxmemory</code> caps how much it may use for data (0, the default, means no limit — then the operating
        system decides, usually by killing the process). Once the limit is reached, every command that would add memory first asks the{' '}
        <strong>eviction policy</strong> what to do. The default policy is <code>{defaultPolicy}</code>.
      </p>
      <Table
        head={['maxmemory-policy', 'Which keys may be removed', 'Which one is removed', 'Use it for']}
        rows={[
          [<code key="1">noeviction</code>, 'none', '— writes fail with an OOM error', 'Redis as a primary store: data must not silently vanish'],
          [<code key="2">allkeys-lru</code>, 'any key', 'least recently used (approximately)', 'A cache with recency-driven access'],
          [<code key="3">allkeys-lfu</code>, 'any key', 'least frequently used (approximately)', 'A cache with a stable set of popular keys'],
          [<code key="4">allkeys-random</code>, 'any key', 'a random one', 'Uniform access, or when you don’t care'],
          [<code key="5">volatile-lru / -lfu / -random</code>, 'only keys with a TTL', 'as above', 'Cache keys (with TTL) and must-keep keys (without) in one instance'],
          [<code key="6">volatile-ttl</code>, 'only keys with a TTL', 'the one expiring soonest', 'When the TTL itself says how disposable a key is'],
          [<code key="7">allkeys-lrm / volatile-lrm</code>, 'any key / only keys with a TTL', 'least recently modified (newer in Redis 8)', 'When reads should not keep a key alive, only writes'],
        ]}
      />
      <TermList
        items={[
          { term: 'used_memory', definition: 'What Redis’s allocator handed out (data, buffers, overhead). Compared with maxmemory — minus replica output buffers and the AOF buffer, which are not counted.' },
          { term: 'eviction', definition: 'Deleting keys to get back under maxmemory, before running the command that needs the memory.' },
          { term: 'idle time', definition: 'Seconds since a key was last accessed (OBJECT IDLETIME), kept with second resolution.' },
          { term: 'LFU counter', definition: 'An 8-bit, logarithmic estimate of how often a key is accessed (OBJECT FREQ).' },
        ]}
      />

      <h2>noeviction: writes fail, reads continue</h2>
      <p>
        With a 2 MB limit, the recorded server accepted {V.noeviction.acceptedBeforeError.toLocaleString()} small keys and then refused the next write with:
      </p>
      <CliSession steps={V.noeviction.transcript} title="recorded: maxmemory 2mb, noeviction" />
      <p>
        Reads still work, and so do commands that free memory. But deleting one 100-byte key did not bring usage under the limit, so the next write still
        failed. The application gets an error on writes until enough is deleted or the limit is raised.
      </p>
      <Callout tone="warn" title="volatile-* without TTLs is noeviction">
        The same experiment with <code>volatile-lru</code> and keys that have no TTL accepted {V.volatileNoTtl.acceptedBeforeError.toLocaleString()} keys and
        then failed with the same error: <code>{V.volatileNoTtl.error}</code>. No key was eligible for eviction.
      </Callout>

      <h2>Approximated LRU: sample, then evict the oldest</h2>
      <p>
        Exact LRU needs every access to move the key to the front of one global list: a linked list with two pointers per key, updated millions of times a
        second. Redis does something cheaper. Each key stores a 24-bit <strong>clock value</strong> of its last access, with a resolution of one second.
        To evict, Redis samples <code>maxmemory-samples</code> random keys (default 5), adds the best candidates to a small <strong>eviction pool</strong>{' '}
        (16 entries, kept sorted across evictions), and evicts the best candidate in the pool. More samples come closer to true LRU at more CPU cost.
      </p>
      <p>
        The recording filled a 20 MB instance with 1,000 hot keys, then wrote 200,000 cold keys once while reading the hot keys over and over (200 hot reads
        per 1,000 writes). Memory held about {lru.keysLeft.toLocaleString()} keys, so roughly {lru.evicted.toLocaleString()} had to go. How many of the 1,000
        hot keys survived?
      </p>
      <BarList
        title="Hot keys still present after the run (of 1,000), recorded"
        max={1000}
        bars={baseline.map((r) => ({ label: r.policy, value: r.hotSurvived, emphasis: r.policy === 'allkeys-lfu', note: `${r.evicted.toLocaleString()} keys evicted` }))}
      />
      <p>
        LRU kept only {lru.hotSurvived} — far fewer than you would expect for keys read constantly. The suspect is the one-second clock: the whole run
        lasted a few seconds, so a hot key read 0.3 s ago and a cold key written 0.8 s ago can carry the <em>same</em> clock value, and LRU cannot tell
        them apart. The recording tested exactly that: the same LRU workload in one burst (twice) and spread over about 20 seconds with a short pause after
        every 1,000 writes.
      </p>
      <BarList
        title="allkeys-lru, the same workload at two speeds (hot keys kept of 1,000), recorded"
        max={1000}
        bars={V.lruPace.map((r, i) => ({
          label: 'pauseMsPerBatch' in r ? 'spread over ~20 s' : `one burst, run ${i + 1}`,
          value: r.hotSurvived,
          emphasis: 'pauseMsPerBatch' in r,
        }))}
      />
      <p>
        Spread out, hot keys are clearly fresher than cold ones and LRU keeps them; in a burst the result is low and varies from run to run. In a cache
        that lives for hours the clock’s resolution matters little; under a burst of writes it matters a lot.
      </p>
      <BarList
        title="allkeys-lru with different maxmemory-samples, recorded"
        max={1000}
        bars={bySamples.map((r) => ({
          label: `samples ${'maxmemory-samples' in r ? r['maxmemory-samples'] : 5}`,
          value: r.hotSurvived,
          emphasis: !('maxmemory-samples' in r),
          note: r.writeErrors ? `${r.writeErrors} writes failed with OOM although the policy allows evicting` : undefined,
          display: `${r.hotSurvived}${r.writeErrors ? ` · ${r.writeErrors} OOM errors` : ''}`,
        }))}
      />
      <p>
        {bySamples.some((r) => r.writeErrors) && (
          <>
            With a single sample some writes failed with OOM even though the policy allows evicting; a separate test showed that raising{' '}
            <code>maxmemory-eviction-tenacity</code> (the per-command eviction time limit) did not help, so the likely cause is an eviction round that
            found no usable candidate — likely, not proven by this recording.{' '}
          </>
        )}
        Under a burst these numbers move a lot
        between runs (compare the two burst runs above), so read them as a range, not a ranking: more samples cost CPU and cannot fix the clock’s
        resolution.
      </p>

      <h2>LFU: counting accesses in 8 bits</h2>
      <p>
        LFU keeps a counter per key in the same 24 bits as the LRU clock: 16 bits for the last decrement time (minutes) and an 8-bit counter. A new key
        starts at {V.lfu.initial}. Each access increments it only with probability <code>1 / ((counter − 5) × lfu-log-factor + 1)</code>, so the counter
        grows logarithmically and saturates at 255. Every <code>lfu-decay-time</code> minutes without access it drops by one, so yesterday’s favourite
        fades. Recorded with the defaults (log factor {V.lfu.logFactor}, decay time {V.lfu.decayTime} minute):
      </p>
      <Table head={['accesses', ...V.lfu.points.map((p) => p.accesses.toLocaleString())]} rows={[['OBJECT FREQ', ...V.lfu.points.map((p) => p.freq)]]} />
      <p>
        Ten accesses barely move the counter; a thousand reach about {V.lfu.points.find((p) => p.accesses === 1000)?.freq}; a million saturate it. That is enough to separate hot from cold — which
        is why <code>allkeys-lfu</code> kept {baseline.find((r) => r.policy === 'allkeys-lfu')!.hotSurvived.toLocaleString()} of 1,000 hot keys above. With LRU the server tracks idle seconds instead: a key left alone for two seconds
        reported <code>OBJECT IDLETIME</code> = {V.idletime}.
      </p>
      <Predict
        question={<p>A cache holds a product catalogue (read all day) and, every night, a batch job reads 5 million rarely used keys once. Which policy keeps the catalogue in memory best?</p>}
        options={['allkeys-lru', 'allkeys-lfu', 'noeviction']}
        answer={1}
        explanation="The nightly scan makes every scanned key ‘recently used’, so LRU throws the catalogue out. LFU sees one access per scanned key versus thousands per catalogue key, and keeps the catalogue."
      />

      <EvictionPlayground />

      <h2>Where the memory goes</h2>
      <p>
        <code>maxmemory</code> limits Redis’s own accounting of data, not the process size. Leave headroom for what is not counted or not data:
      </p>
      <Table
        head={['Also uses RAM', 'Why it matters']}
        rows={[
          ['Replica output buffers and the AOF buffer', 'Not counted against maxmemory; a slow replica can hold hundreds of MB (lesson 11)'],
          ['Client output buffers', 'Big replies and slow subscribers (lesson 13)'],
          ['Fragmentation', 'RSS above used_memory; mem_fragmentation_ratio in INFO (lesson 16)'],
          ['Copy-on-write during BGSAVE / AOF rewrite', 'Pages changed while the child saves are duplicated (lesson 10)'],
        ]}
      />
      <Callout tone="note" title="Big keys make eviction slow">
        Evicting a key frees its memory synchronously unless <code>lazyfree-lazy-eviction yes</code> hands that work to a background thread. Evicting
        one hash with a million fields can block the server just like a slow command.
      </Callout>

      <h2>Design rules</h2>
      <Callout tone="tip" title="Choosing">
        <ul>
          <li>Decide first: is this Redis a <strong>cache</strong> (losing keys is fine) or a <strong>store</strong> (it is not)? Better, run them as separate instances.</li>
          <li>Caches: always set <code>maxmemory</code> and an <code>allkeys-*</code> policy — <code>allkeys-lfu</code> for stable popularity, <code>allkeys-lru</code> for recency. Never leave a cache on noeviction.</li>
          <li>Stores: <code>noeviction</code>, alerts on used memory, and handle OOM errors in the application.</li>
          <li><code>volatile-*</code> only works if the evictable keys have TTLs; otherwise it behaves like noeviction.</li>
          <li>Leave headroom between <code>maxmemory</code> and the machine’s RAM when the instance also persists or replicates, so buffers and copy-on-write fit — a common rule of thumb is 60–75% of RAM.</li>
          <li>Watch <code>evicted_keys</code> in INFO stats: a cache that evicts constantly is too small, and its hit rate (lesson 14) shows it.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          `maxmemory sets the limit; the policy decides what happens — the default ${defaultPolicy} makes writes fail.`,
          'LRU and LFU are approximations: sample a few keys, keep the best candidates in a pool, evict one.',
          'The LRU clock has one-second resolution, so under a burst LRU confuses hot and cold keys; LFU counts accesses and does not.',
          'The LFU counter is 8 bits, grows logarithmically, starts at 5 and decays with time.',
          'Plan RAM for buffers, fragmentation and copy-on-write, not only for data.',
        ]}
      />
    </>
  )
}
