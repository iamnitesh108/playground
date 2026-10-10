import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const { setup } = CAPTURE

export default function Setup() {
  return (
    <>
      <LessonGoals
        goals={[
          'explain what Git does and how it differs from GitHub or GitLab',
          'install Git on Linux, macOS or Windows',
          'set your identity and sensible defaults',
          'know the three configuration levels and which one wins',
        ]}
      />

      <h2>What Git is</h2>
      <p>
        Git records <strong>snapshots</strong> of a project over time. Each snapshot — a <strong>commit</strong> — stores the full state of every file,
        who made it, when, and why. You can compare any two snapshots, go back to any of them, and develop several lines of work side by side.
      </p>
      <TermList
        items={[
          { term: 'repository', definition: 'A project folder plus its complete history, stored in the hidden .git folder inside it.' },
          { term: 'commit', definition: 'One snapshot, with an author, a date, a message and a link to the previous commit.' },
          { term: 'branch', definition: 'A movable name for a line of work. Lesson 5.' },
          { term: 'remote', definition: 'Another copy of the repository, usually on a server, that you exchange commits with. Lesson 8.' },
        ]}
      />
      <Table
        head={['', 'Git', 'GitHub, GitLab, Bitbucket …']}
        rows={[
          ['what', 'a program on your computer', 'websites that host Git repositories'],
          ['works offline', 'yes — every clone has the full history', 'no'],
          ['adds', '—', 'pull requests, reviews, issues, CI, permissions'],
        ]}
      />
      <p>Git is <strong>distributed</strong>: every clone is a complete repository. Commits, branches and history work locally; the network is only needed to exchange commits.</p>

      <h2>Install</h2>
      <Tabs
        items={[
          {
            label: 'Ubuntu / Debian',
            content: (
              <CodeBlock
                title="terminal"
                code={`sudo apt update
sudo apt install git

# Ubuntu's version can lag behind; the Git maintainers' PPA has the latest:
sudo add-apt-repository ppa:git-core/ppa
sudo apt update && sudo apt install git`}
              />
            ),
          },
          {
            label: 'macOS',
            content: (
              <CodeBlock
                title="terminal"
                code={`xcode-select --install     # Apple's Git, with the command line tools

# or a current version with Homebrew:
brew install git`}
              />
            ),
          },
          {
            label: 'Windows',
            content: (
              <CodeBlock
                title="PowerShell"
                code={`winget install --id Git.Git -e --source winget

# or download "Git for Windows" from git-scm.com.
# It includes Git Bash, a terminal where every command in this module works as shown.`}
              />
            ),
          },
        ]}
      />
      <Transcript steps={setup.extras.slice(2)} title={`recorded — this module uses Git ${CAPTURE.git}`} />

      <h2>A brand-new machine</h2>
      <p>Before any configuration, Git has no idea who you are, and it tells you about the default branch name:</p>
      <Transcript steps={setup.fresh} />
      <Callout tone="note">
        The hint says it: the default name of the first branch will change from <code>master</code> to <code>main</code> in Git 3.0. Setting{' '}
        <code>init.defaultBranch</code> now makes every new repository start on <code>main</code>, like most hosting sites do.
      </Callout>

      <h2>Your identity and defaults</h2>
      <Predict
        question={<p>You commit without ever setting <code>user.email</code>. What ends up in the commit?</p>}
        options={['Nothing — commits do not store an email', 'Whatever Git can guess, or an error', 'Your GitHub email']}
        answer={1}
        explanation="Git guesses from your login and host name (often something like user@laptop.local) or refuses to commit. Hosting sites link commits to your account by that email, so set it before your first commit."
      />
      <Transcript steps={setup.identity} />
      <Table
        head={['Setting', 'Why']}
        rows={[
          ['user.name, user.email', 'written into every commit; the email links commits to your account on the hosting site'],
          ['init.defaultBranch main', 'the name of the first branch in new repositories'],
          ['core.editor', 'the editor Git opens for commit messages and interactive rebase (nano, vim, "code --wait")'],
          ['pull.rebase true', 'git pull replays your local commits on top instead of creating merge commits (lesson 8)'],
          ['core.autocrlf', 'Windows: true (convert line endings on checkout); macOS/Linux: input'],
          ['fetch.prune true', 'remove remote-tracking branches that were deleted on the server'],
          ['push.autoSetupRemote true', 'the first git push of a new branch sets its upstream automatically'],
        ]}
      />

      <h2>Three levels of configuration</h2>
      <Table
        head={['Level', 'File', 'Applies to']}
        rows={[
          ['system (--system)', '/etc/gitconfig', 'every user on the machine'],
          ['global (--global)', '~/.gitconfig (or ~/.config/git/config)', 'you, in every repository'],
          ['local (--local, the default)', '.git/config in the repository', 'this repository only'],
        ]}
      />
      <p>The most specific level wins. Here a repository overrides the global email:</p>
      <Transcript steps={setup.levels} />
      <p>
        <code>--show-origin</code> and <code>--show-scope</code> answer “where does this value come from?” — the first thing to check when a commit has
        the wrong name or email. Lesson 9 builds on this to separate work and personal identities automatically.
      </p>
      <h3>A global ignore file</h3>
      <Transcript steps={setup.extras.slice(1, 2)} />
      <p>Git reads <code>~/.config/git/ignore</code> in every repository: the place for files your tools create (editor folders, OS files), so each project’s .gitignore can stay about the project.</p>

      <Recap
        points={[
          'Git stores snapshots locally; hosting sites add collaboration on top.',
          'Set user.name, user.email and init.defaultBranch before the first commit.',
          'Configuration has three levels — local beats global beats system; --show-origin tells you which file a value came from.',
        ]}
      />
    </>
  )
}
