// Records the "Using Kafka day to day" lesson and practicals 4 (transactions) and 5 (share groups)
// against a real Kafka, with the CLI and with the plain-Java using-app.
//   node capture-more.mjs ../../src/modules/kafka/data/more.ts
// Uses its own container (kafka-more) and ports (19592/19593), so it can run beside capture.mjs.
import { spawn, execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { userInfo, homedir } from 'node:os'
import { IMAGE, sleep } from './lib/lab.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-more.mjs <out.ts>')

const CONTAINER = 'kafka-more'
const PORT = 19592
const BIN = '/opt/kafka/bin/'
const BS = `--bootstrap-server localhost:${PORT}`
const LIB = new URL('./using-app/build/install/using-app/lib/*', import.meta.url).pathname

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
    // a single broker: the internal topics of transactions and share groups get one replica
    '-e', 'KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1', '-e', 'KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1',
    '-e', 'KAFKA_SHARE_COORDINATOR_STATE_TOPIC_REPLICATION_FACTOR=1', '-e', 'KAFKA_SHARE_COORDINATOR_STATE_TOPIC_MIN_ISR=1',
    IMAGE], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { execFileSync('podman', ['exec', CONTAINER, BIN + 'kafka-topics.sh', ...BS.split(' '), '--list'], { stdio: 'ignore' }); return } catch {}
    await sleep(1000)
  }
  throw new Error('broker did not start')
}

// ------------------------------------------------------------------ sanitising
const shown = (s) => s.replaceAll(String(PORT + 1), '9093').replaceAll(String(PORT), '9092')
/** Kafka's 22-character ids (members, topics, cluster): first 6 characters are enough to tell them apart. */
// (padded to the same width when a table column follows, so columns stay aligned)
const shortIds = (s) => s.replace(/(?<![\w-])([A-Za-z0-9_-]{22})(?![\w-])( ?)/g, (all, m, sp) => (/\d/.test(m) && /[A-Z]/.test(m) && /[a-z]/.test(m) ? (sp ? (m.slice(0, 6) + '…').padEnd(22) + sp : m.slice(0, 6) + '…') : all))
const NOISE = /consumer rebalance protocol \(KIP-848\) is production-ready/
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
const produce = (argsLine, lines) => ({ ...cli(`kafka-console-producer.sh ${argsLine}`, { input: lines.join('\n') + '\n' }), out: lines.map((l) => '> ' + l).join('\n'), typed: lines })

/** A long-running process; complete output lines are kept with the time they arrived. */
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
      for (const l of parts) if (l.trim() && !NOISE.test(l)) this.lines.push({ at: Date.now(), line: clean(l) })
    }
    this.proc.stdout.on('data', take)
    this.proc.stderr.on('data', take)
    this.exited = new Promise((r) => this.proc.on('exit', r))
  }

  text() { return this.lines.map((l) => l.line) }

  async waitFor(re, timeoutMs = 60000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (this.lines.some((l) => re.test(l.line))) return
      await sleep(100)
    }
    throw new Error(`${this.name}: timed out waiting for ${re}: ${this.text().join(' | ')}`)
  }
}

/** A console tool left running in the container; stop() is Ctrl-C (SIGINT to the java process carrying client.id=<name>). */
function background(name, tool, argsLine) {
  const r = new Proc(name, 'podman', ['exec', '-i', CONTAINER, BIN + tool, ...argsLine.split(' ')])
  r.cmd = shown(`${tool} ${argsLine}`)
  r.stop = async () => {
    try { execFileSync('podman', ['exec', CONTAINER, 'pkill', '-INT', '-f', `client.id=${name}`]) } catch {}
    await Promise.race([r.exited, sleep(15000)])
  }
  return r
}

/** One of the using-app programs: `java -cp "lib/*" demo.using.<Class> args…`. */
const javaCmd = (cls, args = []) => ['KAFKA_BOOTSTRAP=localhost:9092 java -cp "build/install/using-app/lib/*" demo.using.' + cls, ...args].join(' ')
function java(cls, args = [], name = cls) {
  const r = new Proc(name, 'java', ['-cp', LIB, 'demo.using.' + cls, ...args], { KAFKA_BOOTSTRAP: `localhost:${PORT}` })
  r.cmd = javaCmd(cls, args)
  return r
}
async function runJava(cls, args = []) {
  const r = java(cls, args)
  const code = await r.exited
  if (code !== 0) throw new Error(`${cls} exited with ${code}: ${r.text().join('\n')}`)
  return { cmd: r.cmd, out: r.text().join('\n') }
}

