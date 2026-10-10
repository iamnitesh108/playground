// Runs every experiment in a fresh sandbox and writes the lesson data file.
// Usage: node capture.mjs ../../src/modules/git/data/captures.ts
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { Session } from './session.mjs'

const [, , outFile] = process.argv
const EXPERIMENTS = ['setup', 'objects', 'areas', 'history', 'branches', 'merging', 'rebase', 'remotes', 'accounts', 'accounts-setup', 'undo', 'toolbox', 'workflow']
const version = execSync('git --version', { encoding: 'utf8' }).trim().replace('git version ', '')
const capture = { git: version }
for (const name of EXPERIMENTS) {
  const s = new Session()
  try {
    const mod = await import(`./experiments/${name}.mjs`)
    capture[name] = mod.run(s)
  } finally {
    s.dispose()
  }
}
const header = `// Recorded with git ${version} in a sandboxed home directory by tools/git-capture — do not edit by hand.\n\n`
writeFileSync(outFile, `${header}export const CAPTURE = ${JSON.stringify(capture, null, 1)} as const\n`)
console.log('wrote', outFile)
