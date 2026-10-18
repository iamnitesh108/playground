// Proves the formatter matches the real redis-cli before anything is recorded.
import { execFileSync } from 'node:child_process'
import { formatReply, splitArgs } from './format.mjs'

const LINES = [
  'SET k "hello world"', 'GET k', 'GET missing', 'INCR n', 'INCR k', 'DEL k n',
  'RPUSH l a b "c d" "e\\nf"', 'LRANGE l 0 -1', 'LRANGE nothing 0 -1',
  'HSET h f1 v1 f2 v2', 'HGETALL h', 'ZADD z 1 a 2.5 b 10 c', 'ZRANGE z 0 -1 WITHSCORES',
  'SADD s 1 2 3', 'SMEMBERS s', 'XADD st 1-1 a 1', 'XRANGE st - +', 'TYPE z', 'OBJECT ENCODING z',
  'MSET a 1 b 2 c 3 d 4 e 5 f 6 g 7 h 8 i 9 j 10 k2 11', 'MGET a b c d e f g h i j k2 nokey',
  'SCAN 0 COUNT 100 MATCH nomatch*', 'CONFIG GET maxmemory-policy', 'NOSUCHCOMMAND x',
]

export async function selfCheck(server) {
  let failures = 0
  // Run every line through both, from a clean database each time.
  const c2 = await server.client()
  await c2.call('FLUSHALL')
  const mineAll = []
  for (const line of LINES) mineAll.push(formatReply(await c2.send(...splitArgs(line))).trimEnd())
  await c2.call('FLUSHALL')
  const cliAll = []
  for (const line of LINES) {
    let out
    try {
      out = execFileSync('redis-cli', ['-p', String(server.port), '--no-raw', ...splitArgs(line)], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
    } catch (e) { out = e.stdout.toString() }
    cliAll.push(out.trimEnd())
  }
  LINES.forEach((line, i) => {
    if (mineAll[i] !== cliAll[i]) {
      failures++
      console.error(`format mismatch for ${line}\n--- redis-cli\n${cliAll[i]}\n--- mine\n${mineAll[i]}`)
    }
  })
  c2.close()
  if (failures) throw new Error(`${failures} formatter mismatches`)
  return LINES.length
}
