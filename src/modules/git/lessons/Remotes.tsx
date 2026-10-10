import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const r = CAPTURE.remotes

export default function Remotes() {
  return (
    <>
      <LessonGoals
        goals={[
          'connect a repository to a remote and push to it',
          'tell local branches, remote-tracking branches and upstreams apart',
          'know what fetch, pull and push each do',
          'handle a rejected push without losing anything',
        ]}
        before="Lesson 5 — branches; lesson 7 — rebase"
      />

      <p>
        A <strong>remote</strong> is another copy of the repository you exchange commits with — normally on GitHub, GitLab or a company server. Here Ann
        and Bob share a repository on a server at <code>/srv/git/shop.git</code>; with a hosting site the URL is <code>git@github.com:team/shop.git</code>{' '}
        or <code>https://…</code>, and everything else is the same. Every output was recorded.
      </p>

      <h2>Publishing a repository</h2>
      <Transcript steps={r.server} />
      <Transcript steps={r.addRemote} />
      <p>
        <code>-u</code> sets the <strong>upstream</strong>: from now on main tracks <code>origin/main</code>, so plain <code>git push</code> and{' '}
        <code>git pull</code> know where to go. <code>remotes/origin/main</code> is a <strong>remote-tracking branch</strong>: your read-only copy of where
        main was on origin the last time you talked to it.
      </p>

      <h2>Cloning</h2>
      <Transcript steps={r.clone} prompt="bob$" />

      <h2>fetch, then look</h2>
      <Predict
        question={<p>Bob pushed a commit. Ann runs <code>git status</code> before anything else. Does it tell her she is behind?</p>}
        options={['Yes, status checks the server', 'No — status only compares with what she last fetched']}
        answer={1}
        explanation="Git never talks to the network unless you ask. Status said “up to date” until git fetch downloaded Bob’s commit:"
      />
      <Transcript steps={r.fetch} />
      <Transcript steps={r.pullFf} />
      <Table
        head={['Command', 'Network', 'Changes your branch']}
        rows={[
          ['git fetch', 'downloads new commits, updates origin/*', 'no'],
          ['git pull', 'fetch, then merge (or rebase) origin/<branch> into yours', 'yes'],
          ['git push', 'uploads your commits, moves the branch on the server', 'no (moves origin/<branch>)'],
        ]}
      />

      <h2>When both sides have new commits</h2>
      <p>Bob pushed again while Ann committed locally. Her push is rejected — the server will not throw Bob’s commit away:</p>
      <Transcript steps={r.rejected} />
      <p>With divergent branches, a plain <code>git pull</code> asks you to choose merge or rebase (set it once with <code>pull.rebase</code>, lesson 1). Rebasing puts Ann’s commit on top of Bob’s:</p>
      <Transcript steps={r.pullRebase} />

      <h2>Force-pushing safely</h2>
      <p>
        After rewriting your own pushed commits (amend, rebase), a normal push is rejected and you need a force push. <code>--force</code> overwrites the
        remote branch unconditionally. <code>--force-with-lease</code> refuses if the remote branch moved since you last fetched — here because Bob had
        pushed in the meantime:
      </p>
      <Transcript steps={r.lease} />
      <Callout tone="warn">
        Use <code>--force-with-lease</code>, never plain <code>--force</code>, and only on branches that are yours. Protect main on the hosting site so nobody
        can force-push to it.
      </Callout>

      <h2>Branches on the remote</h2>
      <Transcript steps={r.branches} />

      <Recap
        points={[
          'origin/main is your last-known copy of main on the server; fetch updates it.',
          'pull = fetch + merge or rebase; push uploads and is rejected if the server has commits you do not.',
          'git push -u sets the upstream so plain push and pull know where to go.',
          'Prefer pull --rebase for your own work, and --force-with-lease over --force.',
        ]}
      />
    </>
  )
}
