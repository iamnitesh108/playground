/**
 * Re-pads the tables of kafka-consumer-groups output so their columns line up again: shortening the random
 * consumer ids leaves the original padding too short. Only whitespace changes; every value is the recorded one.
 */
const alignBlock = (block) => {
  const lead = block.match(/^\s*/)[0]
  const rows = block.slice(lead.length).trimEnd().split('\n').map((l) => l.trim().split(/\s+/))
  if (!/^GROUP\s/.test(block.slice(lead.length)) || rows.some((r) => r.length !== rows[0].length)) return block
  const widths = rows.reduce((w, r) => r.map((cell, i) => Math.max(w[i] ?? 0, cell.length)), [])
  return lead + rows.map((r) => r.map((cell, i) => (i < r.length - 1 ? cell.padEnd(widths[i] + 2) : cell)).join('')).join('\n')
}

export const alignTables = (out) => out.split(/\n(?:[ \t]*\n)+/).map(alignBlock).join('\n\n')

/** Applies alignTables to every recorded `out` in a captured data tree. */
export const alignAll = (node) => {
  if (Array.isArray(node)) return node.map(alignAll)
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k === 'out' && typeof v === 'string' ? alignTables(v) : alignAll(v)]))
  return node
}
