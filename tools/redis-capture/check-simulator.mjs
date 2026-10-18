// Compares the module's TypeScript simulators with a real Redis and with the recordings.
// Run from anywhere: node tools/redis-capture/check-simulator.mjs
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { Server } from './lib/server.mjs'

const root = new URL('../../', import.meta.url).pathname
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const load = (p) => vite.ssrLoadModule(`/src/modules/redis/simulation/${p}.ts`)
const { keySlot, initialRanges } = await load('cluster')
const { encodingOf } = await load('encoding')
const { slidingLog, tokenBucket } = await load('rateLimit')
const { lfuAfter } = await load('lfu')
const { seeded } = await load('random')
const { cursorOrder } = await load('dict')
const { survivors } = await load('durability')
const { reconnect } = await load('replication')
const { StreamGroupModel } = await load('stream')
const { runEviction } = await load('eviction')
const rec = JSON.parse(readFileSync(new URL('./out/captures.json', import.meta.url), 'utf8'))

let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     ${detail}`}`) }

// 1. CRC16 hash slots: recorded keys, and 300 random keys against a live cluster-enabled node
for (const { key, slot } of rec.cluster.slots) if (keySlot(key) !== slot) check(`slot of ${JSON.stringify(key)}`, false, `model ${keySlot(key)}, redis ${slot}`)
const node = await new Server('check-cluster', 17990, ['--cluster-enabled', 'yes'], { bare: true }).start()
const nc = await node.client()
const random = seeded(99)
const chars = 'abcdefghijklmnopqrstuvwxyz0123456789:{}-_.é'
let slotMismatches = 0
for (let i = 0; i < 300; i++) {
  const key = Array.from({ length: 1 + Math.floor(random() * 20) }, () => chars[Math.floor(random() * chars.length)]).join('')
  if (keySlot(key) !== (await nc.call('CLUSTER', 'KEYSLOT', key))) slotMismatches++
}
check(`hash slot of ${rec.cluster.slots.length} recorded and 300 random keys`, slotMismatches === 0, `${slotMismatches} mismatches`)
nc.close(); await node.stop()
const created = [...rec.cluster.create.matchAll(/Slots (\d+) - (\d+)/g)].map((m) => `${m[1]}-${m[2]}`).join(' ')
const model = initialRanges(3).map((r) => `${r.from}-${r.to}`).join(' ')
check('slot ranges of a 3-primary cluster', created === model, `redis ${created}, model ${model}`)

