import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { GraphPlayground, Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const r = CAPTURE.rebase
/** The id of "Add search" in a recorded graph output. */
const idOf = (out: string) => out.split("\n").find((l) => l.endsWith("Add search"))?.match(/[0-9a-f]{7}/)?.[0]

export default function Rebase() {
  return (
    <>
      <LessonGoals
        goals={[
          'explain what rebase does to commits and their ids',
          'tidy your own commits with interactive rebase',
          'copy a single commit with cherry-pick',
          'know the rule that keeps rebasing safe',
        ]}
        before="Lesson 6 — merging"
      />

      <h2>Replaying commits</h2>
      <p>
        <code>git rebase main</code> takes the commits of your branch that main does not have, and replays them one by one on top of main’s latest
        commit. The result looks as if you had started your work from there.
      </p>
      <Predict
        question={<p>After rebasing, do the feature commits keep their ids?</p>}
        options={['Yes — same changes, same ids', 'No — they are new commits with new parents, so new ids']}
        answer={1}
        explanation="A commit’s id covers its parent (lesson 4). New parent, new commit. Compare the ids before and after:"
      />
      <Transcript steps={r.rebase} />
      <p>“Add search” was {idOf(r.rebase[0].out)} and is now {idOf(r.rebase[2].out)} — same message and change, new id. Main can now fast-forward, giving a straight history:</p>
      <Transcript steps={r.ffAfter} />
      <GraphPlayground initial="rebase" only={['rebase', 'three-way']} />
      <Table
        head={['', 'merge', 'rebase']}
        rows={[
          ['history', 'shows exactly what happened, with merge commits', 'a straight line, as if work happened in order'],
          ['existing commits', 'unchanged', 'replaced by new ones'],
          ['conflicts', 'resolved once, in the merge commit', 'resolved per replayed commit (git rebase --continue)'],
          ['safe on shared branches', 'yes', 'no — see below'],
        ]}
      />

      <h2>Cleaning up before sharing: interactive rebase</h2>
      <p><code>git rebase -i</code> opens a todo list of commits that you can reorder, reword, squash or drop. Here a “fix filter” commit is folded into the commit it fixes:</p>
      <Transcript steps={r.interactive} />
      <Table
        head={['Todo command', 'Does']}
        rows={[
          ['pick', 'keep the commit'],
          ['reword', 'keep it, edit the message'],
          ['squash', 'meld into the previous commit, combining messages'],
          ['fixup', 'meld into the previous commit, keeping its message'],
          ['drop', 'remove the commit'],
          ['edit', 'stop there so you can change the commit'],
        ]}
      />
      <Callout tone="tip">
        Commit a fix with <code>git commit --fixup=&lt;commit&gt;</code> and later run <code>git rebase -i --autosquash main</code>: Git puts each fixup in
        the right place for you.
      </Callout>

      <h2>Cherry-pick: copy one commit</h2>
      <p>A fix landed on main and is also needed on a release branch, without everything else from main:</p>
      <Transcript steps={r.cherryPick} />
      <p>The copy is a new commit (new id) with the same change and message, on the release branch.</p>

      <h2>The golden rule</h2>
      <Callout tone="warn" title="Do not rebase commits that others already have">
        Rebasing replaces commits. If someone else already based work on the old ones — because you pushed them to a shared branch — their history and
        yours now disagree, and you would have to force-push over theirs. Rebase your own local or personal branches freely; never rewrite main or
        other shared branches.
      </Callout>

      <Recap
        points={[
          'rebase replays your commits on top of another branch; they get new ids.',
          'Interactive rebase reorders, rewords, squashes and drops commits before you share them.',
          'cherry-pick copies one commit onto the current branch.',
          'Never rebase commits that are already on a shared branch.',
        ]}
      />
    </>
  )
}
