// Helpers for capture-durability.mjs: podman containers, psql sessions, sanitising.
import { homedir, userInfo } from 'node:os'
import { spawn, spawnSync } from 'node:child_process'

export const IMAGE = 'docker.io/library/postgres:18'
export const NET = 'pg-dur-net'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Runs podman and returns stdout + stderr in order (merged by sh). */
export function podman(args, { input, allowFail = false } = {}) {
  const r = spawnSync('podman', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  if (r.status !== 0 && !allowFail) throw new Error(`podman ${args.join(' ')} failed (${r.status}):\n${out}`)
  return out
}

/** Runs a shell command inside a container, stderr merged into stdout. */
export const exec = (c, cmd, opts = {}) => podman(['exec', '-i', '-u', 'postgres', c, 'sh', '-c', `${cmd} 2>&1`], opts)

/** Removes and starts a fresh postgres:18 container on the lab network. */
export async function startServer(name, { port, alias, args = [], env = {} } = {}) {
  podman(['rm', '-f', name], { allowFail: true })
  const envArgs = Object.entries({ POSTGRES_PASSWORD: 'lab', POSTGRES_DB: 'lab', ...env }).flatMap(([k, v]) => ['-e', `${k}=${v}`])
  podman(['run', '-d', '--name', name, '--network', NET, ...(alias ? ['--network-alias', alias] : []), ...(port ? ['-p', `${port}:5432`] : []), ...envArgs, IMAGE, 'postgres', ...args.flatMap((a) => ['-c', a])])
  await waitReady(name)
}

/** Waits until the server accepts TCP connections (the init server only listens on a socket). */
export async function waitReady(name, timeoutMs = 60000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const r = spawnSync('podman', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-q'])
    if (r.status === 0) return
    await sleep(500)
  }
  throw new Error(`${name} did not become ready`)
}

/** Runs SQL in one psql session; returns raw output (errors included). */
export const psqlRaw = (c, sql, { db = 'lab', flags = '' } = {}) => exec(c, `psql -X -q -U postgres -d ${db} ${flags}`, { input: sql })

/** One value from a query. */
export const val = (c, sql, opts) => psqlRaw(c, sql, { ...opts, flags: '-At' }).trim()

/** Rows as objects, via JSON. */
export function rows(c, sql, opts) {
  const out = psqlRaw(c, `SELECT coalesce(json_agg(t), '[]') FROM (${sql}) t`, { ...opts, flags: '-At' }).trim()
  return JSON.parse(out)
}

/**
 * Runs statements in one psql session and returns what a reader would see:
 * each statement after a "=# " prompt, followed by its output.
 */
export function session(c, statements, { db = 'lab', prompt = `${db}=# ` } = {}) {
  const raw = exec(c, `psql -X -a -U postgres -d ${db}`, { input: statements.join('\n') + '\n' })
  return withPrompts(raw, statements, prompt)
}

/** Puts a prompt before each echoed statement, in order. */
function withPrompts(raw, statements, prompt) {
  let out = raw
  let from = 0
  for (const s of statements) {
    const at = out.indexOf(s, from)
    if (at < 0) continue
    const shown = s.split('\n').map((l, i) => (i === 0 ? prompt : ' '.repeat(prompt.length)) + l).join('\n')
    out = out.slice(0, at) + shown + out.slice(at + s.length)
    from = at + shown.length
  }
  return tidy(out)
}

/** Starts a long-running psql session in the background; resolves with its output when it ends. */
export function background(c, sql, { db = 'lab', prompt = `${db}=# ` } = {}) {
  const p = spawn('podman', ['exec', '-i', '-u', 'postgres', c, 'sh', '-c', `psql -X -a -U postgres -d ${db} 2>&1`])
  let out = ''
  p.stdout.on('data', (d) => (out += d))
  p.stdin.end(sql.join('\n') + '\n')
  const done = new Promise((resolve) => p.on('close', () => resolve(withPrompts(out, sql, prompt))))
  return { done, proc: p }
}

export const tidy = (s) => s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trimEnd()

/** Fails loudly if a recording would leak something personal. */
export function assertClean(text) {
  for (const bad of ['/home/', homedir(), userInfo().username]) {
    if (text.includes(bad)) throw new Error(`refusing to write: output contains "${bad}"`)
  }
}

/** Server log lines of a container since a moment (ISO string or podman duration). */
export const logs = (c, since) => podman(['logs', ...(since ? ['--since', since] : []), c], { allowFail: true })
