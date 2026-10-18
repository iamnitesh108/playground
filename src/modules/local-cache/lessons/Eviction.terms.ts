import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Eviction', definition: 'Removing entries to stay under the bound.', lesson: 'eviction' },
  { term: 'Eviction policy', definition: 'The rule that picks which entry to remove: FIFO, LRU, LFU, W-TinyLFU…', lesson: 'eviction' },
  { term: 'FIFO', definition: 'First in, first out: evict the oldest write, whatever its use.', lesson: 'eviction' },
  { term: 'LRU', definition: 'Least recently used: evict the entry whose last use is the oldest. lru-cache’s policy.', lesson: 'eviction' },
  { term: 'LFU', definition: 'Least frequently used: evict the entry used the fewest times. Pure LFU keeps old favourites forever.', lesson: 'eviction' },
  { term: 'Recency', definition: 'How recently a key was used. LRU’s only signal.', lesson: 'eviction' },
  { term: 'Frequency', definition: 'How often a key was used. TinyLFU estimates it with a sketch.', lesson: 'eviction' },
  { term: 'Scan', definition: 'A burst of one-off keys (a report, a crawler) that flushes popular entries out of an LRU.', lesson: 'eviction' },
  { term: 'Admission', definition: 'Deciding whether a new entry may enter the cache at all, instead of always evicting someone for it.', lesson: 'eviction' },
  { term: 'Count-Min sketch', definition: 'A small table of counters, indexed by several hashes, that estimates how often each key was seen; the minimum of its counters is the estimate.', lesson: 'eviction' },
  { term: 'Aging (reset)', definition: 'Halving all sketch counters periodically so past popularity fades.', lesson: 'eviction' },
  { term: 'TinyLFU', definition: 'An admission filter: a newcomer replaces the eviction victim only if the sketch says it is used more often.', lesson: 'eviction' },
  { term: 'W-TinyLFU', definition: 'Caffeine’s policy: a small LRU window for new entries, then TinyLFU admission into a segmented LRU main space, with the window size tuned by hill climbing.', lesson: 'eviction' },
  { term: 'Segmented LRU (probation / protected)', definition: 'A main space split in two LRU lists: entries start in probation and move to protected on their next hit.', lesson: 'eviction' },
  { term: 'Hill climbing', definition: 'Caffeine’s adaptive tuning of the window size: it moves the split in the direction that raises the sampled hit rate.', lesson: 'eviction' },
  { term: 'Optimal (Belady)', definition: 'The theoretical best policy: evict the entry needed furthest in the future. A yardstick, not an implementation.', lesson: 'eviction' },
]
