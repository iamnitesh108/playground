import { transcript } from '../session.mjs'
import { configure, write, commitFile } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  commitFile(s, 'app.js', 'v1\n', 'Add app')
  commitFile(s, 'app.js', 'v2\n', 'Improve app')
  const t = transcript(s)
  const out = {}
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }
  grab('create', () => {
    t.rec('git branch feature/coupons')
    t.rec('git branch')
    t.rec('cat .git/refs/heads/feature/coupons')
    t.rec('cat .git/HEAD')
  })
  grab('switch', () => {
    t.rec('git switch feature/coupons')
    t.rec('cat .git/HEAD')
    write(s, 'coupons.js', 'export const apply = (total, pct) => total * (1 - pct)\n')
    t.rec('git add coupons.js && git commit -m "Add coupons"')
    t.rec('git branch -v')
  })
  grab('graph', () => {
    t.rec('git switch main')
    write(s, 'app.js', 'v3\n')
    t.rec('git commit -am "Fix rounding"')
    t.rec('git log --oneline --graph --all')
  })
  grab('newBranch', () => {
    t.rec('git switch -c fix/typo')
    t.rec('git switch -')
  })
  grab('detached', () => {
    t.rec('git switch --detach HEAD~1')
    t.rec('git status')
    t.rec('git switch main')
  })
  grab('delete', () => {
    t.rec('git branch -d feature/coupons')
    t.rec('git branch -d fix/typo')
    t.rec('git branch -m feature/coupons feature/discounts')
    t.rec('git branch')
  })
  return out
}
