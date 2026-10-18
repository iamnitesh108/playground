// Records the security and monitoring lessons against a real Kafka:
//   - kafka-sec: a broker with SASL/SCRAM, a TLS listener and the StandardAuthorizer (ACLs)
//   - kafka-mon: a plain broker with JMX open, put under load, and a consumer group falling behind
//   node capture-ops.mjs ../../src/modules/kafka/data/ops.ts
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, chmodSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir, userInfo, homedir } from 'node:os'
import { join } from 'node:path'
import { IMAGE, Running, sleep } from './lib/lab.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-ops.mjs <out.ts>')

const SEC = 'kafka-sec'
const MON = 'kafka-mon'
const BIN = '/opt/kafka/bin/'
// real port -> the port the reader sees
const PORTS = { 19792: 9092, 19793: 9093, 19794: 9094, 19796: 9092, 19797: 9093, 19799: 9999 }
const shown = (s) => s.replace(/\b(1979[234679])\b/g, (p) => String(PORTS[p]))

const dir = mkdtempSync(join(tmpdir(), 'kafka-ops-'))
const removeAll = () => {
  for (const c of [SEC, MON]) try { execFileSync('podman', ['rm', '-f', c], { stdio: 'ignore' }) } catch {}
  rmSync(dir, { recursive: true, force: true })
}
process.on('exit', removeAll)
process.on('SIGINT', () => process.exit(130))

/** Lines nobody needs to read: stack frames, deprecation notes, the KIP-848 banner, log timestamps. */
function clean(text) {
  return text.split('\n')
    .filter((l) => !/^\s+at |^\s+\.\.\. \d+ more|KIP-848|is deprecated|IllegalStateException: Transactional|Error in kafka producer I\/O thread while aborting/.test(l))
    .map((l) => l.replace(/^\[\d{4}-\d\d-\d\d [\d:,]+\] /, ''))
    .join('\n').trim()
}

