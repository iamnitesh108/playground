import type { CSSProperties } from 'react'

/** A slot of the figure palette (tokens --c1…--c8 in src/styles/tokens.css). */
export type Hue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** Sets --hue (the colour) and --hue-soft (a tint for fills) for a figure element. */
export function hue(n: Hue | undefined): CSSProperties | undefined {
  if (!n) return undefined
  return { '--hue': `var(--c${n})`, '--hue-soft': `color-mix(in oklab, var(--c${n}) 15%, var(--surface))` } as CSSProperties
}