const t = (label, step) => ({ label, ...step })
/** Polls a CLI command until its output matches every pattern (a describe taken too early shows a half-finished state). */
async function until(cmd, re, timeoutMs = 30000) {
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

await freshBroker()
const data = { image: IMAGE, version: cli('kafka-topics.sh --version').out.split(' ')[0] }

// ================================================================== Using Kafka day to day — CLI
{
  const u = {}
  const fmt = '--formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true'
  u.connect = [
    t('which cluster is behind this address?', cli(`kafka-cluster.sh cluster-id ${BS}`)),
    t('every tool takes the same --bootstrap-server; an empty cluster has no topics yet', cli(`kafka-topics.sh ${BS} --list`)),
  ]
  u.topics = [
    t('create', cli(`kafka-topics.sh ${BS} --create --topic payments --partitions 3 --replication-factor 1`)),
    t('list', cli(`kafka-topics.sh ${BS} --list`)),
    t('describe', cli(`kafka-topics.sh ${BS} --describe --topic payments`)),
    t('add partitions (only ever more, never fewer)', cli(`kafka-topics.sh ${BS} --alter --topic payments --partitions 4`)),
    t('try to go back to 3', cli(`kafka-topics.sh ${BS} --alter --topic payments --partitions 3`)),
    t('a scratch topic to delete', cli(`kafka-topics.sh ${BS} --create --topic scratch --partitions 1 --replication-factor 1`)),
    t('delete it', cli(`kafka-topics.sh ${BS} --delete --topic scratch`)),
  ]
  // trim the "try to go back" error to its first line: the rest is a stack trace
  u.topics[4].out = u.topics[4].out.split('\n').find((l) => /InvalidPartitionsException|Error/.test(l)) ?? u.topics[4].out
  await sleep(1500)
  u.topics.push(t('gone', cli(`kafka-topics.sh ${BS} --list`)))

  const lines = ['source:checkout\talice:{"amount":25}', 'source:checkout\tbob:{"amount":40}', 'source:refunds\talice:{"amount":-25}', 'source:checkout\tcarol:{"amount":90}']
  u.produce = t('produce keyed records with a header (header TAB key:value per line)', produce(`${BS} --topic payments --reader-property parse.key=true --reader-property key.separator=: --reader-property parse.headers=true`, lines))
  u.readAll = t('read everything, with partition, offset, key and headers', cli(`kafka-console-consumer.sh ${BS} --topic payments --from-beginning --timeout-ms 5000 ${fmt} --formatter-property print.headers=true`))
  u.offsets = t('how many records per partition (the end offsets)', cli(`kafka-get-offsets.sh ${BS} --topic payments`))
  u.readGroup = t('read as a group: offsets are committed, a second run continues where this one stopped', cli(`kafka-console-consumer.sh ${BS} --topic payments --group payments-cli --from-beginning --timeout-ms 5000 ${fmt}`))
  u.groupsList = t('list groups', cli(`kafka-consumer-groups.sh ${BS} --list`))
  u.groupDescribe = t('describe a group: committed offset, end offset and lag per partition', cli(`kafka-consumer-groups.sh ${BS} --describe --group payments-cli`))
  u.produceMore = t('two more payments arrive', produce(`${BS} --topic payments --reader-property parse.key=true --reader-property key.separator=:`, ['bob:{"amount":12}', 'alice:{"amount":7}']))
  u.lag = t('lag: records the group has not read yet', cli(`kafka-consumer-groups.sh ${BS} --describe --group payments-cli`))
  u.resetDry = t('reset to the beginning: --dry-run only shows the plan', cli(`kafka-consumer-groups.sh ${BS} --reset-offsets --to-earliest --group payments-cli --topic payments --dry-run`))
  u.resetRun = t('--execute applies it (the group must have no running members)', cli(`kafka-consumer-groups.sh ${BS} --reset-offsets --to-earliest --group payments-cli --topic payments --execute`))
  u.afterReset = t('now the whole topic is lag again', cli(`kafka-consumer-groups.sh ${BS} --describe --group payments-cli`))
  u.configSet = t('keep records for one day instead of the default seven', cli(`kafka-configs.sh ${BS} --alter --entity-type topics --entity-name payments --add-config retention.ms=86400000`))
  u.configGet = t('the topic now overrides one setting', cli(`kafka-configs.sh ${BS} --describe --entity-type topics --entity-name payments`))
  u.configDel = t('remove the override: back to the broker default', cli(`kafka-configs.sh ${BS} --alter --entity-type topics --entity-name payments --delete-config retention.ms`))
  // find one record: pick the partition and offset of bob's first payment from the full read above
  const bob = u.readAll.out.split('\n').find((l) => /\tbob\t/.test(l) || /bob/.test(l))
  const [, part, off] = bob.match(/Partition:(\d+)\s+Offset:(\d+)/)
  u.byOffset = t(`one record by partition and offset (partition ${part}, offset ${off})`, cli(`kafka-console-consumer.sh ${BS} --topic payments --partition ${part} --offset ${off} --max-messages 1 ${fmt}`))
  u.byOffset.out = u.byOffset.out.split('\n').filter((l) => !/Processed a total/.test(l)).join('\n')
  u.found = { partition: Number(part), offset: Number(off) }
  data.usingCli = u
}

// ================================================================== Using Kafka day to day — Java
{
  await freshBroker()
  const j = {}
  j.setup = t('a topic for the programs', cli(`kafka-topics.sh ${BS} --create --topic payments --partitions 3 --replication-factor 1`))
  j.topicAdmin = await runJava('TopicAdmin')
  j.send = await runJava('SendPayments')
  j.read = await runJava('ReadPayments')
  j.lagAfterRead = await runJava('GroupLag', ['payments-reader'])
  j.sendMore = await runJava('SendPayments')
  j.lagAfterMore = await runJava('GroupLag', ['payments-reader'])
  j.reset = await runJava('ResetOffsets', ['payments-reader'])
  j.lagAfterReset = await runJava('GroupLag', ['payments-reader'])
  const first = j.send.out.split('\n').find((l) => /key=bob/.test(l)).match(/partition (\d+) offset (\d+)/)
  j.atOffset = await runJava('ReadAtOffset', [first[1], first[2]])
  data.usingJava = j
}

// ================================================================== Practical 4 — transactions
{
  await freshBroker()
  const p = {}
  p.setup = [
    t('the input topic', cli(`kafka-topics.sh ${BS} --create --topic transfers --partitions 1 --replication-factor 1`)),
    t('the output topic of the read-process-write step', cli(`kafka-topics.sh ${BS} --create --topic transfers-checked --partitions 1 --replication-factor 1`)),
  ]
  p.features = t('transactions need no switch: transaction.version is finalized on a 4.x cluster', { ...cli(`kafka-features.sh ${BS} describe`) })
  p.features.out = p.features.out.split('\n').filter((l) => /transaction\.version|metadata\.version/.test(l)).map((l) => l.replace(/\s+Epoch: \d+/, '')).join('\n')
  p.pay = await runJava('PayTransactionally')
  p.endOffsets = t('six offsets used for four records', cli(`kafka-get-offsets.sh ${BS} --topic transfers`))
  p.uncommitted = t('read_uncommitted (the default): aborted records are delivered too', cli(`kafka-console-consumer.sh ${BS} --topic transfers --from-beginning --timeout-ms 5000 --formatter-property print.offset=true`))
  p.committed = t('read_committed: only the committed transaction', cli(`kafka-console-consumer.sh ${BS} --topic transfers --from-beginning --timeout-ms 5000 --isolation-level read_committed --formatter-property print.offset=true`))
  // the segment file itself: data batches and control batches (markers); fields trimmed to the ones the lesson uses
  const dump = cli('kafka-dump-log.sh --files /tmp/kafka-logs/transfers-0/00000000000000000000.log --print-data-log')
  const keep = (l, names) => names.map((n) => (l.match(new RegExp(`(?:^|\\s)(${n}: \\S+)`)) ?? [])[1]).filter(Boolean).join(' ')
  p.dump = {
    cmd: dump.cmd,
    out: dump.out.split('\n').filter((l) => /^(baseOffset|\| offset)/.test(l)).map((l) => (l.startsWith('|')
      ? '| ' + keep(l, ['offset', 'key', 'endTxnMarker']) + (l.match(/ payload: .*$/)?.[0] ?? '')
      : keep(l, ['baseOffset', 'lastOffset', 'count', 'producerId', 'producerEpoch', 'isTransactional', 'isControl']))).join('\n'),
  }
  p.javaUncommitted = await runJava('ReadTransfers', ['read_uncommitted'])
  p.javaCommitted = await runJava('ReadTransfers', ['read_committed'])
  p.txList = t('the transactions the cluster knows about', cli(`kafka-transactions.sh ${BS} list`))
  p.txDescribe = t('one transactional id in detail', cli(`kafka-transactions.sh ${BS} describe --transactional-id transfers-1`))
  // read-process-write
  p.check = await runJava('CheckTransfers')
  p.checkGroup = t('the offsets were committed by the transaction, not by the consumer', cli(`kafka-consumer-groups.sh ${BS} --describe --group transfer-checker`))
  p.checkedOut = t('the output topic, read_committed', cli(`kafka-console-consumer.sh ${BS} --topic transfers-checked --from-beginning --timeout-ms 5000 --isolation-level read_committed --formatter-property print.offset=true`))
  p.checkedOffsets = t('two records, one marker', cli(`kafka-get-offsets.sh ${BS} --topic transfers-checked`))
  p.txList2 = t('both transactional ids', cli(`kafka-transactions.sh ${BS} list`))
  data.tx = p
}

// ================================================================== Practical 5 — share groups
{
  await freshBroker()
  const p = {}
  p.features = cli(`kafka-features.sh ${BS} describe`)
  p.features.out = p.features.out.split('\n').filter((l) => /share\.version/.test(l)).map((l) => l.replace(/\s+Epoch: \d+/, '')).join('\n')
  p.setup = t('ONE partition: in a consumer group only one member could read it', cli(`kafka-topics.sh ${BS} --create --topic jobs --partitions 1 --replication-factor 1`))
  p.defaults = t('the share-group settings and their defaults', cli(`kafka-configs.sh ${BS} --describe --entity-type groups --entity-name cli-workers --all`))
  p.defaults.out = p.defaults.out.split('\n').filter((l) => /^All configs|^\s+share\./.test(l)).map((l) => l.replace(/ sensitive=false synonyms=\{.*\}$/, '')).join('\n')
  p.reset = t('a new share group starts at the END of the topic (latest); start this one at the beginning', cli(`kafka-configs.sh ${BS} --alter --entity-type groups --entity-name cli-workers --add-config share.auto.offset.reset=earliest`))

  // three console share consumers, one partition
  const fmt = '--formatter-property print.offset=true --formatter-property print.delivery=true'
  const names = ['worker-a', 'worker-b', 'worker-c']
  const cs = names.map((n) => background(n, 'kafka-console-share-consumer.sh', `${BS} --topic jobs --group cli-workers --command-property client.id=${n} ${fmt}`))
  p.members = await until(`kafka-share-groups.sh ${BS} --describe --group cli-workers --members`, names.map((n) => new RegExp(`${n}.*jobs:0`)), 40000)
  p.members = members3(p.members, names)
  const jobs = Array.from({ length: 9 }, (_, i) => `job-${i + 1}`)
  for (const j of jobs) { cli(`kafka-console-producer.sh ${BS} --topic jobs`, { input: j + '\n' }); await sleep(300) }
  p.produced = { cmd: shown(`kafka-console-producer.sh ${BS} --topic jobs`), out: jobs.map((j) => '> ' + j).join('\n'), typed: jobs }
  for (const c of cs) await c.waitFor(/./, 30000).catch(() => {})
  await sleep(4000)
  p.consumers = cs.map((c) => ({ name: c.name, cmd: c.cmd, out: c.text().filter((l) => /^Offset:/.test(l)) }))
  // a console share consumer acknowledges a record with its next poll, or when it closes: stop them first
  for (const c of cs) await c.stop()
  p.offsets = await until(`kafka-share-groups.sh ${BS} --describe --group cli-workers --offsets`, /jobs\s+0\s+\d+\s+0/, 60000)
  p.list = t('share groups are listed by their own tool', cli(`kafka-share-groups.sh ${BS} --list`))
  p.allGroups = t('kafka-groups.sh lists groups of every type', cli(`kafka-groups.sh ${BS} --list`))
  p.resetDry = t('replay: move the share group back to the beginning (members must be stopped)', cli(`kafka-share-groups.sh ${BS} --reset-offsets --to-earliest --group cli-workers --topic jobs --dry-run`))

  // release and the delivery count limit
  cli(`kafka-topics.sh ${BS} --create --topic retries --partitions 1 --replication-factor 1`)
  p.limit = t('allow three deliveries per record (default 5, allowed 2–10)', cli(`kafka-configs.sh ${BS} --alter --entity-type groups --entity-name releaser --add-config share.auto.offset.reset=earliest,share.delivery.count.limit=3`))
  p.retriesIn = produce(`${BS} --topic retries`, ['job-1', 'job-2'])
  p.release = t('--release gives every record back: it is delivered again, until the limit', cli(`kafka-console-share-consumer.sh ${BS} --topic retries --group releaser --release --timeout-ms 8000 ${fmt}`))
  p.release.out = p.release.out.split('\n').filter((l) => /^Offset:/.test(l)).join('\n')
  p.releaseOffsets = await until(`kafka-share-groups.sh ${BS} --describe --group releaser --offsets`, /retries\s+0\s+\d+\s+0/, 60000)

  // reject
  cli(`kafka-topics.sh ${BS} --create --topic bad-jobs --partitions 1 --replication-factor 1`)
  cli(`kafka-configs.sh ${BS} --alter --entity-type groups --entity-name rejecter --add-config share.auto.offset.reset=earliest`)
  p.rejectIn = produce(`${BS} --topic bad-jobs`, ['job-1', 'job-2'])
  p.reject = t('--reject: each record is delivered once and never again', cli(`kafka-console-share-consumer.sh ${BS} --topic bad-jobs --group rejecter --reject --timeout-ms 6000 ${fmt}`))
  p.reject.out = p.reject.out.split('\n').filter((l) => /^Offset:/.test(l)).join('\n')
  p.rejectAgain = t('a second consumer in the same group: nothing left to deliver', cli(`kafka-console-share-consumer.sh ${BS} --topic bad-jobs --group rejecter --timeout-ms 6000 ${fmt}`))
  p.rejectAgain.out = p.rejectAgain.out.split('\n').filter((l) => /^Offset:|Processed a total/.test(l)).join('\n')

  // Java: two workers, explicit acknowledgement, a slow job whose lock expires
  // workers keeps share.auto.offset.reset=latest: it only sees jobs produced after it started, not the CLI's job-1…9
  p.javaConfig = t('the group the Java workers use: 15 s locks (the minimum), three deliveries', cli(`kafka-configs.sh ${BS} --alter --entity-type groups --entity-name workers --add-config share.record.lock.duration.ms=15000,share.delivery.count.limit=3`))
  const w1 = java('ShareWorker', ['worker-1', '30'], 'worker-1')
  const w2 = java('ShareWorker', ['worker-2', '30'], 'worker-2')
  p.javaMembers = await until(`kafka-share-groups.sh ${BS} --describe --group workers --members`, [/worker-1.*jobs:0/, /worker-2.*jobs:0/], 40000)
  p.javaMembers = members3(p.javaMembers, ['worker-1', 'worker-2'])
  await sleep(3000)
  const t0 = Date.now()
  const javaJobs = ['slow-10', 'job-11', 'retry-12', 'poison-13', 'job-14']
  cli(`kafka-console-producer.sh ${BS} --topic jobs`, { input: javaJobs.join('\n') + '\n' })
  p.javaProduced = { cmd: shown(`kafka-console-producer.sh ${BS} --topic jobs`), typed: javaJobs, at: 0 }
  // retry-12 is released until the limit (3 deliveries); slow-10's first attempt outlives its 15 s lock, so it is
  // delivered again to the other worker, and the first worker's late acknowledgement is refused
  await Promise.all([w1.exited, w2.exited])
  const rel = (w) => w.lines.filter((l) => l.at >= t0 - 200).map((l) => ({ at: Math.max(0, Math.round((l.at - t0) / 100) / 10), line: l.line }))
  p.workers = [{ name: 'worker-1', cmd: w1.cmd, lines: rel(w1) }, { name: 'worker-2', cmd: w2.cmd, lines: rel(w2) }]
  p.javaOffsets = cli(`kafka-share-groups.sh ${BS} --describe --group workers --offsets`)
  data.share = p
}

function members3(r, names) {
  // keep the header and the rows of the named members, sorted by name
  const [head, ...rows] = r.out.split('\n').filter((l) => l.trim())
  return { ...r, out: [head, ...rows.filter((l) => names.some((n) => l.includes(n))).sort((a, b) => names.findIndex((n) => a.includes(n)) - names.findIndex((n) => b.includes(n)))].join('\n') }
}

// ------------------------------------------------------------------ write
const json = JSON.stringify(data, null, 2)
const user = userInfo().username
if (json.includes(homedir()) || new RegExp(`\\b${user}\\b`).test(json)) throw new Error('recording contains the user name or home directory')
if (json.includes(String(PORT))) throw new Error('recording still contains the capture port')
writeFileSync(outFile, `// Recorded by tools/kafka-capture/capture-more.mjs against ${IMAGE} — do not edit by hand.\n// Ports are shown as the standard 9092; Kafka's random ids are shortened.\nexport const MORE = ${json} as const\n`)
console.log('wrote', outFile)
