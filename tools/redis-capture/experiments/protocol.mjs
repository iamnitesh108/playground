// RESP on the wire, round trips, and what pipelining saves.
import { execFileSync } from 'node:child_process'
import net from 'node:net'

const bytes = (s) => s.replaceAll('\r\n', '\\r\\n')

export async function run(lab) {
  const s = await lab.server('proto')
  const c = await s.client()
  const out = {}

  // Exact bytes for a few commands
  out.wire = []
  for (const args of [['SET', 'user:1', 'Ann'], ['GET', 'user:1'], ['GET', 'user:2'], ['INCR', 'visits'], ['INCR', 'user:1'], ['RPUSH', 'cart:1', 'apple', 'pear'], ['LRANGE', 'cart:1', 0, -1]]) {
    c.rawLog = []
    await c.send(...args)
    out.wire.push({ cmd: args.join(' '), sent: bytes(c.rawLog.filter((x) => x.dir === 'out').map((x) => x.bytes).join('')), received: bytes(c.rawLog.filter((x) => x.dir === 'in').map((x) => x.bytes).join('')) })
  }
  c.rawLog = null

  // An inline command typed by hand (what telnet/nc would send)
  out.inline = await new Promise((resolve) => {
    const sock = net.createConnection({ port: s.port }, () => sock.write('PING\r\nGET user:1\r\n'))
    let got = ''
    sock.on('data', (d) => { got += d.toString(); if (got.includes('Ann')) { sock.destroy(); resolve(bytes(got)) } })
  })

  // 10,000 INCRs: one round trip each vs one pipeline vs batches of 100
  const N = 10_000
  await c.call('DEL', 'n')
  let t = process.hrtime.bigint()
  for (let i = 0; i < N; i++) await c.send('INCR', 'n')
  const sequential = Number(process.hrtime.bigint() - t) / 1e6
  t = process.hrtime.bigint()
  await c.pipeline(Array.from({ length: N }, () => ['INCR', 'n']))
  const pipelined = Number(process.hrtime.bigint() - t) / 1e6
  t = process.hrtime.bigint()
  for (let i = 0; i < N / 100; i++) await c.pipeline(Array.from({ length: 100 }, () => ['INCR', 'n']))
  const batched = Number(process.hrtime.bigint() - t) / 1e6
  out.incr = { n: N, sequentialMs: +sequential.toFixed(1), pipelinedMs: +pipelined.toFixed(1), batched100Ms: +batched.toFixed(1), final: await c.call('GET', 'n') }

  // redis-benchmark: 50 clients, then the same with 16 commands per pipeline
  const bench = (extra) => execFileSync('redis-benchmark', ['-p', String(s.port), '-t', 'set,get', '-n', '200000', '-q', ...extra]).toString().split(/\r|\n/).map((l) => l.trim()).filter((l) => /^(SET|GET):.*per second/.test(l))
  out.benchmark = { plain: bench([]), pipeline16: bench(['-P', '16']), oneClient: bench(['-c', '1']) }

  // A pipeline is not a transaction: another client's command can land in between
  const tr = new lab.Transcript()
  await tr.run(c, 'MULTI', 'A')
  await tr.run(c, 'SET stock 10', 'A')
  await tr.run(c, 'DECR stock', 'A')
  await tr.run(c, 'EXEC', 'A')
  out.multi = tr.steps
  c.close()
  await s.stop()
  return out
}
