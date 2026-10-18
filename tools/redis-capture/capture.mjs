// Runs the experiments against throwaway redis-server processes and writes the
// recordings to the module's data file.
//   node capture.mjs <out.ts>                 all experiments
//   node capture.mjs <out.ts> eviction ...    only these (the others are kept from the last run)
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { userInfo, homedir } from 'node:os'
import { ROOT, Server, sleep, version } from './lib/server.mjs'
import { Transcript } from './lib/transcript.mjs'
import { selfCheck } from './lib/selfcheck.mjs'

const [, , outFile, ...only] = process.argv
if (!outFile) throw new Error('usage: node capture.mjs <out.ts> [experiment ...]')

const store = new URL('./out/captures.json', import.meta.url)
mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
const data = existsSync(store) ? JSON.parse(readFileSync(store, 'utf8')) : {}

let nextPort = 17000
const lab = {
  server: (name, args = [], opts) => new Server(name, nextPort++, args, opts).start(),
  newServer: (name, args = [], opts) => new Server(name, nextPort++, args, opts),
  port: () => nextPort++,
  sleep,
  Transcript,
  root: ROOT,
}

const check = await lab.server('selfcheck')
console.log(`formatter matches redis-cli on ${await selfCheck(check)} commands`)
await check.stop()

const names = readdirSync(new URL('./experiments/', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort()
for (const name of names) {
  if (only.length && !only.includes(name)) continue
  const t = Date.now()
  const { run } = await import(`./experiments/${name}.mjs`)
  data[name] = await run(lab)
  console.log(`${name.padEnd(14)} ${((Date.now() - t) / 1000).toFixed(1)}s`)
}
data.version = version()

// Paths of the temporary directory become /data/<server>; nothing machine-specific may remain.
let json = JSON.stringify(data, null, 1).replaceAll(ROOT, '/data')
for (const secret of [userInfo().username, homedir()]) {
  if (json.includes(secret)) throw new Error(`recording contains "${secret}" — refusing to write`)
}
writeFileSync(store, json)
const header = `// Recorded from Redis ${data.version} by tools/redis-capture — do not edit by hand.\n\n`
writeFileSync(outFile, header + `export const REDIS_VERSION = ${JSON.stringify(data.version)}\n\nexport const CAPTURE = ${json} as const\n`)
console.log(`wrote ${outFile}`)
process.exit(0)
