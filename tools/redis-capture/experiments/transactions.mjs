// MULTI/EXEC, WATCH, and scripts: what is atomic, and what is never rolled back.
export async function run(lab) {
  const s = await lab.server('tx')
  const a = await s.client()
  const b = await s.client()
  const out = {}
  const rec = async (lines, who = null, client = a) => { const tr = new lab.Transcript(); for (const l of lines) await tr.run(client, l, who); return tr.steps }

  await a.call('SET', 'stock:42', 10)
  out.basic = await rec(['MULTI', 'DECRBY stock:42 3', 'RPUSH orders:42 order-1001', 'EXEC', 'GET stock:42'])

  // A command that fails while running does not undo the others
  await a.call('SET', 'name', 'Ann')
  out.runtimeError = await rec(['MULTI', 'INCR counter', 'INCR name', 'INCR counter', 'EXEC', 'GET counter'])

  // A command that cannot even be queued aborts the whole transaction
  await a.call('DEL', 'counter')
  out.queueError = await rec(['MULTI', 'INCR counter', 'INCRR counter', 'INCR counter', 'EXEC', 'GET counter'])

  out.discard = await rec(['MULTI', 'SET a 1', 'DISCARD', 'GET a'])

  // WATCH: optimistic locking, two clients
  await a.call('SET', 'balance:7', 100)
  {
    const tr = new lab.Transcript()
    await tr.run(a, 'WATCH balance:7', 'A')
    await tr.run(a, 'GET balance:7', 'A')
    await tr.run(b, 'INCRBY balance:7 50', 'B')
    await tr.run(a, 'MULTI', 'A')
    await tr.run(a, 'SET balance:7 70', 'A')
    await tr.run(a, 'EXEC', 'A')
    await tr.run(a, 'GET balance:7', 'A')
    tr.note('A reads again and retries')
    await tr.run(a, 'WATCH balance:7', 'A')
    await tr.run(a, 'GET balance:7', 'A')
    await tr.run(a, 'MULTI', 'A')
    await tr.run(a, 'SET balance:7 120', 'A')
    await tr.run(a, 'EXEC', 'A')
    out.watch = tr.steps
  }

  // Scripts: the whole script runs without anything in between, but there is no rollback either
  const CAP = "local v = redis.call('INCR', KEYS[1]) if v > tonumber(ARGV[1]) then redis.call('DECR', KEYS[1]) return 0 end return v"
  await a.call('DEL', 'seats:show:9')
  {
    const tr = new lab.Transcript()
    for (let i = 0; i < 4; i++) await tr.run(a, `EVAL "${CAP}" 1 seats:show:9 3`)
    out.script = tr.steps
  }
  out.scriptSource = CAP
  await a.call('DEL', 'x')
  out.scriptError = await rec([
    `EVAL "redis.call('SET', KEYS[1], 'written'); redis.call('INCR', KEYS[2]); return 'done'" 2 x name`,
    'GET x',
  ])
  const sha = await a.call('SCRIPT', 'LOAD', CAP)
  out.evalsha = await rec([`EVALSHA ${sha} 1 seats:show:10 3`, 'SCRIPT FLUSH', `EVALSHA ${sha} 1 seats:show:10 3`])

  // Functions: named, stored with the data (and in RDB/AOF), replicated
  const LIB = "#!lua name=inventory\nredis.register_function('reserve', function(keys, args) local left = tonumber(redis.call('GET', keys[1]) or '0') local want = tonumber(args[1]) if left < want then return redis.error_reply('NOT_ENOUGH stock left: ' .. left) end return redis.call('DECRBY', keys[1], want) end)"
  out.functionSource = LIB
  await a.call('FUNCTION', 'LOAD', 'REPLACE', LIB)
  await a.call('SET', 'stock:42', 5)
  out.functions = await rec(['FCALL reserve 1 stock:42 2', 'FCALL reserve 1 stock:42 4', 'FUNCTION LIST'])
  a.close(); b.close()
  await s.stop()
  return out
}
