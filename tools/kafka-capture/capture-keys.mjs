// Records the "Record keys and partitioning" lesson against a real Kafka, with the CLI and the
// plain-Java keys-app.
//   node capture-keys.mjs ../../src/modules/kafka/data/keys.ts
// Uses its own container (kafka-keys) and ports (19492/19493), so it can run beside the other scripts.
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { userInfo, homedir } from 'node:os'
import { IMAGE, sleep } from './lib/lab.mjs'
import { partitionForKey } from '../../src/modules/kafka/simulation/murmur2.ts'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-keys.mjs <out.ts>')

const CONTAINER = 'kafka-keys'
const PORT = 19492
const BIN = '/opt/kafka/bin/'
const BS = `--bootstrap-server localhost:${PORT}`
const LIB = new URL('./keys-app/build/install/keys-app/lib/*', import.meta.url).pathname

// ------------------------------------------------------------------ broker
function stopBroker() {
  try { execFileSync('podman', ['rm', '-f', CONTAINER], { stdio: 'ignore' }) } catch {}
}
process.on('exit', stopBroker)
process.on('SIGINT', () => process.exit(130))

async function freshBroker() {
  stopBroker()
  execFileSync('podman', ['run', '-d', '--name', CONTAINER, '--network', 'host',
    '-e', 'KAFKA_NODE_ID=1', '-e', 'KAFKA_PROCESS_ROLES=broker,controller',
    '-e', `KAFKA_LISTENERS=PLAINTEXT://localhost:${PORT},CONTROLLER://localhost:${PORT + 1}`,
    '-e', `KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:${PORT}`,
    '-e', 'KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER',
    '-e', 'KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
    '-e', `KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:${PORT + 1}`,
    '-e', 'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1', '-e', 'KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0',
    IMAGE], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { execFileSync('podman', ['exec', CONTAINER, BIN + 'kafka-topics.sh', ...BS.split(' '), '--list'], { stdio: 'ignore' }); return } catch {}
    await sleep(1000)
  }
  throw new Error('broker did not start')
}

// ------------------------------------------------------------------ sanitising
const shown = (s) => s.replaceAll(String(PORT + 1), '9093').replaceAll(String(PORT), '9092')
/** Kafka's 22-character ids (members, topics, cluster): the first 6 characters are enough to tell them apart. */
const shortIds = (s) => s.replace(/(?<![\w-])([A-Za-z0-9_-]{22})(?![\w-])( ?)/g, (all, m, sp) => (/\d/.test(m) && /[A-Z]/.test(m) && /[a-z]/.test(m) ? (sp ? (m.slice(0, 6) + '…').padEnd(22) + sp : m.slice(0, 6) + '…') : all))
const NOISE = /consumer rebalance protocol \(KIP-848\) is production-ready|^\s+at |^\s*\.\.\. \d+ more/
const clean = (s) => shortIds(shown(s)).split('\n').filter((l) => !NOISE.test(l)).join('\n').trimEnd()

// ------------------------------------------------------------------ running things
/** One CLI command inside the container: { cmd, out } with the command as the reader types it. */
function cli(cmd, { input } = {}) {
  const args = cmd.split(' ')
  let out = ''
  try {
    out = execFileSync('podman', ['exec', '-i', CONTAINER, BIN + args[0], ...args.slice(1)], { input, stdio: ['pipe', 'pipe', 'pipe'] }).toString()
  } catch (e) {
    out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  }
  return { cmd: shown(cmd), out: clean(out) }
}
/** Like cli(), but keeps stderr even when the tool exits 0 (the console producer logs send errors there). */
function cliBoth(cmd, input) {
  const args = cmd.split(' ')
  const r = spawnSync('podman', ['exec', '-i', CONTAINER, BIN + args[0], ...args.slice(1)], { input })
  return { cmd: shown(cmd), out: clean(r.stdout.toString() + r.stderr.toString()) }
}
/** kafka-consumer-groups.sh --describe without the long CONSUMER-ID and HOST columns, sorted by partition. */
function groupTable(r) {
  const rows = r.out.split('\n').filter((l) => l.trim()).map((l) => l.trim().split(/\s+/))
  const [head, ...body] = rows
  const keep = ['GROUP', 'TOPIC', 'PARTITION', 'CURRENT-OFFSET', 'LOG-END-OFFSET', 'LAG', 'CLIENT-ID'].map((c) => head.indexOf(c))
  body.sort((a, b) => Number(a[keep[2]]) - Number(b[keep[2]]))
  const table = [head, ...body].map((row) => keep.map((i) => row[i] ?? ''))
  const widths = keep.map((_, c) => Math.max(...table.map((row) => row[c].length)) + 2)
  return { ...r, out: table.map((row) => row.map((v, c) => v.padEnd(widths[c])).join('').trimEnd()).join('\n') }
}
/** The console producer, fed lines on stdin; shown as the lines typed at its > prompt. */
const produce = (argsLine, lines) => {
  const r = cli(`kafka-console-producer.sh ${argsLine}`, { input: lines.join('\n') + '\n' })
  return { cmd: r.cmd, out: [lines.map((l) => '> ' + l).join('\n'), r.out].filter(Boolean).join('\n') }
}

