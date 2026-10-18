// Recorded terminal sessions and the data files the lessons import.
// A step's `cmd` is the exact command line that ran: it is split into arguments and handed to the tool,
// so what a lesson shows is what was executed (only the container wrapper around the tool is not shown).
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { join, relative } from 'node:path'
import { aws, curl, rc, rclone, ROOT } from './lab.mjs'

/** Splits a command line the way a POSIX shell would for simple commands: quotes, backslashes, line continuations. */
export function shellSplit(line) {
  const args = []
  let cur = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '\\' && line[i + 1] === '\n') { i++; continue }
    if (c === ' ' || c === '\n' || c === '\t') { if (cur !== null) { args.push(cur); cur = null } continue }
    cur ??= ''
    if (c === "'") { const end = line.indexOf("'", i + 1); cur += line.slice(i + 1, end); i = end; continue }
    if (c === '"') {
      i++
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && '"\\$`'.includes(line[i + 1])) i++
        cur += line[i++]
      }
      continue
    }
    if (c === '\\') { cur += line[++i]; continue }
    cur += c
  }
  if (cur !== null) args.push(cur)
  return args
}

const RUNNERS = { aws, rc, curl, rclone }

/** What a terminal would show: text a carriage return overwrote is gone, trailing blanks trimmed. */
export function terminal(text) {
  return text.split('\n').map((l) => l.replace(/\r$/, '')).map((l) => l.slice(l.lastIndexOf('\r') + 1).replace(/\s+$/, '')).join('\n').replace(/\s+$/, '')
}

export class Session {
  /** @param {{ cwd: string, server?: string, awsDir?: string }} opts */
  constructor({ cwd, server, awsDir }) {
    this.cwd = cwd
    this.server = server
    this.awsDir = awsDir
    this.steps = []
  }

  /** Runs one command line with the tool its first word names (aws, rc, curl, rclone) or a host shell (sh). */
  run(cmd, { input, keep = (out) => out, note, env } = {}) {
    const [tool, ...args] = shellSplit(cmd)
    let r
    if (RUNNERS[tool]) r = RUNNERS[tool](args, { cwd: this.cwd, input, server: this.server, env, ...(this.awsDir ? { awsDir: this.awsDir } : {}) })
    else {
      const p = spawnSync('sh', ['-c', cmd], { cwd: this.cwd, encoding: 'utf8', input })
      r = { code: p.status, stdout: p.stdout ?? '', stderr: p.stderr ?? '' }
    }
    const out = keep(terminal(`${r.stdout}${r.stderr}`).replace(/^\n+/, ""), r)
    this.steps.push({ cmd, out, ...(r.code ? { code: r.code } : {}), ...(note ? { note } : {}) })
    return { ...r, out }
  }

  /** A line of explanation between commands. */
  note(text) {
    this.steps.push({ note: text })
  }

  /** Takes the steps recorded so far and starts a new list. */
  take() {
    const s = this.steps
    this.steps = []
    return s
  }
}

/** Shortens request ids (they differ on every run and say nothing). */
export function shortenIds(text) {
  return text
    .replace(/((?:x-amz-request-id|x-request-id|x-amz-id-2)["']?:\s*["']?)([0-9a-f-]{16,})/gi, (_, k, id) => `${k}${id.slice(0, 8)}`)
    .replace(/(<(?:RequestId|HostId)>)([0-9a-f-]{16,})(<\/)/g, (_, a, id, b) => `${a}${id.slice(0, 8)}${b}`)
    .replace(/(request ID:? )([0-9a-f-]{16,})/gi, (_, a, id) => `${a}${id.slice(0, 8)}`)
}

/** Host ports of the lab are rewritten to the standard ones a reader would use. */
export function standardPorts(text) {
  return text.replace(/\b19910\b/g, '9000').replace(/\b19911\b/g, '9001')
}

function forbidden() {
  return [homedir(), userInfo().username, 's3cap-'].filter((s) => s && s.length > 2)
}

/** Writes `export const NAME = {...} as const` to src/modules/s3/data/<file>, refusing anything personal. */
export function writeData(file, name, data, { script }) {
  let json = JSON.stringify(data, null, 2)
  json = shortenIds(standardPorts(json))
  for (const bad of forbidden()) if (json.includes(bad)) throw new Error(`refusing to write ${file}: output contains "${bad}" near ${JSON.stringify(json.slice(Math.max(0, json.indexOf(bad) - 80), json.indexOf(bad) + 40))}`)
  const path = join(ROOT, 'src/modules/s3/data', file)
  writeFileSync(path, `// Recorded by tools/s3-capture/${script} against a real RustFS server. Do not edit by hand.\nexport const ${name} = ${json} as const\n`)
  console.log(`wrote ${relative(ROOT, path)} (${(json.length / 1024).toFixed(1)} KiB)`)
}
