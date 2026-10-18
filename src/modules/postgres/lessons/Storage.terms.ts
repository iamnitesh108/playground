import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Page', definition: 'The 8 kB unit of every table and index file, and of the buffer cache.', lesson: 'storage' },
  { term: 'Page header', definition: '24 bytes at the start of a page: LSN of the last change, checksum, flags and the lower/upper free-space offsets.', lesson: 'storage' },
  { term: 'Line pointer', definition: '4 bytes per tuple at the top of a page: offset, length and state. Indexes point at line pointers, so tuples can move within the page.', lesson: 'storage' },
  { term: 'Tuple', definition: 'One physical version of a row: a 23-byte header (xmin, xmax, ctid, flags), a null bitmap, then the column values.', lesson: 'storage' },
  { term: 'Alignment padding', definition: 'Unused bytes inserted so 8-byte values start on 8-byte boundaries; column order changes how much is wasted.', lesson: 'storage' },
  { term: 'fillfactor', definition: 'How full INSERTs pack a page (tables default 100 %, B-tree indexes 90 %); free room lets updates stay on the page.', lesson: 'storage' },
  { term: 'TOAST', definition: 'Where large values go: compressed and/or moved to a side table in chunks once a row exceeds about 2 kB.', lesson: 'storage' },
  { term: 'Free space map', definition: 'The _fsm fork: free bytes per page, so INSERT and UPDATE find a page with room. VACUUM fills it in.', lesson: 'storage' },
  { term: 'Visibility map', definition: 'The _vm fork: two bits per page — all-visible (vacuum and index-only scans can skip it) and all-frozen.', lesson: 'storage' },
]
