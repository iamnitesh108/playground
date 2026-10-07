import type { CSSProperties } from 'react'

/** Stable colour index for a record key, so equal keys always look alike. */
export function toneForKey(key: string | null): number | undefined {
  if (!key) return undefined
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return Math.abs(hash) % 6
}

export function toneStyle(tone: number | undefined, property = '--tone'): CSSProperties | undefined {
  return tone === undefined ? undefined : ({ [property]: `var(--tone-${tone % 6})` } as CSSProperties)
}
