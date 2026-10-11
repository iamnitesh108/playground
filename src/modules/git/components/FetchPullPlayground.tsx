import { useState } from 'react'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { RemoteModel, type Action } from '../simulation/remote'
import { REMOTE_SCENARIOS } from '../simulation/remoteScenarios'
import { GraphView } from './GraphView'
import styles from './FetchPullPlayground.module.css'

/** Replays actions into a fresh model, keeping each outcome. */
function build(actions: readonly Action[]): RemoteModel {
  const m = new RemoteModel()
  for (const a of actions) m.apply(a)
  return m
}

const BUTTONS: { label: string; action: Action; primary?: boolean }[] = [
  { label: 'Bob pushes a commit', action: { kind: 'bob-push' } },
  { label: 'You commit', action: { kind: 'ann-commit' } },
  { label: 'git fetch', action: { kind: 'fetch' }, primary: true },
  { label: 'git merge origin/main', action: { kind: 'merge' } },
  { label: 'git pull', action: { kind: 'pull', mode: 'unset' }, primary: true },
  { label: 'git pull --rebase', action: { kind: 'pull', mode: 'rebase' } },
  { label: 'git pull --no-rebase', action: { kind: 'pull', mode: 'merge' } },
  { label: 'git pull --ff-only', action: { kind: 'pull', mode: 'ff-only' } },
  { label: 'git push', action: { kind: 'push' } },
]

/** Three places — the server, origin/main, your main — and what each command moves. */
export function FetchPullPlayground() {
  const [scenario, setScenario] = useState<string>('free')
  const [actions, setActions] = useState<Action[]>([])
  const [shown, setShown] = useState(0)
  const preset = REMOTE_SCENARIOS.find((s) => s.id === scenario)
  const applied = preset ? preset.actions.slice(0, shown) : actions
  const m = build(applied)
  const last = m.log.at(-1)
  const moved = new Set(last?.moved ?? [])
  const short = (id: string) => `${id.slice(0, 7)} ${m.commits.get(id)!.message}`
  const unseen = [...m.ancestors(m.server)].filter((id) => !m.known.has(id)).length

  const pick = (id: string) => {
    setScenario(id)
    setShown(0)
    setActions([])
  }
  /** Any button continues from what is on screen, leaving the scenario for free play. */
  const run = (a: Action) => {
    setActions([...applied, a])
    setScenario('free')
  }

  return (
    <Demo
      title="fetch and pull, side by side"
      hint="Make Bob push, then compare git fetch with git pull. Watch which of the three places moves. Faded commits exist only on the server — your laptop has not downloaded them."
    >
      <Segmented
        label="scenario"
        value={scenario}
        options={[{ value: 'free', label: 'free play' }, ...REMOTE_SCENARIOS.map((s) => ({ value: s.id, label: s.id }))]}
        onChange={pick}
      />
      {preset && (
        <div className={styles.preset}>
          <span>{preset.title}</span>
          <Button size="sm" onClick={() => setShown((n) => Math.max(0, n - 1))} disabled={shown === 0}>Back</Button>
          <Button size="sm" variant="primary" onClick={() => setShown((n) => n + 1)} disabled={shown >= preset.actions.length}>
            Next ({shown}/{preset.actions.length})
          </Button>
        </div>
      )}

      <div className={styles.places}>
        <div className={cx(styles.place, styles.server, moved.has('server') && styles.moved)}>
          <div className={styles.where}>On the server</div>
          <div className={styles.name}>main</div>
          <code className={styles.tip}>{short(m.server)}</code>
          <div className={styles.note}>moves when anyone pushes</div>
        </div>
        <div className={cx(styles.place, moved.has('tracking') && styles.moved)}>
          <div className={styles.where}>On your laptop</div>
          <div className={styles.name}>origin/main</div>
          <code className={styles.tip}>{short(m.tracking)}</code>
          <div className={styles.note}>your memory of the server — moves only on fetch, pull or push</div>
        </div>
        <div className={cx(styles.place, moved.has('local') && styles.moved)}>
          <div className={styles.where}>On your laptop</div>
          <div className={styles.name}>main + your files</div>
          <code className={styles.tip}>{short(m.local)}</code>
          <div className={styles.note}>moves when you commit, merge, rebase — or pull</div>
        </div>
      </div>

      <GraphView commits={m.commits} branches={new Map([['main', m.local], ['origin/main', m.tracking], ['server: main', m.server]])} head={{ kind: 'branch', name: 'main' }} reachable={m.known} />

      <div className={styles.status}>
        <span className={styles.label}>git status says</span> {m.status.text}
        {m.stale && (
          <div className={styles.truth}>
            …but the server already has {unseen} commit{unseen === 1 ? '' : 's'} you have not fetched. git status only compares with origin/main — run git fetch to find out.
          </div>
        )}
      </div>

      <div className={styles.output} aria-live="polite">
        {last ? (
          <>
            <span className={styles.prompt}>$</span> {last.command}
            <div className={cx(styles.result, !last.ok && styles.error)}>{last.text}</div>
          </>
        ) : (
          <span className={styles.empty}>You and the server both have one commit. Nothing has happened yet.</span>
        )}
      </div>

      <div className={styles.buttons}>
        {BUTTONS.map((b) => (
          <Button key={b.label} size="sm" variant={b.primary ? 'primary' : 'default'} onClick={() => run(b.action)}>
            {b.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => pick('free')}>Reset</Button>
      </div>
    </Demo>
  )
}
