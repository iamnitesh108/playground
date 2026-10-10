import { transcript } from '../session.mjs'
import { configure, write, commitFile } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  commitFile(s, 'app.js', "const total = 0\n", 'Add app')
  const t = transcript(s)
  const step = (label, cmds) => { const start = t.steps.length; for (const c of cmds) t.rec(c); return { label, steps: t.steps.slice(start) } }
  const out = []
  out.push(step('clean', ['git status']))
  write(s, 'cart.js', 'export const items = []\n')
  out.push(step('untracked', ['git status', 'git status --short']))
  out.push(step('stage', ['git add cart.js', 'git status --short']))
  write(s, 'app.js', "const total = 0\nconst tax = 0.2\n")
  out.push(step('modified', ['git status', 'git diff']))
  out.push(step('staged-and-modified', ['git add app.js', 'git status --short']))
  write(s, 'app.js', "const total = 0\nconst tax = 0.2\nconst currency = 'EUR'\n")
  out.push(step('both', ['git status --short', 'git diff', 'git diff --staged']))
  out.push(step('unstage', ['git restore --staged app.js', 'git status --short']))
  out.push(step('discard', ['git restore app.js', 'git status --short', 'cat app.js']))
  out.push(step('commit', ['git commit -m "Add cart"', 'git status']))
  return out
}
