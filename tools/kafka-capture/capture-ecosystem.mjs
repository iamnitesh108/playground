// Records the Schema Registry and Kafka Streams lessons against a real Kafka, a real Schema Registry
// and the two small apps in schema-app/ and streams-app/.
//   node capture-ecosystem.mjs ../../src/modules/kafka/data/ecosystem.ts
import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { userInfo, homedir, tmpdir } from 'node:os'
import { IMAGE, Running, sleep } from './lib/lab.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-ecosystem.mjs <out.ts>')

const BROKER = 'kafka-eco'
const REGISTRY = 'schema-eco'
const REGISTRY_IMAGE = 'docker.io/confluentinc/cp-schema-registry:8.0.0'
const PORT = 19692
const REGISTRY_PORT = 18085
const BIN = '/opt/kafka/bin/'
const BS = `--bootstrap-server localhost:${PORT}`
const here = (p) => new URL(p, import.meta.url).pathname
const SCHEMA_APP = here('schema-app/build/install/schema-app/bin/schema-app')
const STREAMS_APP = here('streams-app/build/install/streams-app/bin/streams-app')
const APP_ENV = { KAFKA_BOOTSTRAP: `localhost:${PORT}`, SCHEMA_REGISTRY: `http://localhost:${REGISTRY_PORT}` }

const NOISE = /consumer rebalance protocol \(KIP-848\) is production-ready|Option --property is deprecated/
/** What the reader types and sees: the standard ports, short ids. */
const shown = (s) => s
  .replaceAll(String(PORT + 1), '9093').replaceAll(String(PORT), '9092').replaceAll(String(REGISTRY_PORT), '8081')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (m) => m.slice(0, 8) + '…')


/** Like lab.mjs Running, but joins output chunks into whole lines (a chunk can end in the middle of a line). */
class Proc extends Running {
  constructor(name, command, args, env = {}) {
    super(name, command, args, env)
    this.exited = new Promise((r) => this.proc.on('close', r))
    this.proc.stdout.removeAllListeners('data')
    this.proc.stderr.removeAllListeners('data')
    for (const stream of [this.proc.stdout, this.proc.stderr]) {
      let rest = ''
      stream.on('data', (d) => {
        const parts = (rest + d.toString()).split('\n')
        rest = parts.pop()
        for (const l of parts) if (l.trim() && !NOISE.test(l)) this.lines.push({ at: Date.now(), line: l })
      })
      stream.on('end', () => { if (rest.trim()) this.lines.push({ at: Date.now(), line: rest }) })
    }
  }
}

function removeContainers() {
  for (const c of [REGISTRY, BROKER]) try { execFileSync('podman', ['rm', '-f', c], { stdio: 'ignore' }) } catch {}
}
process.on('exit', removeContainers)
process.on('SIGINT', () => process.exit(130))

function startContainers() {
  removeContainers()
  execFileSync('podman', ['run', '-d', '--name', BROKER, '--network', 'host',
    '-e', 'KAFKA_NODE_ID=1', '-e', 'KAFKA_PROCESS_ROLES=broker,controller',
    '-e', `KAFKA_LISTENERS=PLAINTEXT://localhost:${PORT},CONTROLLER://localhost:${PORT + 1}`,
    '-e', `KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:${PORT}`,
    '-e', 'KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER',
    '-e', 'KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
    '-e', `KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:${PORT + 1}`,
    '-e', 'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1', '-e', 'KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0',
    // exactly-once needs the transaction log; one broker can only hold one replica of it
    '-e', 'KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1', '-e', 'KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1',
    IMAGE], { stdio: 'ignore' })
  execFileSync('podman', ['run', '-d', '--name', REGISTRY, '--network', 'host',
    '-e', 'SCHEMA_REGISTRY_HOST_NAME=localhost',
    '-e', `SCHEMA_REGISTRY_LISTENERS=http://0.0.0.0:${REGISTRY_PORT}`,
    '-e', `SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS=PLAINTEXT://localhost:${PORT}`,
    REGISTRY_IMAGE], { stdio: 'ignore' })
}

/** One Kafka CLI command inside the broker container. */
function cli(cmd) {
  const args = cmd.split(' ')
  let out = ''
  try {
    out = execFileSync('podman', ['exec', '-i', BROKER, BIN + args[0], ...args.slice(1)], { stdio: ['pipe', 'pipe', 'pipe'] }).toString()
  } catch (e) {
    out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  }
  return { cmd: shown(cmd), out: shown(out.split('\n').filter((l) => !NOISE.test(l) && !/^\[.*\] ERROR Error processing message|TimeoutException/.test(l)).join('\n').trimEnd()) }
}

