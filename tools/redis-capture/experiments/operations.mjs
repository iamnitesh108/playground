// What an operator looks at: INFO, SLOWLOG, LATENCY, MEMORY, big keys, clients, and ACL users.

const DEFAULT_KEYS = ['bind', 'protected-mode', 'requirepass', 'maxclients', 'timeout', 'tcp-keepalive', 'databases', 'maxmemory', 'maxmemory-policy', 'maxmemory-samples', 'save', 'appendonly', 'appendfsync', 'aof-use-rdb-preamble', 'lazyfree-lazy-eviction', 'lazyfree-lazy-expire', 'lazyfree-lazy-user-del', 'replica-read-only', 'repl-backlog-size', 'repl-diskless-sync', 'repl-diskless-sync-delay', 'min-replicas-to-write', 'slowlog-log-slower-than', 'slowlog-max-len', 'latency-monitor-threshold', 'notify-keyspace-events', 'io-threads', 'hz', 'busy-reply-threshold', 'client-output-buffer-limit', 'activedefrag']
import { execFileSync } from 'node:child_process'

export async function run(lab) {
  const s = await lab.server('ops', ['--maxmemory', '512mb', '--maxmemory-policy', 'allkeys-lru'])
  const c = await s.client()
  const out = {}

  // Some realistic content: many small keys, a few big ones
  await c.call('DEBUG', 'POPULATE', 200_000, 'session', 120)
  for (let i = 0; i < 300_000; i += 10_000) await c.pipeline(Array.from({ length: 100 }, (_, b) => ['RPUSH', 'queue:emails', ...Array.from({ length: 100 }, (_, j) => `email-${i + b * 100 + j}`)]))
  for (let i = 0; i < 100_000; i += 10_000) await c.pipeline(Array.from({ length: 100 }, (_, b) => ['HSET', 'cache:catalog', ...Array.from({ length: 100 }, (_, j) => [`product:${i + b * 100 + j}`, 'x'.repeat(60)]).flat()]))
  for (let i = 0; i < 5000; i++) await c.call('GET', `session:${i}`)
  for (let i = 0; i < 2000; i++) await c.call('GET', `nosuch:${i}`)

  const section = async (name, keys) => {
    const info = await c.call('INFO', name)
    return keys.map((k) => info.split('\r\n').find((l) => l.startsWith(`${k}:`))).filter(Boolean).join('\n')
  }
  out.infoMemory = await section('memory', ['used_memory_human', 'used_memory_rss_human', 'used_memory_peak_human', 'used_memory_dataset_perc', 'mem_fragmentation_ratio', 'maxmemory_human', 'maxmemory_policy', 'mem_allocator'])
  out.infoStats = await section('stats', ['total_connections_received', 'total_commands_processed', 'instantaneous_ops_per_sec', 'keyspace_hits', 'keyspace_misses', 'expired_keys', 'evicted_keys', 'rejected_connections'])
  out.infoClients = await section('clients', ['connected_clients', 'blocked_clients', 'maxclients'])
  out.infoKeyspace = await section('keyspace', ['db0'])
  out.infoSections = (await c.call('INFO', 'everything')).split('\r\n').filter((l) => l.startsWith('# ')).map((l) => l.slice(2))

  // Slow log: log anything over 10 ms
  await c.call('CONFIG', 'SET', 'slowlog-log-slower-than', 10_000)
  await c.call('SLOWLOG', 'RESET')
  await c.call('KEYS', 'nomatch*')
  await c.call('HGETALL', 'cache:catalog')
  await c.call('LRANGE', 'queue:emails', 0, -1)
  await c.call('DEL', 'nothing')
  const tr = new lab.Transcript()
  await tr.run(c, 'SLOWLOG GET 3')
  await tr.run(c, 'SLOWLOG LEN')
  out.slowlog = tr.steps.map((st) => ({ ...st, out: st.out.replace(/"127\.0\.0\.1:\d+"/g, '"10.0.4.12:51734"') }))

  // Latency monitor: record events over 20 ms
  await c.call('CONFIG', 'SET', 'latency-monitor-threshold', 20)
  await c.call('EVAL', 'local i = 0 while i < 20000000 do i = i + 1 end return i', 0)
  const tr2 = new lab.Transcript()
  await tr2.run(c, 'LATENCY LATEST')
  out.latency = tr2.steps
  out.latencyDoctor = (await c.call('LATENCY', 'DOCTOR')).trim()

  out.memoryDoctor = (await c.call('MEMORY', 'DOCTOR')).trim()
  out.memoryUsage = await (async () => { const t = new lab.Transcript(); for (const k of ['session:1', 'queue:emails', 'cache:catalog']) await t.run(c, `MEMORY USAGE ${k}`); return t.steps })()

  // Big keys: sampled scan from redis-cli
  out.bigkeys = execFileSync('redis-cli', ['-p', String(s.port), '--bigkeys'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().replace(/\r/g, '').split('\n').filter((l) => /Biggest|found|Summary|keys with|Sampled|-------|^\s*$/i.test(l) === false || /Biggest|Sampled|keys with/.test(l)).join('\n').trim()
  out.memkeys = execFileSync('redis-cli', ['-p', String(s.port), '--memkeys'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().replace(/\r/g, '').split('\n').filter((l) => /Biggest|Sampled|keys with/.test(l)).join('\n').trim()

  // Clients
  const other = await s.client()
  await other.call('CLIENT', 'SETNAME', 'checkout-api')
  const blocked = await s.client()
  blocked.send('BLPOP', 'jobs:none', 0).catch(() => {})   // rejected when we close it below
  await lab.sleep(100)
  const list = (await c.call('CLIENT', 'LIST')).trim().split('\n').map((l) => Object.fromEntries(l.split(' ').map((kv) => [kv.split('=')[0], kv.slice(kv.indexOf('=') + 1)])))
  out.clientList = list.map((x, i) => ({ id: x.id, addr: `10.0.4.${12 + i}:5173${i}`, name: x.name, age: x.age, idle: x.idle, flags: x.flags, db: x.db, cmd: x.cmd, omem: x.omem, 'tot-mem': x['tot-mem'] }))
  other.close(); blocked.close()

  // ACL: an application user that can only touch its own keys, and only safe commands
  const tr3 = new lab.Transcript()
  const app = await s.client()
  await tr3.run(c, 'ACL SETUSER checkout on >s3cret-Pa55 ~checkout:* ~session:* +@read +@write +@string +@hash -@dangerous', 'admin')
  await tr3.run(app, 'AUTH checkout wrong-password', 'app')
  await tr3.run(app, 'AUTH checkout s3cret-Pa55', 'app')
  await tr3.run(app, 'ACL WHOAMI', 'app')
  await tr3.run(app, 'SET checkout:cart:7 apple', 'app')
  await tr3.run(app, 'GET billing:invoice:1', 'app')
  await tr3.run(app, 'FLUSHALL', 'app')
  await tr3.run(app, 'KEYS *', 'app')
  await tr3.run(c, 'ACL LIST', 'admin')
  await tr3.run(c, 'ACL LOG 2', 'admin')
  out.acl = tr3.steps.map((st) => ({ ...st, out: st.out.replace(/"127\.0\.0\.1:\d+"/g, '"10.0.4.12:51734"').replace(/"(id=\d+ addr=)[^"]*"/g, '"$1…"').replace(/(\d+\) )"\d{13,}"/g, '$1"1792300000000"').replace(/(age-seconds"\n\s+\d+\) )"[\d.]+"/g, '$1"0.04"') }))
  app.close(); c.close()
  await s.stop()

  // Real defaults of the settings the operations lesson explains, and the warnings Redis logs at start
  const bare = await lab.server('defaults', [], { bare: true })
  const d = await bare.client()
  out.defaults = {}
  for (const k of DEFAULT_KEYS) out.defaults[k] = (await d.call('CONFIG', 'GET', k))[1] ?? null
  out.startupWarnings = bare.messages().filter((l) => /WARNING/.test(l)).map((l) => l.replace(/^\d+:[A-Z] /, ''))
  d.close(); await bare.stop()
  return out
}