/** A long-running process; complete output lines are kept. */
class Proc {
  constructor(name, command, args, env = {}) {
    this.name = name
    this.lines = []
    let buf = ''
    this.proc = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
    const take = (d) => {
      buf += d.toString()
      const parts = buf.split('\n')
      buf = parts.pop()
      for (const l of parts) if (l.trim() && !NOISE.test(l)) this.lines.push(clean(l))
    }
    this.proc.stdout.on('data', take)
    this.proc.stderr.on('data', take)
    this.exited = new Promise((r) => this.proc.on('exit', r))
  }
}

/** One of the keys-app programs: `java -cp "lib/*" demo.keys.<Class> args…`. */
const javaCmd = (cls, args = []) => ['java -cp "build/install/keys-app/lib/*" demo.keys.' + cls, ...args].join(' ')
const java = (cls, args = []) => Object.assign(new Proc(cls, 'java', ['-cp', LIB, 'demo.keys.' + cls, ...args], { KAFKA_BOOTSTRAP: `localhost:${PORT}` }), { cmd: javaCmd(cls, args) })
async function runJava(cls, args = []) {
  const r = java(cls, args)
  const code = await r.exited
  if (code !== 0) throw new Error(`${cls} exited with ${code}: ${r.lines.join('\n')}`)
  return { cmd: r.cmd, out: r.lines.join('\n') }
}

const t = (label, step) => ({ label, ...step })
const topic = (name, partitions, extra = '') => cli(`kafka-topics.sh ${BS} --create --topic ${name} --partitions ${partitions} --replication-factor 1${extra}`)
/** Polls a CLI command until its output matches every pattern. */
async function until(cmd, re, timeoutMs = 60000) {
  const start = Date.now()
  const all = [re].flat()
  let last
  while (Date.now() - start < timeoutMs) {
    last = cli(cmd)
    if (all.every((r) => r.test(last.out))) return last
    await sleep(500)
  }
  throw new Error(`timed out: ${cmd}\n${last?.out}`)
}
const check = (ok, what) => { if (!ok) throw new Error('check failed: ' + what) }

await freshBroker()
const data = { image: IMAGE, version: cli('kafka-topics.sh --version').out.split(' ')[0] }

// ================================================================== keyed records, explicit partition
data.keyed = {
  setup: t('a topic with three partitions', topic('orders', 3)),
  send: await runJava('SendKeyed'),
}
for (const l of data.keyed.send.out.split('\n').filter((l) => /murmur2/.test(l))) {
  const [, key, p] = l.match(/key=(\S+) .* -> partition (\d+)/)
  check(partitionForKey(key, 3) === Number(p), `SendKeyed ${key} matches the TS partitioner`)
}

// ================================================================== where the key is stored: null, empty, set
{
  topic('keyless', 1)
  const k = {}
  k.keyed = t('a key and a value, split at the first ":"', produce(`${BS} --topic keyless --reader-property parse.key=true --reader-property key.separator=:`, ['customer-1:hello', ':empty key']))
  k.unkeyed = t('without parse.key the whole line is the value and the key is null', produce(`${BS} --topic keyless`, ['no key at all']))
  const dump = cli('kafka-dump-log.sh --files /tmp/kafka-logs/keyless-0/00000000000000000000.log --print-data-log')
  const keep = (l, names) => names.map((n) => (l.match(new RegExp(`(?:^|\\s)(${n}: \\S*)`)) ?? [])[1]).filter(Boolean).join(' ')
  k.dump = {
    cmd: dump.cmd,
    out: dump.out.split('\n').filter((l) => /^\| offset/.test(l)).map((l) => '| ' + keep(l, ['offset', 'keySize', 'valueSize']) + (l.match(/ key: .*$/)?.[0] ?? '')).join('\n'),
  }
  data.stored = k
}

