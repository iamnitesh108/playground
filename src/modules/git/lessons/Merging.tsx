import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { GraphPlayground, Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const m = CAPTURE.merging

export default function Merging() {
  return (
    <>
      <LessonGoals
        goals={[
          'tell a fast-forward from a three-way merge',
          'read and resolve a conflict',
          'abort a merge that went wrong',
          'know when to force a merge commit with --no-ff',
        ]}
        before="Lesson 5 — branches"
      />

      <h2>Fast-forward</h2>
      <p>If main has not moved since the branch was created, merging only has to move main forward. No new commit is made:</p>
      <Transcript steps={m.fastForward} />

      <h2>Three-way merge</h2>
      <Predict
        question={<p>Both main and the feature branch have new commits. What does <code>git merge</code> create?</p>}
        options={['Nothing; it moves main', 'A new commit with two parents', 'Copies of the feature commits on main']}
        answer={1}
        explanation="Git combines the changes of both sides since their common ancestor (the third “way”) into a merge commit that has two parents. Recorded:"
      />
      <Transcript steps={m.threeWay} />
      <p>The merge commit has <strong>two parent lines</strong>. Its tree contains both sides’ changes.</p>
      <GraphPlayground initial="three-way" only={['fast-forward', 'three-way', 'no-ff']} />

      <h2>Conflicts</h2>
      <p>When both sides changed the same lines differently, Git cannot choose. Here main set VAT to 19%, the branch to 21%:</p>
      <Transcript steps={m.conflict} />
      <Table
        head={['Marker', 'Means']}
        rows={[
          ['<<<<<<< HEAD', 'start of your side (the branch you are on)'],
          ['=======', 'separator'],
          ['>>>>>>> feature/vat', 'end of their side (the branch being merged)'],
        ]}
      />
      <p>To resolve: edit the file into the version you want — one side, the other, or a combination — and remove the markers. Then mark it resolved and commit:</p>
      <Transcript steps={m.resolve} />
      <h3>Changing your mind</h3>
      <Transcript steps={m.abort} />
      <Callout tone="tip" title="Conflicts are normal">
        They mean two people changed the same thing. Talk to the other author if unsure, run the tests after resolving, and keep branches short-lived to
        keep conflicts small. <code>git config --global merge.conflictStyle zdiff3</code> also shows the original text between the two sides.
      </Callout>

      <h2>Always a merge commit: --no-ff</h2>
      <Transcript steps={m.noFf} />
      <p>Some teams merge every feature with <code>--no-ff</code> so the history shows where each feature started and ended, even when a fast-forward was possible.</p>

      <Recap
        points={[
          'Fast-forward: the branch pointer moves; no commit is created.',
          'Three-way merge: a new commit with two parents.',
          'Conflict: edit the file, remove the markers, git add, git commit — or git merge --abort.',
        ]}
      />
    </>
  )
}
