// Records the three practicals against a real Kafka, with the CLI and with the Micronaut app.
//   node capture.mjs ../../src/modules/kafka/data/practicals.ts
import { writeFileSync } from 'node:fs'
import { alignAll } from './lib/table.mjs'
import { userInfo, homedir } from 'node:os'
import { BS, IMAGE, appConsumer, appLines, appProduce, cli, consoleConsumer, consoleProduce, shown, sleep, startBroker, stopBroker, waitForBroker, waitForGroup } from './lib/lab.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture.mjs <out.ts>')
process.on('exit', stopBroker)
process.on('SIGINT', () => process.exit(130))

const t = (label, step) => ({ label, ...step })
const consumerOut = (c, from = 0) => c.since(from).filter((l) => /^(Partition|Offset):|Processed a total/.test(l))
/** Each practical starts on an empty broker, so groups and topics never leak between them. */
async function freshBroker() {
  stopBroker()
  startBroker()
  await waitForBroker()
}
const members = (r) => ({ ...r, out: r.out.replace(/console-consumer-[0-9a-f-]{36}/g, (m) => m.slice(0, 25) + '…').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (m) => m.slice(0, 8) + '…') })

await freshBroker()
const data = { image: IMAGE, version: cli('kafka-topics.sh --version').out.split(' ')[0] }

// ---------------------------------------------------------------- Practical 1
{
  const p = { cli: [], app: {} }
  p.cli.push(t('create a topic with one partition', cli(`kafka-topics.sh ${BS} --create --topic greetings --partitions 1 --replication-factor 1`)))
  p.cli.push(t('describe it', cli(`kafka-topics.sh ${BS} --describe --topic greetings`)))
  const prod = consoleProduce(`${BS} --topic greetings`, ['hello', 'from', 'kafka'])
  p.cli.push(t('produce three messages (typed, then Ctrl-D)', { cmd: prod.cmd, out: '> hello\n> from\n> kafka', typed: ['hello', 'from', 'kafka'] }))
  p.cli.push(t('read everything from the beginning', cli(`kafka-console-consumer.sh ${BS} --topic greetings --from-beginning --timeout-ms 5000 --formatter-property print.offset=true --formatter-property print.partition=true`)))
  p.cli.push(t('read again: the same three — reading does not remove anything', cli(`kafka-console-consumer.sh ${BS} --topic greetings --from-beginning --timeout-ms 5000`)))
  // live: a consumer waits, a producer sends
  const live = consoleConsumer('live', `${BS} --topic greetings --command-property client.id=live --formatter-property print.offset=true`)
  await sleep(4000)
  const send = consoleProduce(`${BS} --topic greetings`, ['a new message'])
  await live.waitFor(/a new message/)
  p.liveConsumer = { cmd: live.cmd, out: consumerOut(live) }
  p.liveProducer = { cmd: send.cmd, typed: ['a new message'] }
  await live.stop()
  p.cli.push(t('the consumer without --from-beginning only saw new messages; every console consumer joined a generated group', cli(`kafka-consumer-groups.sh ${BS} --list`)))
  // the same with the app
  cli(`kafka-topics.sh ${BS} --create --topic orders-p1 --partitions 1 --replication-factor 1`)
  p.app.producer = await appProduce('orders-p1', 3, 1001)
  const app = appConsumer('app-1', 'orders-p1', 'billing')
  await app.waitFor(/received partition=0 offset=2 /, 60000)
  await sleep(500)
  p.app.consumer = appLines(app)
  // Micronaut commits automatically every 5 s (enable.auto.commit): wait for that commit before describing
  for (let i = 0; i < 40; i++) {
    p.app.describe = cli(`kafka-consumer-groups.sh ${BS} --describe --group billing`)
    if (/orders-p1\s+0\s+3\s+3\s+0/.test(p.app.describe.out)) break
    await sleep(500)
  }
  await app.stop()
  data.p1 = p
}

