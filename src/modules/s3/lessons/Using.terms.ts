import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Content type', definition: 'What kind of file an object is (image/jpeg…); stored at upload and returned on download.', lesson: 'using' },
  { term: 'Idempotent delete', definition: 'Deleting a key that does not exist succeeds; “make sure it is gone” is safe to retry.', lesson: 'using' },
  { term: 'SDK', definition: 'The library a programming language uses to call S3 (AWS SDK for Java, JavaScript, Rust).', lesson: 'using' },
  { term: 'Sync / mirror', definition: 'Copying only what differs between a folder or bucket and another; with --delete also removing what is gone.', lesson: 'using' },
]
