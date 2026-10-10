import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { GraphPlayground, Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const b = CAPTURE.branches

export default function Branches() {
  return (
    <>
      <LessonGoals
        goals={[
          'create, list, switch, rename and delete branches',
          'explain what HEAD is, and what “detached HEAD” means',
          'predict how the commit graph changes — and check it in the playground',
        ]}
        before="Lesson 4 — a branch is a file with a commit id"
      />

      <h2>A branch is a movable pointer</h2>
      <p>
        A branch names one commit. When you commit on a branch, the branch moves to the new commit. <strong>HEAD</strong> says which branch you are on.
        Creating a branch copies nothing: it writes one file.
      </p>
      <Transcript steps={b.create} />
      <Transcript steps={b.switch} />
      <p>After <code>git switch</code>, HEAD names the other branch, and the working tree shows that branch’s files.</p>

      <h2>Diverging lines</h2>
      <Transcript steps={b.graph} />
      <p>Read the graph bottom-up: both branches share “Add app” and “Improve app”, then each has its own commit. Nothing is merged yet.</p>

      <h2>Practise on the graph</h2>
      <p>
        This model of Git was tested against real Git: for every scenario, the same commands give the same commits, parents, branches and HEAD. Step
        through, then type your own commands.
      </p>
      <GraphPlayground initial="fast-forward" />

      <h2>Detached HEAD</h2>
      <Predict
        question={<p>You switch to an old commit with <code>git switch --detach HEAD~1</code>, make a commit, then switch back to main. What happens to that commit?</p>}
        options={['It is added to main', 'It stays, but no branch points to it', 'Git refuses to commit']}
        answer={1}
        explanation="On a detached HEAD, new commits belong to no branch. When you leave, nothing points to them any more (pick “detached” in the playground). To keep them, create a branch before leaving: git switch -c <name>."
      />
      <Transcript steps={b.detached} />

      <h2>Create, rename, delete</h2>
      <Transcript steps={b.newBranch} />
      <Transcript steps={b.delete} />
      <Table
        head={['Command', 'Does']}
        rows={[
          ['git branch', 'list local branches (* = current)'],
          ['git branch -v / -vv', 'with the last commit / and the upstream (lesson 8)'],
          ['git switch <name>', 'go to a branch'],
          ['git switch -c <name>', 'create a branch here and go to it'],
          ['git switch -', 'go back to the previous branch'],
          ['git branch -m <old> <new>', 'rename'],
          ['git branch -d <name>', 'delete if merged — refuses otherwise'],
          ['git branch -D <name>', 'delete anyway (the commits can still be found in the reflog for a while)'],
        ]}
      />
      <Callout tone="note" title="git checkout">
        Older guides use <code>git checkout</code> for both switching branches and restoring files. Since Git 2.23 those jobs are split into{' '}
        <code>git switch</code> and <code>git restore</code>, which are harder to misuse. checkout still works.
      </Callout>

      <Recap
        points={[
          'A branch is a pointer to a commit; committing moves the current branch forward.',
          'HEAD points to the current branch — or directly to a commit (detached).',
          'Commits made on a detached HEAD need a branch, or they are left behind.',
          'branch -d protects unmerged work; -D does not.',
        ]}
      />
    </>
  )
}
