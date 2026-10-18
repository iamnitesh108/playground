import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Block storage', definition: 'Storage addressed by numbered blocks (a disk, a cloud volume); a file system or database decides what they mean.', lesson: 'what' },
  { term: 'Bucket', definition: 'A named container for objects. Names follow DNS rules: 3–63 lowercase letters, digits, hyphens and dots.', lesson: 'what' },
  { term: 'Common prefix', definition: 'A “folder” in a listing: the part of keys up to the next delimiter after the requested prefix.', lesson: 'what' },
  { term: 'Delimiter', definition: 'The character (usually /) at which a listing groups keys into common prefixes.', lesson: 'what' },
  { term: 'File storage', definition: 'Storage addressed by paths in folders, allowing partial changes, appends and renames (your disk, a network share).', lesson: 'what' },
  { term: 'Flat namespace', definition: 'Keys in a bucket are one sorted list of names; folders exist only in listings.', lesson: 'what' },
  { term: 'Key', definition: 'An object’s full name inside its bucket, slashes included, up to 1,024 bytes.', lesson: 'what' },
  { term: 'Metadata', definition: 'Facts kept with an object: system metadata (size, type, ETag, time) and your own x-amz-meta-* fields.', lesson: 'what' },
  { term: 'Object', definition: 'A stored file plus its key and metadata, written and replaced whole.', lesson: 'what' },
  { term: 'Object storage', definition: 'Storage of whole objects in buckets, addressed by key over HTTP; S3 is its common language.', lesson: 'what' },
  { term: 'Prefix', definition: 'The beginning of keys a listing, policy or lifecycle rule applies to, such as images/ or exports/2026/10/.', lesson: 'what' },
  { term: 'S3', definition: 'Amazon’s Simple Storage Service (2006) and its HTTP API, which most storage servers and tools now speak.', lesson: 'what' },
  { term: 'S3-compatible server', definition: 'A server that answers the S3 API: AWS S3, RustFS, MinIO, Ceph RGW, Garage and others.', lesson: 'what' },
  { term: 'User metadata', definition: 'Your own small fields on an object, sent and returned as x-amz-meta-* headers (about 2 KB in total on AWS).', lesson: 'what' },
]
