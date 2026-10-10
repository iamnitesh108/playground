import { transcript } from '../session.mjs'
import { configure, write, commitFile } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  commitFile(s, 'cart.js', 'export const items = []\n', 'Add cart')
  commitFile(s, 'cart.js', 'export const items = []\nexport const add = (item) => items.push(item)\n', 'Add items to the cart')
  s.quiet('git config user.name "Bob Kim" && git config user.email "bob@example.com"')
  commitFile(s, 'pay.js', 'export function pay(total) {\n  return fetch("/pay", { method: "POST", body: total })\n}\n', 'Add payment call')
  s.quiet('git config --unset user.name && git config --unset user.email')
  commitFile(s, 'cart.js', 'export const items = []\nexport const add = (item) => items.push(item)\nexport const total = () => items.reduce((s, i) => s + i.price, 0)\n', 'Compute the cart total')
  const t = transcript(s)
  const out = {}
  const grab = (key, cmds) => { const start = t.steps.length; for (const c of cmds) t.rec(c); out[key] = t.steps.slice(start) }
  grab('log', ['git log'])
  grab('oneline', ['git log --oneline', 'git log --oneline -2'])
  grab('stat', ['git log --stat -1'])
  grab('patch', ['git show HEAD'])
  grab('filters', ['git log --oneline --author="Bob"', 'git log --oneline -- pay.js', 'git log --oneline -S"reduce"', 'git log --format="%h %an %ar %s"'])
  grab('refs', ['git show --stat --format="%h %s" HEAD~2', 'git diff HEAD~3 HEAD --stat'])
  grab('blame', ['git blame cart.js'])
  return out
}
