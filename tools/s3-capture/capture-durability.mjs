// Records lesson 8 "Surviving disk failures": one server with four drives (erasure coding 2 data + 2 parity),
// drives made unreadable one by one, a drive replaced by an empty one and healed, a shard corrupted on disk
// (bit rot) and repaired on read; then four servers (s3-node-1…4 on the podman network s3-net) with servers
// stopped and started again.
//   node capture-durability.mjs
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, exec, podman, removeContainer, removeVolume, sleep, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'

const MD = 's3-node-md'
const NODES = ['s3-node-1', 's3-node-2', 's3-node-3', 's3-node-4']
const NET = 's3-net'
const w = workspace('durability')

async function healthy(name, ms = 90_000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (exec(name, 'curl -sf http://127.0.0.1:9000/health/ready >/dev/null && echo ok').stdout.includes('ok')) return
    await sleep(1000)
  }
  throw new Error(`${name} not ready`)
}
const shortId = (out) => out.replace(/^([0-9a-f]{12})[0-9a-f]{52}$/gm, '$1…')
const cluster = (o) => o.replace(/Deployment ID: \S+/, 'Deployment ID: …')

function cleanup() {
  removeContainer(MD, ...NODES)
  removeVolume(...[0, 1, 2, 3].map((i) => `${MD}-d${i}`), ...NODES.map((n) => `${n}-data`))
  podman(['network', 'rm', '-f', NET])
}

