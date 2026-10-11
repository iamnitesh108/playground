import { Observable } from '@/shared/utils/observable'
import type { Commit } from './graph'

/*
 * fetch versus pull, reduced to the three pointers that matter:
 *   server   — main on the server (changes when anyone pushes)
 *   tracking — origin/main in your repository: your last-known copy of server
 *   local    — your main (and the files you see)
 * plus which commits your repository has downloaded so far.
 * Tested against real git with the same action sequences.
 */

export type PullMode = 'unset' | 'merge' | 'rebase' | 'ff-only'

export type Action =
  | { kind: 'bob-push' }
  | { kind: 'ann-commit' }
  | { kind: 'fetch' }
  | { kind: 'merge' }
  | { kind: 'pull'; mode: PullMode }
  | { kind: 'push' }

export interface Outcome {
  ok: boolean
  command: string
  text: string
  /** Which pointers moved, for highlighting. */
  moved: ('server' | 'tracking' | 'local')[]
}

/** What git status reports — computed only from local and tracking, like real git. */
export interface Status {
  ahead: number
  behind: number
  text: string
}

/** FNV-1a, a stable short id. */
function shortHash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 7)
}

const COMMAND: Record<Action['kind'], string> = {
  'bob-push': 'git commit && git push        # Bob, on his machine',
  'ann-commit': 'git commit -m "…"',
  fetch: 'git fetch',
  merge: 'git merge origin/main',
  pull: 'git pull',
  push: 'git push',
}

export class RemoteModel extends Observable {
  commits = new Map<string, Commit>()
  server = ''
  tracking = ''
  local = ''
  /** Commits that exist in Ann's repository. */
  known = new Set<string>()
  log: Outcome[] = []
  private seq = 0
  private bob = 0
  private ann = 0

  constructor(actions: readonly Action[] = []) {
    super()
    const first = this.add('Add app', [], 0)
    this.server = this.tracking = this.local = first
    this.known.add(first)
    for (const a of actions) this.apply(a, false)
  }

  apply(action: Action, record = true): Outcome {
    const outcome = this.run(action)
    if (record) this.log = [...this.log, outcome]
    this.notify()
    return outcome
  }

  ancestors(id: string): Set<string> {
    const seen = new Set<string>()
    const stack = [id]
    while (stack.length) {
      const c = stack.pop()!
      if (seen.has(c)) continue
      seen.add(c)
      stack.push(...this.commits.get(c)!.parents)
    }
    return seen
  }

  /** Commits in a's history that b's history lacks. */
  private only(a: string, b: string): number {
    const other = this.ancestors(b)
    return [...this.ancestors(a)].filter((id) => !other.has(id)).length
  }

  get status(): Status {
    const ahead = this.only(this.local, this.tracking)
    const behind = this.only(this.tracking, this.local)
    const text =
      ahead && behind
        ? `Your branch and 'origin/main' have diverged, and have ${ahead} and ${behind} different commits each.`
        : behind
          ? `Your branch is behind 'origin/main' by ${behind} commit${behind > 1 ? 's' : ''}, and can be fast-forwarded.`
          : ahead
            ? `Your branch is ahead of 'origin/main' by ${ahead} commit${ahead > 1 ? 's' : ''}.`
            : "Your branch is up to date with 'origin/main'."
    return { ahead, behind, text }
  }

  /** True when the server has commits that origin/main does not show yet. */
  get stale(): boolean {
    return this.server !== this.tracking
  }

  private add(message: string, parents: string[], lane: number): string {
    const id = shortHash(`${this.seq}:${message}:${parents.join(',')}`)
    this.commits.set(id, { id, message, parents, lane, seq: this.seq++ })
    return id
  }