// ================================================================== no key: sticky partitioning
{
  const s = {}
  s.setup = t('six partitions', topic('clicks', 6))
  s.defaults = await runJava('Spread', ['clicks', '300', '16384', '5', 'null'])
  s.small = await runJava('Spread', ['clicks', '120', '1024', '50', 'null'])
  s.empty = await runJava('Spread', ['clicks', '60', '1024', '50', 'empty'])
  s.ignore = await runJava('Spread', ['clicks', '60', '1024', '50', 'ignore-keys'])
  s.roundRobin = await runJava('Spread', ['clicks', '60', '1024', '50', 'round-robin'])
  data.spread = s
}

// ================================================================== key format
data.formats = {
  setup: t('six partitions', topic('customers', 6)),
  send: await runJava('KeyFormats'),
}

// ================================================================== custom partitioner
data.tenants = {
  setup: t('six partitions', topic('tenant-orders', 6)),
  send: await runJava('SendTenants'),
}
for (const l of data.tenants.send.out.split('\n')) {
  const [, tenant, p] = l.match(/key=([^:]+):\d+ -> partition (\d+)/)
  check(partitionForKey(tenant, 6) === Number(p), `TenantPartitioner ${tenant} = murmur2(tenant) % 6`)
}

// ================================================================== hot keys: skew and lag
{
  const h = {}
  h.setup = [topic('payments-by-status', 6), topic('payments-by-order', 6)]
  h.sendStatus = await runJava('SendStatuses', ['payments-by-status', '3000', 'status'])
  h.sendOrder = await runJava('SendStatuses', ['payments-by-order', '3000', 'order'])
  h.offsetsStatus = t('records per partition, keyed by status', cli(`kafka-get-offsets.sh ${BS} --topic payments-by-status`))
  h.offsetsOrder = t('records per partition, keyed by order id', cli(`kafka-get-offsets.sh ${BS} --topic payments-by-order`))
  // three identical workers per group, 5 ms per record, 14 seconds
  const names = ['worker-1', 'worker-2', 'worker-3']
  const statusWorkers = names.map((n) => java('SlowWorker', [n, 'status-workers', 'payments-by-status', '5', '14']))
  const orderWorkers = names.map((n) => java('SlowWorker', [`o${n}`, 'order-workers', 'payments-by-order', '5', '14']))
  h.workerCmd = javaCmd('SlowWorker', ['worker-1', 'status-workers', 'payments-by-status', '5', '14'])
  await sleep(10000)
  h.lagStatus = groupTable(t('10 s later: the group reading the status-keyed topic', cli(`kafka-consumer-groups.sh ${BS} --describe --group status-workers`)))
  h.lagOrder = groupTable(t('10 s later: the group reading the order-keyed topic', cli(`kafka-consumer-groups.sh ${BS} --describe --group order-workers`)))
  await Promise.all([...statusWorkers, ...orderWorkers].map((w) => w.exited))
  h.statusWorkers = statusWorkers.map((w) => w.lines.join('\n'))
  h.orderWorkers = orderWorkers.map((w) => w.lines.join('\n'))
  data.hot = h
}

