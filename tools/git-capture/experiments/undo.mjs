import { transcript } from '../session.mjs'
import { configure, write, commitFile } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  commitFile(s, 'app.js', 'v1\n', 'Add app')
  commitFile(s, 'cart.js', 'items\n', 'Add cart')
  const out = {}
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }

  grab('amend', () => {
    write(s, 'pay.js', 'pay\n')
    t.rec('git add pay.js && git commit -m "Add paymnet"')
    write(s, 'pay.js', 'pay\nretry\n')
    t.rec('git add pay.js && git commit --amend -m "Add payment"')
    t.rec('git log --oneline')
  })
  grab('soft', () => {
    t.rec('git reset --soft HEAD~1')
    t.rec('git status --short')
    t.rec('git log --oneline')
  })
  grab('mixed', () => {
    t.rec('git reset HEAD~1')
    t.rec('git status --short')
    t.rec('git log --oneline')
  })
  grab('hard', () => {
    t.rec('git add . && git commit -q -m "Add cart and payment" && git log --oneline')
    t.rec('git reset --hard HEAD~1')
    t.rec('git status --short && ls')
  })
  grab('reflog', () => {
    t.rec('git reflog -5')
    t.rec('git reset --hard HEAD@{1}')
    t.rec('git log --oneline && ls')
  })
  grab('revert', () => {
    t.rec('git revert --no-edit HEAD')
    t.rec('git log --oneline')
    t.rec('git show --stat --format="%h %s%n%n%b" HEAD')
  })
  grab('restoreFile', () => {
    write(s, 'app.js', 'v1 broken\n')
    t.rec('git commit -qam "Break app" && cat app.js')
    t.rec('git restore --source=HEAD~1 app.js')
    t.rec('cat app.js && git status --short')
  })
  grab('lostBranch', () => {
    s.quiet('git commit -qam "Fix app"')
    s.quiet('git switch -q -c experiment')
    commitFile(s, 'idea.js', 'idea\n', 'Try an idea')
    s.quiet('git switch -q main')
    t.rec('git branch -D experiment')
    t.rec('git reflog | grep "Try an idea"')
    t.rec('git branch experiment HEAD@{1}')
    t.rec('git log --oneline -1 experiment')
  })
  return out
}
