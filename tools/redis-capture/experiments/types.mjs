// Every data type, its internal encodings, where the encoding changes, and what it costs in memory.
const pad = (n, len) => String(n).padStart(len, '0')

export async function run(lab) {
  const s = await lab.server('types')
  const c = await s.client()
  const enc = (k) => c.call('OBJECT', 'ENCODING', k)
  const mem = (k) => c.call('MEMORY', 'USAGE', k)
  const out = {}

  out.config = {}
  for (const k of ['hash-max-listpack-entries', 'hash-max-listpack-value', 'list-max-listpack-size', 'set-max-intset-entries', 'set-max-listpack-entries', 'set-max-listpack-value', 'zset-max-listpack-entries', 'zset-max-listpack-value', 'stream-node-max-entries', 'stream-node-max-bytes'])
    out.config[k] = (await c.call('CONFIG', 'GET', k))[1]

  // Strings
  out.strings = []
  for (const [key, value] of [['counter', '12345'], ['short', 'x'.repeat(44)], ['long', 'x'.repeat(45)], ['huge-number', '123456789012345678901234567890'], ['float', '3.14']]) {
    await c.call('SET', key, value)
    out.strings.push({ key, bytes: value.length, encoding: await enc(key), memory: await mem(key) })
  }
  // embstr keeps key, value and object header in one allocation: the limit depends on the key length too
  out.embstrLimit = []
  for (const key of ['k', 'user:1:name', 'session:3f2a9c1e-77d0-4b2e']) {
    let max = 0
    for (let n = 1; n <= 64; n++) { await c.call('SET', key, 'x'.repeat(n)); if ((await enc(key)) === 'embstr') max = n }
    out.embstrLimit.push({ key, keyBytes: key.length, maxValueBytes: max })
  }
  await c.call('SET', 'grows', 'abc')
  const before = await enc('grows')
  await c.call('APPEND', 'grows', 'def')
  out.appendTurnsRaw = { before, after: await enc('grows') }

  /** Adds elements one by one and reports where the encoding changes. */
  async function grow(type, key, add, limit) {
    await c.call('DEL', key)
    let last = null
    const steps = []
    for (let i = 1; i <= limit; i++) {
      await add(i)
      const e = await enc(key)
      if (e !== last) { steps.push({ count: i, encoding: e, memory: await mem(key) }); last = e }
      if (steps.length > 1 && i > steps[steps.length - 1].count + 1) break
    }
    // also memory right before the change
    return { type, key, steps }
  }

  out.transitions = []
  out.transitions.push(await grow('hash', 'h', (i) => c.call('HSET', 'h', `field:${pad(i, 4)}`, 'value'), 600))
  out.transitions.push(await grow('set of integers', 'si', (i) => c.call('SADD', 'si', i), 600))
  out.transitions.push(await grow('set of strings', 'ss', (i) => c.call('SADD', 'ss', `member:${i}`), 600))
  out.transitions.push(await grow('sorted set', 'z', (i) => c.call('ZADD', 'z', i, `member:${i}`), 600))
  out.transitions.push(await grow('list (10-byte items)', 'l', (i) => c.call('RPUSH', 'l', `item:${pad(i, 5)}`), 2000))

  // Memory just below and just above the hash threshold
  const limit = Number(out.config['hash-max-listpack-entries'])
  await c.call('DEL', 'h')
  for (let i = 1; i <= limit; i++) await c.call('HSET', 'h', `field:${pad(i, 4)}`, 'value')
  const atLimit = { fields: limit, encoding: await enc('h'), memory: await mem('h') }
  await c.call('HSET', 'h', 'one-more', 'value')
  out.hashJump = { atLimit, above: { fields: limit + 1, encoding: await enc('h'), memory: await mem('h') } }

  // One long value is enough to switch
  await c.call('DEL', 'h2'); await c.call('HSET', 'h2', 'a', '1')
  const small = await enc('h2')
  await c.call('HSET', 'h2', 'bio', 'y'.repeat(Number(out.config['hash-max-listpack-value']) + 1))
  out.longValue = { before: small, after: await enc('h2'), valueBytes: Number(out.config['hash-max-listpack-value']) + 1 }

  // No way back: delete down to one field
  for (let i = 2; i <= limit; i++) await c.call('HDEL', 'h', `field:${pad(i, 4)}`)
  await c.call('HDEL', 'h', 'one-more')
  out.noWayBack = { fields: await c.call('HLEN', 'h'), encoding: await enc('h') }

  // 100,000 small objects: separate keys vs fields inside hashes of 100
  await c.call('FLUSHALL')
  const used = async () => Number((await c.call('INFO', 'memory')).match(/used_memory:(\d+)/)[1])
  let base = await used()
  const cmds = []
  for (let i = 0; i < 100_000; i++) cmds.push(['SET', `user:${i}:name`, `name${i}`])
  for (let i = 0; i < cmds.length; i += 1000) await c.pipeline(cmds.slice(i, i + 1000))
  const asKeys = (await used()) - base
  await c.call('FLUSHALL'); await new Promise((r) => setTimeout(r, 200))
  base = await used()
  const hcmds = []
  for (let i = 0; i < 100_000; i++) hcmds.push(['HSET', `user:${Math.floor(i / 100)}`, `${i % 100}:name`, `name${i}`])
  for (let i = 0; i < hcmds.length; i += 1000) await c.pipeline(hcmds.slice(i, i + 1000))
  const asHashes = (await used()) - base
  out.bucketing = { objects: 100_000, asKeysBytes: asKeys, asHashesBytes: asHashes, hashEncoding: await enc('user:0') }

  // TYPE and encoding of every type, in one transcript
  await c.call('FLUSHALL')
  const tr = new lab.Transcript()
  for (const line of [
    'SET page:home:views 1042', 'OBJECT ENCODING page:home:views', 'SET user:1:name "Ann Lee"', 'OBJECT ENCODING user:1:name',
    'RPUSH queue:emails m1 m2 m3', 'OBJECT ENCODING queue:emails',
    'HSET user:1 name Ann email ann@example.com plan pro', 'OBJECT ENCODING user:1',
    'SADD tags:post:9 redis cache db', 'OBJECT ENCODING tags:post:9',
    'SADD online:ids 4 8 15 16 23 42', 'OBJECT ENCODING online:ids',
    'ZADD leaderboard 3200 ann 2800 bob 4100 eve', 'OBJECT ENCODING leaderboard',
    'XADD events * type signup user 1', 'TYPE events', 'OBJECT ENCODING events',
  ]) await tr.run(c, line)
  out.tour = tr.steps.map((st) => (st.out.match(/^\d+-\d+$|^"\d+-\d+"$/) ? { ...st, out: '"1792300000000-0"' } : st))
  c.close()
  await s.stop()
  return out
}