  private run(action: Action): Outcome {
    const command = action.kind === 'pull' ? ({ unset: 'git pull', merge: 'git pull --no-rebase', rebase: 'git pull --rebase', 'ff-only': 'git pull --ff-only' } as const)[action.mode] : COMMAND[action.kind]
    switch (action.kind) {
      case 'bob-push': {
        this.server = this.add(`Bob ${++this.bob}`, [this.server], 1)
        return { ok: true, command, text: `Bob’s commit is on the server. Nothing on your laptop changed.`, moved: ['server'] }
      }
      case 'ann-commit': {
        this.local = this.add(`Ann ${++this.ann}`, [this.local], 0)
        this.known.add(this.local)
        return { ok: true, command, text: 'A new commit on your main. The server does not have it yet.', moved: ['local'] }
      }
      case 'fetch': {
        const changed = this.fetch()
        return { ok: true, command, text: changed ? `Downloaded the new commits. origin/main moved; your main and your files did not.` : 'Nothing new on the server.', moved: changed ? ['tracking'] : [] }
      }
      case 'merge':
        return { ...this.integrate('merge', `Merge remote-tracking branch 'origin/main'`), command }
      case 'pull': {
        const changed = this.fetch()
        const result = this.integrate(action.mode, `Merge branch 'main' of origin`)
        return { ...result, command, moved: [...(changed ? (['tracking'] as const) : []), ...result.moved] }
      }
      case 'push': {
        if (!this.ancestors(this.local).has(this.server)) {
          return { ok: false, command, text: '! [rejected] main -> main (fetch first): the server has commits you do not have.', moved: [] }
        }
        if (this.server === this.local) return { ok: true, command, text: 'Everything up-to-date', moved: [] }
        this.server = this.tracking = this.local
        return { ok: true, command, text: 'Uploaded. The server’s main and your origin/main now point to your commit.', moved: ['server', 'tracking'] }
      }
    }
  }

  private fetch(): boolean {
    if (this.tracking === this.server) return false
    for (const id of this.ancestors(this.server)) this.known.add(id)
    this.tracking = this.server
    return true
  }

  /** Brings origin/main into main, the way git merge / pull does. */
  private integrate(mode: PullMode, mergeMessage: string): Omit<Outcome, 'command'> {
    const mine = this.ancestors(this.local)
    if (mine.has(this.tracking)) return { ok: true, text: 'Already up to date.', moved: [] }
    if (this.ancestors(this.tracking).has(this.local)) {
      this.local = this.tracking
      return { ok: true, text: 'Fast-forward: your main moved to origin/main, and your files were updated.', moved: ['local'] }
    }
    // Diverged.
    if (mode === 'unset') return { ok: false, text: 'fatal: Need to specify how to reconcile divergent branches. (The fetch part already happened.)', moved: [] }
    if (mode === 'ff-only') return { ok: false, text: 'fatal: Not possible to fast-forward, aborting. (The fetch part already happened.)', moved: [] }
    if (mode === 'merge') {
      this.local = this.add(mergeMessage, [this.local, this.tracking], 0)
      this.known.add(this.local)
      return { ok: true, text: 'A merge commit joins your work and the server’s.', moved: ['local'] }
    }
    const theirs = this.ancestors(this.tracking)
    const replay = [...mine].filter((id) => !theirs.has(id)).map((id) => this.commits.get(id)!).filter((c) => c.parents.length < 2).sort((a, b) => a.seq - b.seq)
    let base = this.tracking
    for (const c of replay) {
      base = this.add(c.message, [base], 0)
      this.known.add(base)
    }
    this.local = base
    return { ok: true, text: 'Your commits were replayed on top of origin/main (new ids). History stays a straight line.', moved: ['local'] }
  }
}

/** The graph as messages, for comparing with real git. Merge messages are normalised (they contain the remote URL). */
export function remoteShape(m: { commits: Map<string, Commit>; server: string; tracking: string; local: string }): string {
  const msg = (id: string) => (m.commits.get(id)!.message.startsWith('Merge') ? 'Merge' : m.commits.get(id)!.message)
  const reach = new Set<string>()
  const stack = [m.local, m.tracking, m.server]
  while (stack.length) {
    const id = stack.pop()!
    if (reach.has(id)) continue
    reach.add(id)
    stack.push(...m.commits.get(id)!.parents)
  }
  const commits = [...reach].map((id) => `${msg(id)} <- ${m.commits.get(id)!.parents.map(msg).sort().join(', ') || '(root)'}`).sort()
  return [...commits, `server main -> ${msg(m.server)}`, `origin/main -> ${msg(m.tracking)}`, `main -> ${msg(m.local)}`].join('\n')
}
