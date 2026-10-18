// Records the "Using Redis day to day" and "Clients" lessons: redis-cli sessions for everyday
// commands and the output of usage-app (a Micronaut + Lettuce app) doing the same from Java,
// including a command timeout, a reconnect after a server restart and a WATCH conflict.
//   (cd usage-app && gradle installDist)   # once
//   node capture-usage.mjs ../../src/modules/redis/data/usage.ts
// Servers use ports 17100-17199.
import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { userInfo, homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, Server, sleep, version } from './lib/server.mjs'
import { Transcript } from './lib/transcript.mjs'
import { formatReply } from './lib/format.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-usage.mjs <out.ts>')
const APP = join(dirname(fileURLToPath(import.meta.url)), 'usage-app/build/install/usage-app/bin/usage-app')
if (!existsSync(APP)) throw new Error('build usage-app first: gradle installDist')

const out = { version: version() }
const cli = (args) => {
  try {
    return execFileSync('redis-cli', args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 8000 }).toString().trimEnd()
  } catch (e) {
    return ((e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')).trimEnd()
  }
}
const shell = (cmd, output) => ({ shell: true, cmd, out: output })

/** Runs usage-app in one mode; `onLine` sees every stdout line (to act at the right moment). */
function app(mode, port, { query = '?timeout=2s', onLine } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(APP, [], { env: { ...process.env, APP_MODE: mode, REDIS_URI: `redis://localhost:${port}${query}` }, stdio: ['ignore', 'pipe', 'pipe'] })
    const lines = []
    let buf = ''
    const take = (d) => {
      buf += d
      const parts = buf.split('\n')
      buf = parts.pop()
      for (const l of parts) { lines.push(l); onLine?.(l) }
    }
    p.stdout.on('data', take)
    p.stderr.on('data', take)
    const t = setTimeout(() => p.kill('SIGKILL'), 60000)
    p.on('exit', (code) => { clearTimeout(t); if (buf) lines.push(buf); if (code === 0) resolve(lines); else reject(new Error(`${mode} exited ${code}:\n${lines.join("\n")}`)) })
  })
}

/** A transcript of command lines on one connection. */
async function session(server, lines) {
  const c = await server.client()
  const tr = new Transcript()
  for (const l of lines) await tr.run(c, l)
  c.close()
  return tr.steps
}

// ---------------------------------------------------------------- Using Redis day to day
const s = await new Server('usage', 17100).start()
const S = String(s.port)
{ const c = await s.client(); await c.call('CONFIG', 'SET', 'requirepass', 'app-secret'); c.close() }
out.connect = [
  shell('redis-cli PING                                   # localhost:6379, no password', cli(['-p', S, 'PING'])),
  shell('redis-cli -h localhost -p 6379 -a app-secret PING', cli(['-h', 'localhost', '-p', S, '-a', 'app-secret', 'PING'])),
  shell('redis-cli -u redis://default:app-secret@localhost:6379/0 PING', cli(['-u', `redis://default:app-secret@localhost:${S}/0`, 'PING'])),
  shell('redis-cli -u redis://default:app-secret@localhost:6379/0 --no-auth-warning DBSIZE', cli(['-u', `redis://default:app-secret@localhost:${S}/0`, '--no-auth-warning', 'DBSIZE'])),
]
// The rest of the lab runs without a password
{ const c = await s.client(); await c.call('AUTH', 'app-secret'); await c.call('CONFIG', 'SET', 'requirepass', ''); c.close() }

