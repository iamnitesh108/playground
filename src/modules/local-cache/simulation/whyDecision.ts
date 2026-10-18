/*
 * "Should this be in a local cache?" — a short decision walk. Each question either settles the answer or leads to
 * the next one. Pure data plus one function, so the walk can be tested and rendered anywhere.
 */

export type Verdict = 'no-cache' | 'source' | 'shared' | 'local' | 'local-and-shared'

export interface Question {
  id: string
  text: string
  hint: string
  /** What a "yes" and a "no" lead to: another question id, or a verdict. */
  yes: string | Verdict
  no: string | Verdict
}

export const QUESTIONS: readonly Question[] = [
  { id: 'reread', text: 'Is the same value read again and again?', hint: 'A cache only pays off on the second read of a key. Values read once (a report row, a one-time token) never hit.', yes: 'expensive', no: 'no-cache' },
  { id: 'expensive', text: 'Is getting it slower than a map lookup?', hint: 'A network call, a query or real computation: yes. Formatting a string or reading a field: no — recomputing costs about as much as the cache.', yes: 'stale', no: 'no-cache' },
  { id: 'stale', text: 'May a reader see a value a few seconds old?', hint: 'Product pages, prices in lists, configuration, feature flags: usually yes. Balances, stock you sell from, permissions: no.', yes: 'fits', no: 'source' },
  { id: 'fits', text: 'Does the hot part fit in a few MB to a few hundred MB per instance?', hint: 'Every instance holds its own copy, inside its heap. Millions of large values do not belong there.', yes: 'instances', no: 'shared' },
  { id: 'instances', text: 'Do several instances read the same keys, or does a restart refill from something slow?', hint: 'Then a shared cache behind the local one saves the source from N instances × N misses.', yes: 'local-and-shared', no: 'local' },
]

export const VERDICTS: Record<Verdict, { title: string; body: string; hue: 6 | 8 | 2 | 5 }> = {
  'no-cache': { title: 'No cache', body: 'Nothing to gain: either nothing is read twice, or recomputing is as cheap as a lookup. A cache would only add memory and staleness.', hue: 8 },
  source: { title: 'Read the source of truth', body: 'Values that must never be stale stay out of every per-instance copy. Read the database (or Redis alone, deleting the key on every write).', hue: 8 },
  shared: { title: 'A shared cache (Redis)', body: 'Too big for every heap: keep one copy in Redis, sized and evicted there, with a TTL.', hue: 2 },
  local: { title: 'A local cache', body: 'Bounded by size, with a TTL that is the staleness you accept. One instance, or cheap misses: nothing more needed.', hue: 6 },
  'local-and-shared': { title: 'Local cache in front of Redis', body: 'L1 in each instance for the hot keys, Redis as the shared L2 so instances and restarts refill cheaply. See Multi-level caching.', hue: 6 },
}

const isVerdict = (next: string): next is Verdict => next in VERDICTS

/** Follows the answers from the first question; returns the questions asked and the verdict, if reached. */
export function walk(answers: readonly boolean[]): { asked: Question[]; verdict: Verdict | null } {
  const asked: Question[] = []
  let current: string = QUESTIONS[0].id
  for (let i = 0; ; i++) {
    if (isVerdict(current)) return { asked, verdict: current }
    const question = QUESTIONS.find((q) => q.id === current)!
    asked.push(question)
    if (i >= answers.length) return { asked, verdict: null }
    current = answers[i] ? question.yes : question.no
  }
}
