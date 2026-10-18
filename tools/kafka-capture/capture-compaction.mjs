// Records the "Log compaction internals" lesson against a real Kafka: a keyed topic written in three rounds
// (three segments), switched to cleanup.policy=compact, cleaned once (tombstone gets its delete horizon),
// then written again and cleaned a second time (superseded records and the expired tombstone go).
//   node capture-compaction.mjs ../../src/modules/kafka/data/compaction.ts
// Uses its own container (kafka-compaction) and ports (20092/20093), so it can run beside the other scripts.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { userInfo, homedir } from 'node:os'
import { IMAGE, sleep } from './lib/lab.mjs'
import { CompactedLog } from '../../src/modules/kafka/simulation/logCompactor.ts'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-compaction.mjs <out.ts>')

const CONTAINER = 'kafka-compaction'
const PORT = 20092
const BIN = '/opt/kafka/bin/'
const BS = `--bootstrap-server localhost:${PORT}`
const DIR = '/tmp/kafka-logs'
const TOPIC = 'profiles'
const DELETE_RETENTION_MS = 5000
const SEGMENT_MS = 2000

// ------------------------------------------------------------------ broker
function stopBroker() {
  try { execFileSync('podman', ['rm', '-f', '-v', CONTAINER], { stdio: 'ignore' }) } catch {}
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
    '-e', 'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1',
    // look for logs to clean every second instead of every 15 seconds (log.cleaner.backoff.ms)
    '-e', 'KAFKA_LOG_CLEANER_BACKOFF_MS=1000',
    IMAGE], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { execFileSync('podman', ['exec', CONTAINER, BIN + 'kafka-topics.sh', ...BS.split(' '), '--list'], { stdio: 'ignore' }); return } catch {}
    await sleep(1000)
  }
  throw new Error('broker did not start')
}

// ------------------------------------------------------------------ sanitising and running
const shown = (s) => s.replaceAll(String(PORT + 1), '9093').replaceAll(String(PORT), '9092').replaceAll(BIN, '')
const NOISE = /^\s+at |^\s*\.\.\. \d+ more|is deprecated and will be removed/
/** Kafka's 22-character random ids (topic ids): the first 6 characters are enough. */
const shortIds = (s) => s.replace(/(?<=topicId=)([A-Za-z0-9_-]{22})/g, (m) => m.slice(0, 6) + '…')
const clean = (s) => shortIds(shown(s)).split('\n').filter((l) => !NOISE.test(l)).join('\n').trimEnd()

/** One command inside the container (a Kafka tool, ls or cat): { cmd, out } with the command as the reader types it. */
function run(cmd, { input } = {}) {
  const args = cmd.split(' ')
  const exe = args[0].endsWith('.sh') ? BIN + args[0] : args[0]
  let out = ''
  try {
    out = execFileSync('podman', ['exec', '-i', CONTAINER, exe, ...args.slice(1)], { input, stdio: ['pipe', 'pipe', 'pipe'] }).toString()
  } catch (e) {
    out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  }
  return { cmd: shown(cmd), out: clean(out) }
}
const t = (label, step) => ({ label, ...step })
const check = (ok, what) => { if (!ok) throw new Error('check failed: ' + what) }
const start = Date.now()
const since = () => Date.now() - start

/** Keyed lines "key:value" (NULL = tombstone) through the console producer; shown as typed at its > prompt. */
const PRODUCE = `kafka-console-producer.sh ${BS} --topic ${TOPIC} --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL`
const produce = (lines) => {
  const r = run(PRODUCE, { input: lines.join('\n') + '\n' })
  return { cmd: r.cmd, out: [lines.map((l) => '> ' + l).join('\n'), r.out].filter(Boolean).join('\n') }
}
const READ = `kafka-console-consumer.sh ${BS} --topic ${TOPIC} --from-beginning --timeout-ms 4000 --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.value=true`
const read = () => {
  const r = run(READ)
  return { cmd: r.cmd, out: r.out.split('\n').filter((l) => /^Offset:/.test(l)).join('\n') }
}
/** "Offset:3	user-1	Anna" → offsets the consumer saw. */
const offsetsRead = (out) => out.split('\n').filter(Boolean).map((l) => Number(/Offset:(\d+)/.exec(l)[1]))