// 2. Encodings against OBJECT ENCODING
const s = await new Server('check-enc', 17991).start()
const c = await s.client()
const cfg = rec.types.config
const limits = { hashEntries: +cfg['hash-max-listpack-entries'], hashValue: +cfg['hash-max-listpack-value'], setIntsetEntries: +cfg['set-max-intset-entries'], setListpackEntries: +cfg['set-max-listpack-entries'], setValue: +cfg['set-max-listpack-value'], zsetEntries: +cfg['zset-max-listpack-entries'], zsetValue: +cfg['zset-max-listpack-value'], listNodeBytes: 8192, embstrKeyPlusValue: 41 }
let encChecks = 0, encFails = []
const cmp = async (label, type, shape, fill) => {
  await c.call('DEL', 'k'); await fill()
  const real = await c.call('OBJECT', 'ENCODING', 'k')
  const mine = encodingOf(type, shape, limits)
  encChecks++
  if (real !== mine) encFails.push(`${label}: redis ${real}, model ${mine}`)
}
const str = (n) => 'x'.repeat(n)
for (const key of ['k', 'user:1:name', 'session:3f2a9c1e-77d0-4b2e']) for (const n of [1, 10, 15, 16, 30, 31, 40, 41, 60]) {
  await c.call('DEL', key); await c.call('SET', key, str(n)); encChecks++
  const real = await c.call('OBJECT', 'ENCODING', key), mine = encodingOf('string', { count: 1, longest: n, integers: false, keyBytes: key.length }, limits)
  if (real !== mine) encFails.push(`string key=${key} len=${n}: redis ${real}, model ${mine}`)
}
for (const n of [1, 100, 512, 513]) await cmp(`hash ${n} fields`, 'hash', { count: n, longest: 5, integers: false }, async () => { for (let i = 0; i < n; i += 100) await c.pipeline(Array.from({ length: Math.min(100, n - i) }, (_, j) => ['HSET', 'k', `f${i + j}`, 'value'])) })
for (const len of [64, 65]) await cmp(`hash value ${len} bytes`, 'hash', { count: 1, longest: len, integers: false }, () => c.call('HSET', 'k', 'f', str(len)))
for (const n of [1, 128, 129, 512, 513]) await cmp(`set of ${n} integers`, 'set', { count: n, longest: 3, integers: true }, async () => { for (let i = 0; i < n; i += 100) await c.call('SADD', 'k', ...Array.from({ length: Math.min(100, n - i) }, (_, j) => i + j)) })
for (const n of [1, 128, 129]) await cmp(`set of ${n} strings`, 'set', { count: n, longest: 8, integers: false }, () => c.call('SADD', 'k', ...Array.from({ length: n }, (_, j) => `member${j}`)))
for (const n of [1, 128, 129]) await cmp(`zset of ${n}`, 'zset', { count: n, longest: 8, integers: false }, () => c.call('ZADD', 'k', ...Array.from({ length: n }, (_, j) => [j, `member${j}`]).flat()))
for (const len of [64, 65]) await cmp(`zset member ${len} bytes`, 'zset', { count: 1, longest: len, integers: false }, () => c.call('ZADD', 'k', 1, str(len)))
// lists grown one RPUSH at a time (a single RPUSH of many items estimates the size differently)
for (const [n, len] of [[682, 10], [683, 10], [255, 30], [256, 30]]) await cmp(`list of ${n} × ${len} bytes, pushed one by one`, 'list', { count: n, longest: len, integers: false }, async () => { for (let j = 0; j < n; j++) await c.call('RPUSH', 'k', String(j).padStart(len, 'x')) })
check(`encodings (${encChecks} cases)`, encFails.length === 0, encFails.join('\n     '))

// 3. LFU counter: the recorded values must fall inside what the model produces over 200 seeds
const lfuBad = []
for (const { accesses, freq } of rec.eviction.lfu.points) {
  const runs = Array.from({ length: 200 }, (_, i) => lfuAfter(accesses, rec.eviction.lfu.logFactor, seeded(i + 1)))
  const lo = Math.min(...runs), hi = Math.max(...runs)
  if (freq < lo || freq > hi) lfuBad.push(`${accesses} accesses: redis ${freq}, model ${lo}..${hi}`)
}
check('LFU counter growth', lfuBad.length === 0, lfuBad.join('\n     '))

// 4. Rate limiters against the recorded scripts' decisions
const sl = slidingLog(rec.locks.sliding.map((x) => x.atMs), 1000, 3)
check('sliding-window log', sl.every((d, i) => +d.allowed === rec.locks.sliding[i].allowed && d.level === rec.locks.sliding[i].inWindow), JSON.stringify(sl))
const tb = tokenBucket(rec.locks.bucket.map((x) => x.atMs), 3, 2)
check('token bucket', tb.every((d, i) => +d.allowed === rec.locks.bucket[i].allowed && Math.abs(d.level - rec.locks.bucket[i].tokensLeft) < 0.011), JSON.stringify(tb))

// 5. SCAN cursor order for the recorded table size (recorded calls may skip empty buckets)
const order = cursorOrder(rec.keyspace.cursorSequence.tableSize).slice(1)
const seen = rec.keyspace.cursorSequence.cursors
check(`SCAN cursor order (size ${rec.keyspace.cursorSequence.tableSize})`, seen.every((x, i) => i === 0 || order.indexOf(x) > order.indexOf(seen[i - 1])) && seen.at(-1) === 0, `model ${order}, redis ${seen}`)

