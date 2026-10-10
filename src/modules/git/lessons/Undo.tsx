import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const u = CAPTURE.undo

export default function Undo() {
  return (
    <>
      <LessonGoals
        goals={[
          'fix the last commit with --amend',
          'move a branch back with reset — and know what soft, mixed and hard keep',
          'undo a pushed commit safely with revert',
          'recover “lost” commits and branches with the reflog',
        ]}
        before="Lesson 2 — the three areas"
      />

      <h2>Pick the right tool</h2>
      <Table
        head={['You want to …', 'Use', 'Rewrites history?']}
        rows={[
          ['discard uncommitted edits to a file', 'git restore <file>', 'no (edits are lost)'],
          ['unstage a file', 'git restore --staged <file>', 'no'],
          ['fix the last commit (message or content), not yet pushed', 'git commit --amend', 'yes'],
          ['undo the last commits but keep the changes', 'git reset --soft / --mixed HEAD~n', 'yes'],
          ['throw the last commits away', 'git reset --hard HEAD~n', 'yes'],
          ['undo a commit that is already pushed', 'git revert <commit>', 'no — adds a commit'],
          ['get a file back as it was in a commit', 'git restore --source=<commit> <file>', 'no'],
        ]}
      />

      <h2>Amend the last commit</h2>
      <Transcript steps={u.amend} />
      <p>The typo commit is replaced by a new one (new id) containing the extra change too. Only amend commits you have not pushed.</p>

      <h2>reset: move the branch back</h2>
      <Predict
        question={<p>After <code>git reset --soft HEAD~1</code>, where are the changes of the commit you undid?</p>}
        options={['Gone', 'Staged, ready to commit again', 'In the working tree, unstaged']}
        answer={1}
        explanation="--soft only moves the branch. --mixed (the default) also empties the staging area, leaving the changes in the working tree. --hard also resets the working tree: changes gone."
      />
      <Transcript steps={u.soft} title="recorded — --soft" />
      <Transcript steps={u.mixed} title="recorded — --mixed (the default)" />
      <Transcript steps={u.hard} title="recorded — --hard" />
      <Table
        head={['', 'branch', 'staging area', 'working tree']}
        rows={[
          ['--soft', 'moved', 'kept', 'kept'],
          ['--mixed', 'moved', 'reset', 'kept'],
          ['--hard', 'moved', 'reset', 'reset — uncommitted changes are lost'],
        ]}
      />

      <h2>The reflog: Git’s undo history</h2>
      <p>
        Every time HEAD moves — commit, reset, switch, rebase — Git writes it in the <strong>reflog</strong>. A commit that no branch points to any more is
        still there and listed, for 90 days by default:
      </p>
      <Transcript steps={u.reflog} />
      <p>The “lost” commit is back. The same works for a deleted branch:</p>
      <Transcript steps={u.lostBranch} />
      <Callout tone="note" title="What the reflog cannot save">
        Changes that were never committed (or stashed). <code>git reset --hard</code> and <code>git restore</code> on uncommitted edits are the two ways to
        really lose work — commit early, even “wip”, and clean up later.
      </Callout>

      <h2>revert: undo without rewriting</h2>
      <Transcript steps={u.revert} />
      <p>A revert is a new commit that applies the opposite change. History stays intact, so it is the safe way to undo something already on a shared branch.</p>

      <h2>One file from the past</h2>
      <Transcript steps={u.restoreFile} />

      <Recap
        points={[
          'Not pushed yet: amend and reset are fine. Already shared: revert.',
          'reset --soft keeps changes staged, --mixed keeps them unstaged, --hard discards them.',
          'git reflog finds any commit HEAD pointed to recently; reset or branch to bring it back.',
          'Only uncommitted work can be truly lost.',
        ]}
      />
    </>
  )
}
