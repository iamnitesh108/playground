import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Bucket event', definition: 'A message the server sends when an object is created or removed, to a webhook or a queue.', lesson: 'patterns' },
  { term: 'Continuation token', definition: 'The bookmark a truncated list response returns; the next list request passes it to get the following page.', lesson: 'patterns' },
  { term: 'Presigned POST', definition: 'A signed HTML-form upload whose policy the server enforces, e.g. a maximum size and a content type.', lesson: 'patterns' },
  { term: 'rclone', definition: 'A sync tool for many storage systems; copies buckets between S3 servers.', lesson: 'patterns' },
  { term: 'SSE', definition: 'Server-side encryption: the server encrypts objects at rest (SSE-S3 with a master key, SSE-KMS, or SSE-C with your key).', lesson: 'patterns' },
]
