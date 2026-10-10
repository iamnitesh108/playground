// A sandboxed shell for recording git: its own HOME, no system config, fixed dates, neutral identity.
import { execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir, userInfo, homedir } from 'node:os'
import { join } from 'node:path'

const BASE = Date.parse('2026-10-05T09:00:00Z')

export class Session {
  constructor({ user = 'ann' } = {}) {
    this.root = mkdtempSync(join(tmpdir(), 'git-capture-'))
    this.home = join(this.root, 'home', user)
    this.srv = join(this.root, 'srv')
    mkdirSync(this.home, { recursive: true })
    mkdirSync(this.srv, { recursive: true })
    this.cwd = this.home
    this.minute = 0
    this.user = user
  }

  /** Real paths → the paths shown in lessons. */
  clean(text) {
    // A carriage return overwrites the line in a terminal: keep what remains visible.
    const visible = text.split("\n").map((line) => line.split("\r").filter(Boolean).at(-1) ?? "").join("\n")
    return visible.replaceAll(join(this.root, 'home'), '/home').replaceAll(this.srv, '/srv').replaceAll(this.root, '').trimEnd()
  }

  env(extra = {}) {
    const date = new Date(BASE + this.minute++ * 60_000).toISOString().replace('.000Z', '+0000')
    return {
      PATH: process.env.PATH,
      HOME: this.home,
      USER: this.user,
      LANG: 'C.UTF-8',
      TERM: 'dumb',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_PAGER: 'cat',
      PAGER: 'cat',
      GIT_EDITOR: 'true',
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
      TZ: 'UTC',
      ...extra,
    }
  }

  /** Runs a command line in bash; returns { cmd, out, exit } as shown in a terminal. */
  run(cmd, { cwd, env, show } = {}) {
    let out
    let exit = 0
    try {
      out = execSync(`{ ${cmd}
} 2>&1`, { cwd: cwd ?? this.cwd, env: this.env(env), shell: '/bin/bash', encoding: 'utf8' })
    } catch (e) {
      out = e.stdout ?? ''
      exit = e.status ?? 1
    }
    const shown = this.clean(out)
    // Never record anything about the machine running the capture.
    for (const secret of [userInfo().username, homedir()]) {
      if (shown.includes(secret) || (show ?? cmd).includes(secret)) throw new Error(`output of "${cmd}" contains "${secret}"`)
    }
    return { cmd: show ?? cmd, out: shown, exit }
  }

  /** Runs without recording (setup steps). */
  quiet(cmd, opts) {
    const r = this.run(cmd, opts)
    if (r.exit !== 0) throw new Error(`setup failed: ${cmd}\n${r.out}`)
    return r.out
  }

  cd(path) {
    this.cwd = path.startsWith('/') ? path : join(this.cwd, path)
  }

  dispose() {
    rmSync(this.root, { recursive: true, force: true })
  }
}

/** A recorder: run() appends to the current transcript. */
export function transcript(session) {
  const steps = []
  const rec = (cmd, opts) => {
    const r = session.run(cmd, opts)
    steps.push(r)
    return r
  }
  return { steps, rec }
}
