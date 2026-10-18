import type { Hue } from '@/shared/figures'
import type { RemovalCause } from '../simulation/usingCache'

/** Each library's name for a removal cause, mapped to Caffeine's (and the model's) names. */
const ALIASES: Record<string, RemovalCause> = {
  SIZE: 'SIZE', Size: 'SIZE', evict: 'SIZE',
  EXPIRED: 'EXPIRED', Expired: 'EXPIRED', expire: 'EXPIRED',
  EXPLICIT: 'EXPLICIT', Explicit: 'EXPLICIT', delete: 'EXPLICIT',
  REPLACED: 'REPLACED', Replaced: 'REPLACED', set: 'REPLACED',
}

export const CAUSE_HUE: Record<RemovalCause, Hue> = { SIZE: 8, EXPIRED: 4, EXPLICIT: 1, REPLACED: 3 }

export interface ParsedRemoval {
  key: string
  value: string
  cause: RemovalCause
  /** The library's own name for the cause. */
  native: string
}

/** Parses the recorded "removed a=v1 (REPLACED)" lines. */
export function parseRemovals(lines: readonly string[]): ParsedRemoval[] {
  return lines.flatMap((line) => {
    const m = line.match(/^removed (\w+)=(\w+) \((\w+)\)$/)
    return m && ALIASES[m[3]] ? [{ key: m[1], value: m[2], cause: ALIASES[m[3]], native: m[3] }] : []
  })
}
