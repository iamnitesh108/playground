// Data structures used as building blocks: counters, sessions, HyperLogLog, bitmaps, geo, sets.
export async function run(lab) {
  const s = await lab.server('patterns')
  const c = await s.client()
  const out = {}
  const rec = async (lines) => { const tr = new lab.Transcript(); for (const l of lines) await tr.run(c, l); return tr.steps }

  out.session = await rec([
    'HSET session:9f3e2a user_id 7 role admin csrf k29fj',
    'EXPIRE session:9f3e2a 1800',
    'HGET session:9f3e2a user_id',
    'EXPIRE session:9f3e2a 1800',
    'TTL session:9f3e2a',
    'DEL session:9f3e2a',
  ])
  out.counters = await rec([
    'INCR page:/pricing:views',
    'INCRBY page:/pricing:views 9',
    'HINCRBY stats:2026-10-18 signups 1',
    'HINCRBY stats:2026-10-18 orders 3',
    'HGETALL stats:2026-10-18',
    'INCRBYFLOAT wallet:7 12.50',
  ])
  out.dedupe = await rec(['SADD seen:emails ann@example.com', 'SADD seen:emails ann@example.com', 'SISMEMBER seen:emails bob@example.com', 'SCARD seen:emails'])

  // HyperLogLog: count distinct visitors in 12 KB, with a small error
  out.hll = []
  let added = 0
  for (const target of [1_000, 10_000, 100_000, 1_000_000]) {
    while (added < target) { const n = Math.min(10_000, target - added); await c.pipeline(Array.from({ length: Math.ceil(n / 100) }, (_, b) => ['PFADD', 'visitors:2026-10-18', ...Array.from({ length: 100 }, (_, i) => `visitor-${added + b * 100 + i}`)])); added += n }
    const est = await c.call('PFCOUNT', 'visitors:2026-10-18')
    out.hll.push({ distinct: target, estimate: est, errorPercent: +((Math.abs(est - target) / target) * 100).toFixed(2), bytes: await c.call('MEMORY', 'USAGE', 'visitors:2026-10-18') })
  }
  // the same million as a set, for comparison
  await c.call('DEL', 'visitors:set')
  for (let i = 0; i < 1_000_000; i += 10_000) await c.pipeline(Array.from({ length: 100 }, (_, b) => ['SADD', 'visitors:set', ...Array.from({ length: 100 }, (_, j) => `visitor-${i + b * 100 + j}`)]))
  out.setOfMillion = { members: await c.call('SCARD', 'visitors:set'), bytes: await c.call('MEMORY', 'USAGE', 'visitors:set', 'SAMPLES', 0) }
  await c.call('DEL', 'visitors:set')
  out.hllMerge = await rec(['PFADD visitors:mon a b c d', 'PFADD visitors:tue c d e', 'PFMERGE visitors:week visitors:mon visitors:tue', 'PFCOUNT visitors:week'])

  // Bitmaps: one bit per user id per day
  await c.pipeline(Array.from({ length: 1000 }, (_, i) => ['SETBIT', 'active:2026-10-17', i * 997 % 1_000_000, 1]))
  await c.pipeline(Array.from({ length: 1000 }, (_, i) => ['SETBIT', 'active:2026-10-18', (i * 997 + (i % 3 === 0 ? 1 : 0)) % 1_000_000, 1]))
  out.bitmaps = await rec([
    'SETBIT active:2026-10-18 999999 1',
    'GETBIT active:2026-10-18 999999',
    'BITCOUNT active:2026-10-18',
    'BITOP AND active:both active:2026-10-17 active:2026-10-18',
    'BITCOUNT active:both',
    'MEMORY USAGE active:2026-10-18',
  ])

  // Geo: a sorted set with interleaved coordinates
  out.geo = await rec([
    'GEOADD stores 13.4050 52.5200 store:central 13.3777 52.5163 store:west 13.4545 52.5110 store:east 13.2846 52.5303 store:far',
    'GEOSEARCH stores FROMLONLAT 13.4000 52.5190 BYRADIUS 5 km ASC WITHDIST',
    'GEODIST stores store:central store:far km',
    'TYPE stores',
    'ZRANGE stores 0 0 WITHSCORES',
  ])

  // Sets: tags, intersections
  out.sets = await rec(['SADD tag:redis post:1 post:2 post:3', 'SADD tag:cache post:2 post:3 post:4', 'SINTER tag:redis tag:cache', 'SUNION tag:redis tag:cache', 'SDIFF tag:redis tag:cache'])

  // A leaderboard
  out.leaderboard = await rec([
    'ZADD leaderboard 3200 ann 2800 bob 4100 eve 2800 dan',
    'ZINCRBY leaderboard 500 bob',
    'ZREVRANGE leaderboard 0 2 WITHSCORES',
    'ZREVRANK leaderboard ann',
    'ZSCORE leaderboard bob',
    'ZRANGE leaderboard 3000 4000 BYSCORE WITHSCORES',
    'ZCOUNT leaderboard 3000 +inf',
  ])
  c.close()
  await s.stop()
  return out
}
