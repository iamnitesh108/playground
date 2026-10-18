// RDB snapshots, the AOF, and what a crash (kill -9) keeps under each setting.
import { readdirSync, readFileSync, statSync, truncateSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const stat = (info, k) => info.match(new RegExp(`^${k}:(\\S*)`, 'm'))?.[1]

function listing(dir) {
  const walk = (d, prefix = '') => readdirSync(d).sort().flatMap((f) => {
    const p = join(d, f)
    return statSync(p).isDirectory() ? [`${prefix}${f}/`, ...walk(p, prefix + '  ')] : [`${prefix}${f}  (${statSync(p).size} bytes)`]
  })
  return walk(dir).filter((l) => !l.includes('redis.log')).join('\n')
}

async function fill(c, from, n, prefix = 'order') {
  for (let i = from; i < from + n; i += 1000) await c.pipeline(Array.from({ length: Math.min(1000, from + n - i) }, (_, j) => ['SET', `${prefix}:${i + j}`, 'x'.repeat(50)]))
}

/** Writes keys in two phases, crashes with SIGKILL, restarts, and counts what came back. */
async function crashTest(lab, label, args, between) {
  const s = await lab.server(`crash-${label}`, args)
  let c = await s.client()
  await fill(c, 0, 50_000)
  if (between) await between(c)
  await fill(c, 50_000, 50_000)
  const acked = await c.call('DBSIZE')
  c.close()
  await s.kill('SIGKILL')
  await s.start()
  c = await s.client()
  const survived = await c.call('DBSIZE')
  c.close(); await s.stop()
  return { label, args: args.join(' '), acknowledged: acked, survived }
}

export async function run(lab) {
  const out = {}

  // RDB: one BGSAVE of 1,000,000 keys
  {
    const s = await lab.server('rdb')
    const c = await s.client()
    await c.call('DEBUG', 'POPULATE', 1_000_000, 'order', 50)
    await c.call('CONFIG', 'RESETSTAT')
    await c.call('BGSAVE')
    while (stat(await c.call('INFO', 'persistence'), 'rdb_bgsave_in_progress') === '1') await lab.sleep(50)
    const p = await c.call('INFO', 'persistence'), st = await c.call('INFO', 'stats'), mem = await c.call('INFO', 'memory')
    out.rdb = {
      keys: 1_000_000,
      usedMemory: stat(mem, 'used_memory_human'),
      lastBgsaveStatus: stat(p, 'rdb_last_bgsave_status'),
      lastBgsaveSec: Number(stat(p, 'rdb_last_bgsave_time_sec')),
      cowBytes: Number(stat(p, 'rdb_last_cow_size')),
      forkUsec: Number(stat(st, 'latest_fork_usec')),
      fileBytes: statSync(join(s.dir, 'dump.rdb')).size,
      log: s.messages().filter((l) => /Background saving|DB saved|Fork CoW/.test(l)),
      saveDefault: null,
    }
    c.close(); await s.stop()
    const fresh = await lab.server('rdb-defaults', [], { bare: true })
    const f = await fresh.client()
    out.rdb.configDefaults = { save: (await f.call('CONFIG', 'GET', 'save'))[1], appendonly: (await f.call('CONFIG', 'GET', 'appendonly'))[1], appendfsync: (await f.call('CONFIG', 'GET', 'appendfsync'))[1], aofUseRdbPreamble: (await f.call('CONFIG', 'GET', 'aof-use-rdb-preamble'))[1], autoAofRewritePercentage: (await f.call('CONFIG', 'GET', 'auto-aof-rewrite-percentage'))[1], autoAofRewriteMinSize: (await f.call('CONFIG', 'GET', 'auto-aof-rewrite-min-size'))[1] }
    f.close(); await fresh.stop()
  }

  // AOF: files on disk, what an incremental file contains, a rewrite
  {
    const s = await lab.server('aof', ['--appendonly', 'yes', '--appendfsync', 'everysec'])
    const c = await s.client()
    await lab.sleep(300)
    out.aofFilesAtStart = listing(s.dir)
    for (const args of [['SET', 'cart:7', 'apple'], ['INCR', 'visits'], ['INCR', 'visits'], ['EXPIRE', 'cart:7', 3600], ['DEL', 'cart:7']]) await c.call(...args)
    await lab.sleep(1200)
    const aofDir = join(s.dir, 'appendonlydir')
    const files = readdirSync(aofDir)
    out.aofManifest = readFileSync(join(aofDir, files.find((f) => f.endsWith('.manifest'))), 'utf8').trim()
    out.aofIncr = readFileSync(join(aofDir, files.find((f) => f.endsWith('.incr.aof'))), 'latin1').replaceAll('\r\n', '\n').trim()
    await c.call('BGREWRITEAOF')
    while (stat(await c.call('INFO', 'persistence'), 'aof_rewrite_in_progress') === '1') await lab.sleep(50)
    await lab.sleep(300)
    out.aofFilesAfterRewrite = listing(s.dir)
    const files2 = readdirSync(aofDir)
    out.aofManifestAfterRewrite = readFileSync(join(aofDir, files2.find((f) => f.endsWith('.manifest'))), 'utf8').trim()
    out.aofRewriteLog = s.messages().filter((l) => /rewrite|AOF/i.test(l) && !/^ *$/.test(l)).slice(-8)

    // A torn last write: cut the incremental file in the middle of a command, restart
    await c.call('SET', 'last', 'write')
    await lab.sleep(1200)
    c.close(); await s.kill('SIGKILL')
    const incr = readdirSync(aofDir).find((f) => f.endsWith('.incr.aof'))
    const size = statSync(join(aofDir, incr)).size
    truncateSync(join(aofDir, incr), size - 5)
    const logBefore = s.log().length
    await s.start()
    out.aofTruncatedLog = s.log().slice(logBefore).split('\n').map((l) => l.replace(/^\d+:[A-Z] \d+ \w+ \d{4} [\d:.]+ [*#.-] /, '')).filter((l) => /AOF|truncated|!!!|loaded|Done loading/i.test(l))
    const c2 = await s.client()
    out.aofTruncatedResult = { visits: await c2.call('GET', 'visits'), last: await c2.call('GET', 'last') }
    out.checkAof = execFileSync('redis-check-aof', [join(aofDir, incr)], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim().split('\n').slice(-3)
    c2.close(); await s.stop()
  }

  // Crash matrix: 100,000 acknowledged writes, then kill -9, then restart
  out.crash = []
  out.crash.push(await crashTest(lab, 'none', ['--save', '', '--appendonly', 'no']))
  out.crash.push(await crashTest(lab, 'rdb', ['--save', '', '--appendonly', 'no'], async (c) => {
    await c.call('BGSAVE'); while (stat(await c.call('INFO', 'persistence'), 'rdb_bgsave_in_progress') === '1') await lab.sleep(20)
  }))
  out.crash.push(await crashTest(lab, 'aof-everysec', ['--appendonly', 'yes', '--appendfsync', 'everysec']))
  out.crash.push(await crashTest(lab, 'aof-always', ['--appendonly', 'yes', '--appendfsync', 'always']))

  // Cost of each fsync policy on this machine's disk
  out.fsyncBench = []
  for (const [label, args] of [['no persistence', ['--appendonly', 'no']], ['appendfsync no', ['--appendonly', 'yes', '--appendfsync', 'no']], ['appendfsync everysec', ['--appendonly', 'yes', '--appendfsync', 'everysec']], ['appendfsync always', ['--appendonly', 'yes', '--appendfsync', 'always']]]) {
    const s = await lab.server(`bench-${label.replaceAll(' ', '-')}`, args)
    const line = execFileSync('redis-benchmark', ['-p', String(s.port), '-t', 'set', '-n', '50000', '-c', '20', '-q']).toString().split(/\r|\n/).map((l) => l.trim()).find((l) => /^SET:.*per second/.test(l))
    out.fsyncBench.push({ label, result: line })
    await s.stop()
  }
  return out
}
