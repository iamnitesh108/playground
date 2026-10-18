// Records the "Segments: the log on disk" lesson against a real Kafka: the files of a partition
// directory, how they roll, what the index files hold, how an offset is found, and retention.
//   node capture-segments.mjs ../../src/modules/kafka/data/segments.ts
// Uses its own container (kafka-segments) and ports (19892/19893), so it can run beside the other scripts.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { userInfo, homedir } from 'node:os'
import { IMAGE, sleep } from './lib/lab.mjs'
import { SegmentedLog } from '../../src/modules/kafka/simulation/segmentedLog.ts'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-segments.mjs <out.ts>')

const CONTAINER = 'kafka-segments'
const PORT = 19892
const BIN = '/opt/kafka/bin/'
const BS = `--bootstrap-server localhost:${PORT}`
const DIR = '/tmp/kafka-logs'

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
    // check retention every second instead of every 5 minutes, so the deletion step is quick
    '-e', 'KAFKA_LOG_RETENTION_CHECK_INTERVAL_MS=1000',
    IMAGE], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { execFileSync('podman', ['exec', CONTAINER, BIN + 'kafka-topics.sh', ...BS.split(' '), '--list'], { stdio: 'ignore' }); return } catch {}
    await sleep(1000)
  }
  throw new Error('broker did not start')
}

// ------------------------------------------------------------------ sanitising
const shown = (s) => s.replaceAll(String(PORT + 1), '9093').replaceAll(String(PORT), '9092').replaceAll(BIN, '')
const NOISE = /^\s+at |^\s*\.\.\. \d+ more|is deprecated and will be removed/
const clean = (s) => shown(s).split('\n').filter((l) => !NOISE.test(l)).join('\n').trimEnd()

// ------------------------------------------------------------------ running things
/** One command inside the container (a Kafka tool, or ls): { cmd, out } with the command as the reader types it. */
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
const ls = (topicDir) => run(`ls -l ${DIR}/${topicDir}`)
const file = (topicDir, base, ext) => `${DIR}/${topicDir}/${String(base).padStart(20, '0')}.${ext}`
const dump = (path, extra = '') => run(`kafka-dump-log.sh --files ${path}${extra}`)
const produce = (topic, lines) => {
  const r = run(`kafka-console-producer.sh ${BS} --topic ${topic}`, { input: lines.join('\n') + '\n' })
  return { cmd: r.cmd, out: [lines.map((l) => '> ' + l).join('\n'), r.out].filter(Boolean).join('\n') }
}
/** Keeps the fields of a kafka-dump-log batch line a reader needs; the others (crc, producer ids, …) are left out. */
const BATCH_FIELDS = ['baseOffset', 'lastOffset', 'count', 'position', 'CreateTime', 'size']
const batchLine = (l) => BATCH_FIELDS.map((f) => (l.match(new RegExp(`(?:^|\\s)(${f}: \\S+)`)) ?? [])[1]).filter(Boolean).join(' ')
const trimBatches = (r, pick) => ({
  cmd: r.cmd,
  out: r.out.split('\n').filter((l) => !l.startsWith('baseOffset') || pick(l)).map((l) => (l.startsWith('baseOffset') ? batchLine(l) : l)).join('\n'),
})
/** Every "offset: N position: P" entry of an offset index dump. */
const indexEntries = (out) => [...out.matchAll(/offset: (\d+) position: (\d+)/g)].map((m) => ({ offset: Number(m[1]), position: Number(m[2]) }))
/** Every batch of a log dump: base and last offset, byte position and size. */
const batches = (out) => out.split('\n').filter((l) => l.startsWith('baseOffset')).map((l) => {
  const n = (f) => Number(l.match(new RegExp(`${f}: (\\d+)`))[1])
  return { base: n('baseOffset'), last: n('lastOffset'), position: n('position'), size: n('size') }
})
/** "name size" pairs of the segment files in an ls -l listing. */
const files = (out) => out.split('\n').map((l) => l.trim().split(/\s+/)).filter((c) => c.length >= 9).map((c) => ({ name: c.at(-1), size: Number(c[4]) }))
const check = (ok, what) => { if (!ok) throw new Error('check failed: ' + what) }

await freshBroker()
const data = { image: IMAGE, version: run('kafka-topics.sh --version').out.split(' ')[0] }