/** A curl call against the registry, recorded as typed. */
function curl(path, { method, body } = {}) {
  const args = ['-s']
  if (method) args.push('-X', method)
  if (body) args.push('-H', 'Content-Type: application/vnd.schemaregistry.v1+json', '--data', body)
  args.push(`localhost:${REGISTRY_PORT}${path}`)
  const out = execFileSync('curl', args).toString()
  const typed = ['curl', '-s', ...(method ? ['-X', method] : []), ...(body ? ['-H', "'Content-Type: application/vnd.schemaregistry.v1+json'", '--data', `'${body}'`] : []), `localhost:${REGISTRY_PORT}${path}`].join(' ')
  return { cmd: shown(typed), out: shown(out) }
}

async function waitUntil(what, check, timeoutMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { if (check()) return } catch {}
    await sleep(1000)
  }
  throw new Error(`${what} did not start`)
}

/** Runs one app to completion; returns the stdout lines that match `keep`. */
async function runApp(bin, args, keep, env = {}) {
  const r = new Proc(args.join(' '), bin, args, { ...APP_ENV, ...env })
  await r.exited
  return { cmd: shown(`./build/install/${bin.split('/').pop()}/bin/${bin.split('/').pop()} ${args.join(' ')}`), out: r.since(0).filter((l) => keep.test(l)).map(shown) }
}

for (const i of ['eco-1', 'eco-2']) rmSync(`${tmpdir()}/order-stats-${i}`, { recursive: true, force: true })  // local state of earlier runs
startContainers()
await waitUntil('broker', () => { execFileSync('podman', ['exec', BROKER, BIN + 'kafka-topics.sh', ...BS.split(' '), '--list'], { stdio: 'ignore' }); return true })
await waitUntil('registry', () => curl('/subjects').out.startsWith('['))
const data = { image: IMAGE, registryImage: REGISTRY_IMAGE, version: cli('kafka-topics.sh --version').out.split(' ')[0] }

// ---------------------------------------------------------------- Schema Registry
{
  const s = {}
  s.config = curl('/config')
  s.createTopic = cli(`kafka-topics.sh ${BS} --create --topic orders-avro --partitions 1 --replication-factor 1`)
  s.produceV1 = await runApp(SCHEMA_APP, ['produce', 'v1'], /^sent /)
  s.subjects = curl('/subjects')
  s.versionsAfterV1 = curl('/subjects/orders-avro-value/versions')
  s.schemaById1 = curl('/schemas/ids/1')
  s.produceV2 = await runApp(SCHEMA_APP, ['produce', 'v2'], /^sent /)
  s.versionsAfterV2 = curl('/subjects/orders-avro-value/versions')
  s.latest = curl('/subjects/orders-avro-value/versions/latest')
  s.raw = await runApp(SCHEMA_APP, ['raw'], /^offset=/)
  s.consume = await runApp(SCHEMA_APP, ['consume'], /^offset=/)
  // a v3 that adds a required field (no default): new readers could not read the old records
  const v3 = JSON.stringify({ schema: JSON.stringify({ type: 'record', name: 'Order', namespace: 'demo.schema', fields: [
    { name: 'id', type: 'string' }, { name: 'customer', type: 'string' }, { name: 'amount', type: 'double' },
    { name: 'currency', type: 'string', default: 'EUR' }, { name: 'channel', type: 'string' }] }) })
  s.badSchema = v3
  s.checkBad = curl('/compatibility/subjects/orders-avro-value/versions/latest', { method: 'POST', body: v3 })
  s.registerBad = curl('/subjects/orders-avro-value/versions', { method: 'POST', body: v3 })
  // the same field with a default is a compatible change
  const v3ok = v3.replace('{\\"name\\":\\"channel\\",\\"type\\":\\"string\\"}', '{\\"name\\":\\"channel\\",\\"type\\":\\"string\\",\\"default\\":\\"web\\"}')
  if (v3ok === v3) throw new Error('could not build the compatible v3')
  s.checkGood = curl('/compatibility/subjects/orders-avro-value/versions/latest', { method: 'POST', body: v3ok })
  s.versionsAtEnd = curl('/subjects/orders-avro-value/versions')
  data.schema = s
}

