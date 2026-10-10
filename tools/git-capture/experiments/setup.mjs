import { transcript } from '../session.mjs'
import { write } from './_util.mjs'

export function run(s) {
  const out = {}
  // A brand-new machine: no configuration at all.
  {
    const t = transcript(s)
    t.rec('git config --global --list')
    t.rec('git init first-repo')
    out.fresh = t.steps
  }
  {
    const t = transcript(s)
    t.rec('git config --global user.name "Ann Lee"')
    t.rec('git config --global user.email "ann@example.com"')
    t.rec('git config --global init.defaultBranch main')
    t.rec('git config --global core.editor "nano"')
    t.rec('git config --global pull.rebase true')
    t.rec('git config --global --list --show-origin')
    t.rec('cat ~/.gitconfig')
    out.identity = t.steps
  }
  // Levels: a repository can override the global value.
  {
    s.quiet('git init -q shop && cd shop && git config user.email "ann@shop.example"')
    s.cd('shop')
    const t = transcript(s)
    t.rec('git config --show-scope --show-origin --get-all user.email')
    t.rec('git config user.email')
    t.rec('git config --show-scope --show-origin user.name')
    out.levels = t.steps
    s.cd(s.home)
  }
  // Line endings and a global ignore file.
  {
    write(s, '.config/git/ignore', '.DS_Store\n.idea/\n*.swp\n')
    const t = transcript(s)
    t.rec('git config --global core.autocrlf input')
    t.rec('cat ~/.config/git/ignore')
    t.rec('git --version')
    out.extras = t.steps
  }
  return out
}
