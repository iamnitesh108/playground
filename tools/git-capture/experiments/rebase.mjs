import { transcript } from '../session.mjs'
import { configure, write, commitFile } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  commitFile(s, 'app.js', 'v1\n', 'Add app')
  s.quiet('git switch -q -c feature/search')
  commitFile(s, 'search.js', 'export const search = (q) => []\n', 'Add search')
  commitFile(s, 'search.js', 'export const search = (q) => items.filter((i) => i.name.includes(q))\n', 'Search by name')
  s.quiet('git switch -q main')
  commitFile(s, 'app.js', 'v2\n', 'Fix checkout')
  s.quiet('git switch -q feature/search')
  const out = {}
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }
  grab('rebase', () => {
    t.rec('git log --oneline --graph --all')
    t.rec('git rebase main')
    t.rec('git log --oneline --graph --all')
  })
  grab('ffAfter', () => {
    t.rec('git switch main')
    t.rec('git merge feature/search')
    t.rec('git log --oneline')
  })
  // Interactive rebase, scripted: squash the two search commits into one.
  s.quiet('git switch -q -c feature/filters')
  commitFile(s, 'filters.js', 'export const byPrice = () => {}\n', 'Add price filter')
  write(s, 'filters.js', 'export const byPrice = (max) => (i) => i.price <= max\n')
  s.quiet('git commit -q -am "fix filter"')
  grab('interactive', () => {
    t.rec('git log --oneline -3')
    const todo = `${s.root}/todo.txt`
    t.rec('git rebase -i HEAD~2', {
      show: 'git rebase -i HEAD~2      # in the editor: change "pick" to "fixup" on the second line',
      env: { GIT_SEQUENCE_EDITOR: `f() { grep -v '^#' "$1" | grep -v '^$' > ${todo}; sed -i "2s/^pick/fixup/" "$1"; }; f` },
    })
    t.rec(`cat ${todo}`, { show: '# the todo list git opened in the editor (comments removed)' })
    t.rec('git log --oneline -2')
  })
  grab('cherryPick', () => {
    s.quiet('git switch -q main')
    s.quiet('git switch -q -c release/1.0 HEAD~1')
    s.quiet('git switch -q main')
    commitFile(s, 'pay.js', 'export const retry = 3\n', 'Retry failed payments')
    t.rec('git log --oneline -1')
    t.rec('git switch release/1.0')
    t.rec('git cherry-pick main')
    t.rec('git log --oneline -2')
  })
  return out
}
