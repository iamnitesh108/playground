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
if (failed) process.exit(failed)

// fetch / pull: the same actions by Ann and Bob against a real server repository.
{
  const server2 = await createServer({ root: new URL('../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  const { RemoteModel, remoteShape } = await server2.ssrLoadModule('/src/modules/git/simulation/remote.ts')
  const { REMOTE_SCENARIOS } = await server2.ssrLoadModule('/src/modules/git/simulation/remoteScenarios.ts')
  const { join } = await import('node:path')
  let failedRemote = 0
  for (const sc of REMOTE_SCENARIOS) {
    const s = new Session()
    try {
      s.quiet('git config --global user.name Test && git config --global user.email t@example.com && git config --global init.defaultBranch main')
      const srv = `${s.srv}/shop.git`
      const ann = join(s.home, 'shop')
      const bob = join(s.home, 'bob')
      s.quiet(`git init -q --bare ${srv} && git init -q ${ann}`)
      s.quiet(`echo app > app.txt && git add . && git commit -q -m "Add app" && git remote add origin ${srv} && git push -q -u origin main`, { cwd: ann })
      s.quiet(`git clone -q ${srv} ${bob}`)
      let nb = 0
      let na = 0
      const real = {
        'bob-push': () => { nb++; s.quiet(`git pull -q --rebase && echo ${nb} > bob${nb}.txt && git add . && git commit -q -m "Bob ${nb}" && git push -q`, { cwd: bob }) },
        'ann-commit': () => { na++; s.quiet(`echo ${na} > ann${na}.txt && git add . && git commit -q -m "Ann ${na}"`, { cwd: ann }) },
        fetch: () => s.run('git fetch -q', { cwd: ann }),
        merge: () => s.run('git merge -q --no-edit origin/main', { cwd: ann }),
        pull: (mode) => s.run({ unset: 'git pull -q', merge: 'git pull -q --no-rebase --no-edit', rebase: 'git pull -q --rebase', 'ff-only': 'git pull -q --ff-only' }[mode], { cwd: ann }),
        push: () => s.run('git push -q', { cwd: ann }),
      }
      for (const a of sc.actions) real[a.kind](a.mode)
      const commits = new Map()
      const read = (cwd, refs) => {
        for (const l of s.quiet(`git log ${refs} --format="%H|%s|%P"`, { cwd }).split('\n').filter(Boolean)) {
          const [h, m, p] = l.split('|')
          commits.set(h, { message: m, parents: p ? p.split(' ') : [] })
        }
      }
      read(ann, 'main origin/main')
      read(srv, 'main')
      const actual = remoteShape({
        commits,
        server: s.quiet('git rev-parse main', { cwd: srv }),
        tracking: s.quiet('git rev-parse origin/main', { cwd: ann }),
        local: s.quiet('git rev-parse main', { cwd: ann }),
      })
      const model = remoteShape(new RemoteModel(sc.actions))
      const ok = model === actual
      if (!ok) failedRemote++
      console.log(ok ? 'ok  ' : 'FAIL', `remote:${sc.id}`, ok ? '' : `\n--- git\n${actual}\n--- model\n${model}`)
    } finally {
      s.dispose()
    }
  }
  await server2.close()
  if (failedRemote) process.exit(failedRemote)
}
