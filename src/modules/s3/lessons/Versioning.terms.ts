import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Compliance mode', definition: 'Object lock retention that nobody — not even the root user — can shorten or bypass before its date.', lesson: 'versioning' },
  { term: 'Current version', definition: 'The newest version of a key, the one a plain GET returns.', lesson: 'versioning' },
  { term: 'Delete marker', definition: 'What a DELETE without a version id creates in a versioned bucket: an empty “deleted” entry on top; nothing is destroyed.', lesson: 'versioning' },
  { term: 'Governance mode', definition: 'Object lock retention that users with s3:BypassGovernanceRetention may override.', lesson: 'versioning' },
  { term: 'Legal hold', definition: 'An object lock flag with no date: the version cannot be deleted until the hold is removed.', lesson: 'versioning' },
  { term: 'Lifecycle rule', definition: 'A bucket rule that expires objects, noncurrent versions or unfinished uploads after some days, run by the server’s scanner.', lesson: 'versioning' },
  { term: 'Noncurrent version', definition: 'Any version older than the current one; it uses space until deleted or expired.', lesson: 'versioning' },
  { term: 'Object lock (WORM)', definition: 'Write once, read many: versions that cannot be deleted or changed until a retention date or while a legal hold is on.', lesson: 'versioning' },
  { term: 'Storage class', definition: 'A label for how an object is stored; RustFS accepts STANDARD and REDUCED_REDUNDANCY (different parity).', lesson: 'versioning' },
  { term: 'Version id', definition: 'The unique id of one write of a key in a versioned bucket; requests can name it to read or delete that version.', lesson: 'versioning' },
  { term: 'Versioning', definition: 'A bucket setting that keeps every version of every key, so overwrites and deletes can be undone.', lesson: 'versioning' },
]
