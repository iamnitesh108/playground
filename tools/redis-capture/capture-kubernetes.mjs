// Checks the Kubernetes lesson's manifests as far as is possible without a cluster:
// the files from k8s/*.yaml are mounted into podman containers of the same image, the way
// Kubernetes mounts them, and the scripts, users, replication, probes and backup are run for real.
//   node capture-kubernetes.mjs ../../src/modules/redis/data/kubernetes.ts
// Containers redis-sec-k8s-*, host ports 17240-17249. Set KUBECONFORM=<path> to also record a schema check.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir, userInfo, homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './lib/resp.mjs'
import { Server } from './lib/server.mjs'
import { formatReply } from './lib/format.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-kubernetes.mjs <out.ts>')
const HERE = dirname(fileURLToPath(import.meta.url))
const K8S = join(HERE, 'k8s')
const IMAGE = 'docker.io/redis:8.10.2'
const NET = 'redis-sec-k8s-net'
const NS = 'default'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const run = (cmd, args) => { try { return { code: 0, out: execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString().trimEnd() } } catch (e) { return { code: e.status ?? 1, out: ((e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')).trimEnd() } } }
const podman = (...args) => run('podman', args)

/** Reads a block scalar `key: |` from a YAML file (enough for our own ConfigMap and Secret). */
function block(file, key) {
  const lines = readFileSync(join(K8S, file), 'utf8').split('\n')
  const i = lines.findIndex((l) => l.trim() === `${key}: |`)
  if (i < 0) throw new Error(`${key} not in ${file}`)
  const indent = lines[i].search(/\S/) + 2
  const body = []
  for (const l of lines.slice(i + 1)) { if (l.trim() && l.search(/\S/) < indent) break; body.push(l.slice(indent)) }
  return body.join('\n').trimEnd() + '\n'
}
const scalar = (file, key) => new RegExp(`^\\s+${key}: (.+)$`, 'm').exec(readFileSync(join(K8S, file), 'utf8'))[1].trim()

const out = { image: IMAGE }
const lab = mkdtempSync(join(tmpdir(), 'redis-k8s-'))
const cfg = join(lab, 'config'); const acl = join(lab, 'acl')
execFileSync('mkdir', ['-p', cfg, acl])
for (const f of ['redis.conf', 'start.sh', 'probe.sh']) writeFileSync(join(cfg, f), block('configmap.yaml', f))
writeFileSync(join(acl, 'users.acl'), block('secret.yaml', 'users.acl'))
for (const f of [cfg, acl]) chmodSync(f, 0o755)
const env = { REPLICATION_PASSWORD: scalar('secret.yaml', 'REPLICATION_PASSWORD'), PROBE_PASSWORD: scalar('secret.yaml', 'PROBE_PASSWORD') }
const backupPassword = scalar('secret.yaml', 'BACKUP_PASSWORD')

const names = []
function pod(name, { port, cmd = ['sh', '/etc/redis/start.sh'], volume = `redis-sec-k8s-data-${name}` } = {}) {
  const c = `redis-sec-k8s-${name}`
  names.push(c)
  podman('rm', '-f', c)
  const r = podman('run', '-d', '--name', c, '--network', NET, '--network-alias', `${name}.redis-headless.${NS}.svc.cluster.local`, '--network-alias', `${name}.redis-headless`,
    '--hostname', name, '--user', '999:999', '-e', `POD_NAME=${name}`, '-e', `POD_NAMESPACE=${NS}`, '-e', `REPLICATION_PASSWORD=${env.REPLICATION_PASSWORD}`, '-e', `PROBE_PASSWORD=${env.PROBE_PASSWORD}`,
    '-v', `${cfg}:/etc/redis:ro`, '-v', `${acl}:/etc/redis-acl:ro`, '-v', `${volume}:/data`, ...(port ? ['-p', `127.0.0.1:${port}:6379`] : []), IMAGE, ...cmd)
  if (r.code) throw new Error(r.out)
  return c
}
const exec = (c, ...args) => podman('exec', c, ...args)
const probe = (c, kind) => { const r = exec(c, 'sh', '/etc/redis/probe.sh', kind); return { exit: r.code, out: r.out } }
const admin = (c, ...args) => exec(c, 'sh', '-c', `REDISCLI_AUTH=example-admin-password redis-cli --user admin ${args.join(' ')}`).out

try {
  if (process.env.KUBECONFORM) {
    const r = run(process.env.KUBECONFORM, ['-strict', '-summary', '-output', 'text', '-kubernetes-version', '1.34.0', '-ignore-missing-schemas', ...['secret', 'configmap', 'statefulset', 'networkpolicy', 'backup'].map((f) => join(K8S, `${f}.yaml`))])
    out.kubeconform = { version: run(process.env.KUBECONFORM, ['-v']).out, out: r.out.replaceAll(K8S + '/', 'k8s/'), code: r.code }
  }
  podman('network', 'rm', '-f', NET)
  podman('network', 'create', NET)
  for (const n of ['redis-0', 'redis-1', 'backup']) podman('volume', 'rm', '-f', `redis-sec-k8s-data-${n}`)

  // Primary and one replica, started by start.sh exactly as the StatefulSet starts them
  const p0 = pod('redis-0', { port: 17240 })
  await sleep(1500)
  const p1 = pod('redis-1', { port: 17241 })
  out.probesBeforeSync = { 'redis-1': { ready: probe(p1, 'ready') } }
  for (let i = 0; i < 40; i++) { if (admin(p1, 'INFO', 'replication').includes('master_link_status:up')) break; await sleep(250) }
  const pick = (text, keys) => text.split('\n').map((l) => l.trim()).filter((l) => keys.some((k) => l.startsWith(k)))
  out.primaryReplication = pick(admin(p0, 'INFO', 'replication'), ['role', 'connected_slaves', 'slave0'])
  out.replicaReplication = pick(admin(p1, 'INFO', 'replication'), ['role', 'master_host', 'master_port', 'master_link_status'])
  out.config = pick(admin(p0, 'CONFIG', 'GET', 'maxmemory*').replace(/\n(?!maxmemory)/g, ' '), ['maxmemory '])
  out.probes = { 'redis-0': { live: probe(p0, 'live'), ready: probe(p0, 'ready') }, 'redis-1': { live: probe(p1, 'live'), ready: probe(p1, 'ready') } }

  // The application user from the Secret
  const app = (cmd) => exec(p0, 'sh', '-c', `REDISCLI_AUTH=example-app-password redis-cli --user app ${cmd}`).out
  out.appUser = ['SET orders:42 paid', 'GET orders:42', 'SET sessions:9 x', 'CONFIG GET maxmemory', 'FLUSHALL'].map((cmd) => ({ cmd, out: app(cmd) }))
  out.defaultUser = exec(p0, 'redis-cli', 'PING').out
  out.replicaRead = exec(p1, 'sh', '-c', 'REDISCLI_AUTH=example-app-password redis-cli --user app GET orders:42').out

  // Liveness vs readiness while a large dataset loads (key-load-delay slows loading down on purpose)
  const c = await connect(17240)
  await c.call('AUTH', 'admin', 'example-admin-password')
  const sets = []; for (let i = 0; i < 300000; i++) sets.push(['SET', `orders:${i}`, 'x'.repeat(40)])
  for (let i = 0; i < sets.length; i += 5000) await c.pipeline(sets.slice(i, i + 5000))
  c.close()
  for (let i = 0; i < 40; i++) { if (admin(p1, 'INFO', 'replication').includes('master_repl_offset') && admin(p1, 'DBSIZE') === '300001') break; await sleep(250) }

  // Backup: redis-cli --rdb from the replica, as the CronJob does
  const b = 'redis-sec-k8s-backup'
  names.push(b)
  podman('rm', '-f', b)
  const r = podman('run', '--rm', '--name', b, '--network', NET, '--user', '999:999', '-e', `REDISCLI_AUTH=${backupPassword}`, '-v', 'redis-sec-k8s-data-backup:/backup', IMAGE,
    'sh', '-c', 'redis-cli -h redis-1.redis-headless --user backup --rdb "/backup/dump-20261018-0215.rdb" && ls -l /backup | tail -n +2')
  out.backup = { code: r.code, out: r.out.replace(/\s+\w{3}\s+\d+\s+[\d:]+\s+/, ' Oct 18 02:15 ') }

  podman('stop', '-t', '30', p1); podman('rm', '-f', p1)
  podman('stop', '-t', '30', p0)
  const loadLog = podman('logs', p0).out
  out.shutdownLog = loadLog.split('\n').filter((l) => /signal-handler|SIGTERM|Saving|AOF|ready to exit|bye/i.test(l)).slice(-6).map((l) => l.replace(/^\d+:[A-Z] \d+ \w+ \d{4} [\d:.]+ /, ''))
  podman('rm', '-f', p0)
  pod('redis-0', { port: 17240, cmd: ['redis-server', '/etc/redis/redis.conf', '--key-load-delay', '20'] })
  const t0 = Date.now()
  await sleep(700)
  const naive = exec('redis-sec-k8s-redis-0', 'sh', '-c', 'REDISCLI_AUTH=$PROBE_PASSWORD redis-cli --user probe PING; echo "exit code $?"').out
  out.loading = { naive, live: probe('redis-sec-k8s-redis-0', 'live'), ready: probe('redis-sec-k8s-redis-0', 'ready') }
  for (let i = 0; i < 120; i++) { if (probe('redis-sec-k8s-redis-0', 'ready').exit === 0) { out.loading.readyAfterSeconds = Math.round((Date.now() - t0) / 500) / 2; break } await sleep(500) }
  out.loading.keys = 300000
} finally {
  for (const n of names) podman('rm', '-f', n)
  for (const n of ['redis-0', 'redis-1', 'backup']) podman('volume', 'rm', '-f', `redis-sec-k8s-data-${n}`)
  podman('network', 'rm', '-f', NET)
  rmSync(lab, { recursive: true, force: true })
}

// Sentinel and Cluster with hostnames instead of pod IPs (local binaries)
{
  const s = await new Server('k8s-cluster', 17245, ['--cluster-enabled', 'yes', '--cluster-announce-hostname', `redis-0.redis-headless.${NS}.svc.cluster.local`, '--cluster-preferred-endpoint-type', 'hostname']).start()
  const c = await s.client()
  await c.call('CLUSTER', 'ADDSLOTSRANGE', '0', '16383')
  await sleep(300)
  out.clusterSlots = formatReply(await c.send('CLUSTER', 'SLOTS')).trimEnd().replace(/\b[0-9a-f]{40}\b/g, (m) => m.slice(0, 8) + '…')
  c.close(); await s.stop()
}
{
  const primary = await new Server('k8s-sentinel-primary', 17246, []).start()
  const lines = ['port 17247', 'sentinel resolve-hostnames yes', 'sentinel announce-hostnames yes', 'sentinel monitor orders localhost 17246 1']
  const conf = primary.writeFile('sentinel.conf', lines.join('\n') + '\n')
  const proc = (await import('node:child_process')).spawn('redis-sentinel', [conf], { stdio: 'ignore' })
  await sleep(1200)
  const c = await connect(17247)
  out.sentinel = { addr: formatReply(await c.send('SENTINEL', 'GET-MASTER-ADDR-BY-NAME', 'orders')).trimEnd(), conf: lines }
  c.close(); proc.kill('SIGTERM'); await new Promise((r) => proc.once('exit', r))
  await primary.stop()
}

const json = JSON.stringify(out, null, 1).replace(/\b17247\b/g, '26379').replace(/\b172(4\d)\b/g, '6379')
for (const secret of [userInfo().username, homedir(), lab]) if (json.includes(secret)) throw new Error(`recording contains "${secret}"`)
writeFileSync(outFile, `// Recorded by tools/redis-capture/capture-kubernetes.mjs (podman, ${IMAGE}) — do not edit by hand.\n// No Kubernetes cluster was used: the manifests' files were mounted into containers as a pod would see them.\n\nexport const K8S = ${json} as const\n`)
console.log('wrote', outFile)
process.exit(0)
