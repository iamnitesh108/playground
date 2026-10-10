import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const o = CAPTURE.objects
const pick = (steps: typeof o.commit, cmd: string) => steps.filter((s) => s.cmd.startsWith(cmd))

export default function Internals() {
  return (
    <>
      <LessonGoals
        goals={[
          'name the three kinds of objects Git stores: blob, tree, commit',
          'explain why a commit id changes when anything about it changes',
          'see that a branch is a file containing a commit id',
        ]}
        before="Lesson 2 — commits"
      />

      <p>
        Knowing how Git stores data makes every other command predictable. It is surprisingly simple — and you can look at all of it yourself. All
        output below is from a real repository.
      </p>

      <h2>An empty repository</h2>
      <Transcript steps={o.empty} />
      <p><code>HEAD</code> already names a branch that has no commit yet. The object store is empty.</p>

      <h2>After one commit</h2>
      <Transcript steps={pick(o.commit, 'git log').concat(pick(o.commit, 'cat .git/refs'))} />
      <p>A branch <em>is</em> that file: 40 hex characters, the id of the commit it points to. Creating a branch writes one small file.</p>
      <Transcript steps={pick(o.commit, 'git cat-file')} />
      <Table
        head={['Object', 'Contains']}
        rows={[
          ['blob', 'the bytes of one file — no name, no permissions'],
          ['tree', 'a directory listing: names, modes, and the ids of blobs and subtrees'],
          ['commit', 'one tree (the full snapshot), parent commit(s), author, committer, message'],
        ]}
      />
      <Transcript steps={pick(o.commit, 'find')} />
      <p>Five objects: one commit, two trees (root and src), two blobs. Each is stored under its id: the first two characters are the folder name.</p>

      <h2>Ids are fingerprints of content</h2>
      <Predict
        question={<p>Two different files have the same content. How many blobs does Git store?</p>}
        options={['Two, one per file', 'One — the id is computed from the content']}
        answer={1}
        explanation="An object’s id is a hash of its content, so identical content has the same id and is stored once. Recorded:"
      />
      <Transcript steps={o.hash} />
      <p>
        The same holds one level up: a commit’s id is the hash of its tree, parents, author, dates and message. Change any of them — even fix a typo in
        the message — and you get a different commit. That is why “rewriting history” (amend, rebase) always creates new commits.
      </p>

      <h2>The second commit</h2>
      <Transcript steps={o.second} />
      <div className={own.grid2}>
        <Callout tone="note" title="parent">
          The new commit points to the previous one. Following parents from a branch tip gives the whole history.
        </Callout>
        <Callout tone="note" title="unchanged parts are shared">
          <code>src</code> did not change, so the new tree reuses the same tree id ({o.commit[4].out.split('\n')[1].split(/\s+/)[2].slice(0, 7)}). Snapshots
          are cheap: only changed files and folders get new objects.
        </Callout>
      </div>
      <Callout tone="tip" title="Real repositories pack objects">
        Over time Git compresses objects into pack files (<code>.git/objects/pack</code>) and stores similar versions as deltas. The model stays the same.
      </Callout>

      <Recap
        points={[
          'Blobs hold file content, trees hold directories, commits hold a tree plus parents and metadata.',
          'Every id is a hash of the content, so identical content is stored once and any change gives a new id.',
          'A branch is a file with a commit id; HEAD names the current branch.',
        ]}
      />
    </>
  )
}
