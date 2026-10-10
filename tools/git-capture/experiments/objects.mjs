import { transcript } from '../session.mjs'
import { configure, write } from './_util.mjs'

export function run(s) {
  configure(s)
  s.quiet('git init -q shop')
  s.cd('shop')
  write(s, 'README.md', '# Shop\n')
  write(s, 'src/app.js', "console.log('hello')\n")
  const out = {}
  {
    const t = transcript(s)
    t.rec('ls -A .git')
    t.rec('cat .git/HEAD')
    t.rec('find .git/objects -type f')
    out.empty = t.steps
  }
  s.quiet('git add . && git commit -q -m "Add readme and app"')
  {
    const t = transcript(s)
    t.rec('git log --oneline')
    t.rec('cat .git/refs/heads/main')
    t.rec('git cat-file -t HEAD')
    t.rec('git cat-file -p HEAD')
    t.rec('git cat-file -p HEAD^{tree}')
    t.rec('git cat-file -p HEAD:src')
    t.rec('git cat-file -p HEAD:README.md')
    t.rec('find .git/objects -type f | sort')
    out.commit = t.steps
  }
  // Same content → same blob; a second commit points to its parent.
  write(s, 'docs/README-copy.md', '# Shop\n')
  {
    const t = transcript(s)
    t.rec('git hash-object README.md docs/README-copy.md')
    t.rec('echo "# Shop" | git hash-object --stdin')
    out.hash = t.steps
  }
  write(s, 'README.md', '# Shop\n\nOrders and payments.\n')
  s.quiet('git add README.md && git commit -q -m "Describe the shop"')
  {
    const t = transcript(s)
    t.rec('git cat-file -p HEAD')
    t.rec('git cat-file -p HEAD^{tree}')
    out.second = t.steps
  }
  return out
}
