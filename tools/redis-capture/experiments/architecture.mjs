// The process, its threads, and what one slow command does to everybody else.
import { readdirSync, readFileSync } from 'node:fs'

const BUSY = 'local i = 0 while i < tonumber(ARGV[1]) do i = i + 1 end return i'

/** Milliseconds a PING takes from client b while client a runs `line`. */
async function pingDuring(lab, a, b, args, delayMs = 30) {
  const started = Date.now()
  const slow = a.send(...args)
  await lab.sleep(delayMs)
  const t = Date.now()
  const ping = await b.send('PING')
  const pingMs = Date.now() - t
  const reply = await slow
  return { slowMs: Date.now() - started, pingMs, ping: ping.type === 'error' ? `(error) ${ping.value}` : ping.value, slowReply: reply.type }
}

export async function run(lab) {
  const s = await lab.server('arch')
  const a = await s.client()
  const b = await s.client()
  const out = {}

  // Threads of an idle server, by name (Linux: /proc/<pid>/task/*/comm)
  const pid = (await a.call('INFO', 'server')).match(/process_id:(\d+)/)[1]
  out.threads = readdirSync(`/proc/${pid}/task`).map((t) => readFileSync(`/proc/${pid}/task/${t}/comm`, 'utf8').trim()).sort()
  const info = await a.call('INFO', 'server')
  out.server = Object.fromEntries(['redis_version', 'redis_mode', 'arch_bits', 'multiplexing_api', 'io_threads_active', 'hz', 'configured_hz'].map((k) => [k, (info.match(new RegExp(`^${k}:(.*)$`, 'm')) ?? [])[1]?.trim()]).filter(([, v]) => v !== undefined))
  out.ioThreads = (await a.call('CONFIG', 'GET', 'io-threads'))[1]

  // Baseline latency of PING with nothing else happening
  const lat = []
  for (let i = 0; i < 200; i++) { const t = process.hrtime.bigint(); await b.call('PING'); lat.push(Number(process.hrtime.bigint() - t) / 1e6) }
  lat.sort((x, y) => x - y)
  out.pingBaselineMs = { p50: +lat[100].toFixed(3), p99: +lat[198].toFixed(3) }

  // Calibrate a busy Lua loop to ~600 ms
  let n = 5_000_000
  let t = Date.now(); await a.call('EVAL', BUSY, 0, n); let ms = Date.now() - t
  n = Math.round(n * 600 / ms)
  out.busyScript = BUSY

  // 1) default busy-reply-threshold (5000 ms): other clients just wait
  out.blockedDefault = await pingDuring(lab, a, b, ['EVAL', BUSY, 0, n])
  out.busyThresholdDefault = (await a.call('CONFIG', 'GET', 'busy-reply-threshold'))[1]

  // 2) threshold 200 ms: after it, other clients get a BUSY error instead of waiting
  await a.call('CONFIG', 'SET', 'busy-reply-threshold', 200)
  out.blockedBusyError = await pingDuring(lab, a, b, ['EVAL', BUSY, 0, n], 300)
  await a.call('CONFIG', 'SET', 'busy-reply-threshold', 5000)

  // 3) KEYS on a big keyspace versus SCAN
  await a.call('DEBUG', 'POPULATE', 1_000_000, 'item')
  out.keyspace = await a.call('DBSIZE')
  t = Date.now(); await a.call('KEYS', 'nomatch*'); out.keysMs = Date.now() - t
  out.keysPing = await pingDuring(lab, a, b, ['KEYS', 'nomatch*'], 5)
  t = Date.now(); const first = await a.call('SCAN', 0, 'MATCH', 'nomatch*', 'COUNT', 1000); out.scanStepMs = Date.now() - t
  out.scanFirst = { cursor: first[0], returned: first[1].length }
  t = Date.now(); let cursor = '0', calls = 0
  do { const r = await a.call('SCAN', cursor, 'MATCH', 'nomatch*', 'COUNT', 1000); cursor = r[0]; calls++ } while (cursor !== '0')
  out.scanFull = { calls, totalMs: Date.now() - t }

  // Slow log after all that
  const tr = new lab.Transcript()
  await tr.run(a, 'SLOWLOG GET 3')
  out.slowlog = tr.steps
  a.close(); b.close()
  await s.stop()
  return out
}
