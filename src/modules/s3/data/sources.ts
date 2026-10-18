/** The lines between `// region:<name>` and `// endregion:<name>` of a source file, with common indentation removed. */
export function region(source: string, name: string): string {
  const lines = source.split('\n')
  const from = lines.findIndex((l) => l.trim() === `// region:${name}`)
  const to = lines.findIndex((l, i) => i > from && l.trim() === `// endregion:${name}`)
  if (from < 0 || to < 0) throw new Error(`region not found: ${name}`)
  const body = lines.slice(from + 1, to).filter((l) => !/^\s*\/\/ (end)?region:/.test(l))
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return body.map((l) => l.slice(indent)).join('\n')
}

/** The text from `start` up to (not including) `end`. */
export function between(source: string, start: string, end?: string): string {
  const from = source.indexOf(start)
  const to = end ? source.indexOf(end, from + start.length) : source.length
  if (from < 0 || to < 0) throw new Error(`excerpt not found: ${start}`)
  return source.slice(from, to).replace(/\s+$/, '')
}

/** The lines a program printed after `== <name>`, up to the next section. */
export function outputSection(lines: readonly string[], name: string): string {
  const from = lines.indexOf(`== ${name}`)
  if (from < 0) throw new Error(`no output section ${name}`)
  const to = lines.findIndex((l, i) => i > from && l.startsWith('== '))
  return lines.slice(from + 1, to < 0 ? undefined : to).join('\n')
}
