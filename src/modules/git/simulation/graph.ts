import { Observable } from '@/shared/utils/observable'

/*
 * Git's model in miniature: commits point to parents, branches point to
 * commits, HEAD points to a branch (or straight at a commit when detached).
 * Commands change only those pointers and add commits; nothing is ever edited.
 * Tested against real git: the same command sequences produce the same graph.
 */

export interface Commit {
  id: string
  message: string
  parents: string[]
  /** Row to draw it in (the branch it was made on). */
  lane: number
  /** Order of creation, for drawing left to right. */
  seq: number
}

export type Head = { kind: 'branch'; name: string } | { kind: 'detached'; id: string }

export interface Result {
  ok: boolean
  /** What git would print, in short. */
  text: string
}

/** A short, stable id (FNV-1a), like an abbreviated commit hash. */
function shortHash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 7)
}

export class GitGraph extends Observable {
  commits = new Map<string, Commit>()
  branches = new Map<string, string>()
  head: Head = { kind: 'branch', name: 'main' }
  history: { command: string; result: Result }[] = []
  private lanes = new Map<string, number>([['main', 0]])
  private next = 1
  private seq = 0

  constructor(script: string[] = []) {
    super()
    for (const line of script) this.exec(line, false)
  }

  /** The commit HEAD resolves to, or null in an empty repository. */
  get headCommit(): string | null {
    return this.head.kind === 'detached' ? this.head.id : (this.branches.get(this.head.name) ?? null)
  }

  /** Commits reachable from any branch or HEAD. */
  reachable(): Set<string> {
    const seen = new Set<string>()
    const stack = [...this.branches.values(), ...(this.headCommit ? [this.headCommit] : [])]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      stack.push(...this.commits.get(id)!.parents)
    }
    return seen
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

  /** Accepts a branch name, a commit id, HEAD, and ~n suffixes (first parent). */
  resolve(ref: string): string | null {
    const m = ref.match(/^(.*?)(?:~(\d+))?$/)!
    const base = m[1] === 'HEAD' ? this.headCommit : (this.branches.get(m[1]) ?? (this.commits.has(m[1]) ? m[1] : null))
    let id = base
    for (let i = 0; i < Number(m[2] ?? 0) && id; i++) id = this.commits.get(id)!.parents[0] ?? null
    return id
  }

  exec(line: string, record = true): Result {
    const result = this.run(line.trim())
    if (record) this.history = [...this.history, { command: line.trim(), result }]
    this.notify()
    return result
  }

  private run(line: string): Result {
    const args = line.replace(/^git\s+/, '').match(/"[^"]*"|\S+/g)?.map((a) => a.replace(/^"|"$/g, '')) ?? []
    const [cmd, ...rest] = args
    const flags = rest.filter((a) => a.startsWith('-'))
    const names = rest.filter((a, i) => !a.startsWith('-') && rest[i - 1] !== '-m')
    const message = rest[rest.indexOf('-m') + 1]
    switch (cmd) {
      case 'commit':
        return this.commit(rest.includes('-m') ? message : `C${this.next}`)
      case 'branch':
        if (flags.includes('-d') || flags.includes('-D')) return this.deleteBranch(names[0], flags.includes('-D'))
        return this.branch(names[0], names[1])
      case 'switch':
        if (flags.includes('-c')) return this.createAndSwitch(names[0])
        if (flags.includes('--detach')) return this.detach(names[0] ?? 'HEAD')
        return this.switchTo(names[0])
      case 'merge':
        return this.merge(names[0], flags.includes('--no-ff'))
      case 'rebase':
        return this.rebase(names[0])
      case 'reset':
        return this.reset(names[0] ?? 'HEAD')
      case 'cherry-pick':
        return this.cherryPick(names[0])
      default:
        return { ok: false, text: `not supported here: ${line}` }
    }
  }

  private newCommit(message: string, parents: string[], lane: number): string {
    this.next++
    const id = shortHash(`${this.seq}:${message}:${parents.join(',')}`)
    this.commits.set(id, { id, message, parents, lane, seq: this.seq++ })
    return id
  }

  private laneOfHead(): number {
    if (this.head.kind === 'branch') return this.lanes.get(this.head.name) ?? 0
    return this.lanes.size + 1
  }

  /** Moves the current branch (or detached HEAD) to a commit. */
  private moveHead(id: string): void {
    if (this.head.kind === 'branch') this.branches.set(this.head.name, id)
    else this.head = { kind: 'detached', id }
  }

  private commit(message: string): Result {
    const parent = this.headCommit
    const id = this.newCommit(message, parent ? [parent] : [], this.laneOfHead())
    this.moveHead(id)
    const where = this.head.kind === 'branch' ? this.head.name : 'detached HEAD'
    return { ok: true, text: `[${where}${parent ? '' : ' (root-commit)'} ${id}] ${message}` }
  }

  private branch(name: string | undefined, start?: string): Result {
    if (!name) return { ok: true, text: [...this.branches.keys()].map((b) => `${this.head.kind === 'branch' && this.head.name === b ? '*' : ' '} ${b}`).join('\n') }
    if (this.branches.has(name)) return { ok: false, text: `fatal: a branch named '${name}' already exists` }
    const at = this.resolve(start ?? 'HEAD')
    if (!at) return { ok: false, text: `fatal: not a valid object name: '${start ?? 'main'}'` }
    this.branches.set(name, at)
    if (!this.lanes.has(name)) this.lanes.set(name, this.lanes.size)
    return { ok: true, text: '' }
  }

