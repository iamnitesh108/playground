import { transcript } from '../session.mjs'
import { configure, write, commitFile } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  commitFile(s, 'price.js', 'export const VAT = 0.20\nexport const round = (x) => Math.round(x * 100) / 100\n', 'Add price helpers')
  const out = {}
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }

  // Fast-forward: main has not moved since the branch was created.
  s.quiet('git switch -q -c feature/coupons')
  commitFile(s, 'coupons.js', 'export const apply = (t, p) => t * (1 - p)\n', 'Add coupons')
  s.quiet('git switch -q main')
  grab('fastForward', () => {
    t.rec('git log --oneline --graph --all')
    t.rec('git merge feature/coupons')
    t.rec('git log --oneline --graph --all')
  })

  // Three-way merge: both sides have new commits.
  s.quiet('git switch -q -c feature/invoices')
  commitFile(s, 'invoice.js', 'export const number = (n) => `INV-${n}`\n', 'Add invoice numbers')
  s.quiet('git switch -q main')
  commitFile(s, 'README.md', '# Shop\n', 'Add readme')
  grab('threeWay', () => {
    t.rec('git log --oneline --graph --all')
    t.rec('git merge feature/invoices -m "Merge branch \'feature/invoices\'"')
    t.rec('git log --oneline --graph --all')
    t.rec('git cat-file -p HEAD')
  })

  // A conflict: both branches change the same line.
  s.quiet('git switch -q -c feature/vat')
  write(s, 'price.js', 'export const VAT = 0.21\nexport const round = (x) => Math.round(x * 100) / 100\n')
  s.quiet('git commit -q -am "Raise VAT to 21%"')
  s.quiet('git switch -q main')
  write(s, 'price.js', 'export const VAT = 0.19\nexport const round = (x) => Math.round(x * 100) / 100\n')
  s.quiet('git commit -q -am "Lower VAT to 19%"')
  grab('conflict', () => {
    t.rec('git merge feature/vat')
    t.rec('git status')
    t.rec('cat price.js')
    t.rec('git diff')
  })
  grab('resolve', () => {
    write(s, 'price.js', 'export const VAT = 0.21\nexport const round = (x) => Math.round(x * 100) / 100\n')
    t.rec('cat price.js')
    t.rec('git add price.js')
    t.rec('git status --short')
    t.rec('git commit --no-edit')
    t.rec('git log --oneline --graph -6')
  })
  // Aborting instead.
  s.quiet('git switch -q -c feature/vat2 HEAD~1 && git switch -q main')
  s.quiet('git switch -q feature/vat2')
  write(s, 'price.js', 'export const VAT = 0.25\nexport const round = (x) => Math.round(x * 100) / 100\n')
  s.quiet('git commit -q -am "VAT 25%" && git switch -q main')
  grab('abort', () => {
    t.rec('git merge feature/vat2')
    t.rec('git merge --abort')
    t.rec('git status --short')
  })
  grab('noFf', () => {
    s.quiet('git switch -q -c feature/footer')
    commitFile(s, 'footer.js', 'export const year = 2026\n', 'Add footer')
    s.quiet('git switch -q main')
    t.rec('git merge --no-ff feature/footer -m "Merge branch \'feature/footer\'"')
    t.rec('git log --oneline --graph -3')
  })
  return out
}