const quote = (a) => (/[[\];*"' ]/.test(a) ? `'${a}'` : a)

/** Runs one Kafka tool in a container; returns the command as typed and what it printed. */
function tool(container, args, { input, keep } = {}) {
  // tools print their errors on standard error, often with exit code 0: keep both streams
  const r = spawnSync('podman', ['exec', '-i', container, BIN + args[0], ...args.slice(1)], { input, timeout: 90000 })
  let out = clean(r.stdout.toString() + r.stderr.toString())
  if (keep) out = out.split('\n').filter((l) => keep.test(l)).join('\n')
  return { cmd: shown(args.map(quote).join(' ')), out: shown(out) }
}

/** A shell command on the host, run in the certificate folder. */
function host(cmd, { keep } = {}) {
  let out = ''
  try {
    out = execFileSync('sh', ['-c', cmd], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).toString()
  } catch (e) {
    out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  }
  if (keep) out = out.split('\n').filter((l) => keep.test(l)).join('\n')
  return { cmd: shown(cmd.replace(' </dev/null', '')), out: shown(out.trim()) }
}

async function waitForLog(container, file, re) {
  for (let i = 0; i < 90; i++) {
    let log = ''
    try { log = execFileSync('podman', file ? ['exec', container, 'cat', file] : ['logs', container], { stdio: ['ignore', 'pipe', 'pipe'] }).toString() } catch {}
    if (re.test(log)) return
    await sleep(1000)
  }
  let tail = ""
  try { tail = execFileSync("podman", ["exec", container, "sh", "-c", `tail -5 ${file ?? "/dev/null"}; ls /opt/kafka/logs`]).toString() } catch {}
  throw new Error(`${container} did not start\n${tail}`)
}

const step = (label, r, extra = {}) => ({ label, ...r, ...extra })
const data = { image: IMAGE }

// ===================================================================== security
{
  const s = { tls: [], steps: [] }
  // a private certificate authority and a broker certificate, all PEM
  s.tls.push(step('a private CA: key + self-signed certificate', host('openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 365 -subj "/CN=demo-ca"')))
  s.tls.push(step('the broker key and a signing request for its host name', host('openssl req -newkey rsa:2048 -nodes -keyout broker.key -out broker.csr -subj "/CN=localhost"')))
  writeFileSync(join(dir, 'san.ext'), 'subjectAltName=DNS:localhost\n')
  s.tls.push(step('the CA signs it; the SAN must match the advertised host', host('openssl x509 -req -in broker.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out broker.pem -days 365 -extfile san.ext')))
  s.tls.push(step('Kafka reads a PEM key only in PKCS#8: convert, then key + certificate in one file', host('openssl pkcs8 -topk8 -nocrypt -in broker.key -out broker.pk8 && cat broker.pk8 broker.pem > broker-chain.pem')))
  s.tls = s.tls.map((t) => ({ ...t, out: t.out.split('\n').filter((l) => !/^[.+*\s-]*$/.test(l)).join('\n') }))

  const server = `process.roles=broker,controller
node.id=1
controller.quorum.voters=1@localhost:19793
listeners=SASL_PLAINTEXT://localhost:19792,CONTROLLER://localhost:19793,SASL_SSL://localhost:19794
advertised.listeners=SASL_PLAINTEXT://localhost:19792,SASL_SSL://localhost:19794
listener.security.protocol.map=CONTROLLER:PLAINTEXT,SASL_PLAINTEXT:SASL_PLAINTEXT,SASL_SSL:SASL_SSL
controller.listener.names=CONTROLLER
inter.broker.listener.name=SASL_PLAINTEXT

# authentication: SCRAM users are stored in the cluster metadata
sasl.enabled.mechanisms=SCRAM-SHA-512
sasl.mechanism.inter.broker.protocol=SCRAM-SHA-512
listener.name.sasl_plaintext.scram-sha-512.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="admin" password="admin-secret";
listener.name.sasl_ssl.scram-sha-512.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="admin" password="admin-secret";

# TLS for the SASL_SSL listener
ssl.keystore.type=PEM
ssl.keystore.location=/cfg/broker-chain.pem

# authorisation: ACLs, deny by default
authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer
super.users=User:admin;User:ANONYMOUS
allow.everyone.if.no.acl.found=false

offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
group.initial.rebalance.delay.ms=0
log.dirs=/tmp/kraft-logs
`
  const scram = (user, pw) => `security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-512
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="${user}" password="${pw}";
`
  const files = {
    'server.properties': server,
    'admin.properties': scram('admin', 'admin-secret'),
    'app.properties': scram('app', 'app-secret'),
    'wrong.properties': scram('app', 'not-the-password'),
    'plain.properties': 'security.protocol=PLAINTEXT\ndefault.api.timeout.ms=8000\nrequest.timeout.ms=4000\n',
    'tls.properties': 'security.protocol=SASL_SSL\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="admin" password="admin-secret";\nssl.truststore.type=PEM\nssl.truststore.location=/cfg/ca.pem\n',
    'tls-no-truststore.properties': 'security.protocol=SASL_SSL\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="admin" password="admin-secret";\ndefault.api.timeout.ms=8000\nrequest.timeout.ms=4000\n',
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  // the container runs as another user: it must be able to enter the folder and read the files
  chmodSync(dir, 0o755)
  for (const f of readdirSync(dir)) chmodSync(join(dir, f), 0o644)
  s.files = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, shown(v)]))

  try { execFileSync('podman', ['rm', '-f', SEC], { stdio: 'ignore' }) } catch {}
  execFileSync('podman', ['run', '-d', '--name', SEC, '--network', 'host', '-v', `${dir}:/cfg:Z`, '--entrypoint', 'sleep', IMAGE, 'infinity'], { stdio: 'ignore' })

  const B = ['--bootstrap-server', 'localhost:19792']
  const admin = [...B, '--command-config', '/cfg/admin.properties']
  const app = [...B, '--command-config', '/cfg/app.properties']
  const T = (label, args, opts) => s.steps.push(step(label, tool(SEC, args, opts)))

  const uuid = tool(SEC, ['kafka-storage.sh', 'random-uuid'])
  s.steps.push(step('a cluster id', { ...uuid }))
  T('format the storage and create the first SCRAM user (admin) before the broker ever starts', ['kafka-storage.sh', 'format', '-t', uuid.out.trim(), '-c', '/cfg/server.properties', '--add-scram', 'SCRAM-SHA-512=[name=admin,password=admin-secret]'], { keep: /^Formatting/ })
  execFileSync('podman', ['exec', '-d', SEC, BIN + 'kafka-server-start.sh', '/cfg/server.properties'])
  await waitForLog(SEC, '/opt/kafka/logs/server.log', /Kafka Server started/)

  T('a client with no credentials (PLAINTEXT) against the SASL listener', ['kafka-topics.sh', ...B, '--command-config', '/cfg/plain.properties', '--list'], { keep: /^Error while/ })
  T('a wrong password', ['kafka-topics.sh', ...B, '--command-config', '/cfg/wrong.properties', '--list'], { keep: /^Error while/ })
  T('the admin (a super user) creates a topic', ['kafka-topics.sh', ...admin, '--create', '--topic', 'orders', '--partitions', '3', '--replication-factor', '1'])
  T('the admin creates a second SCRAM user, app, at runtime', ['kafka-configs.sh', ...admin, '--alter', '--add-config', 'SCRAM-SHA-512=[iterations=8192,password=app-secret]', '--entity-type', 'users', '--entity-name', 'app'])
  T('users are listed with their mechanism and iterations — never the password', ['kafka-configs.sh', ...admin, '--describe', '--entity-type', 'users'])
  T('app is authenticated but has no ACL: producing is denied', ['kafka-console-producer.sh', ...app, '--topic', 'orders'], { input: 'order-1\n', keep: /AUTHORIZATION|AuthorizationException/ })
  T('allow app to WRITE to the topic orders', ['kafka-acls.sh', ...admin, '--add', '--allow-principal', 'User:app', '--operation', 'WRITE', '--topic', 'orders'])
  s.steps.push(step('the same producer now works (no output means every record was acknowledged)', tool(SEC, ['kafka-console-producer.sh', ...app, '--topic', 'orders'], { input: 'order-1\norder-2\n' }), { typed: ['order-1', 'order-2'] }))
  const consume = ['kafka-console-consumer.sh', ...app, '--topic', 'orders', '--group', 'billing', '--from-beginning', '--timeout-ms', '8000']
  T('consuming with a group: denied on the group first', consume, { keep: /AuthorizationException/ })
  T('allow app to READ the group billing', ['kafka-acls.sh', ...admin, '--add', '--allow-principal', 'User:app', '--operation', 'READ', '--group', 'billing'])
  T('now denied on the topic', consume, { keep: /AuthorizationException/ })
  T('allow app to READ the topic', ['kafka-acls.sh', ...admin, '--add', '--allow-principal', 'User:app', '--operation', 'READ', '--topic', 'orders'])
  T('with both READ ACLs the consumer gets its records', consume, { keep: /^order-|Processed a total/ })
  T('every ACL on the cluster', ['kafka-acls.sh', ...admin, '--list'])
  T('TLS: a client that does not trust the private CA', ['kafka-topics.sh', '--bootstrap-server', 'localhost:19794', '--command-config', '/cfg/tls-no-truststore.properties', '--list'], { keep: /SslAuthenticationException|Caused by: javax/ })
  T('TLS: a client with the CA as its truststore', ['kafka-topics.sh', '--bootstrap-server', 'localhost:19794', '--command-config', '/cfg/tls.properties', '--list'])
  s.handshake = host('openssl s_client -connect localhost:19794 -CAfile ca.pem </dev/null', { keep: /^subject=|^issuer=|Verify return code|^Protocol|Cipher is/ })
  const log = execFileSync('podman', ['exec', SEC, 'cat', '/opt/kafka/logs/server.log']).toString()
  s.brokerLog = shown(clean(log.split('\n').filter((l) => /Failed authentication with|Principal = User:app is Denied/.test(l)).join('\n')))
    .split('\n').filter((l, i, all) => all.indexOf(l) === i).slice(0, 6)
  data.security = s
  execFileSync('podman', ['rm', '-f', SEC], { stdio: 'ignore' })
}