const ls = () => run(`ls -l ${DIR}/${TOPIC}-0`)
const logFiles = (out) => out.split('\n').map((l) => l.trim().split(/\s+/).at(-1)).filter((f) => /^\d{20}\.log$/.test(f))
/** kafka-dump-log --print-data-log of every live .log, shortened to the fields the lesson uses. */
function dumpAll(out) {
  const steps = []
  for (const f of logFiles(out)) {
    const r = run(`kafka-dump-log.sh --files ${DIR}/${TOPIC}-0/${f} --print-data-log`)
    const lines = r.out.split('\n').flatMap((l) => {
      if (l.startsWith('baseOffset')) {
        const pick = ['baseOffset', 'lastOffset', 'count', 'deleteHorizonMs'].map((k) => (l.match(new RegExp(`(?:^|\\s)(${k}: \\S+)`)) ?? [])[1]).filter(Boolean)
        return ['batch ' + pick.join(' ')]
      }
      if (/^\| offset/.test(l)) {
        const pick = ['offset', 'key', 'payload'].map((k) => (l.match(new RegExp(`(?:^|\\s)(${k}: \\S*)`)) ?? [])[1]).filter(Boolean)
        return ['  | ' + pick.join(' ')]
      }
      return /^Dumping/.test(l) ? [l] : []
    })
    steps.push({ cmd: r.cmd, out: lines.join('\n') })
  }
  return steps
}
const checkpoint = () => run(`cat ${DIR}/cleaner-offset-checkpoint`)
/** Polls the cleaner checkpoint until it records `offset` for the topic. */
async function cleanedTo(offset, timeoutMs = 60000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (new RegExp(`^${TOPIC} 0 ${offset}$`, 'm').test(checkpoint().out)) return since()
    await sleep(250)
  }
  throw new Error(`cleaner never reached ${offset}:\n${checkpoint().out}`)
}
/** The log cleaner's own log lines about the topic, without their timestamps. */
function cleanerLog() {
  let text = ''
  try { text = execFileSync('podman', ['exec', CONTAINER, 'cat', '/opt/kafka/logs/log-cleaner.log'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString() } catch {}
  if (!text.trim()) text = execFileSync('podman', ['logs', CONTAINER], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  return clean(text.split('\n').filter((l) => /Cleaner|cleaner|cleaning|Cleaning|Buffer utilization|log processed|Indexed|Cleaned|Start size|End size|reduction/.test(l)).filter((l) => l.trim()).map((l) => l.replace(/^\[[^\]]+\] /, '').replace(/ \(kafka\.log\.LogCleaner\)| \(org\.apache\.kafka\.storage\.internals\.log\.\w+\)/, '')).join('\n'))
}

await freshBroker()
const data = { image: IMAGE, version: run('kafka-topics.sh --version').out.split(' ')[0], deleteRetentionMs: DELETE_RETENTION_MS, segmentMs: SEGMENT_MS }
const ROUNDS = [
  ['user-1:Ann', 'user-2:Ben', 'user-3:Cat'],
  ['user-1:Anna', 'user-2:NULL', 'user-4:Dan'],
  ['user-1:Annie', 'user-5:Eve'],
]
const LATER = ['user-3:Cathy']
const times = {}

// ================================================================== written as a normal (delete) topic: nothing is cleaned
data.create = t(`one partition; a new segment every ${SEGMENT_MS / 1000} s (on the next write)`, run(`kafka-topics.sh ${BS} --create --topic ${TOPIC} --partitions 1 --replication-factor 1 --config segment.ms=${SEGMENT_MS}`))
data.rounds = []
for (const [i, lines] of ROUNDS.entries()) {
  if (i) await sleep(SEGMENT_MS + 500)
  times[`round${i + 1}`] = since()
  data.rounds.push(t(`round ${i + 1}${i === 1 ? ': NULL is a tombstone (a null value)' : ''}`, produce(lines)))
}
await sleep(1000)
data.before = { ls: t('three segments; the last is active', ls()), read: t('a consumer reads every record', read()) }
data.before.dumps = dumpAll(data.before.ls.out)
check(logFiles(data.before.ls.out).length === 3, 'three segments before cleaning')
check(offsetsRead(data.before.read.out).join() === '0,1,2,3,4,5,6,7', 'all records before cleaning')

// ================================================================== switch to compact: the first cleaning
data.alter = t('turn on compaction; clean as soon as anything is dirty; keep tombstones 5 s after their first cleaning', run(`kafka-configs.sh ${BS} --alter --entity-type topics --entity-name ${TOPIC} --add-config cleanup.policy=compact,min.cleanable.dirty.ratio=0.01,delete.retention.ms=${DELETE_RETENTION_MS}`))
times.clean1 = await cleanedTo(6)
await sleep(500)
data.first = { checkpoint: t('the cleaner checkpoint: cleaned up to offset 6 (the active segment)', checkpoint()), ls: t('after the first cleaning', ls()), read: t('what a consumer reads now', read()) }
data.first.dumps = dumpAll(data.first.ls.out)

// ================================================================== the tombstone's horizon passes; new data; the second cleaning
await sleep(DELETE_RETENTION_MS + 3000)
times.round4 = since()
data.later = t('one more update; it rolls the active segment, which makes offsets 6–7 dirty', produce(LATER))
times.clean2 = await cleanedTo(8)
await sleep(500)
data.second = { checkpoint: t('cleaned up to offset 8', checkpoint()), ls: t('after the second cleaning', ls()), read: t('what a consumer reads now', read()) }
data.second.dumps = dumpAll(data.second.ls.out)
data.cleanerLog = cleanerLog()
data.times = times

// ------------------------------------------------------------------ the lesson's model must agree with the broker
{
  const model = new CompactedLog({ deleteRetentionMs: DELETE_RETENTION_MS, segmentSize: Number.MAX_SAFE_INTEGER, minCleanableRatio: 0.01 })
  for (const [i, lines] of ROUNDS.entries()) {
    if (i) model.roll()
    for (const l of lines) { const [k, v] = l.split(':'); model.append(k, v === 'NULL' ? null : v, times[`round${i + 1}`]) }
  }
  model.clean(times.clean1)
  check(model.read().map((r) => r.offset).join() === offsetsRead(data.first.read.out).join(), `model after the first cleaning: ${model.read().map((r) => r.offset)} vs ${offsetsRead(data.first.read.out)}`)
  model.roll()
  for (const l of LATER) { const [k, v] = l.split(':'); model.append(k, v, times.round4) }
  model.clean(times.clean2)
  check(model.read().map((r) => r.offset).join() === offsetsRead(data.second.read.out).join(), `model after the second cleaning: ${model.read().map((r) => r.offset)} vs ${offsetsRead(data.second.read.out)}`)
  check(/deleteHorizonMs: OptionalLong\[/.test(data.first.dumps.map((d) => d.out).join('\n')), 'the first cleaning set a delete horizon on the tombstone batch')
}

// ------------------------------------------------------------------ write
const json = JSON.stringify(data, null, 2)
const user = userInfo().username
if (json.includes(homedir()) || new RegExp(`\\b${user}\\b`).test(json)) throw new Error('recording contains the user name or home directory')
if (json.includes(String(PORT))) throw new Error('recording still contains the capture port')
writeFileSync(outFile, `// Recorded by tools/kafka-capture/capture-compaction.mjs against ${IMAGE} — do not edit by hand.\n// Ports are shown as the standard 9092; times are ms since the run started.\nexport const COMPACTION = ${json} as const\n`)
console.log('wrote', outFile)
