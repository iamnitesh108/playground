// Starts throwaway redis-server processes in one temporary directory and
// cleans everything up on exit. Nothing touches a real installation.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connect } from './resp.mjs'

export const ROOT = mkdtempSync(join(tmpdir(), 'redis-lab-'))
const live = new Set()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export { sleep }

function cleanup() {
  for (const s of live) try { s.proc.kill('SIGKILL') } catch {}
  rmSync(ROOT, { recursive: true, force: true })
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(130))
process.on('SIGTERM', () => process.exit(143))

export const version = () => execFileSync('redis-server', ['--version']).toString().match(/v=(\S+)/)[1]

export class Server {
  constructor(name, port, args = [], { binary = 'redis-server', configFile = null, bare = false } = {}) {
    this.bare = bare
    this.name = name
    this.port = port
    this.dir = join(ROOT, name)
    this.args = args
    this.binary = binary
    this.configFile = configFile
    mkdirSync(this.dir, { recursive: true })
  }

  get logPath() { return join(this.dir, 'redis.log') }

  async start(extra = []) {
    const base = ['--port', String(this.port), '--dir', this.dir, '--logfile', this.logPath, '--save', '', '--appendonly', 'no', '--enable-debug-command', 'yes']
    const argv = this.bare ? ['--port', String(this.port), '--dir', this.dir, '--logfile', this.logPath, ...this.args, ...extra] : this.configFile ? [this.configFile, ...base.slice(0, 6), ...this.args, ...extra] : [...base, ...this.args, ...extra]
    this.proc = spawn(this.binary, argv, { stdio: 'ignore' })
    live.add(this)
    this.proc.on('exit', () => live.delete(this))
    for (let i = 0; i < 100; i++) {
      try {
        const c = await connect(this.port)
        await c.call('PING')
        c.close()
        return this
      } catch { await sleep(50) }
    }
    throw new Error(`${this.name} did not start; log:\n${this.log()}`)
  }

  client() { return connect(this.port) }

  log() { return existsSync(this.logPath) ? readFileSync(this.logPath, 'utf8') : '' }

  /** Log lines without pid/role/timestamp prefix, e.g. "Ready to accept connections tcp". */
  messages() {
    return this.log().split('\n').filter(Boolean).map((l) => l.replace(/^\d+:[A-Z] \d+ \w+ \d{4} [\d:.]+ [*#.-] /, ''))
  }

  /** Kills the process (default SIGKILL: a crash, no shutdown work). */
  async kill(signal = 'SIGKILL') {
    if (!this.proc || this.proc.exitCode !== null || this.proc.signalCode !== null) return
    const done = new Promise((r) => this.proc.once('exit', r))
    this.proc.kill(signal)
    await done
  }

  async stop() {
    try { const c = await this.client(); c.send('SHUTDOWN', 'NOSAVE').catch(() => {}); } catch {}
    await this.kill('SIGTERM')
  }

  writeFile(name, content) { const p = join(this.dir, name); writeFileSync(p, content); return p }

  cleanDir() { rmSync(this.dir, { recursive: true, force: true }); mkdirSync(this.dir, { recursive: true }) }
}
