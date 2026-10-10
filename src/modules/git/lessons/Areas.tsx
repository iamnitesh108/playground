import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { AreasPlayer, type AreaFrame } from '../components'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const step = (label: string) => CAPTURE.areas.find((f) => f.label === label)!.steps

const FRAMES: AreaFrame[] = [
  { label: 'clean', caption: 'A repository with one commit. All three areas agree: nothing to do.', working: [], staged: [], committed: [{ name: 'app.js', note: 'committed' }], steps: step('clean') },
  { label: 'untracked', caption: 'A new file appears in the working tree. Git sees it but does not track it: “??” in the short status.', working: [{ name: 'cart.js', note: 'untracked' }], staged: [], committed: [{ name: 'app.js', note: 'committed' }], steps: step('untracked') },
  { label: 'stage', caption: 'git add copies the file into the staging area. “A” in the left column: added to the next commit.', working: [], staged: [{ name: 'cart.js', note: 'new file' }], committed: [{ name: 'app.js', note: 'committed' }], steps: step('stage') },
  { label: 'modified', caption: 'Now app.js is edited. The change is only in the working tree; git diff shows exactly that change.', working: [{ name: 'app.js', note: '+ tax' }], staged: [{ name: 'cart.js', note: 'new file' }], committed: [{ name: 'app.js', note: 'committed' }], steps: step('modified') },
  { label: 'staged-and-modified', caption: 'git add app.js stages that change too. “M” in the left column = staged modification.', working: [], staged: [{ name: 'cart.js', note: 'new file' }, { name: 'app.js', note: '+ tax' }], committed: [{ name: 'app.js', note: 'committed' }], steps: step('staged-and-modified') },
  { label: 'both', caption: 'Edit app.js again: “MM” — one change staged, a newer one not. git diff shows the unstaged part; git diff --staged shows what will be committed.', working: [{ name: 'app.js', note: '+ currency' }], staged: [{ name: 'cart.js', note: 'new file' }, { name: 'app.js', note: '+ tax' }], committed: [{ name: 'app.js', note: 'committed' }], steps: step('both') },
  { label: 'unstage', caption: 'git restore --staged takes app.js out of the staging area. The edits stay in the working tree.', working: [{ name: 'app.js', note: '+ tax, + currency' }], staged: [{ name: 'cart.js', note: 'new file' }], committed: [{ name: 'app.js', note: 'committed' }], steps: step('unstage') },
  { label: 'discard', caption: 'git restore app.js throws the working-tree edits away — back to the committed version. This cannot be undone.', working: [], staged: [{ name: 'cart.js', note: 'new file' }], committed: [{ name: 'app.js', note: 'committed' }], steps: step('discard') },
  { label: 'commit', caption: 'git commit turns exactly the staging area into a new commit. Clean again.', working: [], staged: [], committed: [{ name: 'app.js', note: 'committed' }, { name: 'cart.js', note: 'committed' }], steps: step('commit') },
]

export default function Areas() {
  return (
    <>
      <LessonGoals
        goals={[
          'know the three places a change can be: working tree, staging area, repository',
          'read git status, in long and short form',
          'see exactly what changed with git diff and git diff --staged',
          'stage, unstage, discard and commit precisely',
        ]}
        before="Lesson 1 — your identity is configured"
      />

      <h2>Three areas</h2>
      <p>
        Git does not commit “whatever is on disk”. A change moves through three areas, and you decide what moves. The staging area (also called the{' '}
        <strong>index</strong>) lets you build a commit from just some of your changes — for example, a bug fix without the debugging you did around it.
      </p>
      <Predict
        question={<p>You stage a file, then edit it again, then commit. Which version is committed?</p>}
        options={['The newest version on disk', 'The version you staged', 'Both, as two commits']}
        answer={1}
        explanation="A commit is made from the staging area, not from the disk. The later edit stays in the working tree, unstaged. Step through it — every command and output below was recorded:"
      />
      <AreasPlayer frames={FRAMES} />

      <h2>Reading git status --short</h2>
      <Table
        head={['Code', 'Meaning']}
        rows={[
          ['??', 'untracked: Git does not know this file'],
          ['A_', 'new file, staged (left column = staging area)'],
          ['M_', 'modified and staged'],
          ['_M', 'modified, not staged (right column = working tree)'],
          ['MM', 'staged, then modified again'],
          ['D_ / _D', 'deleted (staged / not staged)'],
          ['R_', 'renamed'],
          ['UU', 'conflict: both sides modified (lesson 6)'],
        ]}
      />
      <p className={own.note}>(_ stands for a space.)</p>

      <h2>The commands in one table</h2>
      <Table
        head={['Command', 'Moves a change …']}
        rows={[
          ['git add <file>', 'working tree → staging area'],
          ['git add -p', 'piece by piece: Git asks for each changed block (y/n)'],
          ['git restore --staged <file>', 'staging area → back out (edits kept)'],
          ['git restore <file>', 'discards working-tree edits (gone for good)'],
          ['git commit -m "…"', 'staging area → a new commit'],
          ['git commit -am "…"', 'stages all tracked, modified files and commits (not new files)'],
          ['git diff / git diff --staged', 'shows unstaged / staged changes'],
        ]}
      />
      <Callout tone="tip" title="Small commits, one idea each">
        Stage only what belongs together, and write the message as what the commit does: “Add cart total”, “Fix rounding of VAT”. Lesson 10 covers
        message conventions.
      </Callout>

      <Recap
        points={[
          'Working tree → (git add) → staging area → (git commit) → repository.',
          'A commit contains exactly what was staged.',
          'git diff shows unstaged changes; git diff --staged shows what the next commit will contain.',
          'git restore --staged unstages; git restore discards edits.',
        ]}
      />
    </>
  )
}
