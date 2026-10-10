import { useState, type FormEvent } from 'react'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { GitGraph } from '../simulation/graph'
import { GRAPH_SCENARIOS } from '../simulation/scenarios'
import { GraphView } from './GraphView'
import styles from './GraphPlayground.module.css'

/** Replays commands into a fresh model (cheap: a handful of commits). */
function build(commands: readonly string[]): GitGraph {
  const g = new GitGraph()
  for (const c of commands) g.exec(c)
  return g
}

interface GraphPlaygroundProps {
  /** Scenario to open with. */
  initial?: string
  /** Limit the scenario picker to these ids. */
  only?: readonly string[]
}

/** Step through a scenario or type commands; the graph is redrawn after each one. */
export function GraphPlayground({ initial = 'fast-forward', only }: GraphPlaygroundProps) {
  const scenarios = GRAPH_SCENARIOS.filter((s) => !only || only.includes(s.id))
  const [id, setId] = useState(initial)
  const [shown, setShown] = useState(0)
  const [extra, setExtra] = useState<string[]>([])
  const [input, setInput] = useState('')
  const scenario = scenarios.find((s) => s.id === id) ?? scenarios[0]

  const graph = build([...scenario.commands.slice(0, shown), ...extra])
  const last = graph.history.at(-1)

  const pick = (next: string) => {
    setId(next)
    setShown(0)
    setExtra([])
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setExtra((x) => [...x, input.trim().startsWith('git ') ? input.trim() : `git ${input.trim()}`])
    setInput('')
  }
  const commitCount = graph.commits.size

  return (
    <Demo
      title="The commit graph"
      hint="Step through a scenario, then try your own commands: commit, branch, switch (-c, --detach), merge (--no-ff), rebase, reset --hard, cherry-pick. Faded commits are unreachable — only the reflog still knows them."
    >
      <Segmented label="scenario" value={scenario.id} options={scenarios.map((s) => ({ value: s.id, label: s.id }))} onChange={pick} />
      <p className={styles.title}>{scenario.title}</p>
      <div className={styles.steps}>
        {scenario.commands.map((c, i) => (
          <button key={i} type="button" className={cx(styles.cmd, i < shown && styles.done, i === shown && styles.nextCmd)} onClick={() => { setShown(i + 1); setExtra([]) }}>
            {c}
          </button>
        ))}
      </div>
      <GraphView commits={graph.commits} branches={graph.branches} head={graph.head} reachable={graph.reachable()} />
      <div className={styles.output} aria-live="polite">
        {last ? (
          <>
            <span className={styles.prompt}>$</span> {last.command}
            {last.result.text && <pre className={cx(styles.text, !last.result.ok && styles.error)}>{last.result.text}</pre>}
          </>
        ) : (
          <span className={styles.empty}>An empty repository: no commits, and main does not exist yet. Press Next.</span>
        )}
      </div>
      <div className={styles.controls}>
        <Button size="sm" variant="ghost" onClick={() => pick(scenario.id)}>Reset</Button>
        <Button size="sm" onClick={() => setShown((n) => Math.max(0, n - 1))} disabled={shown === 0 || extra.length > 0}>Back</Button>
        <Button size="sm" variant="primary" onClick={() => setShown((n) => n + 1)} disabled={shown >= scenario.commands.length || extra.length > 0}>Next</Button>
        <form className={styles.form} onSubmit={submit}>
          <input className={styles.input} value={input} onChange={(e) => setInput(e.target.value)} placeholder={`commit -m "C${commitCount + 1}"   ·   switch -c topic   ·   merge topic`} aria-label="git command" />
          <Button size="sm" type="submit">Run</Button>
        </form>
      </div>
    </Demo>
  )
}
