import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const a = CAPTURE.accounts

export default function Accounts() {
  return (
    <>
      <LessonGoals
        goals={[
          'create one SSH key per account and register it',
          'route each repository to the right account with SSH host aliases',
          'pick the right name and email automatically, by folder or by remote URL',
          'sign commits, and check which identity Git will use',
        ]}
        before="Lesson 1 — configuration levels; lesson 8 — remotes"
      />

      <h2>The problem</h2>
      <p>
        One laptop, two accounts on the same hosting site: a work account (<code>ann@work.example</code>) and a personal one (
        <code>ann@personal.example</code>). Two things must be right for every repository:
      </p>
      <Table
        head={['', 'Decides', 'Wrong value means']}
        rows={[
          ['authentication', 'which account the push is made as (SSH key or HTTPS token)', '“Permission denied” or “Repository not found”'],
          ['commit identity', 'the name and email written into each commit', 'personal email in work history — permanently'],
        ]}
      />
      <p>They are independent: the SSH key does not set the commit email, and the email does not choose the key. This lesson sets up both, with everything recorded in a sandbox.</p>

      <h2>1. One SSH key per account</h2>
      <Transcript steps={a.keys} />
      <p>
        Each key is a pair: the private key stays on your machine (<code>-rw-------</code>), the <code>.pub</code> file is added to the account on the
        hosting site (on GitHub: Settings → SSH and GPG keys). Add the work key to the work account and the personal key to the personal account. A key
        can belong to only one account on a site.
      </p>

      <h2>2. SSH host aliases</h2>
      <p>
        Both accounts live at <code>github.com</code>, so SSH needs another way to know which key to use. Give each account its own alias in{' '}
        <code>~/.ssh/config</code>:
      </p>
      <Transcript steps={a.sshConfig.slice(0, 1)} />
      <Predict
        question={<p>Why <code>IdentitiesOnly yes</code>?</p>}
        options={['It is required for ed25519 keys', 'Without it, SSH also offers other keys from the agent — and the site may log you in as the wrong account']}
        answer={1}
        explanation="The hosting site accepts the first key it recognises. If the agent offers the personal key first, a work push arrives as the personal account. IdentitiesOnly makes SSH offer only the configured key."
      />
      <p><code>ssh -G</code> prints what SSH will really use for a host — check the aliases without connecting:</p>
      <Transcript steps={a.sshConfig.slice(1)} />
      <p>Then use the alias in remote URLs:</p>
      <CodeBlock
        title="cloning and remotes"
        code={`git clone git@github.com-work:acme-example/api.git            # work account
git clone git@github.com-personal:ann-example/blog.git        # personal account

git remote set-url origin git@github.com-personal:ann-example/blog.git   # fix an existing clone

ssh -T git@github.com-work        # GitHub answers: "Hi <work username>! You've successfully authenticated…"
ssh -T git@github.com-personal    # … and the personal username here`}
      />

      <h2>3. The right email, automatically</h2>
      <Tabs
        items={[
          {
            label: 'By folder (includeIf gitdir)',
            content: (
              <>
                <p>Keep work repositories under <code>~/work/</code>. A conditional include loads extra settings for everything below it:</p>
                <Transcript steps={a.includeIf} />
                <p>
                  The trailing slash in <code>gitdir:~/work/</code> matters: it means “this folder and everything below”. The work file can also set{' '}
                  <code>core.sshCommand</code> to pick the key, and rewrite URLs with <code>insteadOf</code>, so even a URL copied from the website goes through
                  the work alias:
                </p>
                <Transcript steps={a.urls} />
              </>
            ),
          },
          {
            label: 'By remote URL (hasconfig)',
            content: (
              <>
                <p>Since Git 2.36 the condition can be the remote URL instead of the folder — useful when repositories live anywhere:</p>
                <CodeBlock
                  title="~/.gitconfig"
                  code={`[user]
\tname = Ann Lee
\temail = ann@personal.example
[includeIf "hasconfig:remote.*.url:git@github.com-work:*/**"]
\tpath = ~/.gitconfig-work`}
                />
                <Transcript steps={a.hasconfig} />
                <Callout tone="warn" title="Mind the pattern">
                  The pattern uses Git’s glob rules, where <code>**</code> only works next to a slash. <code>git@github.com-work:**</code> matches nothing; the
                  working form is <code>git@github.com-work:*/**</code> (owner / repository). Always check with <code>git config --show-origin user.email</code>.
                </Callout>
              </>
            ),
          },
          {
            label: 'Per repository',
            content: (
              <>
                <p>For a one-off, set it in the repository itself — local beats global:</p>
                <CodeBlock title="inside the repository" code={`git config user.email "ann@work.example"\ngit config --show-origin user.email`} />
                <p>Easy to forget in the next clone, which is why the automatic ways are better.</p>
              </>
            ),
          },
        ]}
      />
      <h3>Which identity will this commit use?</h3>
      <Transcript steps={a.whoami} />
      <p>Run it in a new clone before the first commit. A wrong email can be fixed before pushing with <code>git commit --amend --reset-author --no-edit</code>.</p>

      <h2>4. Signed commits</h2>
      <p>
        Anyone can write any name and email into a commit. A <strong>signature</strong> proves the commit was made with your key, and hosting sites show
        it as “Verified”. Git can sign with an SSH key (since 2.34) — the same kind you already have:
      </p>
      <Transcript steps={a.signing} />
      <p>
        Locally, verification needs <code>gpg.ssh.allowedSignersFile</code> (a list of emails and their keys). On the hosting site, add the public key once
        more as a <em>signing</em> key. Put these settings in the work or personal include file to sign with the matching key.
      </p>

      <h2>HTTPS instead of SSH</h2>
      <Table
        head={['Approach', 'How']}
        rows={[
          ['GitHub CLI', 'gh auth login for each account; gh auth switch changes the active one; gh auth setup-git makes Git use it for HTTPS'],
          ['Git Credential Manager', 'stores tokens per account; with credential.useHttpPath true it can keep separate credentials per repository path'],
          ['the username in the URL', 'https://ann-work@github.com/acme-example/api.git — credential helpers store one token per username, so each remote uses its account'],
        ]}
      />

      <h2>Troubleshooting</h2>
      <Table
        head={['Symptom', 'Check']}
        rows={[
          ['“Permission denied (publickey)”', 'ssh -T git@<alias>; is the .pub key added to that account? IdentitiesOnly yes?'],
          ['“Repository not found” although it exists', 'you are authenticated as the other account: check the remote URL uses the right alias'],
          ['commits show the wrong email', 'git config --show-origin user.email inside the repository'],
          ['includeIf seems ignored', 'trailing slash in gitdir:; the repository is really under that folder (symlinks!); the hasconfig pattern'],
          ['which key does SSH try?', 'ssh -v git@<alias> 2>&1 | grep -i offering'],
        ]}
      />

      <Recap
        points={[
          'One SSH key per account, registered on that account.',
          'Host aliases in ~/.ssh/config (with IdentitiesOnly yes) choose the key; use the alias in remote URLs.',
          'includeIf (by folder or by remote URL) chooses the commit email automatically.',
          'Check with ssh -G, ssh -T, git config --show-origin and git var GIT_AUTHOR_IDENT.',
        ]}
      />
    </>
  )
}
