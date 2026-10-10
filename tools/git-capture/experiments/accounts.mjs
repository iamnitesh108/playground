import { transcript } from '../session.mjs'
import { write } from './_util.mjs'

/** One laptop, a work identity and a personal identity. */
export function run(s) {
  const out = {}
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }

  grab('keys', () => {
    t.rec('mkdir -p ~/.ssh && chmod 700 ~/.ssh')
    t.rec('ssh-keygen -t ed25519 -C "ann@work.example" -f ~/.ssh/id_ed25519_work -N ""', { show: 'ssh-keygen -t ed25519 -C "ann@work.example" -f ~/.ssh/id_ed25519_work' })
    s.quiet('ssh-keygen -q -t ed25519 -C "ann@personal.example" -f ~/.ssh/id_ed25519_personal -N ""')
    t.rec('stat -c "%A  %n" ~/.ssh/*')
    t.rec('cat ~/.ssh/id_ed25519_personal.pub | cut -c1-40', { show: 'cat ~/.ssh/id_ed25519_personal.pub        # this is what you paste into the hosting site' })
  })

  write(s, '.ssh/config', `# Work account
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes

# Personal account
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
`)
  grab('sshConfig', () => {
    t.rec('chmod 600 ~/.ssh/config && cat ~/.ssh/config')
    t.rec('ssh -F ~/.ssh/config -G github.com-work 2>/dev/null | grep -E "^(hostname|user|identityfile|identitiesonly) "', { show: 'ssh -G github.com-work | grep -E "^(hostname|user|identityfile|identitiesonly) "' })
    t.rec('ssh -F ~/.ssh/config -G github.com-personal 2>/dev/null | grep -E "^(hostname|user|identityfile|identitiesonly) "', { show: 'ssh -G github.com-personal | grep -E "^(hostname|user|identityfile|identitiesonly) "' })
  })

  // Identity by folder: includeIf gitdir.
  write(s, '.gitconfig', `[user]
\tname = Ann Lee
\temail = ann@personal.example
[init]
\tdefaultBranch = main
[includeIf "gitdir:~/work/"]
\tpath = ~/.gitconfig-work
`)
  write(s, '.gitconfig-work', `[user]
\temail = ann@work.example
[url "git@github.com-work:"]
\tinsteadOf = git@github.com:
[core]
\tsshCommand = ssh -i ~/.ssh/id_ed25519_work -o IdentitiesOnly=yes
`)
  s.quiet('mkdir -p ~/work/api ~/personal/blog && git -C ~/work/api init -q && git -C ~/personal/blog init -q')
  s.quiet('git -C ~/work/api remote add origin git@github.com:acme-example/api.git')
  s.quiet('git -C ~/personal/blog remote add origin git@github.com-personal:ann-example/blog.git')
  grab('includeIf', () => {
    t.rec('cat ~/.gitconfig')
    t.rec('cat ~/.gitconfig-work')
    t.rec('cd ~/work/api && git config --show-origin user.email')
    t.rec('cd ~/personal/blog && git config --show-origin user.email')
    t.rec('cd ~/work/api && git config --show-origin core.sshCommand')
  })
  grab('urls', () => {
    t.rec('cd ~/work/api && git config remote.origin.url', { show: 'git config remote.origin.url          # in ~/work/api: what is stored' })
    t.rec('cd ~/work/api && git remote -v', { show: 'git remote -v                          # what git uses after insteadOf' })

  })

  // Identity by remote URL (git 2.36+), and a per-repository override.
  write(s, '.gitconfig', `[user]
\tname = Ann Lee
\temail = ann@personal.example
[includeIf "hasconfig:remote.*.url:git@github.com-work:*/**"]
\tpath = ~/.gitconfig-work
`)
  s.quiet('mkdir -p ~/code/new-service && git -C ~/code/new-service init -q && git -C ~/code/new-service remote add origin git@github.com-work:acme-example/new-service.git')
  grab('hasconfig', () => {
    t.rec('cd ~/code/new-service && git remote get-url origin && git config --show-origin user.email')
    t.rec('cd ~/personal/blog && git config --show-origin user.email')
  })

  // Signing commits with the SSH key.
  s.quiet('cd ~/personal/blog && git config gpg.format ssh && git config user.signingkey ~/.ssh/id_ed25519_personal.pub && git config commit.gpgsign true')
  s.quiet('echo "ann@personal.example $(cat ~/.ssh/id_ed25519_personal.pub)" > ~/.ssh/allowed_signers && git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers')
  grab('signing', () => {
    t.rec('cd ~/personal/blog && git config gpg.format ssh && git config user.signingkey ~/.ssh/id_ed25519_personal.pub && git config commit.gpgsign true', { show: 'git config gpg.format ssh\ngit config user.signingkey ~/.ssh/id_ed25519_personal.pub\ngit config commit.gpgsign true' })
    t.rec('cd ~/personal/blog && echo "# Blog" > README.md && git add README.md && git commit -m "Start blog"', { show: 'git commit -m "Start blog"' })
    t.rec('cd ~/personal/blog && git log --show-signature -1', { show: 'git log --show-signature -1' })
  })
  // Checking which identity a commit will use.
  grab('whoami', () => {
    t.rec('cd ~/personal/blog && git var GIT_AUTHOR_IDENT', { show: 'git var GIT_AUTHOR_IDENT          # in ~/personal/blog' })
    t.rec('cd ~/code/new-service && git var GIT_AUTHOR_IDENT', { show: 'git var GIT_AUTHOR_IDENT          # in ~/code/new-service' })
  })
  return out
}
