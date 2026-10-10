// Runs every graph scenario in real git and in the model, and compares the resulting graphs.
// Run from the repository root: node tools/git-capture/check-simulator.mjs
import { createServer } from 'vite'
import { Session } from './session.mjs'

const server = await createServer({ root: new URL('../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { GitGraph, shape } = await server.ssrLoadModule('/src/modules/git/simulation/graph.ts')
const { GRAPH_SCENARIOS } = await server.ssrLoadModule('/src/modules/git/simulation/scenarios.ts')

/** Reads the same shape out of a real repository. */
function realShape(s) {
  const lines = (cmd) => s.quiet(cmd).split('\n').filter(Boolean)
  const commits = new Map(lines('git log --branches HEAD --format="%H|%s|%P"').map((l) => { const [h, m, p] = l.split('|'); return [h, { message: m, parents: p ? p.split(' ') : [] }] }))
  const branches = new Map(lines('git for-each-ref refs/heads --format="%(refname:short) %(objectname)"').map((l) => l.split(' ')))
  const symbolic = s.run('git symbolic-ref -q --short HEAD').out
  const head = symbolic ? { kind: 'branch', name: symbolic } : { kind: 'detached', id: s.quiet('git rev-parse HEAD') }
  return shape({ commits, branches, head, reachable: () => new Set(commits.keys()) })
}

let failed = 0
for (const sc of GRAPH_SCENARIOS) {
  const s = new Session()
  try {
    s.quiet('git config --global user.name Test && git config --global user.email t@example.com && git config --global init.defaultBranch main')
    s.quiet('git init -q repo')
    s.cd('repo')
    for (const c of sc.commands) {
      const real = c.replace(/^git commit /, 'git commit -q --allow-empty ').replace(/^git merge /, 'git merge -q ').replace(/^git cherry-pick /, 'git cherry-pick --allow-empty ')
      s.run(real) // failures (like deleting an unmerged branch) are part of the scenarios
    }
    const model = shape(new GitGraph(sc.commands))
    const actual = realShape(s)
    const ok = model === actual
    if (!ok) failed++
    console.log(ok ? 'ok  ' : 'FAIL', sc.id, ok ? '' : `\n--- git\n${actual}\n--- model\n${model}`)
  } finally {
    s.dispose()
  }
}
await server.close()
process.exit(failed)
