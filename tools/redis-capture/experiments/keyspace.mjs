// The main dictionary: table sizes, incremental rehashing, and how SCAN walks it.
export async function run(lab) {
  const s = await lab.server('keyspace', ['--activerehashing', 'no'])
  const c = await s.client()
  const out = {}
  const ht = async () => (await c.call('DEBUG', 'HTSTATS', 0)).trim()

  out.htEmpty = await ht()
  for (let i = 1; i <= 4; i++) await c.call('SET', `k${i}`, i)
  out.ht4 = await ht()
  await c.call('SET', 'k5', 5)
  out.ht5 = await ht()
  // let the cron... (activerehashing off) — each access moves buckets
  for (let i = 0; i < 20; i++) await c.call('GET', 'k1')
  out.ht5AfterAccess = await ht()

  // A bigger table caught in the middle of a rehash
  await c.call('FLUSHALL')
  const cmds = []
  for (let i = 0; i < 65_536; i++) cmds.push(['SET', `key:${i}`, i])
  for (let i = 0; i < cmds.length; i += 4096) await c.pipeline(cmds.slice(i, i + 4096))
  out.htFull = await ht()
  await c.call('SET', 'one-more', 1)
  out.htRehashing = await ht()
  for (let i = 0; i < 200; i++) await c.call('GET', `key:${i}`)
  out.htRehashingLater = await ht()
  await c.call('CONFIG', 'SET', 'activerehashing', 'yes')
  await lab.sleep(500)
  out.htDone = await ht()

  // SCAN on a small keyspace: the cursor sequence and what each call returns
  await c.call('FLUSHALL')
  for (let i = 1; i <= 20; i++) await c.call('SET', `user:${i}`, i)
  const tr = new lab.Transcript()
  let cursor = '0'
  do { const r = await tr.run(c, `SCAN ${cursor} MATCH user:* COUNT 5`); cursor = r.value[0].value.toString() } while (cursor !== '0')
  out.scan = tr.steps
  const tr2 = new lab.Transcript()
  await tr2.run(c, 'SCAN 0 MATCH user:1* COUNT 5')
  await tr2.run(c, 'SCAN 0 TYPE string COUNT 100')
  out.scanFilter = tr2.steps

  // Cursor values in binary: they count with the bits reversed
  await c.call('FLUSHALL')
  for (let i = 0; i < 12; i++) await c.call('SET', `k:${i}`, i)
  // let any growth finish first, so the cursor walks one table (each command moves a bucket)
  while (/rehashing target/.test(await ht())) await c.call('GET', 'k:0')
  const cursors = []
  cursor = '0'
  do { const r = await c.call('SCAN', cursor, 'COUNT', 1); cursor = r[0]; cursors.push(Number(cursor)) } while (cursor !== '0')
  out.cursorSequence = { tableSize: Number((await ht()).match(/table size: (\d+)/)?.[1]), cursors }
  c.close()
  await s.stop()
  return out
}