try {
  cleanup()
  writeFileSync(join(w, 'three.bin'), randomBytes(3 * 1024 * 1024))

  // ================================================================ one server, four drives
  const s = new Session({ cwd: w, server: MD })
  s.run('podman run -d --name s3-node-md -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true -e "RUSTFS_VOLUMES=/data/rustfs{0...3}" -v s3-node-md-d0:/data/rustfs0 -v s3-node-md-d1:/data/rustfs1 -v s3-node-md-d2:/data/rustfs2 -v s3-node-md-d3:/data/rustfs3 docker.io/rustfs/rustfs:latest', { keep: shortId })
  await healthy(MD)
  s.run('rc alias set lab http://localhost:9000 labadmin labsecret123')
  s.run('rc admin info cluster lab', { keep: (o) => cluster(o).split('\n').filter((l) => !/Capacity|Location|Storage|Uptime|Version|RC Version/.test(l)).join('\n') })
  s.run('aws s3 mb s3://catalog')
  s.run('aws s3api put-object --bucket catalog --key three.bin --body three.bin')
  s.run('md5sum three.bin')
  s.run('podman exec s3-node-md sh -c "du -b /data/rustfs*/catalog/three.bin/*/part.1"')
  const mdSetup = s.take()

  // drives become unreadable one by one
  const steps = []
  for (const [i, drive] of [[1, 'rustfs1'], [2, 'rustfs2'], [3, 'rustfs3']]) {
    s.run(`podman exec s3-node-md chmod 000 /data/${drive}`)
    await sleep(2000)
    const get = s.run('aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag')
    const put = s.run(`aws s3api put-object --bucket catalog --key written-with-${i}-down.bin --body three.bin --query ETag`)
    steps.push({ down: i, read: !get.code, write: !put.code })
  }
  const failing = s.take()
  s.run('podman exec s3-node-md chmod 755 /data/rustfs1 /data/rustfs2 /data/rustfs3')
  await sleep(2000)
  s.run('podman exec s3-node-md ls /data/rustfs1/catalog /data/rustfs2/catalog')
  s.run('rc admin heal start lab --bucket catalog')
  await sleep(5000)
  s.run('podman exec s3-node-md ls /data/rustfs1/catalog /data/rustfs2/catalog')
  s.run('aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag')
  const back = s.take()

  // a drive replaced by an empty one
  s.run('podman exec s3-node-md sh -c "rm -rf /data/rustfs3/catalog && ls /data/rustfs3"')
  s.run('aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag')
  s.run('rc admin heal start lab --bucket catalog')
  await sleep(5000)
  s.run('podman exec s3-node-md sh -c "du -b /data/rustfs3/catalog/three.bin/*/part.1"')
  const replaced = s.take()

  // bit rot: flip bytes inside one shard on disk
  const shard = '$(find /data/rustfs0/catalog/three.bin -name part.1)'
  s.run(`podman exec s3-node-md sh -c 'md5sum ${shard}'`)
  s.run(`podman exec s3-node-md sh -c 'printf BITROT | dd of=${shard} bs=1 seek=4096 conv=notrunc 2>/dev/null; md5sum ${shard}'`)
  s.run('aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag')
  s.run('md5sum copy.bin')
  await sleep(5000)
  s.note('5 seconds later')
  s.run(`podman exec s3-node-md sh -c 'md5sum ${shard}'`)
  const bitrot = s.take()
  removeContainer(MD)
  removeVolume(...[0, 1, 2, 3].map((i) => `${MD}-d${i}`))

  // ================================================================ four servers
  const n = new Session({ cwd: w, server: 's3-node-1' })
  n.run('podman network create s3-net')
  for (const node of NODES) {
    n.run(`podman run -d --name ${node} --hostname ${node} --network s3-net -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e "RUSTFS_VOLUMES=http://s3-node-{1...4}:9000/data" -v ${node}-data:/data docker.io/rustfs/rustfs:latest`, { keep: shortId })
  }
  for (const node of NODES) await healthy(node)
  n.run('rc alias set lab http://localhost:9000 labadmin labsecret123')
  n.run('rc admin info cluster lab', { keep: (o) => cluster(o).split('\n').filter((l) => !/Capacity|Location|Storage|Uptime|Version|RC Version/.test(l)).join('\n') })
  n.run('aws s3 mb s3://catalog')
  n.run('aws s3api put-object --bucket catalog --key three.bin --body three.bin --query ETag')
  for (const node of NODES) n.run(`podman exec ${node} sh -c "du -b /data/catalog/three.bin/*/part.1"`)
  const nodesSetup = n.take()

  const t0 = Date.now()
  const at = () => Math.round((Date.now() - t0) / 100) / 10
  const events = []
  const ev = (label, ok) => events.push({ at: at(), label, ok })
  n.run('podman stop s3-node-3')
  ev('s3-node-3 stopped', false)
  const g1 = n.run('aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag')
  ev('read', !g1.code)
  const p1 = n.run('aws s3api put-object --bucket catalog --key while-one-down.bin --body three.bin --query ETag')
  ev('write', !p1.code)
  n.run('podman stop s3-node-4')
  ev('s3-node-4 stopped', false)
  const g2 = n.run('aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag')
  ev('read', !g2.code)
  const p2 = n.run('aws s3api put-object --bucket catalog --key while-two-down.bin --body three.bin --query ETag')
  ev('write', !p2.code)
  const nodesDown = n.take()

  n.run('podman start s3-node-3 s3-node-4')
  ev('both started', true)
  await healthy('s3-node-3')
  await healthy('s3-node-4')
  n.run('podman exec s3-node-3 ls /data/catalog')
  let healedAt = null
  for (let i = 0; i < 120 && healedAt === null; i++) {
    if (exec('s3-node-3', 'ls /data/catalog').stdout.includes('while-one-down.bin')) healedAt = at()
    else await sleep(1000)
  }
  if (healedAt !== null) ev('while-one-down.bin back on s3-node-3', true)
  n.note(`healed ${healedAt === null ? 'not within 2 minutes' : `${Math.round((healedAt - events.find((e) => e.label === 'both started').at) * 10) / 10} s after the restart`}`)
  n.run('podman exec s3-node-3 ls /data/catalog')
  n.run('aws s3api put-object --bucket catalog --key after-restart.bin --body three.bin --query ETag')
  const nodesBack = n.take()

  writeData(
    'durability.ts',
    'DURABILITY',
    { version: version(), objectBytes: 3 * 1024 * 1024, mdSetup, failing, driveSteps: steps, back, replaced, bitrot, nodesSetup, nodesDown, nodesBack, events, healedAt },
    { script: 'capture-durability.mjs' },
  )
} finally {
  cleanup()
  dropWorkspace(w)
}
