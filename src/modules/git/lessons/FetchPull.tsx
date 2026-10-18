import { Callout, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { FetchPullPlayground } from '../components/FetchPullPlayground'
import { Transcript } from '../components/Transcript'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const f = CAPTURE.fetchpull
/** "a024d5b..2e4340e" from the recorded fetch output. */
const range = f.fetch[0].out.match(/[0-9a-f]{7}\.\.[0-9a-f]{7}/)?.[0] ?? ''
const [before, after] = range.split('..')

export default function FetchPull() {
  return (
    <>
      <LessonGoals
        goals={[
          'say exactly what git fetch changes and what it leaves alone',
          'say what git pull adds on top of fetch',
          'look at incoming work before taking it',
          'handle divergent branches, local changes and undoing a pull',
          'choose between fetch and pull with confidence',
        ]}
        before="Lesson 8 — remotes and origin/main"
      />

      <h2>The short answer</h2>
      <Table
        head={['', 'git fetch', 'git pull']}
        rows={[
          ['in one sentence', 'download what is new on the server, and change nothing of yours', 'download what is new, and immediately put it into your current branch'],
          ['is the same as', '—', 'git fetch + git merge origin/main (or + git rebase origin/main with --rebase)'],
          ['changes your branch and files', 'never', 'yes'],
          ['can cause conflicts', 'never', 'yes'],
          ['safe to run at any time', 'yes', 'only when you are ready to combine'],
        ]}
      />
      <Callout tone="analogy">
        A colleague keeps updating a shared report. <strong>fetch</strong> is downloading their latest version into a separate folder: you can read it and
        compare, and your own copy is untouched. <strong>pull</strong> is downloading it and immediately merging their changes into the copy you are
        editing.
      </Callout>

      <h2>Three places, not two</h2>
      <p>Most confusion disappears once you see that your laptop keeps a <em>copy of the server’s branch</em>, separate from your own branch:</p>
      <Table
        head={['Place', 'Where', 'Moves when …']}
        rows={[
          [<code key="a">main</code>, 'on the server', 'anyone pushes'],
          [<code key="b">origin/main</code>, 'on your laptop — a read-only bookmark: “main on the server, as of my last contact”', 'you fetch, pull or push — never by itself'],
          [<code key="c">main</code>, 'on your laptop — your branch, and the files you see', 'you commit, merge, rebase — or pull'],
        ]}
      />
      <p>
        fetch moves only <code>origin/main</code>. pull moves <code>origin/main</code> and then your <code>main</code>. Nothing ever changes the server
        except push.
      </p>

      <h2>Why git status can be wrong</h2>
      <p>Bob has pushed two commits. Ann has not run any network command since:</p>
      <Transcript steps={f.stale} />
      <Predict
        question={<p>Status says “up to date with 'origin/main'” although the server has two new commits. Is Git broken?</p>}
        options={['Yes, it should check the server', 'No — it compares with origin/main, which is only updated by fetch, pull or push']}
        answer={1}
        explanation="git status never uses the network. It compares your main with your bookmark origin/main — and that bookmark is from your last fetch. Fetch, and status tells the truth:"
      />

      <h2>Step 1 — git fetch</h2>
      <Transcript steps={f.fetch} />
      <p>
        <code>{range} main -&gt; origin/main</code> reads: “origin/main moved from {before} to {after}”. Now status knows you are 2 commits behind. In
        the graph, origin/main is ahead and your main (HEAD) has not moved. And your files are exactly as before:
      </p>
      <Transcript steps={f.untouched} title="recorded — after git fetch: no currency line, no pay.js yet" />

      <h2>Step 2 — look before you take</h2>
      <p>Because fetch downloaded the commits, you can inspect them locally — what is coming, and what it changes:</p>
      <Transcript steps={f.preview} />
      <Table
        head={['Command', 'Shows']}
        rows={[
          ['git log main..origin/main', 'commits on the server that you do not have yet (incoming)'],
          ['git log origin/main..main', 'commits you have that the server does not (outgoing — what push would send)'],
          ['git diff main origin/main', 'the combined change incoming'],
          ['git diff --stat main origin/main', 'just the files and line counts'],
        ]}
      />

      <h2>Step 3 — combine</h2>
      <Transcript steps={f.integrate} />
      <p>Only now did your branch and files change. This was a fast-forward: you had no commits of your own, so main simply moved forward.</p>

      <h2>git pull = both steps at once</h2>
      <Transcript steps={f.pull} />
      <p>
        The output is the two commands one after the other: the <code>From … main -&gt; origin/main</code> lines are the fetch, the{' '}
        <code>Updating … Fast-forward</code> lines are the merge. Convenient — but you combine without looking first.
      </p>

      <h2>Try it</h2>
      <p>
        The playground below follows the same rules as Git — it was checked against real Git for every scenario. Make Bob push, then press git fetch:
        only origin/main moves. Press git pull: both move.
      </p>
      <FetchPullPlayground />

      <h2>When both sides have new commits</h2>
      <p>Ann committed locally while Bob pushed. After a fetch, Git calls the branches <em>diverged</em>:</p>
      <Transcript steps={f.diverged} />
      <p>A plain pull stops and asks how to combine them (the fetch part did happen). There are three answers:</p>
      <Transcript steps={f.ffOnly} title="recorded — --ff-only: only fast-forwards, so it refuses" />
      <div className={own.grid2}>
        <Transcript steps={f.pullMerge} title="recorded — --no-rebase: a merge commit" />
        <Transcript steps={f.pullRebase} title="recorded — --rebase: your commit on top" />
      </div>
      <Table
        head={['Option', 'Set as default with', 'Result when diverged']}
        rows={[
          ['git pull --rebase', 'git config --global pull.rebase true', 'your commits are replayed on top of the server’s — a straight line (new ids for your commits)'],
          ['git pull --no-rebase', 'git config --global pull.rebase false', "a merge commit “Merge branch 'main' of …”"],
          ['git pull --ff-only', 'git config --global pull.ff only', 'refuses; you decide yourself, e.g. git rebase origin/main'],
        ]}
      />
      <Callout tone="tip" title="A good default">
        <code>pull.rebase true</code> for your everyday branches keeps history readable and avoids meaningless merge commits. It only rewrites your own
        unpushed commits, which is safe.
      </Callout>

      <h2>When you have uncommitted changes</h2>
      <p>Ann is editing app.js (not committed) and Bob pushed a change to the same file:</p>
      <Transcript steps={f.dirty} />
      <p>
        fetch is always safe: it never touches your files. pull refused, because combining would overwrite edits Git cannot recover. Stash them (or commit
        them), pull, and bring them back.
      </p>

      <h2>Undoing a pull</h2>
      <p>Before pull changes your branch, Git remembers where it was in <code>ORIG_HEAD</code>:</p>
      <Transcript steps={f.undoPull} />
      <p>Your branch is back where it was; origin/main still knows about the new commits, so you can integrate them again later — here with <code>--ff-only</code>.</p>

      <h2>Branches deleted on the server</h2>
      <Transcript steps={f.prune} />
      <p><code>origin/feature/old</code> stayed on your laptop after the branch was deleted on the server, until <code>--prune</code>. Make it automatic with <code>git config --global fetch.prune true</code>.</p>

      <h2>Side by side</h2>
      <Table
        head={['', 'git fetch', 'git pull']}
        rows={[
          ['downloads new commits', 'yes', 'yes'],
          ['updates origin/* (remote-tracking branches)', 'yes', 'yes'],
          ['changes your current branch', 'no', 'yes (merge, rebase or fast-forward)'],
          ['changes files in your working tree', 'no', 'yes'],
          ['can produce conflicts', 'no', 'yes'],
          ['works with uncommitted changes', 'always', 'refuses if they would be overwritten'],
          ['affects other branches of yours', 'no', 'no — only the current one'],
          ['undo', 'nothing to undo', 'git reset --hard ORIG_HEAD'],
        ]}
      />

      <h2>Which one should I use?</h2>
      <Table
        head={['Situation', 'Use']}
        rows={[
          ['“What has the team done?” — just looking', 'git fetch, then git log main..origin/main'],
          ['starting work for the day on your own branch, no local changes', 'git pull (with pull.rebase true)'],
          ['before git push', 'git pull --rebase — or fetch and check first'],
          ['you have uncommitted work', 'git fetch now; commit or stash before pulling'],
          ['you are unsure what is coming', 'git fetch, inspect, then git merge origin/main or git rebase origin/main'],
          ['updating a branch you are not on (e.g. refresh main while on a feature)', 'git fetch, then git rebase origin/main on your feature — no need to switch'],
          ['in scripts and CI', 'git fetch + an explicit merge/reset, or git pull --ff-only (never a surprise merge)'],
        ]}
      />

      <h2>Questions people ask</h2>
      <dl className={own.faq}>
        <dt>Does git fetch change my files?</dt>
        <dd>No. It only downloads commits and moves origin/* bookmarks. Your branches, staging area and files stay exactly as they are.</dd>
        <dt>So how do I see fetched changes?</dt>
        <dd>Compare with the bookmark: git log main..origin/main, git diff main origin/main, or git switch --detach origin/main to look around.</dd>
        <dt>Is git pull dangerous?</dt>
        <dd>Not dangerous — it never destroys committed work, and ORIG_HEAD undoes it — but it can surprise you with a merge commit or conflicts. Fetch first when in doubt.</dd>
        <dt>Why did git pull create a commit called “Merge branch 'main' of …”?</dt>
        <dd>Your branch and the server’s had diverged and pull was set to merge. Use git pull --rebase (or pull.rebase true) to avoid these.</dd>
        <dt>Does pull update all my branches?</dt>
        <dd>It fetches all branches of the remote (all origin/* move) but merges only into the branch you are on.</dd>
        <dt>What does “Your branch is behind 'origin/main' by 2 commits” mean exactly?</dt>
        <dd>Compared with your last fetch, the server’s main has 2 commits you have not merged. The server may have even more by now.</dd>
        <dt>git fetch printed nothing. Did it work?</dt>
        <dd>Yes — nothing was new. fetch only prints the branches that moved.</dd>
        <dt>Can I fetch from a specific remote or branch?</dt>
        <dd>git fetch origin fetches everything from origin; git fetch origin main only that branch; git fetch --all every remote.</dd>
      </dl>

      <Recap
        points={[
          'origin/main is your laptop’s bookmark of the server’s main; only fetch, pull and push move it.',
          'git fetch downloads and moves origin/*; your branch and files are untouched — always safe.',
          'git pull = git fetch + merge (or rebase) of origin/<branch> into your current branch.',
          'Diverged? pull --rebase for a straight line, --no-rebase for a merge commit, --ff-only to refuse.',
          'Undo a pull with git reset --hard ORIG_HEAD.',
        ]}
      />
    </>
  )
}
