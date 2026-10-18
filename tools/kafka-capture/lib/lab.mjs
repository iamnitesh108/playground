// A throwaway single-node Kafka (KRaft) in a container, the CLI tools inside it,
// and the Micronaut orders-app — everything the practicals need, recorded.
import { spawn, execFileSync } from 'node:child_process'

export const IMAGE = 'docker.io/apache/kafka:4.3.1'
export const CONTAINER = 'kafka-practicals'
const PORT = 19092
const BIN = '/opt/kafka/bin/'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** What the reader types: the standard port, no install path. */
export const shown = (cmd) => cmd.replaceAll(String(PORT), '9092')

export function startBroker() {
  try { execFileSync('podman', ['rm', '-f', CONTAINER], { stdio: 'ignore' }) } catch {}
  execFileSync('podman', ['run', '-d', '--name', CONTAINER, '--network', 'host',
    '-e', 'KAFKA_NODE_ID=1', '-e', 'KAFKA_PROCESS_ROLES=broker,controller',
    '-e', `KAFKA_LISTENERS=PLAINTEXT://localhost:${PORT},CONTROLLER://localhost:${PORT + 1}`,
    '-e', `KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:${PORT}`,
    '-e', 'KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER',
    '-e', 'KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
    '-e', `KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:${PORT + 1}`,
    '-e', 'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1', '-e', 'KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0',
    IMAGE], { stdio: 'ignore' })
}

export function stopBroker() {
  try { execFileSync('podman', ['rm', '-f', CONTAINER], { stdio: 'ignore' }) } catch {}
}

/** The informational banner Kafka 4.x tools print about KIP-848; not part of the command's result. */
const NOISE = /consumer rebalance protocol \(KIP-848\) is production-ready/

/** Runs one CLI command in the container; returns { cmd, out } with the command as the reader types it. */
export function cli(cmd, { input } = {}) {
  const args = cmd.split(' ')
  let out = ''
  try {
    out = execFileSync('podman', ['exec', '-i', CONTAINER, BIN + args[0], ...args.slice(1)], { input, stdio: ['pipe', 'pipe', 'pipe'] }).toString()
  } catch (e) {
    out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  }
  return { cmd: shown(cmd), out: out.split('\n').filter((l) => !NOISE.test(l)).join('\n').trimEnd() }
}

export async function waitForBroker() {
  for (let i = 0; i < 60; i++) {
    if (!cli(`kafka-topics.sh --bootstrap-server localhost:${PORT} --list`).out.includes('Exception')) {
      try { execFileSync('podman', ['exec', CONTAINER, BIN + 'kafka-topics.sh', '--bootstrap-server', `localhost:${PORT}`, '--list'], { stdio: 'ignore' }); return } catch {}
    }
    await sleep(1000)
  }
  throw new Error('broker did not start')
}

export const BS = `--bootstrap-server localhost:${PORT}`

/**
 * A long-running process (a console consumer, or an app instance) whose output lines are kept with
 * the time they arrived. stop() ends it like Ctrl-C.
 */
export class Running {
  constructor(name, command, args, env = {}) {
    this.name = name
    this.lines = []
    this.t0 = Date.now()
    this.proc = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
    const keep = (l) => { if (l.trim() && !NOISE.test(l)) this.lines.push({ at: Date.now(), line: l }) }
    // output arrives in chunks that can end mid-line: hold the unfinished tail until its newline comes
    for (const stream of [this.proc.stdout, this.proc.stderr]) {
      let tail = ''
      stream.on('data', (d) => {
        const parts = (tail + d.toString()).split('\n')
        tail = parts.pop()
        parts.forEach(keep)
      })
      stream.on('end', () => keep(tail))
    }
    this.exited = new Promise((r) => this.proc.on('exit', r))
  }

  /** Lines since index `from`. */
  since(from) { return this.lines.slice(from).map((l) => l.line) }

