import { Callout, LessonGoals, Predict, Recap, TermList } from '@/shared/ui'
import { Flow, Proportion, StatTiles } from '@/shared/figures'
import { CliSession } from '../components/CliSession'
import { ExpiryPlayground } from '../components/ExpiryPlayground'
import { LineChart } from '../components/LineChart'
import { ExpiryTtlFigure } from '../components/ExpiryFigures'
import { CAPTURE } from '../data/captures'

const E = CAPTURE.expiry
const lazy = E.lazy
const mixed = E.mixed

/** When each drain run started losing keys and when it reached zero. */
const drain = E.active.map((run) => {
  const total = run.samples[0].keys
  const start = run.samples.find((s) => s.keys < total)?.ms ?? 0
  const end = run.samples.find((s) => s.keys === 0)?.ms ?? run.samples[run.samples.length - 1].ms
  return { ...run, total, start, end }
})

export default function Expiry() {
  return (
    <>
      <LessonGoals
        goals={[
          'set, read, keep and remove TTLs correctly — including the commands that silently drop them',
          'see the two ways a key actually disappears: lazily when touched, actively by a cursor that walks the keys with a TTL',
          'understand why expired keys can sit in memory for a long time',
        ]}
        before="Lesson 5 — the keyspace is a hash table"
      />

      <h2>A TTL is a deadline attached to a key</h2>
      <p>A TTL tells Redis when to delete a key; the tricky part is which commands keep it and which drop it.</p>
      <p>
        Any key can get an expiry time. Redis stores it as an absolute Unix time in milliseconds in a second table (the <em>expires</em> dict, next to
        the keyspace). <code>TTL</code> and <code>PTTL</code> compute the time left. The rules about which commands keep or drop the TTL are where
        bugs come from, so here they are, recorded:
      </p>
      <TermList
        items={[
          { term: 'TTL / PTTL', definition: 'Seconds / milliseconds left. -1: the key exists but has no expiry. -2: the key does not exist.' },
          { term: 'EX / PX / EXAT / PXAT', definition: 'Options of SET: relative seconds / milliseconds, or an absolute Unix time.' },
          { term: 'KEEPTTL', definition: 'SET option: replace the value but keep the current expiry.' },
          { term: 'PERSIST', definition: 'Remove the expiry; the key lives forever again.' },
          { term: 'NX / XX / GT / LT', definition: 'EXPIRE options: only set an expiry if there is none / if there is one / if the new one is later / earlier.' },
        ]}
      />
      <CliSession steps={E.rules} title="recorded: TTL rules" />
      <ExpiryTtlFigure
        keeps={[
          { command: 'SET … KEEPTTL', note: 'replaces the value, keeps the deadline' },
          { command: 'INCR, APPEND, LPUSH, HSET…', note: 'change the value in place' },
          { command: 'RENAME', note: 'the TTL moves with the key' },
          { command: 'EXPIRE … GT', note: 'changed only if the new deadline is later' },
        ]}
        drops={[
          { command: 'SET (plain)', note: 'the most common TTL bug' },
          { command: 'PERSIST', note: 'on purpose: the key lives forever again' },
        ]}
      />
      <p>And <code>EXPIRE</code> on a key that does not exist does nothing and returns 0 — it does not create the key.</p>
      <Predict
        question={<p>A session is stored with <code>SET session:42 … EX 1800</code>. On every request the app rewrites it with <code>SET session:42 &lt;new json&gt;</code>. What happens to the session?</p>}
        options={['It expires 30 minutes after it was created', 'It never expires', 'It expires 30 minutes after the last request']}
        answer={1}
        explanation="A plain SET replaces the value and drops the TTL (TTL → -1, as recorded above). Use SET … EX 1800 on every write for a sliding expiry, or KEEPTTL to keep the original deadline."
      />

      <h3>Expiring one field of a hash</h3>
      <p>
        Since Redis 7.4 a single field of a hash can have its own TTL (<code>HEXPIRE</code>, <code>HPEXPIRE</code>, <code>HTTL</code>,{' '}
        <code>HPERSIST</code>). That fits values like a password-reset token inside a user record:
      </p>
      <CliSession steps={E.fieldTtl} title="recorded: per-field expiry" />

      <h2>How a key actually disappears</h2>
      <p>Redis does not run a timer per key. Expired keys are removed in two ways.</p>
      <Flow
        title="Two ways out: lazily when touched, actively by a cursor"
        cols={4}
        rows={3}
        rowHeight={92}
        nodes={[
          { id: 'client', label: 'a command', sub: 'GET session:42', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'check', label: 'deadline passed?', sub: 'checked on lookup', col: 1, row: 0, hue: 2 },
          { id: 'lazy', label: 'delete now', sub: 'then act as missing', col: 2, row: 0, hue: 8 },
          { id: 'expires', label: 'expires dict', sub: 'key → deadline', col: 1, row: 1, hue: 3, shape: 'store' },
          { id: 'cron', label: 'cron tick', sub: 'hz times a second', col: 0, row: 2, hue: 4 },
          { id: 'round', label: 'next 20 keys', sub: 'cursor continues', col: 1, row: 2, hue: 2 },
          { id: 'active', label: 'delete expired', sub: 'of those 20', col: 2, row: 2, hue: 8 },
          { id: 'more', label: '> 10% expired?', sub: 'yes: another round', col: 3, row: 2, hue: 4 },
        ]}
        edges={[
          { from: 'client', to: 'check', flow: true, hue: 1 },
          { from: 'check', to: 'expires', dashed: true, hue: 3 },
          { from: 'check', to: 'lazy', label: 'yes', flow: true, hue: 8 },
          { from: 'cron', to: 'round', flow: true, hue: 4 },
          { from: 'round', to: 'expires', dashed: true, hue: 3 },
          { from: 'round', to: 'active', flow: true, hue: 2 },
          { from: 'active', to: 'more', hue: 4 },
        ]}
        steps={[
          { title: 'Lazy: a command touches the key', body: <p>Every lookup checks the key’s deadline in the expires dict first. If it has passed, the key is deleted right there and the command sees no key.</p>, active: ['client', 'check', 'lazy', 'expires', 'client>check', 'check>expires', 'check>lazy'] },
          { title: 'Active: the cron wakes up', body: <p>{CAPTURE.operations.defaults.hz} times a second (<code>hz</code>) the server runs the active expire cycle for each database.</p>, active: ['cron', 'round', 'cron>round'] },
          { title: 'A round looks at 20 keys with a TTL', body: <p>A cursor walks the expires dict; each round looks at the next 20 keys there and deletes the ones whose deadline passed.</p>, active: ['round', 'active', 'expires', 'round>expires', 'round>active'] },
          { title: 'Another round only if it paid off', body: <p>More than 10% of the round expired? Then more probably have — do another round, until the time budget runs out. Otherwise stop; the cursor remembers where it was for the next tick.</p>, active: ['active', 'more', 'round', 'active>more'] },
        ]}
      />
      <h3>1. Lazily, when touched</h3>
      <p>
        Every command that looks up a key first checks its deadline; if it has passed, the key is deleted right then and the command behaves as if it
        never existed. With the background cycle switched off (<code>DEBUG SET-ACTIVE-EXPIRE 0</code>), the recorded server had{' '}
        {lazy.afterExpiry.dbsize.toLocaleString()} expired keys still counted by <code>DBSIZE</code>, and {lazy.afterExpiry.expired} expirations so far.
        One <code>GET</code> of one of them: <code>DBSIZE</code> {lazy.afterOneGet.dbsize.toLocaleString()}, expirations {lazy.afterOneGet.expired}.
      </p>
      <StatTiles
        title="Recorded with the active cycle switched off"
        stats={[
          { label: 'expired keys still counted', value: lazy.afterExpiry.dbsize, sub: 'DBSIZE after every deadline passed', hue: 8 },
          { label: 'expirations recorded', value: lazy.afterExpiry.expired, sub: 'nobody touched them', hue: 4 },
          { label: 'after one GET', value: lazy.afterOneGet.dbsize, sub: `DBSIZE; expirations ${lazy.afterOneGet.expired}`, hue: 6 },
        ]}
      />
      <h3>2. Actively, by a cursor</h3>
      <p>
        Keys nobody reads again would stay forever with lazy expiry alone. So <code>hz</code> times per second (default 10) the server runs the
        <strong> active expire cycle</strong>: per database it walks on through the table of keys that have a TTL with a cursor (since Redis 6), looking at 20 keys
        per round and deleting the expired ones.
      </p>
      <ul>
        <li>If more than 10% of a round had expired, the table probably holds many more, so it does another round.</li>
        <li>It stops when a round is mostly alive or the cycle’s time budget (a share of CPU time) runs out; the next cycle continues where the cursor stopped.</li>
        <li>A shorter extra cycle also runs before the event loop goes idle.</li>
        <li><code>active-expire-effort</code> (1–10, default {E.activeExpireEffort}) raises the keys per round and the budget.</li>
      </ul>
      <LineChart
        title={`${drain[0].total.toLocaleString()} keys written with PX 1000: keys left over time`}
        series={drain.map((d) => ({ label: `hz ${d.hz}`, points: d.samples.map((s) => [s.ms, s.keys] as const), emphasis: d.hz === 10 }))}
        xLabel="ms after the last write"
        yLabel="keys"
        height={220}
      />
      <StatTiles
        stats={drain.flatMap((d) => [
          { label: `hz ${d.hz}: all ${d.total.toLocaleString()} removed`, value: `${d.end} ms`, sub: `first removal at ${d.start} ms`, hue: 2 as const, bar: { value: d.end, max: Math.max(...drain.map((x) => x.end)) } },
          { label: `hz ${d.hz}: CPU in expire cycles`, value: `${d.cycleCpuMs} ms`, sub: 'for the whole drain', hue: 4 as const },
        ])}
      />
      <p>
        When almost everything expired, every round is full of expired keys and the cycle keeps going: {drain[0].total.toLocaleString()} keys were gone
        within about {drain[0].end - drain[0].start} ms of the first removal. Now the uncomfortable case.
      </p>

      <h2>When few keys expire, they linger</h2>
      <p>The cycle stops early when it finds little to delete — so a few expired keys among many live ones can stay in memory for minutes.</p>
      <p>
        The recording wrote {mixed.keys.toLocaleString()} keys, of which {mixed.shortLived.toLocaleString()} (10%) expired after half a second and the
        rest lived an hour. Three seconds later only <strong>{mixed.after3s.expired}</strong> of the {mixed.shortLived.toLocaleString()} expired keys had
        been removed; <code>DBSIZE</code> still said {mixed.after3s.dbsize.toLocaleString()}. INFO’s <code>expired_stale_perc</code> (the server’s estimate of
        expired-but-present keys) was {mixed.after3s.expiredStalePerc}%.
      </p>
      <Proportion
        title={`The ${mixed.shortLived.toLocaleString()} keys that had expired, 3 seconds later`}
        parts={[
          { label: 'removed by the cycle', value: mixed.after3s.expired, hue: 6 },
          { label: 'expired, still in memory', value: mixed.shortLived - mixed.after3s.expired, hue: 8 },
        ]}
      />
      <p>
        That is the rule working as designed: a round of 20 keys contains about 2 expired ones — not more than 10% — so each cycle does one round and
        stops. At {CAPTURE.operations.defaults.hz} cycles a second that is about {20 * Number(CAPTURE.operations.defaults.hz)} keys looked at per second (plus
        the short extra cycles), so one full sweep of {mixed.keys.toLocaleString()} keys takes minutes. Until the cursor reaches them, or a command
        touches them, those expired keys keep their memory. It is a deliberate trade:
        keeping latency flat matters more than reclaiming memory promptly.
      </p>
      <ExpiryPlayground />
      <Callout tone="note" title="Replicas wait for the primary">
        A replica does not delete expired keys on its own; it waits for the <code>DEL</code> the primary sends when it expires them (lazily or actively),
        so all copies stay identical. A read on the replica of a logically expired key still returns nothing. And keyspace notifications fire the{' '}
        <code>expired</code> event when the key is actually deleted, which can be well after its deadline.
      </Callout>

      <h2>Design rules</h2>
      <Callout tone="tip" title="Using TTLs well">
        <ul>
          <li>Set the TTL in the same command as the value (<code>SET k v EX n</code>), never as a separate EXPIRE after it — a crash in between leaves a key that never expires.</li>
          <li>Rewrite with <code>EX</code> or <code>KEEPTTL</code>; remember a plain SET drops the TTL.</li>
          <li>Add jitter: <code>EX 3600 + random(0..300)</code> stops thousands of keys written together from expiring together (lesson 14: stampedes).</li>
          <li>Do not build timers on expiry. The <code>expired</code> event can come late; use a sorted set of due times, or a stream, for scheduled work.</li>
          <li>Budget memory for expired-but-present keys when few of many keys expire; watch <code>expired_stale_perc</code>, or raise <code>active-expire-effort</code>.</li>
          <li>Use <code>HEXPIRE</code> for fields that should vanish on their own instead of splitting a record into many keys.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'A TTL is an absolute deadline kept per key; TTL -1 = no expiry, -2 = no key. A plain SET removes it.',
          'Expired keys are deleted lazily when touched, and actively by a cursor that looks at 20 keys with a TTL per round, hz times per second.',
          'The cycle does another round only while more than 10% of a round had expired — so a few expired keys among many live ones can linger until the cursor comes round, minutes later.',
          'Replicas and keyspace notifications follow the actual deletion, not the deadline.',
        ]}
      />
    </>
  )
}
