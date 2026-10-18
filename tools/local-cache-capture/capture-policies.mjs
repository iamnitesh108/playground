// Records the "Eviction" and "Expiry and refresh" lessons of the in-process caching module.
//  - Eviction: writes deterministic traces (src/modules/local-cache/simulation/evictionTraces.ts), replays each one
//    through Caffeine, lru-cache and moka (TinyLFU and LRU) at several sizes, and runs the lesson's own policy
//    models on the same traces, so the lesson can say how close the models are.
//  - Expiry: when entries stop being visible, when they are removed and their listener fires, refresh vs expire,
//    and synchronized expiry with and without jitter — in all three libraries.
//   node capture-policies.mjs ../../src/modules/local-cache/data/policies.ts
// Builds the apps first (GRADLE=/path/to/gradle if gradle is not on the PATH). Needs Java 17, Node 24, cargo.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRACES, RECORDED_SIZES } from '../../src/modules/local-cache/simulation/evictionTraces.ts'
import { POLICIES, WTinyLfu, createPolicy, optimalHitRatio, replay } from '../../src/modules/local-cache/simulation/evictionPolicies.ts'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-policies.mjs <out.ts>')
const HERE = dirname(fileURLToPath(import.meta.url))
const JAVA = join(HERE, 'policies-java')
const TS = join(HERE, 'policies-ts')
const RUST = join(HERE, 'policies-rust')
const TRACE_DIR = join(HERE, 'policies-traces')
const GRADLE = process.env.GRADLE ?? 'gradle'

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, maxBuffer: 1 << 28 }).toString()
const lines = (text) => text.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l))
const log = (msg) => process.stderr.write(`${msg}\n`)

// ---------- build ----------
log('building the apps…')
run(GRADLE, ['--console=plain', '-q', 'installDist'], JAVA)
run('npm', ['install', '--silent'], TS)
run('cargo', ['build', '--release', '-q'], RUST)
const javaApp = (...args) => lines(run(join(JAVA, 'build/install/policies/bin/policies'), args, JAVA))
const tsApp = (...args) => lines(run('node', ['main.ts', ...args], TS))
const rustApp = (...args) => lines(run(join(RUST, 'target/release/policies'), args, RUST))

const versions = {
  caffeine: readFileSync(join(JAVA, 'build.gradle'), 'utf8').match(/caffeine:([\d.]+)/)[1],
  lruCache: JSON.parse(readFileSync(join(TS, 'node_modules/lru-cache/package.json'), 'utf8')).version,
  moka: readFileSync(join(RUST, 'Cargo.lock'), 'utf8').match(/name = "moka"\nversion = "([\d.]+)"/)[1],
  // `java -version` prints to stderr
  java: execFileSync('sh', ['-c', 'java -version 2>&1']).toString().match(/version "([^"]+)"/)[1],
  node: process.version,
  rust: run('rustc', ['--version'], RUST).trim().split(' ').slice(0, 2).join(' '),
}

// ---------- eviction: traces, libraries, models ----------
mkdirSync(TRACE_DIR, { recursive: true })
const sizes = RECORDED_SIZES.map(String)
const replays = []
const models = []
const modelWindows = []
for (const spec of TRACES) {
  const trace = spec.generate(1)
  const file = join(TRACE_DIR, `${spec.id}.txt`)
  writeFileSync(file, `${Array.from(trace).join('\n')}\n`)
  log(`${spec.id}: ${trace.length.toLocaleString()} requests, ${new Set(trace).size.toLocaleString()} distinct keys`)
  for (const r of javaApp('replay', file, ...sizes)) replays.push(r)
  for (const r of tsApp('replay', file, ...sizes)) replays.push(r)
  for (const r of rustApp('replay', file, ...sizes)) replays.push(r)
  for (const size of RECORDED_SIZES) {
    for (const p of POLICIES) {
      if (p.id === 'wtinylfu') continue
      models.push({ model: p.id, trace: spec.id, size, hits: replay(createPolicy(p.id, size), trace).hits })
    }
    // W-TinyLFU twice: with the hill climber (as Caffeine) and with the window fixed at 1 %
    for (const adaptive of [true, false]) {
      const policy = new WTinyLfu(size, undefined, { adaptive })
      const window = []
      let hits = 0
      const every = trace.length / 100
      for (let i = 0; i < trace.length; i++) {
        if (policy.access(trace[i])) hits++
        if ((i + 1) % every === 0) window.push([i + 1, policy.windowMax])
      }
      models.push({ model: adaptive ? 'wtinylfu' : 'wtinylfu-static', trace: spec.id, size, hits })
      if (adaptive) modelWindows.push({ trace: spec.id, size, window })
    }
    models.push({ model: 'optimal', trace: spec.id, size, hits: Math.round(optimalHitRatio(trace, size) * trace.length) })
  }
}

// ---------- eviction: the same few requests in each library ----------
const ORDER = ['4', 'a', 'b', 'c', 'd', 'a', 'b', 'x', 'y', 'z', 'a', 'b']
const order = { max: 4, requests: ORDER.slice(1), caffeine: javaApp('order', ...ORDER), lruCache: tsApp('order', ...ORDER), moka: rustApp('order', ...ORDER) }

// ---------- expiry ----------
log('recording expiry…')
const expiry = {
  caffeine: {
    lazy: javaApp('lazy'),
    scheduler: javaApp('scheduler'),
    writeVsAccess: javaApp('write-vs-access'),
    perEntry: javaApp('per-entry'),
    refresh: javaApp('refresh'),
    jitter: javaApp('jitter'),
  },
  lruCache: {
    lazy: tsApp('lazy'),
    autopurge: tsApp('autopurge'),
    ageOnGet: tsApp('age-on-get'),
    fetch: tsApp('fetch'),
  },
  moka: {
    lazy: rustApp('lazy'),
    idle: rustApp('idle'),
    ttlVsTti: rustApp('ttl-vs-tti'),
    perEntry: rustApp('per-entry'),
    reload: rustApp('reload'),
  },
}

// ---------- write ----------
const data = {
  versions,
  sizes: RECORDED_SIZES,
  traces: TRACES.map((t) => ({ id: t.id, label: t.label, description: t.description })),
  replays,
  models,
  modelWindows,
  order,
  expiry,
}
const json = JSON.stringify(data)
for (const secret of [homedir(), userInfo().username]) {
  if (secret && json.includes(secret)) throw new Error('refusing to write: the output contains a local path or user name')
}
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(
  outFile,
  `// Recorded by tools/local-cache-capture/capture-policies.mjs (Caffeine ${versions.caffeine}, lru-cache ${versions.lruCache}, moka ${versions.moka}) — do not edit by hand.\n\nexport const POLICY_CAPTURE = ${json}\n`,
)
log(`wrote ${outFile}`)
