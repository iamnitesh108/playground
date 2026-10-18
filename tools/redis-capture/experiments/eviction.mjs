// maxmemory: refusing writes, evicting with approximated LRU / LFU, and the LFU counter.
const stat = (info, k) => Number(info.match(new RegExp(`^${k}:(\\S+)`, 'm'))?.[1])

async function hotCold(lab, policy, extra = {}, pauseMs = 0) {
  const s = await lab.server(`evict-${policy}`, ['--maxmemory', '20mb', '--maxmemory-policy', policy, ...Object.entries(extra).flatMap(([k, v]) => [`--${k}`, String(v)])])
  const c = await s.client()
  const value = 'v'.repeat(100)
  // 1,000 hot keys, read constantly; then 200,000 cold keys written once (far more than fits)
  for (let i = 0; i < 1000; i++) await c.call('SET', `hot:${i}`, value)
  let errors = 0
  for (let batch = 0; batch < 200; batch++) {
    const cmds = []
    for (let i = 0; i < 1000; i++) cmds.push(['SET', `cold:${batch * 1000 + i}`, value])
    for (let i = 0; i < 200; i++) cmds.push(['GET', `hot:${(batch * 200 + i) % 1000}`])
    const replies = await c.pipeline(cmds)
    errors += replies.filter((r) => r.type === 'error').length
    if (pauseMs) await lab.sleep(pauseMs)
  }
  let hot = 0
  const keys = await c.call('DBSIZE')
  for (let i = 0; i < 1000; i += 100) hot += (await c.pipeline(Array.from({ length: 100 }, (_, j) => ['EXISTS', `hot:${i + j}`]))).reduce((n, r) => n + Number(r.value), 0)
  const info = await c.call('INFO', 'stats')
  const r = { policy, ...extra, ...(pauseMs ? { pauseMsPerBatch: pauseMs } : {}), keysLeft: keys, hotSurvived: hot, coldSurvived: keys - hot, evicted: stat(info, 'evicted_keys'), writeErrors: errors }
  c.close(); await s.stop()
  return r
}

export async function run(lab) {
  const out = {}

  // noeviction: the write fails
  {
    const s = await lab.server('evict-none', ['--maxmemory', '2mb', '--maxmemory-policy', 'noeviction'])
    const c = await s.client()
    let n = 0, err = null
    while (!err) { const r = await c.send('SET', `k:${n}`, 'v'.repeat(100)); if (r.type === 'error') err = r.value; else n++ }
    const tr = new lab.Transcript()
    await tr.run(c, 'GET k:1')
    await tr.run(c, 'SET one:more value')
    await tr.run(c, 'DEL k:1')
    await tr.run(c, 'SET one:more value')
    out.noeviction = { acceptedBeforeError: n, error: err, transcript: tr.steps }
    c.close(); await s.stop()
  }

  // volatile-lru with no TTLs: nothing is eligible, so it behaves like noeviction
  {
    const s = await lab.server('evict-volatile', ['--maxmemory', '2mb', '--maxmemory-policy', 'volatile-lru'])
    const c = await s.client()
    let n = 0, err = null
    while (!err && n < 100000) { const r = await c.send('SET', `k:${n}`, 'v'.repeat(100)); if (r.type === 'error') err = r.value; else n++ }
    out.volatileNoTtl = { acceptedBeforeError: n, error: err }
    c.close(); await s.stop()
  }

  out.hotCold = []
  for (const policy of ['allkeys-random', 'allkeys-lru', 'allkeys-lfu']) out.hotCold.push(await hotCold(lab, policy))
  out.hotCold.push(await hotCold(lab, 'allkeys-lru', { 'maxmemory-samples': 1 }))
  out.hotCold.push(await hotCold(lab, 'allkeys-lru', { 'maxmemory-samples': 10 }))

  // The same LRU workload in one burst (twice: it varies) and spread over ~20 s. With a one-second LRU
  // clock, keys touched in the same second look equally old; spread out, hot keys are clearly fresher.
  out.lruPace = [await hotCold(lab, 'allkeys-lru'), await hotCold(lab, 'allkeys-lru'), await hotCold(lab, 'allkeys-lru', {}, 100)]

  // LFU counter growth with the default lfu-log-factor (10)
  {
    const s = await lab.server('lfu', ['--maxmemory-policy', 'allkeys-lfu'])
    const c = await s.client()
    out.lfu = { logFactor: Number((await c.call('CONFIG', 'GET', 'lfu-log-factor'))[1]), decayTime: Number((await c.call('CONFIG', 'GET', 'lfu-decay-time'))[1]), points: [] }
    await c.call('SET', 'k', 'v')
    out.lfu.initial = await c.call('OBJECT', 'FREQ', 'k')
    let done = 0
    for (const target of [1, 10, 100, 1000, 10_000, 100_000, 1_000_000]) {
      while (done < target) { const n = Math.min(10_000, target - done); await c.pipeline(Array.from({ length: n }, () => ['GET', 'k'])); done += n }
      out.lfu.points.push({ accesses: target, freq: await c.call('OBJECT', 'FREQ', 'k') })
    }
    // LRU clock: idle time
    await c.call('CONFIG', 'SET', 'maxmemory-policy', 'allkeys-lru')
    await c.call('SET', 'idle', 'v')
    await lab.sleep(2100)
    out.idletime = await c.call('OBJECT', 'IDLETIME', 'idle')
    c.close(); await s.stop()
  }
  return out
}
