import type { ReactNode } from 'react'

export type ConfigFormat = 'properties' | 'json' | 'raw'

export interface ConfigEntry {
  /** Setting name. For `raw` files, a short label for the block. */
  key: string
  value?: string
  /** For `raw` files: the exact lines shown in the file. */
  text?: string
  /** Starts a new section with this heading. */
  section?: string
  defaultValue?: string
  options?: string
  explain: ReactNode
}

/** The line(s) one entry occupies in the file. */
export function lineFor(entry: ConfigEntry, format: ConfigFormat, last: boolean): string {
  if (format === 'raw') return entry.text ?? entry.key
  if (format === 'json') return `  ${JSON.stringify(entry.key)}: ${JSON.stringify(entry.value ?? '')}${last ? '' : ','}`
  return `${entry.key}=${entry.value ?? ''}`
}

/** Builds the file a reader can copy: the same lines, with section comments. */
export function renderConfig(format: ConfigFormat, entries: readonly ConfigEntry[]): string {
  const lines: string[] = []
  entries.forEach((entry, i) => {
    if (entry.section && format === 'properties') lines.push(`${lines.length ? '\n' : ''}# ${entry.section}`)
    if (entry.section && format === 'raw') lines.push(entry.section)
    lines.push(lineFor(entry, format, i === entries.length - 1))
  })
  return format === 'json' ? `{\n${lines.join('\n')}\n}` : lines.join('\n')
}