out.strings = await session(s, ['SET user:1:name Ann', 'GET user:1:name', 'GET user:2:name', 'SET lock:report worker-1 NX EX 30', 'SET lock:report worker-2 NX EX 30', 'MGET user:1:name user:2:name', 'EXISTS user:1:name', 'DEL user:1:name', 'EXISTS user:1:name'])
out.counters = await session(s, ['INCR page:home:views', 'INCR page:home:views', 'INCRBY page:home:views 10', 'DECR page:home:views', 'SET price 9.5', 'INCRBYFLOAT price 0.25', 'SET name Ann', 'INCR name'])
{
  const c = await s.client()
  const tr = new Transcript()
  for (const l of ['SET otp:7 381920 EX 300', 'TTL otp:7', 'PERSIST otp:7', 'TTL otp:7', 'TTL no:such:key', 'SET session:9 abc PX 1500', 'PTTL session:9']) await tr.run(c, l)
  tr.note('(2 seconds later)')
  await sleep(2000)
  for (const l of ['GET session:9', 'TTL session:9', 'SET cart:3 "2 items" EX 600', 'SET cart:3 "3 items"', 'TTL cart:3', 'SET cart:3 "4 items" KEEPTTL EX 600', 'SET cart:3 "4 items" EX 600', 'SET cart:3 "5 items" KEEPTTL', 'TTL cart:3']) await tr.run(c, l)
  out.expiry = tr.steps
  c.close()
}
out.hashes = await session(s, ['HSET user:1 name Ann email ann@example.com plan pro', 'HGET user:1 plan', 'HMGET user:1 name email phone', 'HINCRBY user:1 logins 1', 'HSET user:1 plan team', 'HGETALL user:1', 'HDEL user:1 email', 'HEXISTS user:1 email', 'HLEN user:1'])
{
  const a = await s.client(), b = await s.client()
  const tr = new Transcript()
  for (const l of ['LPUSH jobs:email job-1 job-2 job-3', 'LRANGE jobs:email 0 -1', 'RPOP jobs:email', 'LLEN jobs:email', 'RPOP jobs:email', 'RPOP jobs:email', 'RPOP jobs:email']) await tr.run(a, l, 'worker')
  const done = tr.start(a, 'BRPOP jobs:email 5', 'worker')
  await sleep(1000)
  tr.note('(1 second later, from the web app)')
  await tr.run(b, 'LPUSH jobs:email job-4', 'web app')
  await done()
  out.lists = tr.steps
  a.close(); b.close()
}
out.sets = await session(s, ['SADD tags:post:9 redis cache redis', 'SADD tags:post:10 redis queue', 'SISMEMBER tags:post:9 cache', 'SMEMBERS tags:post:9', 'SCARD tags:post:9', 'SINTER tags:post:9 tags:post:10', 'SREM tags:post:9 cache'])
out.sortedSets = await session(s, ['ZADD leaderboard 3200 ann 2800 bob 4100 eve', 'ZINCRBY leaderboard 500 bob', 'ZRANGE leaderboard 0 2 REV WITHSCORES', 'ZRANK leaderboard ann', 'ZREVRANK leaderboard ann', 'ZSCORE leaderboard bob', 'ZRANGE leaderboard 3000 +inf BYSCORE WITHSCORES', 'ZCARD leaderboard'])
{
  const sub = await s.client(), pub = await s.client()
  const tr = new Transcript()
  await tr.run(sub, 'SUBSCRIBE orders', 'subscriber')
  await tr.run(pub, 'PUBLISH orders "order 1001 paid"', 'publisher')
  tr.steps.push({ who: 'subscriber', cmd: '(message arrives)', out: formatReply(await sub.nextPush()).trimEnd() })
  await tr.run(pub, 'PUBLISH payments "refund 77"', 'publisher')
  sub.close()
  await sleep(100)
  await tr.run(pub, 'PUBLISH orders "order 1002 paid"', 'publisher')
  out.pubsub = tr.steps
  pub.close()
}
{
  const c = await s.client()
  for (let i = 1; i <= 40; i++) await c.call('SET', `session:${i}`, 'x')
  for (let i = 1; i <= 20; i++) await c.call('SET', `user:${i}:name`, 'x')
  const tr = new Transcript()
  await tr.run(c, 'DBSIZE')
  let cursor = '0', calls = 0, keys = 0
  do {
    const r = await c.call('SCAN', cursor, 'MATCH', 'session:*', 'COUNT', '20')
    if (calls === 0) await tr.run(c, 'SCAN 0 MATCH session:* COUNT 20')
    cursor = r[0]; keys += r[1].length; calls++
  } while (cursor !== '0')
  out.scanTotals = { calls, keys }
  out.scan = tr.steps
  c.close()
}
out.scanCli = shell('redis-cli --scan --pattern "session:*" | head -3', cli(['-p', S, '--scan', '--pattern', 'session:*']).split('\n').slice(0, 3).join('\n'))
out.typeErrors = await session(s, ['TYPE leaderboard', 'TYPE user:1', 'GET leaderboard', 'OBJECT ENCODING user:1'])
out.multi = await session(s, ['SET stock:42 10', 'MULTI', 'DECRBY stock:42 3', 'RPUSH orders:42 order-1001', 'EXEC'])
{
  // redis-cli --pipe: many commands from a file in one go
  const p = spawn('sh', ['-c', `for i in $(seq 1 10000); do printf 'INCR hits\\r\\n'; done | redis-cli -p ${S} --pipe`])
  let o = ''
  p.stdout.on('data', (d) => { o += d })
  await new Promise((r) => p.on('exit', r))
  out.pipeCli = shell("for i in $(seq 1 10000); do printf 'INCR hits\\r\\n'; done | redis-cli --pipe", o.trimEnd())
}
{ const c = await s.client(); await c.call('FLUSHALL'); c.close() }
out.appUsage = await app('usage', s.port)
out.appAsync = await app('async', s.port)
out.appPubsub = await app('pubsub', s.port)
out.appPipeline = await app('pipeline', s.port)
await s.stop()

