/**
 * A GIN index in miniature: every word of every document becomes a key, and
 * each key points to the sorted list of rows that contain it (a posting list).
 * A query for several words intersects their lists. Simplified: no stemming.
 */
export interface Doc {
  id: number
  text: string
}

export const DOCS: readonly Doc[] = [
  { id: 1, text: 'A waterproof nylon jacket for hiking' },
  { id: 2, text: 'A lightweight wool shirt for travel' },
  { id: 3, text: 'An insulated wool glove for skiing' },
  { id: 4, text: 'A waterproof wool hat for skiing' },
  { id: 5, text: 'A breathable nylon shirt for running' },
  { id: 6, text: 'A waterproof canvas backpack for hiking' },
]

const STOP = new Set(['a', 'an', 'for', 'the'])

export function words(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z]+/).filter((w) => w && !STOP.has(w)))]
}

/** key → sorted row ids */
export function buildIndex(docs: readonly Doc[]): Map<string, number[]> {
  const index = new Map<string, number[]>()
  for (const d of docs) for (const w of words(d.text)) index.set(w, [...(index.get(w) ?? []), d.id])
  return new Map([...index.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

/** Rows containing every term: the intersection of their posting lists. */
export function search(index: Map<string, number[]>, terms: readonly string[]): number[] {
  if (terms.length === 0) return []
  return terms
    .map((t) => index.get(t) ?? [])
    .reduce((acc, list) => acc.filter((id) => list.includes(id)))
}
