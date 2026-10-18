import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession, ExpiryPlayground, LineChart } from '../components'
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
      <Table
        head={['Command on a key with a TTL', 'TTL afterwards']}
        rows={[
          ['SET (plain)', 'removed — the most common TTL bug'],
          ['SET … KEEPTTL', 'kept'],
          ['INCR, APPEND, LPUSH, HSET… (changing the value in place)', 'kept'],
          ['RENAME', 'moves with the key'],
          ['PERSIST', 'removed'],
          ['EXPIRE with GT', 'only changed if the new deadline is later'],
          ['EXPIRE on a missing key', 'nothing happens; returns 0'],
        ]}
      />
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
      <h3>1. Lazily, when touched</h3>
      <p>
        Every command that looks up a key first checks its deadline; if it has passed, the key is deleted right then and the command behaves as if it
        never existed. With the background cycle switched off (<code>DEBUG SET-ACTIVE-EXPIRE 0</code>), the recorded server had{' '}
        {lazy.afterExpiry.dbsize.toLocaleString()} expired keys still counted by <code>DBSIZE</code>, and {lazy.afterExpiry.expired} expirations so far.
        One <code>GET</code> of one of them: <code>DBSIZE</code> {lazy.afterOneGet.dbsize.toLocaleString()}, expirations {lazy.afterOneGet.expired}.
      </p>
      <h3>2. Actively, by a cursor</h3>
      <p>
        Keys nobody reads again would stay forever with lazy expiry alone. So <code>hz</code> times per second (default 10) the server runs the
        <strong> active expire cycle</strong>: per database it walks on through the table of keys that have a TTL with a cursor (since Redis 6), looking at 20 keys
        per round and deleting the expired ones. If more than 10% of a round had expired, the table probably holds many more, so it does another round —
        until a round is mostly alive or the cycle’s time budget (a share of CPU time) runs out. The next cycle continues where the cursor stopped. A shorter extra cycle also runs before the event loop goes idle. <code>active-expire-effort</code> (1–10, default{' '}
        {E.activeExpireEffort}) raises the keys per round and the budget.
      </p>
      <LineChart
        title={`${drain[0].total.toLocaleString()} keys written with PX 1000: keys left over time`}
        series={drain.map((d) => ({ label: `hz ${d.hz}`, points: d.samples.map((s) => [s.ms, s.keys] as const), emphasis: d.hz === 10 }))}
        xLabel="ms after the last write"
        yLabel="keys"
        height={220}
      />
      <Table
        head={['hz', 'first key removed', 'all removed', 'CPU spent in expire cycles']}
        rows={drain.map((d) => [d.hz, `${d.start} ms`, `${d.end} ms`, `${d.cycleCpuMs} ms`])}
      />
      <p>
        When almost everything expired, every round is full of expired keys and the cycle keeps going: {drain[0].total.toLocaleString()} keys were gone
        within about {drain[0].end - drain[0].start} ms of the first removal. Now the uncomfortable case.
      </p>

      <h2>When few keys expire, they linger</h2>
      <p>
        The recording wrote {mixed.keys.toLocaleString()} keys, of which {mixed.shortLived.toLocaleString()} (10%) expired after half a second and the
        rest lived an hour. Three seconds later only <strong>{mixed.after3s.expired}</strong> of the {mixed.shortLived.toLocaleString()} expired keys had
        been removed; <code>DBSIZE</code> still said {mixed.after3s.dbsize.toLocaleString()}. INFO’s <code>expired_stale_perc</code> (the server’s estimate of
        expired-but-present keys) was {mixed.after3s.expiredStalePerc}%.
      </p>
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
