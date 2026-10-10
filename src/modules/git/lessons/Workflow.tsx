import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { Transcript } from '../components'
import { CAPTURE } from '../data/captures'

const w = CAPTURE.workflow

const FLOW = `git switch main && git pull                 # start from the latest main
git switch -c feature/coupon-codes           # one branch per change
# … edit, test …
git add -p && git commit                     # small, focused commits
git push -u origin feature/coupon-codes      # publish the branch
# open a pull request; reviewers comment; CI runs the tests
git commit … && git push                     # address review comments
# the PR is merged on the hosting site (merge, squash or rebase)
git switch main && git pull && git branch -d feature/coupon-codes`

const MESSAGE = `Add coupon codes to checkout

Customers can enter one code per order. The discount is applied before
VAT, as required for invoices. Expired codes are rejected with a message.

Refs: #142`

export default function Workflow() {
  return (
    <>
      <LessonGoals
        goals={[
          'follow the feature-branch and pull-request workflow',
          'write commit messages that help later',
          'keep files out of Git with .gitignore — and remove ones that slipped in',
          'automate checks with hooks, and save typing with aliases',
        ]}
        before="Lesson 8 — remotes"
      />

      <h2>Feature branches and pull requests</h2>
      <p>Most teams work the same way: main always works, every change happens on a short-lived branch, and a pull request (merge request on GitLab) is reviewed and tested before it is merged.</p>
      <CodeBlock title="one change, start to finish" code={FLOW} />
      <Table
        head={['Merge button', 'Result on main']}
        rows={[
          ['Merge commit', 'all branch commits plus a merge commit (like --no-ff)'],
          ['Squash and merge', 'one new commit with all changes — the branch commits are not kept'],
          ['Rebase and merge', 'the branch commits replayed on main, no merge commit'],
        ]}
      />
      <Callout tone="tip" title="Protect main">
        On the hosting site, require pull requests and passing checks for main, and disallow force pushes. Mistakes then cannot reach main directly.
      </Callout>

      <h2>Commit messages</h2>
      <CodeBlock title="a good message" code={MESSAGE} />
      <ul>
        <li>A subject line of about 50 characters, in the imperative: “Add”, “Fix”, “Remove” — it completes “This commit will …”.</li>
        <li>A blank line, then the body: <em>why</em> the change was needed and anything surprising. The diff already shows <em>what</em>.</li>
        <li>Many teams use Conventional Commits (<code>feat: add coupon codes</code>, <code>fix: round VAT once</code>) so tools can build changelogs.</li>
      </ul>

      <h2>.gitignore</h2>
      <Transcript steps={w.ignore} />
      <p>
        <code>!!</code> marks ignored files. <code>!</code> in .gitignore re-includes a file (<code>.env.example</code> is kept as a template while{' '}
        <code>.env</code> with real secrets is ignored). <code>git check-ignore -v</code> tells you which rule ignores a file.
      </p>
      <Predict
        question={<p>A file is already committed. You add it to .gitignore. Does Git stop tracking it?</p>}
        options={['Yes', 'No — .gitignore only affects untracked files']}
        answer={1}
        explanation="Tracked files stay tracked. Remove it from the index (not from disk) with git rm --cached, then commit:"
      />
      <Transcript steps={w.untrack} />
      <Callout tone="warn" title="A committed secret is not removed by deleting it">
        It stays in the history, and in every clone. Rotate the secret (change the password, revoke the key) first; then, if needed, rewrite history
        with a tool such as git filter-repo and force-push.
      </Callout>

      <h2>Hooks</h2>
      <p>Hooks are scripts Git runs at certain moments. A <code>pre-commit</code> hook that exits non-zero stops the commit:</p>
      <Transcript steps={w.hook} />
      <p>
        <code>.git/hooks</code> is not committed, so teams share hooks through a tool (husky, lefthook, pre-commit) or <code>core.hooksPath</code>. Hooks
        run on each developer’s machine and can be skipped — enforce rules in CI as well.
      </p>

      <h2>Aliases</h2>
      <Transcript steps={w.aliases} />

      <Recap
        points={[
          'Branch from an up-to-date main, open a pull request, merge after review and checks, delete the branch.',
          'Subject in the imperative, about 50 characters; the body explains why.',
          '.gitignore prevents tracking; git rm --cached stops tracking an already committed file.',
          'Hooks automate local checks; CI enforces them.',
        ]}
      />
    </>
  )
}
