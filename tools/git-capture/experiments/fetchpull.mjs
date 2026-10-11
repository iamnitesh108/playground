import { join } from 'node:path'
import { transcript } from '../session.mjs'
import { configure, write } from './_util.mjs'

/** Ann and Bob share /srv/git/shop.git. Everything is seen from Ann's laptop. */
export function run(s) {
  configure(s)
  const bob = join(s.root, 'home', 'bob')
  s.quiet(`mkdir -p ${bob}`)
  const asBob = { HOME: bob, GIT_AUTHOR_NAME: 'Bob Kim', GIT_AUTHOR_EMAIL: 'bob@example.com', GIT_COMMITTER_NAME: 'Bob Kim', GIT_COMMITTER_EMAIL: 'bob@example.com', GIT_CONFIG_GLOBAL: join(s.home, '.gitconfig') }
  const bobRepo = join(bob, 'shop')
  const bobCommits = (file, content, message) => {
    s.quiet(`git pull -q --rebase`, { cwd: bobRepo, env: asBob })
    write(s, join(bobRepo, file), content)
    s.quiet(`git add ${file} && git commit -q -m "${message}" && git push -q`, { cwd: bobRepo, env: asBob })
  }

  s.quiet(`git init -q --bare ${s.srv}/git/shop.git`)
  s.quiet('git init -q shop')
  s.cd('shop')
  write(s, 'app.js', "export const name = 'shop'\nexport const version = 1\nexport const debug = false\nexport const theme = 'light'\n")
  s.quiet(`git add . && git commit -q -m "Add app" && git remote add origin ${s.srv}/git/shop.git && git push -q -u origin main`)
  s.quiet(`git clone -q ${s.srv}/git/shop.git`, { cwd: bob, env: asBob })

  const out = {}
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }

  // Bob pushes two commits. Ann has not talked to the server since.
  bobCommits('app.js', "export const name = 'shop'\nexport const version = 1\nexport const debug = false\nexport const theme = 'light'\nexport const currency = 'EUR'\n", 'Bob: add currency')
  bobCommits('pay.js', 'export const retry = 3\n', 'Bob: retry payments')

  grab('stale', () => {
    t.rec('git status')
    t.rec('git log --oneline --graph --all')
  })
  grab('fetch', () => {
    t.rec('git fetch')
    t.rec('git status')
    t.rec('git log --oneline --graph --all')
  })
  grab('untouched', () => {
    t.rec('cat app.js')
    t.rec('ls')
  })
  grab('preview', () => {
    t.rec('git log --oneline main..origin/main')
    t.rec('git diff --stat main origin/main')
    t.rec('git diff main origin/main -- app.js')
  })
  grab('integrate', () => {
    t.rec('git merge origin/main')
    t.rec('git log --oneline --graph --all')
    t.rec('ls')
  })

  // pull = fetch + merge, in one command.
  bobCommits('cart.js', 'export const items = []\n', 'Bob: add cart')
  grab('pull', () => {
    t.rec('git pull')
    t.rec('git log --oneline -3')
  })
  grab('undoPull', () => {
    t.rec('git reset --hard ORIG_HEAD')
    t.rec('git log --oneline -1')
    t.rec('git status')
    t.rec('git pull --ff-only')
  })

  // Uncommitted local changes in a file the incoming commit changes: fetch is fine, pull refuses.
  bobCommits('app.js', "export const name = 'shop'\nexport const version = 1\nexport const debug = false\nexport const theme = 'light'\nexport const currency = 'USD'\n", 'Bob: switch to USD')
  write(s, 'app.js', "export const name = 'my shop'\nexport const version = 1\nexport const debug = false\nexport const theme = 'light'\nexport const currency = 'EUR'\n")
  grab('dirty', () => {
    t.rec('git status --short')
    t.rec('git fetch')
    t.rec('git pull')
    t.rec('git stash')
    t.rec('git pull')
    t.rec('git stash pop')
  })
  s.quiet('git reset -q --hard && git stash clear')

  // Divergence: Ann commits locally while Bob pushes. Compare the three ways to pull.
  bobCommits('stock.js', 'export const stock = {}\n', 'Bob: add stock')
  write(s, 'search.js', 'export const search = () => []\n')
  s.quiet('git add search.js && git commit -q -m "Ann: add search"')
  s.quiet('git branch before-pull')
  grab('diverged', () => {
    t.rec('git fetch')
    t.rec('git status')
    t.rec('git log --oneline --graph --all')
    t.rec('git pull')
  })
  grab('ffOnly', () => {
    t.rec('git pull --ff-only')
  })
  grab('pullMerge', () => {
    t.rec('git pull --no-rebase --no-edit')
    t.rec('git log --oneline --graph -5')
  })
  s.quiet('git reset -q --hard before-pull')
  grab('pullRebase', () => {
    t.rec('git pull --rebase')
    t.rec('git log --oneline --graph -5')
    t.rec('git push')
  })

  grab('prune', () => {
    s.quiet('git push -q origin HEAD:refs/heads/feature/old && git fetch -q')
    s.quiet('git push -q origin --delete feature/old', { cwd: bobRepo, env: asBob })
    t.rec('git branch -r')
    t.rec('git fetch --prune')
    t.rec('git branch -r')
  })
  return out
}
