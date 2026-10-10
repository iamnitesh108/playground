import { LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const h = CAPTURE.history

export default function History() {
  return (
    <>
      <LessonGoals
        goals={[
          'read history in full and in one line per commit',
          'see what a commit changed',
          'search history by author, file and content',
          'name commits relative to HEAD',
          'find who last changed each line, and why',
        ]}
        before="Lesson 2 — commits"
      />

      <p>The examples use a repository with four commits by two people. Every output was recorded.</p>

      <h2>git log</h2>
      <Transcript steps={h.log} />
      <p>Newest first. Each commit has a 40-character id (a hash of its content), an author, a date and a message.</p>
      <Transcript steps={h.oneline} />
      <p>Short ids are enough as long as they are unique in the repository — Git shows 7 characters by default and accepts any unambiguous prefix.</p>

      <h2>What changed</h2>
      <Transcript steps={h.stat} />
      <Transcript steps={h.patch} />
      <p>
        A <strong>diff</strong> shows removed lines with <code>-</code> and added lines with <code>+</code>; <code>@@ -1,2 +1,3 @@</code> means “lines 1–2
        before became lines 1–3 after”. Lines without a sign are context.
      </p>

      <h2>Searching</h2>
      <Predict
        question={<p>Which command finds the commit that introduced a call to <code>reduce</code>, without knowing the file?</p>}
        options={['git log --grep="reduce"', 'git log -S"reduce"', 'git blame reduce']}
        answer={1}
        explanation="-S (the “pickaxe”) finds commits that changed how often the text appears in the code. --grep searches commit messages instead."
      />
      <Transcript steps={h.filters} />
      <Table
        head={['Option', 'Shows commits …']}
        rows={[
          ['--author="Bob"', 'by authors matching Bob'],
          ['-- <path>', 'that touched this file or folder'],
          ['-S"text"', 'that added or removed the text'],
          ['--grep="text"', 'whose message contains the text'],
          ['--since="2 weeks ago" --until=…', 'in a time range'],
          ['main..feature', 'on feature but not on main (what a merge would bring)'],
          ['--format="…"', 'in your own format (%h id, %an author, %ar relative date, %s subject)'],
        ]}
      />

      <h2>Naming commits</h2>
      <Table
        head={['Name', 'Means']}
        rows={[
          ['HEAD', 'the commit you are on'],
          ['HEAD~1, HEAD~2 …', 'one, two … commits back (following the first parent)'],
          ['HEAD^2', 'the second parent of a merge commit'],
          ['main, origin/main, v1.0.0', 'branches, remote-tracking branches and tags all name commits'],
          ['59980cf', 'any unique prefix of a commit id'],
        ]}
      />
      <Transcript steps={h.refs} />

      <h2>Who wrote this line?</h2>
      <Transcript steps={h.blame} />
      <p>
        For each line: the commit that last changed it, the author and the date (<code>^</code> marks the first commit). Use it to find the commit and
        read its message — the why — not to find someone to blame. <code>git log -L 3,3:cart.js</code> shows the full history of a line range.
      </p>

      <Recap
        points={[
          'git log --oneline --graph --all is the overview; git show <commit> the details.',
          '-S finds code changes, --grep finds messages, -- <path> limits to files.',
          'HEAD~n walks back; any unique hash prefix names a commit.',
          'git blame leads you to the commit — read its message for the reason.',
        ]}
      />
    </>
  )
}
