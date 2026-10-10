import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const t = CAPTURE.toolbox

export default function Toolbox() {
  return (
    <>
      <LessonGoals
        goals={[
          'park unfinished work with stash',
          'mark releases with annotated tags',
          'work on two branches at once with worktrees',
          'find the commit that introduced a bug, automatically, with bisect',
        ]}
        before="Lesson 5 — branches"
      />

      <h2>stash: put work aside</h2>
      <p>Half-way through a change, an urgent bug arrives. Stash saves your uncommitted changes and gives you a clean working tree:</p>
      <Transcript steps={t.stash} />
      <Table
        head={['Command', 'Does']}
        rows={[
          ['git stash push -m "…"', 'save tracked changes (add -u for untracked files too)'],
          ['git stash list', 'list stashes, newest first'],
          ['git stash pop', 'apply the newest stash and drop it'],
          ['git stash apply stash@{1}', 'apply a stash and keep it'],
          ['git stash drop stash@{0}', 'delete a stash'],
        ]}
      />
      <Callout tone="tip">For anything longer than a few minutes, a “wip” commit on a branch is safer than a stash: it has a name and a place.</Callout>

      <h2>tags: name a release</h2>
      <Transcript steps={t.tags} />
      <p>
        An <strong>annotated</strong> tag (<code>-a</code>) is an object with a tagger, date and message — use it for releases. <code>git describe</code>{' '}
        names the current commit relative to the latest tag: 2 commits after v1.0.0. Tags are not pushed by <code>git push</code>; use{' '}
        <code>git push origin v1.0.0</code> or <code>git push --follow-tags</code>.
      </p>

      <h2>clean: remove untracked files</h2>
      <Transcript steps={t.clean} />
      <p>Always run with <code>-n</code> (dry run) first — untracked files are not in Git and cannot be recovered.</p>

      <h2>worktrees: two branches, two folders</h2>
      <Transcript steps={t.worktree} />
      <p>A worktree is a second working folder sharing the same repository. Fix the hotfix in one folder while your feature stays untouched in the other — no stashing, no rebuilding.</p>

      <h2>bisect: let Git find the bad commit</h2>
      <Predict
        question={<p>A bug appeared somewhere in the last 8 commits. How many commits must you test, at most, with bisect?</p>}
        options={['8', '4', '3']}
        answer={2}
        explanation="Bisect halves the range each time: 8 → 4 → 2 → 1, so 3 tests. For 1,000 commits it is about 10. With a test script, Git runs it for you:"
      />
      <Transcript steps={t.bisect} />
      <p>
        <code>git bisect run</code> checks out the middle commit, runs the script (exit 0 = good, 1 = bad), and repeats. Without a script, mark each step yourself
        with <code>git bisect good</code> / <code>git bisect bad</code>. Always finish with <code>git bisect reset</code>.
      </p>

      <Recap
        points={[
          'stash parks uncommitted changes; pop brings them back.',
          'Annotated tags mark releases; push them explicitly.',
          'clean -n first; untracked files cannot be recovered.',
          'worktrees give each branch its own folder.',
          'bisect finds the first bad commit in log₂(n) steps — automatically with bisect run.',
        ]}
      />
    </>
  )
}