// ================================================================== adding partitions moves keys
{
  const r = {}
  const keys = Array.from({ length: 8 }, (_, i) => `customer-${i + 1}`)
  const fmt = '--formatter-property print.partition=true --formatter-property print.key=true'
  r.setup = t('three partitions', topic('profiles', 3))
  r.first = t('one record per customer, key before the ":"', produce(`${BS} --topic profiles --reader-property parse.key=true --reader-property key.separator=:`, keys.map((k) => `${k}:v1`)))
  r.readFirst = t('print the partition and key of every record', cli(`kafka-console-consumer.sh ${BS} --topic profiles --from-beginning --timeout-ms 5000 ${fmt}`))
  r.alter = t('add a fourth partition', cli(`kafka-topics.sh ${BS} --alter --topic profiles --partitions 4`))
  await until(`kafka-topics.sh ${BS} --describe --topic profiles`, /PartitionCount: 4/)
  await sleep(1000)
  r.second = t('the same customers again', produce(`${BS} --topic profiles --reader-property parse.key=true --reader-property key.separator=:`, keys.map((k) => `${k}:v2`)))
  r.readAll = t('everything, sorted by key: where did v1 and v2 of each customer go?', cli(`kafka-console-consumer.sh ${BS} --topic profiles --from-beginning --timeout-ms 5000 ${fmt}`))
  // the console consumer prints partition by partition; sort by customer number for reading
  const num = (l) => Number(l.match(/customer-(\d+)/)?.[1] ?? 0) * 10 + (l.includes('v2') ? 1 : 0)
  r.readAll.out = r.readAll.out.split('\n').filter((l) => /customer-/.test(l)).sort((a, b) => num(a) - num(b)).join('\n')
  for (const l of r.readAll.out.split('\n')) {
    const [, p, key, v] = l.match(/Partition:(\d+)\s+(\S+)\s+(v\d)/)
    check(partitionForKey(key, v === 'v1' ? 3 : 4) === Number(p), `remap ${key} ${v}`)
  }
  data.remap = r
}

// ================================================================== compacted topics need keys
{
  const c = {}
  c.setup = t('a compacted topic', topic('user-profiles', 1, ' --config cleanup.policy=compact --config segment.ms=100 --config min.cleanable.dirty.ratio=0.01'))
  const noKey = cliBoth(`kafka-console-producer.sh ${BS} --topic user-profiles`, 'no key here\n')
  c.noKey = {
    label: 'a record without a key',
    cmd: noKey.cmd,
    out: ['> no key here', ...noKey.out.split('\n').filter((l) => /ERROR|Exception/.test(l)).slice(0, 2).map((l) => l.replace(/^\[[^\]]+\] /, ''))].join('\n'),
  }
  const brokerLog = execFileSync('podman', ['logs', CONTAINER], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  c.brokerLog = brokerLog.split('\n').filter((l) => /without key/.test(l)).slice(0, 1).map((l) => clean(l.replace(/^\[[^\]]+\] /, '')))
  const kfmt = '--formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.value=true'
  const lines = ['user-1:Ann', 'user-2:Ben', 'user-1:Anna', 'user-3:Cat', 'user-2:NULL', 'user-1:Annie']
  c.produce = t('keyed updates; NULL becomes a null value (a tombstone)', produce(`${BS} --topic user-profiles --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL`, lines))
  await sleep(1500)
  c.roll = t('one more record, so the earlier ones sit in a closed segment the cleaner may compact', produce(`${BS} --topic user-profiles --reader-property parse.key=true --reader-property key.separator=:`, ['user-4:Dan']))
  c.before = t('right after writing', cli(`kafka-console-consumer.sh ${BS} --topic user-profiles --from-beginning --timeout-ms 4000 ${kfmt}`))
  const cmd = `kafka-console-consumer.sh ${BS} --topic user-profiles --from-beginning --timeout-ms 4000 ${kfmt}`
  const start = Date.now()
  let after
  while (Date.now() - start < 90000) {
    after = cli(cmd)
    if (!/Offset:0\b/.test(after.out)) break
    await sleep(3000)
  }
  check(!/Offset:0\b/.test(after.out), 'compaction happened')
  check(/ERROR/.test(c.noKey.out), 'the keyless record was rejected')
  c.after = t('after the log cleaner ran', after)
  data.compacted = c
}

// ------------------------------------------------------------------ write
const json = JSON.stringify(data, null, 2)
const user = userInfo().username
if (json.includes(homedir()) || new RegExp(`\\b${user}\\b`).test(json)) throw new Error('recording contains the user name or home directory')
if (json.includes(String(PORT))) throw new Error('recording still contains the capture port')
writeFileSync(outFile, `// Recorded by tools/kafka-capture/capture-keys.mjs against ${IMAGE} — do not edit by hand.\n// Ports are shown as the standard 9092; Kafka's random ids are shortened.\nexport const KEYS = ${json} as const\n`)
console.log('wrote', outFile)