// ================================================================== a new partition directory
const SEGMENT = 1048576
const RECORDS = 3000
const SIZE = 1000
{
  const s = {}
  s.create = t('one partition, segments of 1 MiB (the smallest allowed) instead of 1 GiB', run(`kafka-topics.sh ${BS} --create --topic payments --partitions 1 --replication-factor 1 --config segment.bytes=${SEGMENT}`))
  s.tooSmall = t('smaller is refused', run(`kafka-topics.sh ${BS} --create --topic tiny --partitions 1 --replication-factor 1 --config segment.bytes=4096`))
  s.tooSmall.out = s.tooSmall.out.split('\n').find((l) => /Invalid value/.test(l)) ?? s.tooSmall.out
  s.empty = t('right after creating it', ls('payments-0'))
  s.write = t(`${RECORDS} records of ${SIZE} bytes`, run(`kafka-producer-perf-test.sh ${BS} --topic payments --num-records ${RECORDS} --record-size ${SIZE} --throughput -1 --command-property linger.ms=5`))
  s.write.out = s.write.out.split('\n').filter((l) => /records sent/.test(l)).at(-1)
  s.full = t('after writing ~3 MB', ls('payments-0'))
  s.offsets = [
    t('earliest offset still stored (log start offset)', run(`kafka-get-offsets.sh ${BS} --topic payments --time -2`)),
    t('next offset to be written (log end offset)', run(`kafka-get-offsets.sh ${BS} --topic payments --time -1`)),
  ]
  data.dir = s
}
const SEGMENTS = files(data.dir.full.out).filter((f) => f.name.endsWith('.log')).map((f) => ({ base: Number(f.name.slice(0, 20)), size: f.size }))
check(SEGMENTS.length >= 3, 'the writes rolled at least two segments')
check(files(data.dir.empty.out).some((f) => f.name.endsWith('.index') && f.size === 10485760), 'a new index is preallocated to 10 MB')

// ================================================================== what the files hold
{
  const f = {}
  const log0 = dump(file('payments-0', 0, 'log'))
  const all0 = batches(log0.out)
  f.log = t('the batches in the first segment (fields shortened)', trimBatches(log0, (l) => all0.slice(0, 3).some((b) => l.startsWith(`baseOffset: ${b.base} `))))
  f.log.out += `\n… ${all0.length - 3} more batches, the last one ends at offset ${all0.at(-1).last}`
  const idx0 = dump(file('payments-0', 0, 'index'))
  const entries0 = indexEntries(idx0.out)
  f.index = t('its offset index: one entry per ~4 KB of log', { cmd: idx0.cmd, out: idx0.out.split('\n').slice(0, 5).join('\n') + `\n… ${entries0.length - 4} more entries` })
  const tidx0 = dump(file('payments-0', 0, 'timeindex'))
  f.timeindex = t('its time index: timestamp → offset', { cmd: tidx0.cmd, out: tidx0.out.split('\n').slice(0, 4).join('\n') + '\n…' })
  f.counts = { batches: all0.length, entries: entries0.length, indexBytes: files(data.dir.full.out).find((x) => x.name === '00000000000000000000.index').size }
  check(f.counts.indexBytes === entries0.length * 8, 'an offset index entry is 8 bytes')
  // the lesson's TS model, fed the recorded batches, must build the same index and roll at the same offset
  const model = new SegmentedLog({ segmentBytes: SEGMENT, segmentMs: Infinity, indexIntervalBytes: 4096 })
  for (const b of all0) model.append(b.last - b.base + 1, b.size, 0)
  check(JSON.stringify(model.active.index) === JSON.stringify(entries0), 'the TS model builds the same offset index')
  model.append(all0[0].last - all0[0].base + 1, all0[0].size, 0)
  check(model.active.base === SEGMENTS[1].base, 'the TS model rolls at the same offset')
  data.files = f
}

// ================================================================== finding offset 1500
{
  const TARGET = 1500
  const seg = SEGMENTS.filter((s) => s.base <= TARGET).at(-1)
  const idx = dump(file('payments-0', seg.base, 'index'))
  const entries = indexEntries(idx.out)
  const hit = entries.filter((e) => e.offset <= TARGET).at(-1)
  const near = entries.filter((e) => Math.abs(e.offset - TARGET) <= 40)
  const log = dump(file('payments-0', seg.base, 'log'))
  const all = batches(log.out)
  const scanned = all.filter((b) => b.position >= hit.position && b.base <= TARGET)
  check(scanned.at(-1).last >= TARGET, 'the scan reaches the target')
  data.lookup = {
    target: TARGET,
    segment: seg.base,
    segments: SEGMENTS.map((s) => s.base),
    entry: hit,
    scanned,
    index: t(`entries of segment ${seg.base} near offset ${TARGET}`, { cmd: idx.cmd, out: ['Dumping ' + file('payments-0', seg.base, 'index'), '…', ...near.map((e) => `offset: ${e.offset} position: ${e.position}`), '…'].join('\n') }),
    log: t('the batches from that position on', trimBatches(log, (l) => all.filter((b) => b.position >= hit.position).slice(0, 2).some((b) => l.startsWith(`baseOffset: ${b.base} `)))),
    read: t(`a consumer asking for offset ${TARGET}`, run(`kafka-console-consumer.sh ${BS} --topic payments --partition 0 --offset ${TARGET} --max-messages 2 --formatter-property print.offset=true --formatter-property print.value=false`)),
  }
  data.lookup.log.out = data.lookup.log.out.split('\n').filter((l) => !/^Log starting/.test(l)).join('\n') + '\n…'
  data.lookup.read.out = data.lookup.read.out.split('\n').filter((l) => !/^Processed/.test(l)).join('\n')
}

