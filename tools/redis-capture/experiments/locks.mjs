// Locks with SET NX PX, what goes wrong when a lock expires, fencing tokens, rate limiters, idempotency keys.
const RELEASE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end"

export async function run(lab) {
  const s = await lab.server('locks')
  const [a, b, c] = [await s.client(), await s.client(), await s.client()]
  const out = { releaseScript: RELEASE }

  // Happy path
  {
    const tr = new lab.Transcript()
    await tr.run(a, 'SET lock:order:42 token-a NX PX 10000', 'A')
    await tr.run(b, 'SET lock:order:42 token-b NX PX 10000', 'B')
    await tr.run(b, 'PTTL lock:order:42', 'B')
    await tr.run(a, `EVAL "${RELEASE}" 1 lock:order:42 token-a`, 'A')
    await tr.run(b, 'SET lock:order:42 token-b NX PX 10000', 'B')
    out.happy = tr.steps
  }

  // The lock expires while A is still working; A then deletes B's lock with a plain DEL
  await a.call('FLUSHALL')
  {
    const tr = new lab.Transcript()
    await tr.run(a, 'SET lock:report token-a NX PX 500', 'A')
    tr.note('A is paused (a long GC pause, a slow call) for 800 ms — its lock expires after 500 ms')
    await lab.sleep(800)
    await tr.run(b, 'SET lock:report token-b NX PX 5000', 'B')
    tr.note('A wakes up, finishes, and releases "its" lock with a plain DEL')
    await tr.run(a, 'DEL lock:report', 'A')
    await tr.run(c, 'SET lock:report token-c NX PX 5000', 'C')
    tr.note('B and C now both believe they hold the lock')
    out.naive = tr.steps
  }
  await a.call('FLUSHALL')
  {
    const tr = new lab.Transcript()
    await tr.run(a, 'SET lock:report token-a NX PX 500', 'A')
    tr.note('A is paused for 800 ms — its lock expires')
    await lab.sleep(800)
    await tr.run(b, 'SET lock:report token-b NX PX 5000', 'B')
    tr.note('A releases with the compare-and-delete script')
    await tr.run(a, `EVAL "${RELEASE}" 1 lock:report token-a`, 'A')
    await tr.run(c, 'SET lock:report token-c NX PX 5000', 'C')
    await tr.run(b, 'GET lock:report', 'B')
    out.safe = tr.steps
  }

  // Fencing token: every acquisition gets a bigger number; the storage refuses older numbers
  const FENCED_WRITE = "local last = tonumber(redis.call('HGET', KEYS[1], 'token') or '0') if tonumber(ARGV[1]) <= last then return redis.error_reply('STALE token ' .. ARGV[1] .. ' <= ' .. last) end redis.call('HSET', KEYS[1], 'token', ARGV[1], 'body', ARGV[2]) return 'OK'"
  out.fencedWriteScript = FENCED_WRITE
  await a.call('FLUSHALL')
  {
    const tr = new lab.Transcript()
    await tr.run(a, 'INCR fence:report', 'A')
    tr.note('A pauses, its lock expires, B acquires the lock')
    await tr.run(b, 'INCR fence:report', 'B')
    await tr.run(b, `EVAL "${FENCED_WRITE}" 1 report:2026-10 2 "written by B"`, 'B')
    tr.note('A wakes up and writes with its old token')
    await tr.run(a, `EVAL "${FENCED_WRITE}" 1 report:2026-10 1 "written by A"`, 'A')
    await tr.run(a, 'HGETALL report:2026-10', 'A')
    out.fencing = tr.steps
  }

  // Fixed-window rate limit: 5 requests per window
  await a.call('FLUSHALL')
  {
    const tr = new lab.Transcript()
    for (let i = 1; i <= 7; i++) {
      await tr.run(a, 'INCR rate:user:7:2026-10-18T10:41')
      if (i === 1) await tr.run(a, 'EXPIRE rate:user:7:2026-10-18T10:41 60 NX')
    }
    out.fixedWindow = tr.steps
  }

  // Sliding-window log in one script (timestamps passed in, so the run is reproducible)
  const SLIDING = "local now = tonumber(ARGV[1]) local window = tonumber(ARGV[2]) local limit = tonumber(ARGV[3]) redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window) if redis.call('ZCARD', KEYS[1]) >= limit then return 0 end redis.call('ZADD', KEYS[1], now, ARGV[4]) redis.call('PEXPIRE', KEYS[1], window) return 1"
  out.slidingScript = SLIDING
  out.sliding = []
  for (const [t, id] of [[1000, 'r1'], [1200, 'r2'], [1400, 'r3'], [1500, 'r4'], [2050, 'r5'], [2300, 'r6'], [2450, 'r7']]) {
    out.sliding.push({ atMs: t, request: id, allowed: await a.call('EVAL', SLIDING, 1, 'rl:user:7', t, 1000, 3, id), inWindow: await a.call('ZCARD', 'rl:user:7') })
  }

  // Token bucket in one script: capacity 3, refill 1 token per 500 ms
  const BUCKET = "local cap = tonumber(ARGV[1]) local rate = tonumber(ARGV[2]) local now = tonumber(ARGV[3]) local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts') local tokens = tonumber(b[1] or cap) local ts = tonumber(b[2] or now) tokens = math.min(cap, tokens + (now - ts) * rate / 1000) local ok = 0 if tokens >= 1 then tokens = tokens - 1 ok = 1 end redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now) redis.call('PEXPIRE', KEYS[1], 60000) return {ok, tostring(tokens)}"
  out.bucketScript = BUCKET
  out.bucket = []
  for (const t of [0, 10, 20, 30, 40, 600, 700, 1700, 1710, 1720, 1730]) {
    const [ok, tokens] = await a.call('EVAL', BUCKET, 1, 'tb:user:7', 3, 2, t)
    out.bucket.push({ atMs: t, allowed: ok, tokensLeft: Number(tokens) })
  }

  // Idempotency key: the first request wins, retries get the stored result
  await a.call('FLUSHALL')
  {
    const tr = new lab.Transcript()
    await tr.run(a, 'SET idem:pay:7f3e processing NX EX 86400', 'A')
    await tr.run(b, 'SET idem:pay:7f3e processing NX EX 86400', 'B')
    await tr.run(b, 'GET idem:pay:7f3e', 'B')
    await tr.run(a, 'SET idem:pay:7f3e "done:payment=88213" XX KEEPTTL', 'A')
    await tr.run(b, 'GET idem:pay:7f3e', 'B')
    out.idempotency = tr.steps
  }
  ;[a, b, c].forEach((x) => x.close())
  await s.stop()
  return out
}