// ---------------------------------------------------------------- Kafka Streams
{
  const k = {}
  const topics = ['orders', 'big-orders', 'orders-per-customer-out', 'orders-per-customer-10s-out', 'orders-per-size-out']
  // retention.ms=-1: the orders carry fixed event times in the past, and time-based retention would delete them at once
  k.createTopics = topics.map((t) => cli(`kafka-topics.sh ${BS} --create --topic ${t} --partitions 2 --replication-factor 1 --config retention.ms=-1`))
  const one = new Proc('instance-1', STREAMS_APP, ['run'], { ...APP_ENV, APP_INSTANCE: 'eco-1' })
  await one.waitFor(/^active tasks/, 90000)
  k.describe = one.since(0).slice(0, one.since(0).findIndex((l) => /^state /.test(l))).filter((l) => !/^\[/.test(l)).join('\n').trimEnd()
  k.produce = await runApp(STREAMS_APP, ['produce'], /^sent /)
  await sleep(5000)
  const read = (t) => cli(`kafka-console-consumer.sh ${BS} --topic ${t} --from-beginning --timeout-ms 6000 --isolation-level read_committed --formatter-property print.key=true --formatter-property print.partition=true`)
  k.outputs = Object.fromEntries(topics.slice(1).map((t) => [t, read(t)]))
  one.proc.stdin.write('query alice\nquery bob\n')
  await one.waitFor(/^store .*bob/)
  k.query = { typed: ['query alice', 'query bob'], out: one.since(0).filter((l) => /^store /.test(l)) }
  k.topics = cli(`kafka-topics.sh ${BS} --list`)
  k.changelogConfig = cli(`kafka-configs.sh ${BS} --describe --entity-type topics --entity-name order-stats-orders-per-customer-changelog`)
  k.repartitionConfig = cli(`kafka-configs.sh ${BS} --describe --entity-type topics --entity-name order-stats-orders-per-size-repartition`)
  // a second instance with the same application.id: the tasks are split between the two
  const mark = one.lines.length
  const two = new Proc('instance-2', STREAMS_APP, ['run'], { ...APP_ENV, APP_INSTANCE: 'eco-2' })
  await two.waitFor(/^active tasks/, 90000)
  await one.waitFor(/^active tasks/, 30000)
  for (let i = 0; i < 40 && one.since(mark).filter((l) => /^active tasks/.test(l)).length === 0; i++) await sleep(500)
  await sleep(3000)
  k.scale = {
    first: one.since(0).filter((l) => /^(state |active tasks)/.test(l)),
    second: two.since(0).filter((l) => /^(state |active tasks)/.test(l)),
  }
  k.group = cli(`kafka-consumer-groups.sh ${BS} --describe --group order-stats --members`)
  k.lateWarning = one.since(0).filter((l) => /Skipping record for expired window/.test(l))
    .map((l) => shown(l.replace(/^\[[^\]]+\] WARN org\.apache\.kafka\.streams\.kstream\.internals\./, 'WARN ')))
  await two.stop('SIGTERM')
  await one.stop('SIGTERM')
  data.streams = k
}

// ---------------------------------------------------------------- write
const json = JSON.stringify(data, null, 2)
for (const leak of [userInfo().username, homedir()]) if (json.includes(leak)) throw new Error(`refusing to write: output contains "${leak}"`)
const src = (p) => `../../../../tools/kafka-capture/${p}?raw`
writeFileSync(outFile, `// Recorded by tools/kafka-capture/capture-ecosystem.mjs against a real Kafka, Schema Registry and the
// apps in tools/kafka-capture/schema-app and streams-app. Do not edit by hand: re-run the script.
import ordersAvro from '${src('schema-app/src/main/java/demo/schema/OrdersAvro.java')}'
import orderV1 from '${src('schema-app/src/main/resources/order-v1.avsc')}'
import orderV2 from '${src('schema-app/src/main/resources/order-v2.avsc')}'
import schemaGradle from '${src('schema-app/build.gradle')}'
import orderStats from '${src('streams-app/src/main/java/demo/streams/OrderStats.java')}'
import streamsGradle from '${src('streams-app/build.gradle')}'

export const ECOSYSTEM_APPS = {
  schema: { 'build.gradle': schemaGradle, 'order-v1.avsc': orderV1, 'order-v2.avsc': orderV2, 'OrdersAvro.java': ordersAvro },
  streams: { 'build.gradle': streamsGradle, 'OrderStats.java': orderStats },
} as const

export const ECOSYSTEM = ${json} as const
`)
console.log('wrote', outFile)
