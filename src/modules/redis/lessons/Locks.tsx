import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession, LockPlayground, RateLimitPlayground } from '../components'
import { CAPTURE } from '../data/captures'

const L = CAPTURE.locks

/** Puts the long Lua source of an EVAL on separate lines so it reads as code. */
const script = (src: string) => src.replace(/(?<!return|=|if|local) (?=(local |if |else |end\b|return |redis\.call|tokens = |ok = ))/g, '\n')

const RENEW = `-- KEYS[1] = lock key, ARGV[1] = my token, ARGV[2] = new TTL in ms
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
else
  return 0   -- the lock is no longer mine: stop working
end`

export default function Locks() {
  const limited = L.fixedWindow.filter((s) => s.cmd?.startsWith('INCR')).map((s) => Number(s.out?.replace('(integer) ', '')))
  return (
    <>
      <LessonGoals
        goals={[
          'build a lock from SET NX PX and release it safely',
          'see, on a real server, how an expired lock lets two clients in — and how fencing tokens stop the damage',
          'choose between fixed-window, sliding-window and token-bucket rate limiting',
          'make retries safe with idempotency keys',
        ]}
        before="Lesson 8 — scripts run atomically"
      />

      <h2>A lock is a key with an owner and an expiry</h2>
      <p>
        Several processes want to do something only one of them may do at a time: charge an order, rebuild a report, run a nightly job. Redis
        has no lock object — a lock is just a key that exists while someone holds it. Three choices make it work:
      </p>
      <TermList
        items={[
          { term: 'NX', definition: 'Set the key only if it does not exist. The first client gets OK; everyone else gets (nil). Creating the key is the act of taking the lock.' },
          { term: 'token', definition: 'A random value unique to this holder, stored as the key’s value. It proves who owns the lock when it is released.' },
          { term: 'PX (TTL)', definition: 'The lock deletes itself after this many milliseconds, so a holder that crashes cannot block everybody forever.' },
          { term: 'lease', definition: 'What a lock with a TTL really is: permission that runs out on its own, whether or not the holder is finished.' },
        ]}
      />
      <CliSession title="two clients, one lock (recorded)" steps={L.happy} />
      <p>
        B is refused while A holds the lock and can see how long it will wait with <code>PTTL</code>. Once A releases, B gets it. Note that B is
        not queued: Redis does not wake waiting clients, so a client that wants the lock has to retry (with a short, randomised back-off).
      </p>

      <h2>Releasing: delete only your own lock</h2>
      <p>
        The obvious release is <code>DEL lock</code>. It is wrong, because the lock may no longer be yours. Here A takes a lock for 500 ms and
        then stalls for 800 ms — a long garbage-collection pause, a slow call to another service, a laptop going to sleep. Recorded:
      </p>
      <CliSession title="plain DEL after the lock expired (recorded)" steps={L.naive} />
      <p>
        A’s DEL returned <code>1</code>: it deleted <em>B’s</em> lock. C then got it too, while B was still working. A check-then-delete in
        application code (<code>GET</code>, compare, <code>DEL</code>) has the same hole between its two commands. The release has to compare and
        delete in one atomic step — a script:
      </p>
      <CodeBlock title="release: delete the key only if it still holds my token" language="lua" code={script(L.releaseScript)} />
      <CliSession title="the same race, released with the script (recorded)" steps={L.safe} />

      <Predict
        question={
          <p>
            A holds <code>lock:report</code> with a 500 ms TTL and stalls for 800 ms. Meanwhile B takes the lock. A wakes up and runs{' '}
            <code>DEL lock:report</code>. What happens?
          </p>
        }
        options={['DEL returns 0 because A’s lock already expired', 'DEL deletes B’s lock, so a third client can get in', 'Redis refuses: B owns the key']}
        answer={1}
        explanation="Redis does not know who owns a key — a key is just a key. DEL removes whatever is there. Only the token comparison in a script tells the owner apart, as the recording above shows."
      />

      <LockPlayground />

      <h2>Safe release is not enough: fencing tokens</h2>
      <p>
        Compare-and-delete stops A from breaking the <em>next</em> lock, but it cannot stop A from doing its work late: when A wakes up, it
        still believes it holds the lock and writes to the shared resource. The fix belongs in the resource, not in Redis. Every time the lock is
        granted, the holder also gets a number that only grows (<code>INCR</code> on a counter). The resource remembers the highest number it has
        accepted and refuses anything older.
      </p>
      <CliSession title="a fencing token rejects the stale writer (recorded)" steps={L.fencing} />
      <CodeBlock title="the storage side: accept a write only with a newer token" language="lua" code={script(L.fencedWriteScript)} />
      <p>
        Here the “storage” is a Redis hash so the run is reproducible; in a real system it is the database row, the file or the external API
        that the lock protects. A database can do the same with a column: <code>UPDATE … SET body = $2, token = $1 WHERE id = $3 AND token &lt; $1</code>.
      </p>

      <Callout tone="warn" title="Efficiency lock or correctness lock?">
        If two holders at once only cost some duplicated work (two processes rebuild the same cache entry), a Redis lock with a TTL is enough. If
        two holders at once corrupt data or charge a customer twice, the TTL alone cannot protect you: pauses longer than the TTL happen. Use
        fencing tokens checked by the resource, or a database constraint, or a coordination system built on consensus.
      </Callout>

      <h2>Keeping a lock while you still need it</h2>
      <p>
        A short TTL frees the lock quickly after a crash; a long job needs it for longer. The usual answer is a <strong>watchdog</strong>: while
        the work runs, a timer renews the lock every third of the TTL — but only if it is still the owner, again in one script:
      </p>
      <CodeBlock title="renew: extend the TTL only if the lock is still mine" language="lua" code={RENEW} />
      <p>
        If renewal returns 0, the lock is gone: stop the work, or at least stop before writing. Renewal shrinks the window but does not close it —
        a pause can still outlast the TTL between two renewals. Fencing is what closes it.
      </p>

      <h2>Redlock, briefly</h2>
      <p>
        With one Redis server the lock lives on one machine. If that server fails over to a replica that had not yet received the{' '}
        <code>SET</code> (replication is asynchronous, lesson 11), a second client can take a lock the first still holds. The Redlock algorithm
        uses several <em>independent</em> primaries (typically five): a client takes the lock on each with the same token and TTL, and holds it
        only if a majority said OK within a fraction of the TTL.
      </p>
      <Table
        head={['Option', 'Survives', 'Still assumes']}
        rows={[
          ['one Redis, SET NX PX + safe release', 'client crashes', 'the server keeps the key; no pause longer than the TTL'],
          ['Redlock over 5 independent primaries', 'a minority of servers failing', 'bounded pauses, bounded network delay and clock drift'],
          ['any of the above + fencing tokens', 'pauses longer than the TTL', 'the resource checks the token'],
          ['a consensus store (lease + revision)', 'node failures and pauses, with fencing via revisions', 'a quorum is reachable'],
        ]}
      />
      <p>
        Redlock is criticised exactly because a process pause or a jump of a server’s clock can still give two clients the lock. For correctness,
        the honest design is: a Redis lock to avoid duplicate work, and a fencing token or a constraint at the resource to make duplicates harmless.
      </p>

      <h2>Rate limiting</h2>
      <p>
        A rate limit is a counter per client per time span. Redis is a natural home for it: every application server sees the same counts, and an
        increment is one atomic command. Three designs, recorded with a limit of 5 per window for the fixed window, 3 per second for the sliding
        log, and a bucket of 3 tokens refilling 2 per second for the token bucket.
      </p>
      <h3>Fixed window: INCR on a key per minute</h3>
      <CliSession title="limit 5 per window (recorded)" steps={L.fixedWindow} />
      <p>
        The window is part of the key name (<code>…:2026-10-18T10:41</code>); the first request sets an expiry (<code>EXPIRE … NX</code> only sets
        one if there is none). Requests {limited.filter((n) => n > 5).join(' and ')} got counts above 5 and are rejected by the application. Two
        commands, one round trip each — cheap. The flaw: a client can send 5 at the end of one window and 5 at the start of the next, 10 within
        a second.
      </p>
      <h3>Sliding log: a sorted set of request times</h3>
      <CodeBlock title="sliding window: remove old entries, count, maybe add — one script" language="lua" code={script(L.slidingScript)} />
      <Table
        head={['at (ms)', 'request', 'allowed', 'in the last 1000 ms']}
        rows={L.sliding.map((r) => [r.atMs, r.request, r.allowed ? 'yes' : 'no', r.inWindow])}
      />
      <p>
        Exact, and no burst at an edge: r4 at 1500 ms is refused because r1–r3 all fall within (500, 1500]; r5 at 2050 ms is allowed because r1 has left
        the window. The cost is one sorted-set member per allowed request — fine for a few per second, heavy for thousands.
      </p>
      <h3>Token bucket: a level that refills</h3>
      <CodeBlock title="token bucket: capacity 3, 2 tokens per second" language="lua" code={script(L.bucketScript)} />
      <Table head={['at (ms)', 'allowed', 'tokens left']} rows={L.bucket.map((r) => [r.atMs, r.allowed ? 'yes' : 'no', r.tokensLeft])} />
      <p>
        Two numbers per client (tokens and the time of the last update), and it allows short bursts up to the capacity while holding the average
        rate. The script takes the time as an argument so it is deterministic; in production pass the application’s clock or read{' '}
        <code>TIME</code> inside the script.
      </p>

      <RateLimitPlayground />

      <Table
        head={['', 'Fixed window', 'Sliding log', 'Token bucket']}
        rows={[
          ['memory per client', 'one counter', 'one entry per request in the window', 'two fields'],
          ['accuracy', 'up to 2× the limit at a window edge', 'exact', 'exact average, bursts up to capacity'],
          ['commands', 'INCR (+ EXPIRE NX)', 'a script', 'a script'],
          ['good for', 'coarse limits per minute or hour', 'low limits that must be exact', 'APIs that should absorb short bursts'],
        ]}
      />

      <h2>Idempotency keys: make retries harmless</h2>
      <p>
        A client times out and retries a payment. Did the first attempt succeed? The client sends a unique key with the request; the server
        records it with <code>SET … NX</code> before doing the work, and stores the result when done. Recorded with two attempts of the same
        request:
      </p>
      <CliSession title="the first attempt wins, the retry gets the stored result (recorded)" steps={L.idempotency} />
      <p>
        <code>XX KEEPTTL</code> updates the existing key without resetting its 24-hour lifetime. If the process dies while the key says{' '}
        <code>processing</code>, retries are blocked until the key expires — so give the <code>processing</code> state a short TTL and extend it
        when storing the result, or let a retry take over a stale <code>processing</code> entry after a timeout. For money, also keep the key in
        the database in the same transaction as the payment: Redis can lose it (lesson 10).
      </p>

      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Lock with <code>SET key &lt;random token&gt; NX PX &lt;ttl&gt;</code>; release and renew only with token-checking scripts.</li>
          <li>Pick the TTL as “longest normal run × a safety factor”, and renew with a watchdog for long work.</li>
          <li>Where a duplicate would corrupt data, add fencing tokens (or a database constraint) at the resource — do not rely on the lock alone.</li>
          <li>Rate limit with a fixed window for coarse limits, a token bucket for APIs, a sliding log when low limits must be exact.</li>
          <li>Keep every rate-limit and lock key short-lived (EXPIRE / PX) so abandoned keys clean themselves up.</li>
          <li>Idempotency: <code>SET idem:&lt;key&gt; processing NX EX …</code> first, store the result after, and keep the durable copy in the database.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'A Redis lock is a lease: SET NX PX creates it, the TTL ends it, a token identifies the owner.',
          'A plain DEL can delete someone else’s lock; compare-and-delete in a script cannot. Neither stops a paused holder from writing late — fencing tokens do.',
          'Redlock spreads a lock over independent primaries but still assumes bounded pauses and clocks.',
          'Fixed windows burst at the edge, sliding logs are exact but cost memory, token buckets allow controlled bursts.',
          'Idempotency keys turn retries into lookups of the first result.',
        ]}
      />
    </>
  )
}