  private deleteBranch(name: string, force: boolean): Result {
    const tip = this.branches.get(name)
    if (!tip) return { ok: false, text: `error: branch '${name}' not found` }
    if (this.head.kind === 'branch' && this.head.name === name) return { ok: false, text: `error: cannot delete branch '${name}' used by worktree` }
    if (!force && this.headCommit && !this.ancestors(this.headCommit).has(tip)) return { ok: false, text: `error: the branch '${name}' is not fully merged` }
    this.branches.delete(name)
    return { ok: true, text: `Deleted branch ${name} (was ${tip}).` }
  }

  private switchTo(name: string): Result {
    if (!this.branches.has(name)) return { ok: false, text: `fatal: invalid reference: ${name}` }
    this.head = { kind: 'branch', name }
    return { ok: true, text: `Switched to branch '${name}'` }
  }

  private createAndSwitch(name: string): Result {
    const r = this.branch(name)
    if (!r.ok) return r
    this.head = { kind: 'branch', name }
    return { ok: true, text: `Switched to a new branch '${name}'` }
  }

  private detach(ref: string): Result {
    const id = this.resolve(ref)
    if (!id) return { ok: false, text: `fatal: invalid reference: ${ref}` }
    this.head = { kind: 'detached', id }
    return { ok: true, text: `HEAD is now at ${id} ${this.commits.get(id)!.message}` }
  }

  private merge(ref: string, noFf: boolean): Result {
    const theirs = this.resolve(ref)
    const ours = this.headCommit
    if (!theirs || !ours) return { ok: false, text: `merge: ${ref} - not something we can merge` }
    if (this.ancestors(ours).has(theirs)) return { ok: true, text: 'Already up to date.' }
    if (!noFf && this.ancestors(theirs).has(ours)) {
      this.moveHead(theirs)
      return { ok: true, text: `Updating ${ours}..${theirs}\nFast-forward` }
    }
    // git's default message; "into <branch>" is left out when merging into the default branch
    const into = this.head.kind === 'branch' && this.head.name !== 'main' ? ` into ${this.head.name}` : ''
    const what = this.branches.has(ref) ? `branch '${ref}'` : `commit '${ref}'`
    const id = this.newCommit(`Merge ${what}${into}`, [ours, theirs], this.laneOfHead())
    this.moveHead(id)
    return { ok: true, text: "Merge made by the 'ort' strategy." }
  }

  private rebase(onto: string): Result {
    const target = this.resolve(onto)
    const ours = this.headCommit
    if (!target || !ours) return { ok: false, text: `fatal: invalid upstream '${onto}'` }
    const theirs = this.ancestors(target)
    if (theirs.has(ours)) {
      this.moveHead(target)
      return { ok: true, text: `Successfully rebased and updated ${this.head.kind === 'branch' ? `refs/heads/${this.head.name}` : 'detached HEAD'}.` }
    }
    // Commits on our side that the target does not have, oldest first (merges are dropped, like git rebase).
    const mine = [...this.ancestors(ours)].filter((id) => !theirs.has(id)).map((id) => this.commits.get(id)!).filter((c) => c.parents.length < 2).sort((a, b) => a.seq - b.seq)
    if (mine.length === 0) return { ok: true, text: 'Current branch is up to date.' }
    let base = target
    for (const c of mine) base = this.newCommit(c.message, [base], this.laneOfHead())
    this.moveHead(base)
    return { ok: true, text: `Successfully rebased and updated ${this.head.kind === 'branch' ? `refs/heads/${this.head.name}` : 'detached HEAD'}.` }
  }

  private reset(ref: string): Result {
    const id = this.resolve(ref)
    if (!id) return { ok: false, text: `fatal: ambiguous argument '${ref}'` }
    this.moveHead(id)
    return { ok: true, text: `HEAD is now at ${id} ${this.commits.get(id)!.message}` }
  }

  private cherryPick(ref: string): Result {
    const id = this.resolve(ref)
    const ours = this.headCommit
    if (!id || !ours) return { ok: false, text: `fatal: bad revision '${ref}'` }
    const picked = this.newCommit(this.commits.get(id)!.message, [ours], this.laneOfHead())
    this.moveHead(picked)
    return { ok: true, text: `[${this.head.kind === 'branch' ? this.head.name : 'detached HEAD'} ${picked}] ${this.commits.get(id)!.message}` }
  }
}

/**
 * Describes the reachable graph by commit messages, independent of ids:
 * every commit with its parents, every branch tip, and HEAD.
 * Used to compare the model with real git.
 */
export function shape(g: { commits: Map<string, Commit>; branches: Map<string, string>; head: Head; reachable(): Set<string> }): string {
  const msg = (id: string) => g.commits.get(id)!.message
  const reach = g.reachable()
  const commits = [...reach].map((id) => `${msg(id)} <- ${g.commits.get(id)!.parents.map(msg).sort().join(', ') || '(root)'}`).sort()
  const branches = [...g.branches].map(([b, id]) => `${b} -> ${msg(id)}`).sort()
  const head = g.head.kind === 'branch' ? `HEAD -> ${g.head.name}` : `HEAD detached at ${msg(g.head.id)}`
  return [...commits, ...branches, head].join('\n')
}
