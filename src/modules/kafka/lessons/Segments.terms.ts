import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Active segment', definition: 'The newest segment file of a partition; the only one that receives writes. Retention deletes it only when every record has expired, after rolling a new empty one.', lesson: 'segments' },
  { term: 'Base offset', definition: 'The first offset a segment holds; its file name, zero-padded to 20 digits.', lesson: 'segments' },
  { term: 'Segment', definition: 'File holding a contiguous range of a partition’s records, with its .index and .timeindex.', lesson: 'segments' },
  { term: 'Offset index', definition: 'Sparse .index file mapping offsets to byte positions in a segment, one entry per ~4 KB.', lesson: 'segments' },
  { term: 'Log start offset', definition: 'The oldest offset a partition still stores; retention moves it forward.', lesson: 'segments' },
  { term: 'Roll (segment)', definition: 'Closing the active segment and starting a new one, by size (segment.bytes) or age (segment.ms) on the next write.', lesson: 'segments' },
]
