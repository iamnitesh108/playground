// Records the two basics lessons of the local-cache module ("What an in-process cache is", "Using it day to day"):
// the everyday API of Caffeine, lru-cache and moka (one program per library), a Micronaut @Cacheable run, heap growth
// of an unbounded map vs a bounded cache, read latencies (cache, map, recompute, Redis GET on localhost), and a check of
// the lesson's cache model against lru-cache.
//   node capture-basics.mjs ../../src/modules/local-cache/data/basics.ts      (SKIP_BUILD=1 to reuse the builds)
// Starts a throwaway redis-server on port 17500.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, homedir, tmpdir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-basics.mjs <out.ts>')
const HERE = dirname(fileURLToPath(import.meta.url))
const app = (name) => join(HERE, `basics-${name}`)
const REDIS_PORT = 17500
const RUNS = 3
const GRADLE = process.env.GRADLE ?? join(homedir(), '.gradle/wrapper/dists/gradle-8.8-bin/dl7vupf4psengwqhwktix4v1/gradle-8.8/bin/gradle')

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------- build ----------
if (!process.env.SKIP_BUILD) {
  for (const name of ['java', 'micronaut']) run(GRADLE, ['--console=plain', '-q', 'installDist'], { cwd: app(name), stdio: 'inherit' })
  run('npm', ['install', '--no-audit', '--no-fund'], { cwd: app('ts'), stdio: 'inherit' })
  run('cargo', ['build', '--release', '-q'], { cwd: app('rust'), stdio: 'inherit' })
}
const BIN = {
  java: join(app('java'), 'build/install/basics-java/bin/basics-java'),
  micronaut: join(app('micronaut'), 'build/install/basics-micronaut/bin/basics-micronaut'),
  rustUsing: join(app('rust'), 'target/release/using'),
  rustWhy: join(app('rust'), 'target/release/why'),
}

// ---------- versions ----------
const jarVersion = (dir, name) => run('ls', [join(dir, 'lib')]).split('\n').find((f) => f.startsWith(`${name}-`))?.slice(name.length + 1, -4)
const cargoLock = readFileSync(join(app('rust'), 'Cargo.lock'), 'utf8')
const crateVersion = (name) => cargoLock.match(new RegExp(`name = "${name}"\\nversion = "([^"]+)"`))[1]
const versions = {
  caffeine: jarVersion(join(app('java'), 'build/install/basics-java'), 'caffeine'),
  micronautCache: jarVersion(join(app('micronaut'), 'build/install/basics-micronaut'), 'micronaut-cache-caffeine'),
  micronautCore: jarVersion(join(app('micronaut'), 'build/install/basics-micronaut'), 'micronaut-core'),
  lettuce: jarVersion(join(app('java'), 'build/install/basics-java'), 'lettuce-core'),
  lruCache: JSON.parse(readFileSync(join(app('ts'), 'node_modules/lru-cache/package.json'), 'utf8')).version,
  ioredis: JSON.parse(readFileSync(join(app('ts'), 'node_modules/ioredis/package.json'), 'utf8')).version,
  moka: crateVersion('moka'),
  redisCrate: crateVersion('redis'),
  java: spawnSync('java', ['-version'], { encoding: 'utf8' }).stderr.match(/version "([^"]+)"/)[1],
  node: process.version,
  rust: run('rustc', ['--version']).trim().split(' ')[1],
  redis: run('redis-server', ['--version']).match(/v=([\d.]+)/)[1],
  cpu: cpus()[0].model.replace(/\s+/g, ' ').trim(),
  cores: cpus().length,
}
// ---------- the API tours: "## section" headers, then the printed lines ----------
function sections(text) {
  const out = {}
  let current = null
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) out[(current = line.slice(3).trim())] = []
    else if (current && line.trim()) out[current].push(line)
  }
  return out
}
const using = {
  java: sections(run(BIN.java, ['using'])),
  ts: sections(run('node', ['using.ts'], { cwd: app('ts') })),
  rust: sections(run(BIN.rustUsing, [])),
}
const micronaut = run(BIN.micronaut, []).split('\n').filter((l) => l.trim())

// ---------- the model check ----------
const modelCheck = JSON.parse(run('node', ['model-check.ts'], { cwd: app('ts') }))
modelCheck.matches = JSON.stringify(modelCheck.library) === JSON.stringify(modelCheck.model)

// ---------- why: heap growth and latency, against a throwaway Redis ----------
const redisDir = mkdtempSync(join(tmpdir(), 'lc-basics-redis-'))
const redis = spawn('redis-server', ['--port', String(REDIS_PORT), '--save', '', '--appendonly', 'no', '--dir', redisDir], { stdio: 'ignore' })
await sleep(500)
const jsonLines = (text) => text.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l))
const env = { ...process.env, REDIS_PORT: String(REDIS_PORT) }
const WHY = {
  java: () => run(BIN.java, ['why'], { env, stdio: ['ignore', 'pipe', 'ignore'] }),
  ts: () => run('node', ['--expose-gc', 'why.ts'], { cwd: app('ts'), env }),
  rust: () => run(BIN.rustWhy, [], { env }),
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const why = {}
try {
  for (const [lang, fn] of Object.entries(WHY)) {
    const runs = Array.from({ length: RUNS }, () => jsonLines(fn()))
    const heap = runs[0].filter((r) => r.t === 'heap').map(({ kind, inserted, size, mb }) => ({ kind, inserted, size, mb }))
    const latency = {}
    for (const op of ['cache-get', 'map-get', 'compute', 'redis-get']) {
      const rows = runs.map((r) => r.find((x) => x.t === 'latency' && x.op === op))
      latency[op] = { ns: +median(rows.map((r) => r.ns)).toFixed(1), ...(rows[0].p99 ? { p99: median(rows.map((r) => r.p99)) } : {}) }
    }
    why[lang] = { heap, latency }
  }
} finally {
  redis.kill()
  await sleep(200)
  rmSync(redisDir, { recursive: true, force: true })
}

// ---------- write ----------
const data = { versions, runs: RUNS, using, micronaut, modelCheck, why }
const text = JSON.stringify(data, null, 1)
for (const secret of [homedir(), userInfo().username]) {
  if (secret && text.includes(secret)) throw new Error('output contains a local path or user name; refusing to write')
}
writeFileSync(
  outFile,
  `// Recorded by tools/local-cache-capture/capture-basics.mjs (Caffeine ${versions.caffeine}, lru-cache ${versions.lruCache}, moka ${versions.moka}) — do not edit by hand.\n\nexport const BASICS = ${text} as const\n`,
)
console.log(`wrote ${outFile}; model matches lru-cache: ${modelCheck.matches}`)
