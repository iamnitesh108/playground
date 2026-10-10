import { join } from 'node:path'
import { transcript } from '../session.mjs'
import { configure, write } from './_util.mjs'

/** Two people share a repository on a server (/srv/git/shop.git). */
export function run(s) {
  configure(s)
  s.quiet('git config --global --unset pull.rebase || true')
  const ann = s.home
  const bob = join(s.root, 'home', 'bob')
  s.quiet(`mkdir -p ${bob}`)
  const asBob = { HOME: bob, GIT_AUTHOR_NAME: 'Bob Kim', GIT_AUTHOR_EMAIL: 'bob@example.com', GIT_COMMITTER_NAME: 'Bob Kim', GIT_COMMITTER_EMAIL: 'bob@example.com', GIT_CONFIG_GLOBAL: join(ann, '.gitconfig') }
  const out = {}
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }

  grab('server', () => {
    t.rec(`git init --bare ${s.srv}/git/shop.git`, { show: 'git init --bare /srv/git/shop.git        # on the server' })
  })
  s.quiet('git init -q shop')
  s.cd('shop')
  write(s, 'app.js', 'v1\n')
  s.quiet('git add . && git commit -q -m "Add app"')
  grab('addRemote', () => {
    t.rec(`git remote add origin ${s.srv}/git/shop.git`, { show: 'git remote add origin /srv/git/shop.git' })
    t.rec('git remote -v')
    t.rec('git push -u origin main')
    t.rec('git branch -vv')
    t.rec('git branch -a')
  })
  grab('clone', () => {
    t.rec(`git clone ${s.srv}/git/shop.git`, { cwd: bob, env: asBob, show: 'git clone /srv/git/shop.git              # Bob, on his machine' })
    t.rec('cat shop/.git/config', { cwd: bob, env: asBob, show: 'cat shop/.git/config                     # Bob' })
  })
  const bobShop = join(bob, 'shop')
  write(s, join(bobShop, 'app.js'), 'v2\n')
  s.quiet('git commit -q -am "Bob: improve app" && git push -q', { cwd: bobShop, env: asBob })
  grab('fetch', () => {
    t.rec('git status')
    t.rec('git fetch')
    t.rec('git status')
    t.rec('git log --oneline --graph --all')
  })
  grab('pullFf', () => {
    t.rec('git pull')
  })
  // Divergence: both commit, Bob pushes first.
  write(s, join(bobShop, 'pay.js'), 'export const retry = 3\n')
  s.quiet('git add pay.js && git commit -q -m "Bob: retry payments" && git push -q', { cwd: bobShop, env: asBob })
  write(s, 'cart.js', 'export const items = []\n')
  s.quiet('git add cart.js && git commit -q -m "Ann: add cart"')
  grab('rejected', () => {
    t.rec('git push')
    t.rec('git fetch')
    t.rec('git status')
    t.rec('git pull')
  })
  grab('pullRebase', () => {
    t.rec('git pull --rebase')
    t.rec('git log --oneline --graph -4')
    t.rec('git push')
  })
  // A stale force push is refused by --force-with-lease.
  s.quiet('git pull -q --rebase', { cwd: bobShop, env: asBob })
  write(s, join(bobShop, 'pay.js'), 'export const retry = 5\n')
  s.quiet('git commit -q -am "Bob: retry 5 times" && git push -q', { cwd: bobShop, env: asBob })
  s.quiet('git commit -q --amend -m "Ann: add cart (amended)"')
  grab('lease', () => {
    t.rec('git push --force-with-lease')
    t.rec('git fetch && git status')
  })
  grab('branches', () => {
    s.quiet('git reset -q --hard origin/main')
    t.rec('git switch -c feature/search')
    write(s, 'search.js', 'export const search = () => []\n')
    t.rec('git add search.js && git commit -m "Add search"')
    t.rec('git push -u origin feature/search')
    t.rec('git branch -vv')
    t.rec('git push origin --delete feature/search')
  })
  return out
}