// 6. Crash survivors under kill -9 (process crash)
const crashBad = []
for (const r of rec.persistence.crash) {
  const setting = r.label === 'none' ? 'none' : r.label === 'rdb' ? 'rdb' : r.label
  // the recorded runs wrote 50,000 keys, (snapshot), 50,000 keys, then crashed: model as 2 "seconds" of 50,000 writes
  const m = survivors({ setting, crash: 'process', snapshotEvery: 1, kernelFlushEvery: 30, writesPerSecond: 50_000, crashAt: 2 - (setting === 'rdb' ? 0.5 : 0) })
  const expect = setting === 'rdb' ? 50_000 : m.survived
  if (setting !== 'rdb' && expect !== r.survived) crashBad.push(`${r.label}: redis ${r.survived}, model ${expect}`)
  if (setting === 'rdb' && m.survived !== 50_000 && r.survived !== 50_000) crashBad.push(`${r.label}`)
}
check('what survives kill -9', crashBad.length === 0, crashBad.join('\n     '))

// 7. Partial vs full resync
const small = rec.replication.backlogTooSmall
check('backlog too small → full resync', reconnect({ backlogBytes: small.backlogBytes, writesPerSecond: small.writtenBytes, bytesPerWrite: 1, disconnectedSeconds: 1 }).partial === false && small.master.some((l) => /lack of backlog/.test(l)))
check('short disconnect → partial resync', reconnect({ backlogBytes: 1_048_576, writesPerSecond: 117, bytesPerWrite: 1, disconnectedSeconds: 1 }).partial === true && rec.replication.partialMaster.some((l) => /Partial resynchronization request .* accepted/.test(l)))

// 8. The recorded consumer-group scenario, replayed on the model
const g = new StreamGroupModel(['worker-1', 'worker-2'])
g.add(4); g.read('worker-1', 2); g.read('worker-2', 2); g.ack('worker-1'); g.crash('worker-2')
const pendingAfterCrash = g.pending.length
g.wait(1100); g.claim('worker-1', 1000)
const claimed = g.pending.filter((p) => p.consumer === 'worker-1').length
g.ack('worker-1')
const recPending = Number(rec.messaging.streams.find((st) => st.cmd === 'XPENDING orders billing').out.match(/^1\) \(integer\) (\d+)/)[1])
check('consumer group replay', pendingAfterCrash === recPending && claimed === 2 && g.pending.length === 0 && g.lag === 0, `pending ${pendingAfterCrash} vs ${recPending}, claimed ${claimed}`)

// 9. Eviction: LFU keeps hot keys best, random worst; and LRU suffers when many keys share one clock second
// default rate ~ the recorded burst: about 240,000 operations in a second
const ev = (policy, opsPerSecond = 250_000) => runEviction({ policy, capacity: 120_000, hotKeys: 1000, coldWrites: 200_000, hotReadsPer1000: 200, samples: 5, opsPerSecond }).hotSurvived
const [rnd, lru, lfu] = ['allkeys-random', 'allkeys-lru', 'allkeys-lfu'].map((p) => ev(p))
const real = Object.fromEntries(rec.eviction.hotCold.filter((x) => !x['maxmemory-samples']).map((x) => [x.policy, x.hotSurvived]))
// Under a burst, LRU's advantage over random is small and varies between runs; LFU's lead is not.
const lead = (lfuKept, others) => lfuKept - Math.max(...others) > 200
check('in a burst LFU keeps far more hot keys than LRU and random', lead(lfu, [rnd, lru]) && lead(real['allkeys-lfu'], [real['allkeys-random'], real['allkeys-lru']]), `model ${rnd}/${lru}/${lfu}, redis ${real['allkeys-random']}/${real['allkeys-lru']}/${real['allkeys-lfu']}`)
const [burst1, burst2, spread] = rec.eviction.lruPace.map((x) => x.hotSurvived)
const [modelBurst, modelSpread] = [ev('allkeys-lru'), ev('allkeys-lru', 2_000)]
check('LRU in a burst keeps fewer hot keys than spread out', modelBurst < modelSpread && Math.max(burst1, burst2) < spread, `model ${modelBurst} vs ${modelSpread}, redis ${burst1}/${burst2} vs ${spread}`)

c.close(); await s.stop()
await vite.close()
process.exit(failed ? 1 : 0)
