// TTL rules, lazy expiry, and the active expire cycle draining keys over time.
const stat = (info, k) => Number(info.match(new RegExp(`^${k}:(\\S+)`, 'm'))?.[1])

export async function run(lab) {
  const s = await lab.server('expiry')
  const c = await s.client()
  const out = {}

  const tr = new lab.Transcript()
  for (const line of [
    'SET session:42 "user=7" EX 1800', 'TTL session:42', 'GET session:42',
    'SET session:42 "user=7;cart=3"', 'TTL session:42',
    'SET session:42 "user=7" EX 1800', 'SET session:42 "user=7;cart=3" KEEPTTL', 'TTL session:42',
    'INCR views', 'EXPIRE views 60', 'INCR views', 'TTL views',
    'RENAME views views:old', 'TTL views:old',
    'PERSIST views:old', 'TTL views:old',
    'TTL nosuchkey', 'EXPIRE nosuchkey 60',
    'SET otp:7 381920 PX 300000', 'PTTL otp:7',
    'EXPIRE otp:7 600 GT', 'EXPIRE otp:7 60 GT', 'TTL otp:7',
    'SET temp 1 EX 1',
  ]) await tr.run(c, line)
  await lab.sleep(1100)
  tr.note('(1.1 seconds later)')
  await tr.run(c, 'GET temp')
  await tr.run(c, 'EXISTS temp')
  out.rules = tr.steps

  // Hash field expiry (one field, not the whole key)
  const tr2 = new lab.Transcript()
  for (const line of ['HSET user:7 name Ann reset_token 9f3k2', 'HEXPIRE user:7 900 FIELDS 1 reset_token', 'HTTL user:7 FIELDS 2 name reset_token', 'HGETALL user:7']) await tr2.run(c, line)
  out.fieldTtl = tr2.steps

  // Lazy expiry only: active cycle switched off
  await c.call('FLUSHALL')
  await c.call('CONFIG', 'RESETSTAT')
  await c.call('DEBUG', 'SET-ACTIVE-EXPIRE', 0)
  const cmds = []
  for (let i = 0; i < 10_000; i++) cmds.push(['SET', `tmp:${i}`, 'x', 'PX', 300])
  await c.pipeline(cmds)
  await lab.sleep(500)
  const lazy = { afterExpiry: { dbsize: await c.call('DBSIZE'), expired: stat(await c.call('INFO', 'stats'), 'expired_keys') } }
  await c.call('GET', 'tmp:1')
  lazy.afterOneGet = { dbsize: await c.call('DBSIZE'), expired: stat(await c.call('INFO', 'stats'), 'expired_keys') }
  out.lazy = lazy
  await c.call('DEBUG', 'SET-ACTIVE-EXPIRE', 1)

  // Active cycle: 200,000 keys, all expiring at the same moment; sample every 50 ms
  async function drain(hz) {
    await c.call('FLUSHALL'); await c.call('CONFIG', 'SET', 'hz', hz); await c.call('CONFIG', 'RESETSTAT')
    const big = []
    for (let i = 0; i < 200_000; i++) big.push(['SET', `tmp:${i}`, 'x', 'PX', 1000])
    for (let i = 0; i < big.length; i += 5000) await c.pipeline(big.slice(i, i + 5000))
    const t0 = Date.now()
    const samples = []
    while (Date.now() - t0 < 4000) {
      samples.push({ ms: Date.now() - t0, keys: await c.call('DBSIZE') })
      if (samples.at(-1).keys === 0) break
      await lab.sleep(50)
    }
    const info = await c.call('INFO', 'stats')
    return { hz, samples, expiredKeys: stat(info, 'expired_keys'), cycleCpuMs: stat(info, 'expire_cycle_cpu_milliseconds') }
  }
  out.active = [await drain(10), await drain(100)]
  await c.call('CONFIG', 'SET', 'hz', 10)

  // Mixed keyspace: 10% expire, 90% do not — the cycle stops early (it only keeps going when >10% of a sample expired)
  await c.call('FLUSHALL'); await c.call('CONFIG', 'RESETSTAT')
  const mixed = []
  for (let i = 0; i < 100_000; i++) mixed.push(i % 10 === 0 ? ['SET', `m:${i}`, 'x', 'PX', 500] : ['SET', `m:${i}`, 'x', 'EX', 3600])
  for (let i = 0; i < mixed.length; i += 5000) await c.pipeline(mixed.slice(i, i + 5000))
  await lab.sleep(3000)
  const info = await c.call('INFO', 'stats')
  out.mixed = { keys: 100_000, shortLived: 10_000, after3s: { dbsize: await c.call('DBSIZE'), expired: stat(info, 'expired_keys'), expiredStalePerc: stat(info, 'expired_stale_perc') } }
  out.activeExpireEffort = (await c.call('CONFIG', 'GET', 'active-expire-effort'))[1]
  c.close()
  await s.stop()
  return out
}
