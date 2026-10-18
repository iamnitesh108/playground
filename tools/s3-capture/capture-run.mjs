// Records lesson 2 "Running RustFS": starting the server, health checks, the aws CLI and rc set up for a
// non-AWS endpoint, where objects end up on disk, data surviving a container replacement, a compose file,
// and a single server with four drives.
//   node capture-run.mjs
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, HERE, LAB, podman, removeContainer, removeVolume, sleep, version, waitHealthy, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'

const w = workspace('run')
const RUN = `podman run -d --name s3-lab -p ${LAB.api}:9000 -p ${LAB.console}:9001 -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -v s3-lab-data:/data docker.io/rustfs/rustfs:latest`
const quiet = { PODMAN_COMPOSE_WARNING_LOGS: 'false' }
/** Colour codes a terminal would interpret (ESC [ … m). */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const noBanner = (out) => out.split('\n').filter((l) => !l.includes('compose provider') && l.trim() !== '').map((l) => l.replace(ANSI, '')).join('\n')
const shortId = (out) => out.replace(/^([0-9a-f]{12})[0-9a-f]{52}$/gm, '$1…')

try {
  removeContainer(LAB.name, 's3-lab-compose')
  removeVolume('s3-lab-data', 'compose_data')
  const s = new Session({ cwd: w })

  // ---- start
  s.run('podman volume create s3-lab-data')
  s.run(RUN, { keep: shortId })
  await waitHealthy(LAB.api)
  s.run('podman ps --filter name=s3-lab --format "{{.Names}}  {{.Status}}  {{.Ports}}"')
  s.run('podman logs s3-lab')
  const start = s.take()

  // ---- health and a first unsigned request
  s.run('curl -si http://localhost:9000/health')
  s.run('curl -s http://localhost:9000/health/ready')
  s.run('curl -s http://localhost:9001/rustfs/console/health')
  const health = s.take()
  s.run('curl -si http://localhost:9000/')
  const anonymous = s.take()

  // ---- aws CLI
  writeFileSync(join(w, 'readme.txt'), 'Product photos and manuals.\n')
  s.run('aws --version')
  s.run('aws configure list')
  s.run('aws s3 ls')
  s.run('aws s3 mb s3://catalog')
  s.run('aws s3 cp readme.txt s3://catalog/readme.txt')
  s.run('aws s3 ls s3://catalog/')
  const awsCli = s.take()
  s.run('aws --profile virtual s3 ls s3://catalog/')
  const virtual = s.take()

  // ---- rc, RustFS's own client
  s.run('rc alias set lab http://localhost:9000 labadmin labsecret123')
  s.run('rc alias list')
  s.run('rc ping lab')
  s.run('rc ready lab')
  s.run('rc ls lab/catalog/')
  s.run('rc admin info server lab')
  const rcCli = s.take()

  // ---- where the bytes live
  writeFileSync(join(w, 'photo.jpg'), Buffer.alloc(300 * 1024, 0xd8))
  writeFileSync(join(w, 'video.mp4'), Buffer.alloc(20 * 1024 * 1024, 0x42))
  s.run('aws s3 cp photo.jpg s3://catalog/images/photo.jpg')
  s.run('aws s3 cp video.mp4 s3://catalog/videos/demo.mp4')
  const moreUploads = s.take()
  s.run('podman exec s3-lab ls -a /data')
  s.run('podman exec s3-lab tree /data')
  s.run('podman exec s3-lab sh -c "du -b /data/catalog/readme.txt/xl.meta /data/catalog/images/photo.jpg/xl.meta /data/catalog/images/photo.jpg/*/part.1 /data/catalog/videos/demo.mp4/*/part.*"')
  s.run('podman exec s3-lab strings /data/catalog/readme.txt/xl.meta')
  s.run('podman exec s3-lab sh -c "tail -c 32 /data/catalog/readme.txt/xl.meta | xxd"')
  const disk = s.take()

  // ---- the data outlives the container
  s.run('podman rm -f s3-lab')
  s.run(RUN, { keep: shortId })
  await waitHealthy(LAB.api)
  s.run('aws s3 ls s3://catalog/ --recursive')
  const persist = s.take()
  removeContainer(LAB.name)

  // ---- compose
  const composeDir = join(HERE, 'compose')
  const cs = new Session({ cwd: composeDir })
  const env = { ...process.env, ...quiet, S3_API_PORT: String(LAB.api), S3_CONSOLE_PORT: String(LAB.console) }
  const prev = { ...process.env }
  Object.assign(process.env, env)
  cs.run('podman compose up -d', { keep: (o) => shortId(noBanner(o)) })
  await waitHealthy(LAB.api)
  let health2 = ''
  for (let i = 0; i < 40 && health2 !== 'healthy'; i++) {
    await sleep(1000)
    health2 = podman(['inspect', '--format', '{{.State.Health.Status}}', 's3-lab-compose']).stdout.trim()
  }
  cs.run('podman compose ps --format "{{.Names}}  {{.Status}}  {{.Ports}}"', { keep: noBanner })
  cs.run('podman compose down -v', { keep: (o) => shortId(noBanner(o)) })
  process.env = prev
  const compose = cs.take()

  // ---- one server, four drives
  const md = `podman run -d --name s3-lab -p ${LAB.api}:9000 -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e "RUSTFS_VOLUMES=/data/rustfs{0...3}" docker.io/rustfs/rustfs:latest`
  s.run(md, { keep: shortId })
  await sleep(6000)
  s.run('podman logs s3-lab', { keep: (o) => o.split('\n').filter((l) => !l.includes('mkdir')).join('\n') })
  removeContainer(LAB.name)
  s.run(md.replace('-e "RUSTFS_VOLUMES', '-e RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true -e "RUSTFS_VOLUMES'), { keep: shortId })
  await waitHealthy(LAB.api)
  s.run('rc admin info cluster lab', { keep: (o) => o.replace(/Deployment ID: \S+/, 'Deployment ID: …') })
  const drives = s.take()

  writeData('run.ts', 'RUN', { version: version(), start, health, anonymous, awsCli, virtual, rcCli, moreUploads, disk, persist, compose, composeHealth: health2, drives }, { script: 'capture-run.mjs' })
} finally {
  removeContainer(LAB.name, 's3-lab-compose')
  removeVolume('s3-lab-data', 'compose_data')
  dropWorkspace(w)
}
