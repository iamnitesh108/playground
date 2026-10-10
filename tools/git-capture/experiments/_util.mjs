import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Writes a file inside the session (not shown as a command). */
export function write(session, path, content) {
  const full = path.startsWith('/') ? path : join(session.cwd, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

/** The identity and defaults every lesson after "setup" assumes. */
export function configure(session, { name = 'Ann Lee', email = 'ann@example.com' } = {}) {
  session.quiet(`git config --global user.name "${name}"`)
  session.quiet(`git config --global user.email "${email}"`)
  session.quiet('git config --global init.defaultBranch main')
  // A terminal shows branch names in git log by default; output to a pipe does not, so turn it on.
  session.quiet('git config --global log.decorate short')
}

/** Makes one commit that changes a file. */
export function commitFile(session, file, content, message) {
  write(session, file, content)
  session.quiet(`git add ${file} && git commit -q -m "${message}"`)
}
