// Throwaway RustFS servers and client tools, all in containers (podman).
// The main server is `s3-lab` (host ports 19910 for the S3 API, 19911 for the console). Client tools run with
// `--network container:<server>`, so they reach the server at http://localhost:9000 exactly as a reader would.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(dirname(fileURLToPath(import.meta.url)))
export const ROOT = join(HERE, '../..')

export const IMAGES = {
  rustfs: 'docker.io/rustfs/rustfs:latest',
  aws: 'docker.io/amazon/aws-cli:latest',
  rc: 'docker.io/rustfs/rc:latest',
  curl: 'docker.io/curlimages/curl:latest',
  rclone: 'docker.io/rclone/rclone:latest',
}

export const LAB = { name: 's3-lab', api: 19910, console: 19911, access: 'labadmin', secret: 'labsecret123' }

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Runs podman; never throws unless asked to. */
export function podman(args, { input, check = false, timeout = 180000 } = {}) {
  const r = spawnSync('podman', args, { encoding: 'utf8', input, timeout, maxBuffer: 256 << 20 })
  const res = { code: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
  if (check && res.code !== 0) throw new Error(`podman ${args.join(' ')} → ${res.code}\n${res.stderr}${res.stdout}`)
  return res
}

export function removeContainer(...names) {
  // -v also removes the anonymous volume the image declares for /data
  for (const n of names) podman(['rm', '-f', '-v', '-t', '1', n])
}

export function removeVolume(...names) {
  for (const n of names) podman(['volume', 'rm', '-f', n])
}

export function version() {
  return podman(['run', '--rm', '--entrypoint', '/usr/bin/rustfs', IMAGES.rustfs, '--version'], { check: true }).stdout.split('\n')[0].replace('rustfs ', '').trim()
}

/** Waits until GET /health answers 200 on a host port. */
export async function waitHealthy(port, timeoutMs = 90000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      const r = await fetch(`http://localhost:${port}/health`)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await sleep(500)
  }
  throw new Error(`server on ${port} did not become healthy`)
}

/**
 * Starts a RustFS container. `env` adds to the lab credentials; `volumes` are podman -v specs.
 * Returns once /health answers (unless `wait` is false, e.g. for cluster nodes that wait for each other).
 */
export async function startServer({ name = LAB.name, api = LAB.api, consolePort = LAB.console, env = {}, volumes = [], network, hostname, args = [], wait = true } = {}) {
  removeContainer(name)
  const a = ['run', '-d', '--name', name]
  if (hostname) a.push('--hostname', hostname)
  if (network) a.push('--network', network)
  if (api) a.push('-p', `${api}:9000`)
  if (consolePort) a.push('-p', `${consolePort}:9001`)
  const all = { RUSTFS_ACCESS_KEY: LAB.access, RUSTFS_SECRET_KEY: LAB.secret, ...env }
  for (const [k, v] of Object.entries(all)) a.push('-e', `${k}=${v}`)
  for (const v of volumes) a.push('-v', v)
  podman([...a, IMAGES.rustfs, ...args], { check: true })
  if (wait && api) await waitHealthy(api)
}

/** A fresh scratch directory that client containers mount as their working directory. */
export function workspace(name) {
  const dir = mkdtempSync(join(tmpdir(), `s3cap-${name}-`))
  mkdirSync(join(dir, 'rc'), { recursive: true })
  return dir
}

export function dropWorkspace(dir) {
  rmSync(dir, { recursive: true, force: true })
}

const net = (server) => ['--network', `container:${server}`]

/** The aws CLI (v2) with tools/s3-capture/aws as ~/.aws and `cwd` as the working directory. */
export function aws(args, { cwd, input, server = LAB.name, env = {}, awsDir = join(HERE, 'aws') } = {}) {
  const e = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`])
  return podman(['run', '--rm', '-i', ...net(server), '-v', `${awsDir}:/root/.aws:ro`, '-v', `${cwd}:/aws`, '-w', '/aws', ...e, IMAGES.aws, ...args], { input })
}

/** RustFS's own CLI (rc); its aliases live in <cwd>/rc. */
export function rc(args, { cwd, input, server = LAB.name } = {}) {
  return podman(['run', '--rm', '-i', ...net(server), '--userns', 'keep-id:uid=100,gid=101', '-e', 'RC_CONFIG_DIR=/work/rc', '-e', 'NO_COLOR=1', '-v', `${cwd}:/work`, '-w', '/work', IMAGES.rc, ...args], { input })
}

export function curl(args, { cwd, input, server = LAB.name } = {}) {
  return podman(['run', '--rm', '-i', ...net(server), '--userns', 'keep-id:uid=100,gid=101', '-v', `${cwd}:/work`, '-w', '/work', IMAGES.curl, ...args], { input })
}

export function rclone(args, { cwd, input, server = LAB.name } = {}) {
  return podman(['run', '--rm', '-i', ...net(server), '-v', `${cwd}:/data`, '-w', '/data', '-e', 'RCLONE_CONFIG=/data/rclone.conf', IMAGES.rclone, ...args], { input })
}

/** Runs a command inside a server container (e.g. to list its data directory). */
export function exec(server, cmd) {
  return podman(['exec', server, 'sh', '-c', cmd])
}