  async waitFor(re, timeoutMs = 30000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (this.lines.some((l) => re.test(l.line))) return
      await sleep(100)
    }
    throw new Error(`${this.name}: timed out waiting for ${re}`)
  }

  async stop(signal = 'SIGINT') {
    this.proc.kill(signal)
    await Promise.race([this.exited, sleep(15000)])
  }
}

/** A console consumer started inside the container. `pkill` inside the container ends it cleanly. */
export function consoleConsumer(name, argsLine) {
  const args = argsLine.split(' ')
  const r = new Running(name, 'podman', ['exec', '-i', CONTAINER, BIN + 'kafka-console-consumer.sh', ...args])
  r.cmd = shown(`kafka-console-consumer.sh ${argsLine}`)
  r.stop = async () => {
    // Ctrl-C inside the container: SIGINT the java process whose command line carries this consumer's marker
    try { execFileSync('podman', ['exec', CONTAINER, 'pkill', '-INT', '-f', `client.id=${name}`]) } catch {}
    await Promise.race([r.exited, sleep(15000)])
  }
  return r
}

export function consoleProduce(argsLine, lines) {
  return cli(`kafka-console-producer.sh ${argsLine}`, { input: lines.join('\n') + '\n' })
}

/** Waits until a group has `members` members and is Stable; returns the --members --verbose description. */
export async function waitForGroup(group, members, timeoutMs = 40000, partitions = 3) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeoutMs) {
    last = cli(`kafka-consumer-groups.sh ${BS} --describe --group ${group} --members --verbose`)
    const state = cli(`kafka-consumer-groups.sh ${BS} --describe --group ${group} --state`).out
    const rows = last.out.split('\n').filter((l) => l.startsWith(group + ' '))
    // every partition handed out (#PARTITIONS summed), not a snapshot taken in the middle of a rebalance
    const assigned = rows.reduce((n, l) => n + Number(l.trim().split(/\s+/)[4] ?? 0), 0)
    // and, when there are enough partitions, nobody idle: otherwise the snapshot is between two rebalances
    const everyoneWorks = members > partitions || rows.every((l) => Number(l.trim().split(/\s+/)[4]) > 0)
    if (rows.length === members && assigned === partitions && everyoneWorks && /Stable/.test(state)) return last
    await sleep(500)
  }
  throw new Error(`group ${group} did not reach ${members} members: ${last?.out}`)
}

const APP = new URL('../orders-app/build/install/orders-app/bin/orders-app', import.meta.url).pathname

/** Runs the Micronaut app once in producer mode; returns its "sent …" lines. */
export async function appProduce(topic, count, firstOrder) {
  const r = new Running('producer', APP, [], { KAFKA_BOOTSTRAP: `localhost:${PORT}`, APP_MODE: 'producer', APP_TOPIC: topic, APP_COUNT: String(count), APP_FIRST_ORDER: String(firstOrder) })
  await r.exited
  return r.lines.map((l) => l.line).filter((l) => / sent /.test(l)).map((l) => l.replace(/^\d\d:\d\d:\d\d\.\d{3} /, ''))
}

/** Starts one Micronaut app instance in consumer mode. */
export function appConsumer(instance, topic, group) {
  return new Running(instance, APP, [], { KAFKA_BOOTSTRAP: `localhost:${PORT}`, APP_MODE: 'consumer', APP_TOPIC: topic, APP_GROUP: group, APP_INSTANCE: instance })
}

/** App log lines worth showing: received records and partition assignment changes. */
export function appLines(r, from = 0) {
  return r.since(from)
    .filter((l) => / received |Adding newly assigned|Revoke previously assigned/.test(l))
    .map((l) => l.replace(/^\d\d:\d\d:\d\d\.\d{3} /, '').replace(/\[Consumer clientId=[^,]+, groupId=([^\]]+)\] /, '[group $1] ').replace(/localhost:19092/g, 'localhost:9092'))
}
