import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { transcript } from '../session.mjs'

/**
 * The complete setup for a new laptop, with three accounts:
 * personal (GitHub, the default), work (GitHub) and a client (GitLab).
 * The script below is shown in the lesson exactly as tested here.
 */
export const SCRIPT = `#!/usr/bin/env bash
# One-time Git setup for several accounts. Edit these lines, then run: bash git-accounts.sh
set -euo pipefail

NAME="Ann Lee"
PERSONAL_EMAIL="ann@personal.example"   # GitHub, personal account (the default everywhere)
WORK_EMAIL="ann@work.example"           # GitHub, work account   → repositories under ~/work/
CLIENT_EMAIL="ann@client.example"       # GitLab, client account → repositories under ~/clients/acme/

mkdir -p ~/.ssh ~/work ~/clients/acme
chmod 700 ~/.ssh

# 1. One key per account (you will be asked for a passphrase — use one).
[ -f ~/.ssh/id_ed25519_personal ] || ssh-keygen -t ed25519 -C "$PERSONAL_EMAIL" -f ~/.ssh/id_ed25519_personal
[ -f ~/.ssh/id_ed25519_work ]     || ssh-keygen -t ed25519 -C "$WORK_EMAIL"     -f ~/.ssh/id_ed25519_work
[ -f ~/.ssh/id_ed25519_client ]   || ssh-keygen -t ed25519 -C "$CLIENT_EMAIL"   -f ~/.ssh/id_ed25519_client

# 2. Which key for which host. Plain github.com is the personal account.
cat >> ~/.ssh/config <<'SSH'

Host github.com
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes

Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes

Host gitlab.com-client
    HostName gitlab.com
    User git
    IdentityFile ~/.ssh/id_ed25519_client
    IdentitiesOnly yes
SSH
chmod 600 ~/.ssh/config

# 3. Commit identity: personal by default, work and client by folder.
git config --global user.name "$NAME"
git config --global user.email "$PERSONAL_EMAIL"
git config --global init.defaultBranch main
git config --global includeIf."gitdir:~/work/".path ~/.gitconfig-work
git config --global includeIf."gitdir:~/clients/acme/".path ~/.gitconfig-client

git config --file ~/.gitconfig-work user.email "$WORK_EMAIL"
git config --file ~/.gitconfig-work url."git@github.com-work:".insteadOf "git@github.com:"

git config --file ~/.gitconfig-client user.email "$CLIENT_EMAIL"
git config --file ~/.gitconfig-client url."git@gitlab.com-client:".insteadOf "git@gitlab.com:"

# 4. Public keys to add on each site (GitHub: Settings → SSH and GPG keys; GitLab: Preferences → SSH Keys).
for account in personal work client; do
  echo "== $account"
  cat ~/.ssh/id_ed25519_$account.pub
done
`

export function run(s) {
  const out = { script: SCRIPT }
  const t = transcript(s)
  const grab = (key, fn) => { const start = t.steps.length; fn(); out[key] = t.steps.slice(start) }

  // Run it unattended: the only change is an empty passphrase instead of a prompt.
  const file = join(s.root, 'git-accounts.sh')
  writeFileSync(file, SCRIPT.replaceAll(/(-f ~\/\.ssh\/id_ed25519_\w+)$/gm, '$1 -N "" -q'))
  grab('run', () => {
    t.rec(`bash ${file} | cut -c1-60`, { show: 'bash git-accounts.sh        # recorded with an empty passphrase; public keys shortened' })
  })

  // Three repositories, one per account, each cloned the way the lesson recommends.
  s.quiet('git init -q ~/code/blog && git -C ~/code/blog remote add origin git@github.com:ann-example/blog.git')
  s.quiet('git init -q ~/work/api && git -C ~/work/api remote add origin git@github.com:acme-example/api.git')
  s.quiet('git init -q ~/clients/acme/portal && git -C ~/clients/acme/portal remote add origin git@gitlab.com:acme-client/portal.git')

  grab('verifySsh', () => {
    for (const host of ['github.com', 'github.com-work', 'gitlab.com-client']) {
      t.rec(`ssh -F ~/.ssh/config -G ${host} 2>/dev/null | grep -E "^(hostname|identityfile) " | sort`, { show: `ssh -G ${host} | grep -E "^(hostname|identityfile) "` })
    }
  })
  grab('verifyRepos', () => {
    for (const dir of ['~/code/blog', '~/work/api', '~/clients/acme/portal']) {
      t.rec(`cd ${dir} && git config --show-origin user.email && git remote get-url --push origin`, { show: `cd ${dir} && git config --show-origin user.email && git remote get-url --push origin` })
    }
  })

  // A fact the lesson relies on: inside ~/work, the folder's URL rewrite already applies to git clone
  // (git creates the repository first, so includeIf gitdir matches), and to every later fetch and push.
  s.quiet(`git init -q --bare ${s.srv}/public.git && git init -q --bare ${s.srv}/mirror.git`)
  s.quiet(`git init -q ${s.root}/seed && git -C ${s.root}/seed commit -q --allow-empty -m seed && git -C ${s.root}/seed push -q ${s.srv}/mirror.git HEAD:refs/heads/main`)
  s.quiet(`git config --file ~/.gitconfig-work url."${s.srv}/mirror.git".insteadOf "${s.srv}/public.git"`)
  s.run(`cd ~/work && git clone -q ${s.srv}/public.git probe`)
  const cloned = s.run('cd ~/work/probe && git log --oneline -1').exit === 0
  const after = s.run('cd ~/work/probe && git remote get-url origin').out
  out.cloneUsesRewrite = cloned
  out.laterFetchUsesRewrite = after.endsWith('/mirror.git')
  if (!out.cloneUsesRewrite || !out.laterFetchUsesRewrite) throw new Error('URL rewrite behaviour changed: update the accounts lesson')
  return out
}