// ---------------------------------------------------------------- Practical 2
{
  await freshBroker()
  const p = { cli: [], stages: [], app: {} }
  p.cli.push(t('a topic with three partitions', cli(`kafka-topics.sh ${BS} --create --topic orders --partitions 3 --replication-factor 1`)))
  p.cli.push(t('describe: one leader per partition', cli(`kafka-topics.sh ${BS} --describe --topic orders`)))
  const keyed = ['alice:order-1001', 'bob:order-1002', 'carol:order-1003', 'dave:order-1004', 'erin:order-1005', 'frank:order-1006']
  const prod = consoleProduce(`${BS} --topic orders --reader-property parse.key=true --reader-property key.separator=:`, keyed)
  p.cli.push(t('produce six keyed messages (key:value)', { cmd: prod.cmd, out: keyed.map((k) => '> ' + k).join('\n'), typed: keyed }))
  p.cli.push(t('where did they land? one read of everything, with partition and key', cli(`kafka-console-consumer.sh ${BS} --topic orders --from-beginning --timeout-ms 5000 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true`)))

  const consumers = []
  const start = async (name) => {
    const c = consoleConsumer(name, `${BS} --topic orders --group billing --from-beginning --command-property client.id=${name} --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true`)
    consumers.push(c)
    const d = await waitForGroup('billing', consumers.length)
    await sleep(1500)
    return { cmd: c.cmd, describe: members(d) }
  }
  p.stages.push({ label: 'one consumer in group billing', ...(await start('c1')), output: {} })
  p.stages[0].output.c1 = consumerOut(consumers[0])
  p.stages.push({ label: 'a second consumer joins the same group', ...(await start('c2')) })
  p.stages.push({ label: 'a third consumer joins', ...(await start('c3')) })
  // new messages now: who prints what?
  const marks = consumers.map((c) => c.lines.length)
  const burst = ['alice:order-1007', 'bob:order-1008', 'carol:order-1009', 'dave:order-1010', 'erin:order-1011', 'frank:order-1012']
  const burstCmd = consoleProduce(`${BS} --topic orders --reader-property parse.key=true --reader-property key.separator=:`, burst)
  await sleep(4000)
  p.burst = { cmd: burstCmd.cmd, typed: burst, outputs: Object.fromEntries(consumers.map((c, i) => [c.name, consumerOut(c, marks[i])])) }
  p.stages.push({ label: 'a fourth consumer: more consumers than partitions', ...(await start('c4')) })
  // stop c2: its partition moves
  await consumers[1].stop()
  consumers.splice(1, 1)
  p.afterStop = { label: 'c2 stops (Ctrl-C): the partitions are dealt out again among c1, c3 and c4', describe: members(await waitForGroup('billing', 3)) }
  p.offsets = cli(`kafka-consumer-groups.sh ${BS} --describe --group billing`)
  for (const c of consumers) await c.stop()

  // the same with three app instances
  cli(`kafka-topics.sh ${BS} --create --topic orders-p2 --partitions 3 --replication-factor 1`)
  const apps = []
  for (const name of ['app-1', 'app-2', 'app-3']) {
    const a = appConsumer(name, 'orders-p2', 'billing-app')
    apps.push(a)
    await a.waitFor(/Adding newly assigned partitions|assignments changed: \[\] -> \[orders/, 60000)
    await waitForGroup('billing-app', apps.length)
    await sleep(1500)
  }
  p.app.assignments = cli(`kafka-consumer-groups.sh ${BS} --describe --group billing-app --members --verbose`)
  const appMarks = apps.map((a) => a.lines.length)
  p.app.producer = await appProduce('orders-p2', 6, 1001)
  await sleep(3000)
  p.app.logs = Object.fromEntries(apps.map((a, i) => [a.name, { startup: appLines(a).filter((l) => !/ received /.test(l)), received: appLines(a, appMarks[i]).filter((l) => / received /.test(l)) }]))
  const fourth = appConsumer('app-4', 'orders-p2', 'billing-app')
  await waitForGroup('billing-app', 4, 60000)
  await sleep(1500)
  p.app.fourth = cli(`kafka-consumer-groups.sh ${BS} --describe --group billing-app --members --verbose`)
  for (const a of [...apps, fourth]) await a.stop()
  data.p2 = p
}

// ---------------------------------------------------------------- Practical 3
{
  await freshBroker()
  const p = { cli: [], app: {} }
  p.cli.push(t('a topic for payments, three partitions', cli(`kafka-topics.sh ${BS} --create --topic payments --partitions 3 --replication-factor 1`)))
  const fmt = '--formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true'
  // all three consumers run before anything is produced: one in billing, two in analytics
  const billing = consoleConsumer('billing-1', `${BS} --topic payments --group billing --from-beginning --command-property client.id=billing-1 ${fmt}`)
  await waitForGroup('billing', 1)
  const a1 = consoleConsumer('analytics-1', `${BS} --topic payments --group analytics --from-beginning --command-property client.id=analytics-1 ${fmt}`)
  await waitForGroup('analytics', 1)
  const a2 = consoleConsumer('analytics-2', `${BS} --topic payments --group analytics --from-beginning --command-property client.id=analytics-2 ${fmt}`)
  await waitForGroup('analytics', 2)
  p.assignedBefore = cli(`kafka-consumer-groups.sh ${BS} --describe --group analytics --members --verbose`)
  const pays = ['alice:pay-1', 'bob:pay-2', 'carol:pay-3', 'dave:pay-4', 'erin:pay-5', 'frank:pay-6']
  const prod = consoleProduce(`${BS} --topic payments --reader-property parse.key=true --reader-property key.separator=:`, pays)
  p.cli.push(t('produce six payments', { cmd: prod.cmd, out: pays.map((k) => '> ' + k).join('\n'), typed: pays }))
  await sleep(4000)
  p.groups = {
    billing: { cmd: billing.cmd, out: consumerOut(billing) },
    'analytics-1': { cmd: a1.cmd, out: consumerOut(a1) },
    'analytics-2': { cmd: a2.cmd, out: consumerOut(a2) },
  }
  p.list = cli(`kafka-consumer-groups.sh ${BS} --list`)
  p.list.out = p.list.out.split('\n').filter((l) => !l.startsWith('console-consumer-')).join('\n')
  p.describeBoth = cli(`kafka-consumer-groups.sh ${BS} --describe --group billing --group analytics`)
  // analytics goes away, more payments arrive: lag
  await a1.stop(); await a2.stop()
  await sleep(1000)
  const more = ['alice:pay-7', 'bob:pay-8', 'carol:pay-9']
  const before = billing.lines.length
  const moreCmd = consoleProduce(`${BS} --topic payments --reader-property parse.key=true --reader-property key.separator=:`, more)
  await sleep(3000)
  p.whileAway = { cmd: moreCmd.cmd, typed: more, billingSaw: consumerOut(billing, before), describe: cli(`kafka-consumer-groups.sh ${BS} --describe --group analytics`) }
  // analytics comes back and catches up
  const back = consoleConsumer('analytics-3', `${BS} --topic payments --group analytics --command-property client.id=analytics-3 ${fmt}`)
  await waitForGroup('analytics', 1)
  await sleep(4000)
  p.caughtUp = { cmd: back.cmd, out: consumerOut(back), describe: cli(`kafka-consumer-groups.sh ${BS} --describe --group analytics`) }
  await back.stop()
  await billing.stop()
  await sleep(1500)
  // replay: reset analytics to the beginning
  p.reset = {
    dryRun: cli(`kafka-consumer-groups.sh ${BS} --group analytics --topic payments --reset-offsets --to-earliest --dry-run`),
    execute: cli(`kafka-consumer-groups.sh ${BS} --group analytics --topic payments --reset-offsets --to-earliest --execute`),
  }
  const replay = consoleConsumer('analytics-4', `${BS} --topic payments --group analytics --command-property client.id=analytics-4 ${fmt}`)
  await waitForGroup('analytics', 1)
  await sleep(4000)
  p.replay = { cmd: replay.cmd, out: consumerOut(replay) }
  await replay.stop()

  // the same with the app: one instance in billing, two in analytics
  cli(`kafka-topics.sh ${BS} --create --topic payments-p3 --partitions 3 --replication-factor 1`)
  const apps = [appConsumer('billing-app-1', 'payments-p3', 'billing-app'), appConsumer('analytics-app-1', 'payments-p3', 'analytics-app'), appConsumer('analytics-app-2', 'payments-p3', 'analytics-app')]
  await waitForGroup('billing-app', 1, 60000)
  await waitForGroup('analytics-app', 2, 60000)
  await sleep(1500)
  const marks = apps.map((a) => a.lines.length)
  p.app.producer = await appProduce('payments-p3', 6, 1)
  await sleep(3000)
  p.app.logs = Object.fromEntries(apps.map((a, i) => [a.name, appLines(a, marks[i]).filter((l) => / received /.test(l))]))
  p.app.describe = cli(`kafka-consumer-groups.sh ${BS} --describe --group billing-app --group analytics-app`)
  for (const a of apps) await a.stop()
  data.p3 = p
}

let json = JSON.stringify(data, null, 1)
for (const secret of [userInfo().username, homedir()]) if (json.includes(secret)) throw new Error(`recording contains "${secret}"`)
// generated member and console group ids are long and random: shorten them everywhere
json = shown(json).replace(/console-consumer-[0-9a-f-]{36}/g, (m) => m.slice(0, 25) + "…").replace(/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "$1…")
json = JSON.stringify(alignAll(JSON.parse(json)), null, 1)
writeFileSync(outFile, `// Recorded with Kafka ${data.version} (${IMAGE}) and the Micronaut orders-app by tools/kafka-capture — do not edit by hand.\n\nexport const PRACTICALS = ${json} as const\n`)
console.log(`wrote ${outFile}`)
process.exit(0)