// ================================================================== rolling by time: only when a record arrives
{
  const r = {}
  r.create = t('segments roll after 10 seconds instead of 7 days', run(`kafka-topics.sh ${BS} --create --topic clicks --partitions 1 --replication-factor 1 --config segment.ms=10000`))
  r.first = t('three records', produce('clicks', ['click-1', 'click-2', 'click-3']))
  r.ls1 = t('one segment', ls('clicks-0'))
  await sleep(13000)
  r.ls2 = t('13 seconds later, nothing written in between', ls('clicks-0'))
  r.second = t('two more records', produce('clicks', ['click-4', 'click-5']))
  await sleep(1000)
  r.ls3 = t('the old segment was closed by the write, a new one holds offset 3 onwards', ls('clicks-0'))
  const logs = (s) => files(s.out).filter((f) => f.name.endsWith('.log')).length
  check(logs(r.ls1) === 1 && logs(r.ls2) === 1 && logs(r.ls3) === 2, 'segment.ms rolls on the next append')
  data.timeRoll = r
}

// ================================================================== retention deletes whole segments
{
  const d = {}
  const MORE = 600
  d.more = t(`${MORE} new records: they fill the last segment and roll a new one`, run(`kafka-producer-perf-test.sh ${BS} --topic payments --num-records ${MORE} --record-size ${SIZE} --throughput -1 --command-property linger.ms=5`))
  d.more.out = d.more.out.split('\n').filter((l) => /records sent/.test(l)).at(-1)
  d.before = t('the first two segments hold only old records, the third old and new ones', ls('payments-0'))
  d.alter = t('keep records for 10 seconds (the first 3000 are older than that, the new ones are not)', run(`kafka-configs.sh ${BS} --alter --entity-type topics --entity-name payments --add-config retention.ms=10000`))
  await sleep(4000)
  d.after = t('4 seconds later', ls('payments-0'))
  d.start = t('the log start offset moved', run(`kafka-get-offsets.sh ${BS} --topic payments --time -2`))
  d.end = t('the log end offset did not', run(`kafka-get-offsets.sh ${BS} --topic payments --time -1`))
  d.read = t('reading from the beginning now starts at the new log start offset', run(`kafka-console-consumer.sh ${BS} --topic payments --partition 0 --from-beginning --max-messages 1 --timeout-ms 10000 --formatter-property print.offset=true --formatter-property print.value=false`))
  d.read.out = d.read.out.split('\n').filter((l) => /^Offset/.test(l)).join('\n')
  const deleted = (out) => files(out).filter((f) => f.name.endsWith('.log.deleted')).map((f) => Number(f.name.slice(0, 20)))
  const live = (out) => files(out).filter((f) => f.name.endsWith('.log')).map((f) => Number(f.name.slice(0, 20)))
  check(deleted(d.after.out).join() === '0,1024', 'only the segments whose newest record expired are deleted')
  check(live(d.after.out)[0] === 2048 && d.start.out.endsWith(':2048'), 'the mixed segment stays and the log starts at its base offset')
  check(d.end.out.endsWith(`:${RECORDS + MORE}`), 'the log end offset is unchanged')
  await sleep(12000)
  d.allExpired = t('12 seconds later every record is older than 10 seconds', ls('payments-0'))
  d.allStart = t('nothing left to read: the log start offset is now the log end offset', run(`kafka-get-offsets.sh ${BS} --topic payments --time -2`))
  check(live(d.allExpired.out).join() === String(RECORDS + MORE), 'all expired: a new empty segment was rolled and the old active one deleted')
  data.retention = d
}

// ------------------------------------------------------------------ write
const json = JSON.stringify(data, null, 2)
const user = userInfo().username
if (json.includes(homedir()) || new RegExp(`\\b${user}\\b`).test(json)) throw new Error('recording contains the user name or home directory')
if (json.includes(String(PORT))) throw new Error('recording still contains the capture port')
writeFileSync(outFile, `// Recorded by tools/kafka-capture/capture-segments.mjs against ${IMAGE} — do not edit by hand.\n// Ports are shown as the standard 9092.\nexport const SEGMENTS = ${json} as const\n`)
console.log('wrote', outFile)
