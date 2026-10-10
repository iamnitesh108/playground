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

  grab('ignore', () => {
    write(s, '.gitignore', 'node_modules/\ndist/\n*.log\n.env\n!.env.example\n')
    write(s, 'node_modules/lib/index.js', 'x\n')
    write(s, 'dist/app.js', 'x\n')
    write(s, 'error.log', 'x\n')
    write(s, '.env', 'DB_PASSWORD=secret\n')
    write(s, '.env.example', 'DB_PASSWORD=\n')
    t.rec('cat .gitignore')
    t.rec('git status --short')
    t.rec('git check-ignore -v .env error.log dist/app.js')
    t.rec('git status --short --ignored')
  })
  grab('untrack', () => {
    s.quiet('git add .gitignore .env.example && git commit -q -m "Add ignore rules"')
    write(s, 'secrets.json', '{"key":"123"}\n')
    s.quiet('git add secrets.json && git commit -q -m "Add config"')
    s.quiet('echo "secrets.json" >> .gitignore')
    t.rec('git status --short')
    t.rec('git rm --cached secrets.json')
    t.rec('git status --short')
    t.rec('ls secrets.json')
  })
  grab('hook', () => {
    write(s, '.git/hooks/pre-commit', '#!/bin/sh\nif git diff --cached | grep -q "console.log"; then\n  echo "pre-commit: remove console.log before committing" >&2\n  exit 1\nfi\n')
    s.quiet('chmod +x .git/hooks/pre-commit')
    t.rec('cat .git/hooks/pre-commit')
    write(s, 'debug.js', 'console.log(order)\n')
    t.rec('git add debug.js && git commit -m "Debug order"')
    t.rec('git commit --no-verify -m "Debug order"', { show: 'git commit --no-verify -m "Debug order"     # skips hooks — use rarely' })
  })
  grab('aliases', () => {
    t.rec('git config --global alias.lg "log --oneline --graph --all"')
    t.rec('git config --global alias.st "status --short --branch"')
    t.rec('git st')
    t.rec('git lg')
  })
  return out
}
