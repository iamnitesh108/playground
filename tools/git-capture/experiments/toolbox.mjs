import { transcript } from '../session.mjs'
import { configure, write, commitFile } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  commitFile(s, 'app.js', 'v1\n', 'Add app')
  const out = {}
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }

  grab('stash', () => {
    write(s, 'app.js', 'v1\nhalf-done feature\n')
    write(s, 'notes.txt', 'todo\n')
    t.rec('git status --short')
    t.rec('git stash push -u -m "half-done feature"')
    t.rec('git status --short')
    t.rec('git stash list')
    t.rec('git stash show -p --include-untracked stash@{0}')
    t.rec('git stash pop')
    t.rec('git status --short')
  })
  grab('tags', () => {
    s.quiet('git add . && git commit -q -m "Finish feature"')
    t.rec('git tag v1.0.0 -a -m "First release"')
    commitFile(s, 'app.js', 'v2\n', 'Improve app')
    commitFile(s, 'app.js', 'v3\n', 'Fix bug')
    t.rec('git tag')
    t.rec('git describe')
    t.rec('git show v1.0.0 --stat --format="%h %s"')
    t.rec('git push origin v1.0.0', { show: 'git push origin v1.0.0        # tags are not pushed by plain "git push"' })
  })
  out.tags = out.tags.filter((step) => !step.cmd.startsWith('git push')) // there is no remote here
  grab('clean', () => {
    write(s, 'build/out.js', 'compiled\n')
    write(s, 'debug.log', 'log\n')
    t.rec('git clean -n -d')
    t.rec('git clean -f -d')
  })
  grab('worktree', () => {
    t.rec('git worktree add ../shop-hotfix -b hotfix/vat')
    t.rec('git worktree list')
    t.rec('cd ../shop-hotfix && git branch --show-current', { show: 'cd ../shop-hotfix && git branch --show-current' })
    t.rec('git worktree remove ../shop-hotfix')
  })
  // bisect: find the commit that broke a test.
  s.quiet('git switch -q -c bisect-demo')
  for (let i = 1; i <= 8; i++) {
    const broken = i >= 6
    commitFile(s, 'total.sh', `echo $(($1 ${broken ? '-' : '+'} $2)) # v${i}\n`, i === 6 ? 'Refactor total' : `Change ${i}`)
  }
  write(s, 'test.sh', '#!/bin/sh\n# exit 0 = good, 1 = bad\n[ "$(sh total.sh 2 2)" = 4 ]\n')
  s.quiet('chmod +x test.sh')
  grab('bisect', () => {
    t.rec('git log --oneline -9')
    t.rec('cat test.sh')
    t.rec('git bisect start HEAD HEAD~8')
    t.rec('git bisect run ./test.sh')
    t.rec('git bisect reset')
  })
  return out
}
