import type { Action } from './remote'

/** Ready-made situations for the fetch/pull playground. Each is also run against real git. */
export interface RemoteScenario {
  id: string
  title: string
  actions: Action[]
}

const bob: Action = { kind: 'bob-push' }
const ann: Action = { kind: 'ann-commit' }

export const REMOTE_SCENARIOS: readonly RemoteScenario[] = [
  { id: 'fetch-then-merge', title: 'Bob pushes; you fetch, look, then merge', actions: [bob, bob, { kind: 'fetch' }, { kind: 'merge' }] },
  { id: 'pull', title: 'Bob pushes; you pull (fetch + merge in one step)', actions: [bob, { kind: 'pull', mode: 'unset' }] },
  { id: 'diverged-merge', title: 'Both committed: pull asks how; pull --no-rebase merges', actions: [bob, ann, { kind: 'pull', mode: 'unset' }, { kind: 'pull', mode: 'merge' }, { kind: 'push' }] },
  { id: 'diverged-rebase', title: 'Both committed: pull --rebase keeps a straight line', actions: [bob, ann, ann, { kind: 'pull', mode: 'rebase' }, { kind: 'push' }] },
  { id: 'push-rejected', title: 'Your push is rejected until you pull', actions: [ann, bob, { kind: 'push' }, { kind: 'pull', mode: 'rebase' }, { kind: 'push' }] },
  { id: 'ff-only', title: 'pull --ff-only refuses to merge or rebase', actions: [bob, ann, { kind: 'pull', mode: 'ff-only' }] },
]
