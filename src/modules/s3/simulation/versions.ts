/*
 * One key in a bucket, with or without versioning: a stack of versions and delete markers, newest first.
 * PUT pushes a version; DELETE pushes a delete marker; with versioning suspended both use the id "null" and replace
 * the previous "null" entry;
 * deleting a specific version id removes just that entry; GET reads the top of the stack.
 */

export interface Entry {
  id: string
  kind: 'version' | 'marker'
  content?: string
}

export interface KeyState {
  versioning: boolean
  stack: Entry[]
  counter: number
}

export type Op =
  | { type: 'put'; content: string }
  | { type: 'delete' }
  | { type: 'delete-version'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'versioning'; on: boolean }

export function start(versions: { id: string; content: string }[], versioning = true): KeyState {
  return { versioning, stack: versions.map((v) => ({ id: v.id, kind: 'version' as const, content: v.content })), counter: 0 }
}

const nextId = (s: KeyState, prefix: string) => `${prefix}${s.counter + 1}`

export function apply(s: KeyState, op: Op): KeyState {
  switch (op.type) {
    case 'versioning':
      return { ...s, versioning: op.on }
    case 'put': {
      const entry: Entry = { id: s.versioning ? nextId(s, 'new-') : 'null', kind: 'version', content: op.content }
      // with versioning off (or suspended) the new bytes replace the "null" version; older versions stay
      const rest = s.versioning ? s.stack : s.stack.filter((e) => e.id !== 'null')
      return { ...s, stack: [entry, ...rest], counter: s.counter + 1 }
    }
    case 'delete': {
      // suspended: a delete marker with the id "null" replaces any "null" version
      if (!s.versioning) return { ...s, stack: [{ id: 'null', kind: 'marker' }, ...s.stack.filter((e) => e.id !== 'null')] }
      return { ...s, stack: [{ id: nextId(s, 'marker-'), kind: 'marker' }, ...s.stack], counter: s.counter + 1 }
    }
    case 'delete-version':
      return { ...s, stack: s.stack.filter((e) => e.id !== op.id) }
    case 'restore': {
      const source = s.stack.find((e) => e.id === op.id && e.kind === 'version')
      return source ? apply(s, { type: 'put', content: source.content ?? '' }) : s
    }
  }
}

/** What a plain GET of the key returns. */
export function read(s: KeyState): { status: 200 | 404; content?: string; why: string } {
  const top = s.stack[0]
  if (!top) return { status: 404, why: 'no versions at all' }
  if (top.kind === 'marker') return { status: 404, why: 'the latest entry is a delete marker' }
  return { status: 200, content: top.content, why: `latest version ${top.id}` }
}