// ---------------------------------------------------------------- Clients
const k = await new Server('clients', 17150).start()
// One shared connection: CLIENT LIST while the app is connected shows a single client for it
out.appWatch = await app('watch', k.port)
// redis.timeout is ignored when redis.uri is set: the URI's own ?timeout= (default 60 s) wins
out.appConfig = [...await app('config', k.port, { query: '' }), ...await app('config', k.port, { query: '?timeout=500ms' })]
{
  // A command timeout: the app sets a key, prints "# ready", then the server is kept busy for 2 s
  const busy = await k.client()
  let sleeping
  out.appTimeout = await app('timeout', k.port, { query: '?timeout=500ms', onLine: (l) => { if (l === '# ready') sleeping = busy.call('DEBUG', 'SLEEP', '2') } })
  await sleeping
  busy.close()
  out.timeoutBusy = 'DEBUG SLEEP 2'
}
{
  // Reconnect: restart the server while the app increments a counter every 250 ms
  let restarted
  const restart = async () => {
    await sleep(1500)
    const t0 = Date.now()
    await k.kill('SIGTERM')
    await sleep(1500)
    await k.start()
    return Date.now() - t0
  }
  const run = app('reconnect', k.port, { onLine: (l) => { if (!restarted && l.includes(' ms  incr')) restarted = restart() } })
  out.appReconnect = await run
  out.downMs = await restarted
}
{
  // Client-side caching (RESP2 style): invalidations are redirected to a second connection
  const a = await k.client(), b = await k.client(), inv = await k.client()
  const tr = new Transcript()
  const invId = await inv.call('CLIENT', 'ID')
  await tr.run(inv, 'SUBSCRIBE __redis__:invalidate', 'app (listener)')
  for (const l of [`CLIENT TRACKING ON REDIRECT ${invId}`, 'GET product:5']) await tr.run(a, l, 'app')
  await tr.run(b, 'SET product:5 "new price"', 'admin')
  tr.steps.push({ who: 'app (listener)', cmd: '(message arrives)', out: formatReply(await inv.nextPush()).trimEnd() })
  inv.close()
  out.tracking = tr.steps
  a.close(); b.close()
}
{
  // Health check and client list
  const c = await k.client()
  const tr = new Transcript()
  await tr.run(c, 'PING')
  await tr.run(c, 'CLIENT SETNAME orders-api')
  out.health = tr.steps
  out.clientList = (await c.call('CLIENT', 'LIST')).trim().split(' ').filter((f) => /^(id|addr|name|age|idle|flags|db|cmd)=/.test(f)).join(' ')
  c.close()
}
await k.stop()

// A three-node cluster: a client that is not cluster-aware sees MOVED
{
  const nodes = [17160, 17161, 17162].map((p) => new Server(`node-${p}`, p, ['--cluster-enabled', 'yes', '--cluster-config-file', `nodes-${p}.conf`]))
  for (const n of nodes) await n.start()
  cli(['--cluster', 'create', ...nodes.map((n) => `127.0.0.1:${n.port}`), '--cluster-yes'])
  await sleep(1500)
  out.moved = [
    shell('redis-cli -p 7000 SET user:1:name Ann', cli(['-p', '17160', 'SET', 'user:1:name', 'Ann'])),
    shell('redis-cli -p 7000 CLUSTER KEYSLOT user:1:name', cli(['-p', '17160', 'CLUSTER', 'KEYSLOT', 'user:1:name'])),
    shell('redis-cli -c -p 7000 SET user:1:name Ann    # -c: follow MOVED', cli(['-c', '-p', '17160', 'SET', 'user:1:name', 'Ann'])),
  ]
  for (const n of nodes) await n.stop()
}

let json = JSON.stringify(out, null, 1).replaceAll(ROOT, '/data')
  .replace(/127\.0\.0\.1:1716([0-2])/g, (_, d) => `127.0.0.1:700${d}`)
  .replace(/\b171\d\d\b/g, '6379')
  .replace(/addr=127\.0\.0\.1:\d+/g, 'addr=10.0.4.12:51734')
  .replace(/id=\d+/g, (m) => m)
for (const secret of [userInfo().username, homedir()]) if (json.includes(secret)) throw new Error(`recording contains "${secret}"`)
writeFileSync(outFile, `// Recorded from Redis ${out.version} by tools/redis-capture/capture-usage.mjs — do not edit by hand.\n\nexport const USAGE = ${json} as const\n`)
console.log('wrote', outFile)
process.exit(0)
