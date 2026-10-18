// Typed lookups into the recording: every experiment printed JSON lines, grouped here by app.
import { RUNTIME } from './runtime'
import type { RuntimeApp, RuntimeEvent } from './runtimeTypes'

/** Every event of one experiment, in the order it was printed. */
export function all<T>(app: RuntimeApp, exp: string, match: (e: RuntimeEvent) => boolean = () => true): T[] {
  return RUNTIME[app].filter((e) => e.exp === exp && match(e)) as unknown as T[]
}

/** The one event of an experiment (optionally the one with a given mode); throws if the recording lacks it. */
export function one<T>(app: RuntimeApp, exp: string, mode?: string): T {
  const found = all<T>(app, exp, (e) => mode === undefined || e.mode === mode)[0]
  if (!found) throw new Error(`not recorded: ${app} ${exp} ${mode ?? ''}`)
  return found
}

export const versions = {
  java: String(RUNTIME.java[0].java),
  node: String(RUNTIME.ts[0].node),
  lruCache: String(RUNTIME.ts[0].lruCache),
  moka: String(RUNTIME.rust[0].moka),
  cores: Number(RUNTIME.java[0].cores),
}
