import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'postmaster', definition: 'The first server process: accepts connections, forks backends, restarts children that die.', lesson: 'architecture' },
  { term: 'Backend', definition: 'The server process serving one client connection for its whole life.', lesson: 'architecture' },
  { term: 'Background writer', definition: 'Writes some dirty pages ahead of time, so backends rarely have to write one before reusing a buffer.', lesson: 'architecture' },
  { term: 'Checkpointer', definition: 'Writes all dirty pages at each checkpoint and records a redo point where crash recovery starts.', lesson: 'architecture' },
  { term: 'walwriter', definition: 'Flushes WAL buffers to disk in the background.', lesson: 'architecture' },
  { term: 'io worker', definition: 'PostgreSQL 18: processes that perform reads for asynchronous I/O (io_method = worker, the default).', lesson: 'architecture' },
  { term: 'Shared buffers', definition: 'PostgreSQL’s cache of 8 kB pages, shared by all processes; every read and write of a table or index goes through it.', lesson: 'architecture' },
  { term: 'Dirty page', definition: 'A buffer changed in memory and not yet written back to its data file.', lesson: 'architecture' },
  { term: 'work_mem', definition: 'Memory one sort or hash may use before spilling to temporary files. A query can use several multiples of it.', lesson: 'architecture' },
]
