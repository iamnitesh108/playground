// Records the "beyond the core types" lesson on the official Redis 8 image, which bundles
// JSON, the Query Engine, time series, probabilistic types and vector sets.
//   node capture-beyond.mjs ../../src/modules/redis/data/beyond.ts
// Runs podman containers named redis-beyond-* on host ports 17250-17299 and removes them.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { userInfo, homedir } from 'node:os'
import { Transcript } from './lib/transcript.mjs'
import { connect } from './lib/resp.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-beyond.mjs <out.ts>')

const IMAGE = 'docker.io/redis:8'
const NAME = 'redis-beyond-1'
const PORT = 17250
const podman = (...args) => execFileSync('podman', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Small deterministic generator so every run records the same data
let seed = 42
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

try { podman('rm', '-f', NAME) } catch { /* not there */ }
podman('run', '-d', '--name', NAME, '-p', `127.0.0.1:${PORT}:6379`, IMAGE)
let c
for (let i = 0; i < 50 && !c; i++) { try { c = await connect(PORT); await c.call('PING') } catch { c = undefined; await sleep(200) } }
if (!c) throw new Error('redis did not start')

const out = {}
try {
  const info = await c.call('INFO', 'server')
  out.version = /redis_version:(\S+)/.exec(info)[1]
  const mods = await c.call('MODULE', 'LIST')
  out.modules = mods.map((m) => ({ name: m[1], ver: String(m[3]) }))
  const mem = async (key) => Number(await c.call('MEMORY', 'USAGE', key, 'SAMPLES', '0'))
  const batch = async (cmds, size = 2000) => { for (let i = 0; i < cmds.length; i += size) await c.pipeline(cmds.slice(i, i + size)) }

  // 1. JSON documents
  {
    const tr = new Transcript()
    for (const line of [
      `JSON.SET user:1 $ '{"name":"Ada","city":"London","age":36,"tags":["admin"],"address":{"zip":"N1 9GU"},"orders":[{"id":101,"total":20.5},{"id":102,"total":74}]}'`,
      'JSON.GET user:1 $.name $.address.zip',
      'JSON.NUMINCRBY user:1 $.age 1',
      `JSON.ARRAPPEND user:1 $.tags '"beta"'`,
      'JSON.GET user:1 $.orders[*].total',
      'JSON.GET user:1 $..zip',
      'JSON.TYPE user:1 $.orders',
      `JSON.SET user:1 $.address.city '"London"'`,
      'JSON.DEL user:1 $.address',
      'JSON.GET user:1',
    ]) await tr.run(c, line)
    out.json = tr.steps
    // The same document as a JSON string vs a JSON value
    const doc = JSON.stringify({ name: 'Ada', city: 'London', age: 36, tags: ['admin'], orders: [{ id: 101, total: 20.5 }, { id: 102, total: 74 }] })
    await c.call('SET', 'user:str', doc)
    await c.call('JSON.SET', 'user:json', '$', doc)
    await c.call('HSET', 'user:hash', 'name', 'Ada', 'city', 'London', 'age', '36')
    out.jsonMemory = { string: await mem('user:str'), json: await mem('user:json'), hash: await mem('user:hash'), bytes: doc.length }
  }

  // 2. Query Engine: index JSON documents, search and aggregate
  {
    const cities = ['London', 'Paris', 'Berlin', 'Madrid', 'Rome']
    const names = ['Ada', 'Alan', 'Grace', 'Linus', 'Edsger', 'Barbara', 'Ken', 'Margaret', 'Donald', 'Frances']
    const cmds = []
    for (let i = 1; i <= 1000; i++) cmds.push(['JSON.SET', `customer:${i}`, '$', JSON.stringify({ name: `${names[i % names.length]} ${i}`, city: cities[Math.floor(rand() * cities.length)], age: 18 + Math.floor(rand() * 60), plan: rand() < 0.3 ? 'pro' : 'free', spent: Math.round(rand() * 50000) / 100 })])
    await batch(cmds)
    const tr = new Transcript()
    for (const line of [
      'FT.CREATE idx:customer ON JSON PREFIX 1 customer: SCHEMA $.name AS name TEXT $.city AS city TAG $.plan AS plan TAG $.age AS age NUMERIC SORTABLE $.spent AS spent NUMERIC SORTABLE',
    ]) await tr.run(c, line)
    for (let i = 0; i < 50; i++) { const r = await c.call('FT.INFO', 'idx:customer'); const k = r.indexOf('indexing'); if (String(r[k + 1]) === '0') break; await sleep(100) }
    for (const line of [
      "FT.SEARCH idx:customer '@city:{London} @plan:{pro} @age:[30 40]' SORTBY spent DESC LIMIT 0 3 RETURN 3 name age spent",
      "FT.SEARCH idx:customer '@name:grace' LIMIT 0 0",
      "FT.AGGREGATE idx:customer '*' GROUPBY 1 @city REDUCE COUNT 0 AS customers REDUCE AVG 1 @spent AS avg_spent SORTBY 2 @customers DESC",
      "FT.EXPLAIN idx:customer '@city:{London} @age:[30 40]'",
    ]) await tr.run(c, line)
    out.search = tr.steps.map((s) => ({ ...s, out: s.out.replace(/"(\d+\.\d{2})\d+"/g, '"$1"') }))
    const info = await c.call('FT.INFO', 'idx:customer')
    const get = (k) => info[info.indexOf(k) + 1]
    out.searchInfo = { docs: Number(get('num_docs')), invertedMB: Math.round(Number(get('inverted_sz_mb')) * 1e4) / 1e4, totalIndexMB: Math.round(Number(get('total_index_memory_sz_mb') ?? 0) * 1e4) / 1e4 }
    // Same question without an index: a full SCAN in the client
    const t0 = performance.now(); let cursor = '0'; let hits = 0; let scanned = 0
    do {
      const [next, keys] = await c.call('SCAN', cursor, 'MATCH', 'customer:*', 'COUNT', '500')
      cursor = next
      if (keys.length) {
        const docs = await c.call('JSON.MGET', ...keys, '$')
        for (const d of docs) { scanned++; const [v] = JSON.parse(d); if (v.city === 'London' && v.plan === 'pro' && v.age >= 30 && v.age <= 40) hits++ }
      }
    } while (cursor !== '0')
    const scanMs = performance.now() - t0
    const t1 = performance.now()
    const r = await c.call('FT.SEARCH', 'idx:customer', '@city:{London} @plan:{pro} @age:[30 40]', 'LIMIT', '0', '0')
    const searchMs = performance.now() - t1
    out.searchVsScan = { docs: 1000, scanned, hits, searchHits: Number(r[0]), scanMs: Math.round(scanMs * 10) / 10, searchMs: Math.round(searchMs * 10) / 10 }
  }

  // 3. Time series
  {
    const tr = new Transcript()
    const t0 = 1792300000000
    for (const line of [
      'TS.CREATE temp:kitchen RETENTION 86400000 DUPLICATE_POLICY LAST LABELS room kitchen type temperature',
      'TS.CREATE temp:kitchen:hourly LABELS room kitchen type temperature resolution 1h',
      'TS.CREATERULE temp:kitchen temp:kitchen:hourly AGGREGATION avg 3600000',
    ]) await tr.run(c, line)
    const cmds = []
    for (let m = 0; m < 6 * 60; m++) cmds.push(['TS.ADD', 'temp:kitchen', String(t0 + m * 60000), (20 + 2 * Math.sin(m / 60) + rand() * 0.4).toFixed(2)])
    await batch(cmds)
    tr.note('(6 hours of one-minute readings added with TS.ADD in a pipeline)')
    for (const line of [
      `TS.ADD temp:kitchen ${t0 + 360 * 60000} 21.4`,
      'TS.GET temp:kitchen',
      `TS.RANGE temp:kitchen ${t0} ${t0 + 4 * 60000}`,
      `TS.RANGE temp:kitchen - + AGGREGATION max 3600000`,
      'TS.RANGE temp:kitchen:hourly - +',
      'TS.MRANGE - + SELECTED_LABELS resolution COUNT 2 AGGREGATION max 3600000 FILTER room=kitchen type=temperature',
    ]) await tr.run(c, line)
    out.timeseries = tr.steps
    out.tsStart = t0
    // Memory: 10,000 samples as a time series vs a sorted set (score = time, member = "time:value")
    const ts = []; const zs = []
    for (let i = 0; i < 10000; i++) { const v = (20 + rand() * 5).toFixed(2); ts.push(['TS.ADD', 'mem:ts', String(t0 + i * 1000), v]); zs.push(['ZADD', 'mem:zset', String(t0 + i * 1000), `${t0 + i * 1000}:${v}`]) }
    await c.call('TS.CREATE', 'mem:ts')
    await batch(ts); await batch(zs)
    const tsInfo = await c.call('TS.INFO', 'mem:ts')
    out.tsMemory = { samples: 10000, timeseries: Number(tsInfo[tsInfo.indexOf('memoryUsage') + 1]), zset: await mem('mem:zset'), chunks: Number(tsInfo[tsInfo.indexOf('chunkCount') + 1]) }
  }

  // 4. Probabilistic types
  {
    const tr = new Transcript()
    for (const line of [
      'BF.RESERVE seen:emails 0.01 100000',
      'BF.ADD seen:emails ada@example.com',
      'BF.EXISTS seen:emails ada@example.com',
      'BF.EXISTS seen:emails alan@example.com',
      'CF.RESERVE seen:coupons 100000',
      'CF.ADD seen:coupons WELCOME10',
      'CF.DEL seen:coupons WELCOME10',
      'CF.EXISTS seen:coupons WELCOME10',
      'CMS.INITBYPROB page:views 0.001 0.01',
      'CMS.INCRBY page:views /home 120 /pricing 7',
      'CMS.QUERY page:views /home /pricing /about',
      'TOPK.RESERVE top:products 3',
      'TOPK.ADD top:products p1 p2 p1 p3 p1 p2 p4',
      'TOPK.LIST top:products WITHCOUNT',
      'TDIGEST.CREATE latency:ms',
      'TDIGEST.ADD latency:ms 12 15 11 230 14 13 16 12 980 15',
      'TDIGEST.QUANTILE latency:ms 0.5 0.9 0.99',
    ]) await tr.run(c, line)
    out.prob = tr.steps

    // Bloom: 100,000 members, then 100,000 strangers -> measured false positive rate; memory vs a set
    const N = 100000
    await c.call('BF.RESERVE', 'bf:test', '0.01', String(N))
    await c.call('CF.RESERVE', 'cf:test', String(N))
    const members = Array.from({ length: N }, (_, i) => `user:${i}@example.com`)
    const add = []; const sadd = []; const cadd = []
    for (let i = 0; i < N; i += 1000) { const chunk = members.slice(i, i + 1000); add.push(['BF.MADD', 'bf:test', ...chunk]); sadd.push(['SADD', 'set:test', ...chunk]); for (const m of chunk) cadd.push(['CF.ADD', 'cf:test', m]) }
    await batch(add, 50); await batch(sadd, 50); await batch(cadd)
    let bfFalse = 0; let cfFalse = 0
    for (let i = 0; i < N; i += 1000) {
      const strangers = Array.from({ length: 1000 }, (_, j) => `stranger:${i + j}@example.com`)
      bfFalse += (await c.call('BF.MEXISTS', 'bf:test', ...strangers)).filter((x) => Number(x) === 1).length
      cfFalse += (await c.call('CF.MEXISTS', 'cf:test', ...strangers)).filter((x) => Number(x) === 1).length
    }
    out.bloom = { n: N, target: 0.01, bfFalse, cfFalse, bf: await mem('bf:test'), cf: await mem('cf:test'), set: await mem('set:test') }

    // Count-min vs exact counts on a skewed stream (a few hot pages, a long tail)
    await c.call('CMS.INITBYPROB', 'cms:test', '0.001', '0.01')
    const exact = new Map(); const incr = []
    for (let i = 0; i < 200000; i++) { const page = `/p/${Math.floor(Math.pow(rand(), 3) * 5000)}`; exact.set(page, (exact.get(page) ?? 0) + 1); incr.push(page) }
    for (let i = 0; i < incr.length; i += 1000) { const args = []; for (const p of incr.slice(i, i + 1000)) args.push(p, '1'); await c.call('CMS.INCRBY', 'cms:test', ...args) }
    const pages = [...exact.keys()]
    const est = await c.call('CMS.QUERY', 'cms:test', ...pages)
    let over = 0; let maxOver = 0
    pages.forEach((p, i) => { const d = Number(est[i]) - exact.get(p); if (d < 0) throw new Error('count-min undercounted'); if (d > 0) over++; maxOver = Math.max(maxOver, d) })
    const hashArgs = []; for (const [p, n] of exact) hashArgs.push(p, String(n))
    await c.call('HSET', 'hash:counts', ...hashArgs)
    const top = [...exact.entries()].sort((a, b) => b[1] - a[1])[0]
    const topEst = Number((await c.call('CMS.QUERY', 'cms:test', top[0]))[0])
    out.cms = { events: 200000, distinct: pages.length, overcounted: over, maxOver, epsilonBound: Math.round(0.001 * 200000), cms: await mem('cms:test'), hash: await mem('hash:counts'), topPage: top[0], topExact: top[1], topEst }

    // t-digest vs exact percentiles on 100,000 latencies; memory vs a list of all samples
    await c.call('TDIGEST.CREATE', 'td:test')
    const lat = []
    for (let i = 0; i < 100000; i++) lat.push(Math.round((rand() < 0.97 ? 8 + rand() * 20 : 60 + Math.pow(rand(), 2) * 900) * 10) / 10)
    for (let i = 0; i < lat.length; i += 2000) { const chunk = lat.slice(i, i + 2000).map(String); await c.call('TDIGEST.ADD', 'td:test', ...chunk); await c.call('RPUSH', 'list:test', ...chunk) }
    const sorted = [...lat].sort((a, b) => a - b)
    const qs = [0.5, 0.9, 0.99, 0.999]
    const estQ = await c.call('TDIGEST.QUANTILE', 'td:test', ...qs.map(String))
    out.tdigest = { n: lat.length, quantiles: qs.map((q, i) => ({ q, exact: sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))], estimate: Math.round(Number(estQ[i]) * 10) / 10 })), tdigest: await mem('td:test'), list: await mem('list:test') }
  }

  // 5. Vector sets
  {
    const tr = new Transcript()
    for (const line of [
      `VADD products VALUES 3 0.9 0.1 0.0 p:running-shoe SETATTR '{"category":"shoes","price":89}'`,
      `VADD products VALUES 3 0.8 0.2 0.1 p:trail-shoe SETATTR '{"category":"shoes","price":120}'`,
      `VADD products VALUES 3 0.7 0.0 0.4 p:sports-sock SETATTR '{"category":"socks","price":9}'`,
      `VADD products VALUES 3 0.0 0.9 0.3 p:rain-jacket SETATTR '{"category":"jackets","price":150}'`,
      'VCARD products',
      'VDIM products',
      'VSIM products ELE p:running-shoe WITHSCORES COUNT 3',
      `VSIM products VALUES 3 0.85 0.1 0.1 WITHSCORES COUNT 3 FILTER '.category == "shoes" and .price < 100'`,
      'VGETATTR products p:trail-shoe',
      'VREM products p:rain-jacket',
    ]) await tr.run(c, line)
    out.vectors = tr.steps.map((s) => ({ ...s, out: s.out.replace(/"(\d\.\d{4})\d+"/g, '"$1"') }))
    // Memory per quantisation: 2,000 random 384-dimension vectors
    const dims = 384; const n = 2000
    const vecs = Array.from({ length: n }, () => Array.from({ length: dims }, () => (rand() * 2 - 1).toFixed(4)))
    const mems = {}
    for (const q of ['NOQUANT', 'Q8', 'BIN']) {
      await batch(vecs.map((v, i) => ['VADD', `vec:${q}`, 'VALUES', String(dims), ...v, `item:${i}`, q]), 200)
      mems[q] = await mem(`vec:${q}`)
    }
    out.vectorMemory = { n, dims, raw: n * dims * 4, ...mems }
    const vinfo = await c.call('VINFO', 'vec:Q8')
    out.vinfo = vinfo.map(String)
  }
} finally {
  c.close()
  podman('rm', '-f', NAME)
}

const json = JSON.stringify(out, null, 1).replaceAll(String(PORT), '6379')
for (const secret of [userInfo().username, homedir()]) if (json.includes(secret)) throw new Error(`recording contains "${secret}"`)
writeFileSync(outFile, `// Recorded from Redis ${out.version} (${IMAGE}) by tools/redis-capture/capture-beyond.mjs — do not edit by hand.\n\nexport const BEYOND = ${json} as const\n`)
console.log('wrote', outFile)
process.exit(0)