// ===================================================================== monitoring
{
  const m = {}
  try { execFileSync('podman', ['rm', '-f', MON], { stdio: 'ignore' }) } catch {}
  const env = {
    KAFKA_NODE_ID: '1', KAFKA_PROCESS_ROLES: 'broker,controller',
    KAFKA_LISTENERS: 'PLAINTEXT://localhost:19796,CONTROLLER://localhost:19797',
    KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:19796', KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
    KAFKA_CONTROLLER_QUORUM_VOTERS: '1@localhost:19797', KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
    KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: '0',
    KAFKA_JMX_PORT: '19799', KAFKA_JMX_HOSTNAME: 'localhost',
  }
  execFileSync('podman', ['run', '-d', '--name', MON, '--network', 'host', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), IMAGE], { stdio: 'ignore' })
  m.jmxEnv = shown('KAFKA_JMX_PORT=19799\nKAFKA_JMX_HOSTNAME=localhost')
  await waitForLog(MON, null, /Kafka Server started/)
  data.version = tool(MON, ['kafka-topics.sh', '--version']).out.split(' ')[0]

  const B = ['--bootstrap-server', 'localhost:19796']
  const JMX = ['--jmx-url', 'service:jmx:rmi:///jndi/rmi://localhost:19799/jmxrmi']
  const jmxOnce = (objects, extra = []) => tool(MON, ['kafka-jmx.sh', ...JMX, ...objects.flatMap((o) => ['--object-name', o]), ...extra, '--one-time', 'true'])
  const HEALTH = [
    'kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions',
    'kafka.server:type=ReplicaManager,name=UnderMinIsrPartitionCount',
    'kafka.controller:type=KafkaController,name=OfflinePartitionsCount',
    'kafka.controller:type=KafkaController,name=ActiveControllerCount',
  ]
  m.create = tool(MON, ['kafka-topics.sh', ...B, '--create', '--topic', 'orders', '--partitions', '3', '--replication-factor', '1'])
  m.health = jmxOnce(HEALTH, ['--report-format', 'properties'])

  // load: one million 200-byte records as fast as one producer can, while JMX is sampled every second
  const SAMPLED = [
    'kafka.server:type=BrokerTopicMetrics,name=MessagesInPerSec',
    'kafka.server:type=BrokerTopicMetrics,name=BytesInPerSec',
    'kafka.server:type=KafkaRequestHandlerPool,name=RequestHandlerAvgIdlePercent',
    'kafka.network:type=SocketServer,name=NetworkProcessorAvgIdlePercent',
  ]
  // no --attributes: when a listed attribute is missing on one of the objects the tool waits forever
  const samplerArgs = ['kafka-jmx.sh', ...JMX, ...SAMPLED.flatMap((o) => ['--object-name', o]), '--reporting-interval', '1000', '--report-format', 'csv']
  m.samplerCmd = shown(samplerArgs.map(quote).join(' '))
  const sampler = new Running('jmx', 'podman', ['exec', MON, 'sh', '-c', `exec ${BIN}${samplerArgs.join(' ')} > /tmp/jmx.csv`])
  await sleep(6000)
  m.perf = tool(MON, ['kafka-producer-perf-test.sh', '--topic', 'orders', '--num-records', '4000000', '--record-size', '100', '--throughput', '-1', '--producer-props', 'bootstrap.servers=localhost:19796', 'acks=all', 'linger.ms=5', '--print-metrics'])
  await sleep(3000)
  await sampler.stop('SIGKILL')
  try { execFileSync('podman', ['exec', MON, 'pkill', '-f', 'JmxTool'], { stdio: 'ignore' }) } catch {}
  {
    // a sampling run prints one block per interval: a "time" line, then one name:attribute,"value" line each
    const rows = []
    const csv = execFileSync('podman', ['exec', MON, 'cat', '/tmp/jmx.csv']).toString().split('\n')
    for (const line of csv) {
      const g = line.match(/^(.+),"([^"]*)"$/)
      if (!g) continue
      if (g[1] === 'time') rows.push({ time: Number(g[2]) })
      else if (rows.length) rows.at(-1)[g[1]] = Number(g[2])
    }
    const v = (r, needle) => Number(Object.entries(r).find(([k]) => k.includes(needle))?.[1])
    const t0 = rows[0].time
    m.load = rows.slice(1).map((r, i) => {
      const p = rows[i]
      const dt = (r.time - p.time) / 1000
      const d = (needle) => v(r, needle) - v(p, needle)
      return {
        t: Math.round((r.time - t0) / 100) / 10,
        msgsPerSec: Math.round(d('MessagesInPerSec:Count') / dt),
        mbPerSec: Math.round(d('BytesInPerSec:Count') / dt / 1e5) / 10,
        // the meter is marked with idle nanoseconds divided by the thread count: its rate is the idle share
        handlerIdlePct: Math.max(0, Math.min(100, Math.round(d('RequestHandlerAvgIdlePercent:Count') / (dt * 1e9) * 100))),
        networkIdlePct: Math.round(v(r, 'NetworkProcessorAvgIdlePercent:Value') * 100),
      }
    })
  }
  const pick = (out, names) => out.split('\n')
    .map((l) => l.match(/^([\w-]+):([\w-]+):\{([^}]*)\}\s*:\s*(\S+)/))
    .filter((g) => g && names.includes(g[2]) && !/node-id|topic=|partition=/.test(g[3]))
    .map((g) => ({ group: g[1], name: g[2], value: Number(g[4]) }))
  m.perfSummary = m.perf.out.split('\n').find((l) => /records sent/.test(l))
  m.producerMetrics = pick(m.perf.out, ['record-send-rate', 'record-error-rate', 'record-retry-rate', 'request-latency-avg', 'request-latency-max', 'batch-size-avg', 'records-per-request-avg', 'bufferpool-wait-ratio', 'buffer-available-bytes'])
  m.perf = { cmd: m.perf.cmd, out: m.perfSummary }

  const REQ = (metric, request) => `kafka.network:type=RequestMetrics,name=${metric},request=${request}`
  m.produceTimes = jmxOnce([REQ('TotalTimeMs', 'Produce'), REQ('RequestQueueTimeMs', 'Produce'), REQ('LocalTimeMs', 'Produce'), REQ('RemoteTimeMs', 'Produce'), REQ('ResponseSendTimeMs', 'Produce')], ['--attributes', 'Count,Mean,99thPercentile', '--report-format', 'properties'])
  m.flush = jmxOnce(['kafka.log:type=LogFlushStats,name=LogFlushRateAndTimeMs'], ['--attributes', 'Count,Mean', '--report-format', 'properties'])

  const cperf = tool(MON, ['kafka-consumer-perf-test.sh', ...B, '--topic', 'orders', '--num-records', '4000000', '--group', 'perf-readers', '--print-metrics'])
  m.consumerPerf = { cmd: cperf.cmd, out: cperf.out.split('\n').filter((l) => /^start\.time|^\d{4}-/.test(l)).join('\n') }
  m.consumerMetrics = pick(cperf.out, ['records-consumed-rate', 'records-lag-max', 'fetch-rate', 'fetch-latency-avg', 'fetch-size-avg', 'commit-rate', 'commit-latency-avg', 'rebalance-total', 'rebalance-latency-avg', 'last-poll-seconds-ago'])
  m.fetchTimes = jmxOnce([REQ('TotalTimeMs', 'FetchConsumer'), REQ('RemoteTimeMs', 'FetchConsumer')], ['--attributes', 'Count,Mean,99thPercentile', '--report-format', 'properties'])
  m.healthAfter = jmxOnce(HEALTH, ['--report-format', 'properties'])

  // lag over time: a steady producer; the consumer keeps up, stops, then comes back
  tool(MON, ['kafka-topics.sh', ...B, '--create', '--topic', 'payments', '--partitions', '3', '--replication-factor', '1'])
  const RATE = 2000
  const producerArgs = ['kafka-producer-perf-test.sh', '--topic', 'payments', '--num-records', String(RATE * 45), '--record-size', '100', '--throughput', String(RATE), '--producer-props', 'bootstrap.servers=localhost:19796']
  const consumerLine = `${BIN}kafka-console-consumer.sh --bootstrap-server localhost:19796 --topic payments --group reports --command-property client.id=reports-1 --command-property auto.commit.interval.ms=1000 > /dev/null`
  const startConsumer = () => new Running('reports', 'podman', ['exec', MON, 'sh', '-c', `exec ${consumerLine}`])
  const stopConsumer = async (c) => {
    try { execFileSync('podman', ['exec', MON, 'pkill', '-INT', '-f', 'client.id=reports-1']) } catch {}
    await Promise.race([c.exited, sleep(15000)])
  }
  m.lagCommands = {
    producer: shown(producerArgs.map(quote).join(' ')),
    consumer: shown(consumerLine.replace(BIN, '')),
    describe: shown('kafka-consumer-groups.sh --bootstrap-server localhost:19796 --describe --group reports'),
  }
  let consumer = startConsumer()
  await sleep(4000)
  const t0 = Date.now()
  const producer = new Running('payments-producer', 'podman', ['exec', MON, BIN + producerArgs[0], ...producerArgs.slice(1)])
  const events = [{ t: 0, label: `producer starts: ${RATE} records/s` }]
  const series = []
  let maxDescribe = { lag: -1 }
  let stopped = false
  let restarted = false
  for (;;) {
    const d = tool(MON, ['kafka-consumer-groups.sh', ...B, '--describe', '--group', 'reports'])
    const t = Math.round((Date.now() - t0) / 100) / 10
    const rows = d.out.split('\n').filter((l) => /^reports\s/.test(l)).map((l) => l.trim().split(/\s+/))
    if (rows.length === 3) {
      const lag = rows.reduce((n, r) => n + (Number(r[5]) || 0), 0)
      const end = rows.reduce((n, r) => n + (Number(r[4]) || 0), 0)
      series.push({ t, lag, logEnd: end })
      if (lag > maxDescribe.lag) maxDescribe = { lag, t, ...d }
    }
    if (!stopped && t >= 12) {
      await stopConsumer(consumer)
      events.push({ t: Math.round((Date.now() - t0) / 100) / 10, label: 'consumer stops' })
      stopped = true
    }
    if (stopped && !restarted && t >= 28) {
      consumer = startConsumer()
      events.push({ t: Math.round((Date.now() - t0) / 100) / 10, label: 'consumer restarts' })
      restarted = true
    }
    const done = series.at(-1)?.logEnd === RATE * 45
    if (done && !events.some((e) => e.label === 'producer ends')) events.push({ t, label: 'producer ends' })
    if (restarted && done && series.at(-1)?.lag === 0) break
    if (t > 120) throw new Error('lag never returned to zero: ' + JSON.stringify({ series: series.slice(-6), events, last: d.out.slice(0, 600), consumer: consumer.since(0).slice(-5) }))
  }
  await stopConsumer(consumer)
  await producer.stop('SIGKILL')
  m.lag = { rate: RATE, series, events, atMax: { t: maxDescribe.t, cmd: maxDescribe.cmd, out: maxDescribe.out } }
  data.monitoring = m
}

let json = JSON.stringify(data, null, 1)
for (const secret of [userInfo().username, homedir(), dir]) if (json.includes(secret)) throw new Error(`recording contains "${secret}"`)
// generated member ids are long and random: shorten them
json = json.replace(/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "$1…")
json = json.replace(/\b([0-9a-zA-Z_-]{8})[0-9a-zA-Z_-]{14}\b(?=\s|")/g, (m, a) => (/\d/.test(m) && /[a-z]/i.test(m) ? a + '…' : m))
writeFileSync(outFile, `// Recorded with Kafka ${data.version} (${IMAGE}) by tools/kafka-capture/capture-ops.mjs — do not edit by hand.\n\nexport const OPS = ${json} as const\n`)
console.log(`wrote ${outFile}`)
process.exit(0)
