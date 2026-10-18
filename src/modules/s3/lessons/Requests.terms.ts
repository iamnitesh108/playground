import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Canonical request', definition: 'The exact text form of a request (method, path, query, signed headers, payload hash) that SigV4 hashes and signs.', lesson: 'requests' },
  { term: 'Conditional request', definition: 'A request with If-Match / If-None-Match: it only runs if the object’s ETag does (or does not) match. 412 if not.', lesson: 'requests' },
  { term: 'ETag', definition: 'A fingerprint of an object’s content: the MD5 for single uploads, MD5-of-part-MD5s plus “-N” for multipart, something else when encrypted.', lesson: 'requests' },
  { term: 'HEAD', definition: 'The HTTP method that returns an object’s headers (size, type, ETag) without its bytes.', lesson: 'requests' },
  { term: 'HMAC', definition: 'A keyed hash; SigV4 uses HMAC-SHA256 to derive the signing key and compute the signature.', lesson: 'requests' },
  { term: 'ListObjectsV2', definition: 'The list request: GET /bucket?list-type=2 with prefix, delimiter and continuation token; at most 1,000 keys per page.', lesson: 'requests' },
  { term: 'NoSuchKey', definition: 'Error 404: the key does not exist (or its latest entry is a delete marker).', lesson: 'requests' },
  { term: 'Path-style', definition: 'URLs with the bucket in the path (http://host/bucket/key). RustFS’s default; set it in every client.', lesson: 'requests' },
  { term: 'Read-after-write consistency', definition: 'After a write or delete succeeds, every later request sees it.', lesson: 'requests' },
  { term: 'Region', definition: 'Part of every signature (us-east-1 by default here). AWS checks it against the bucket; the lab RustFS accepted any.', lesson: 'requests' },
  { term: 'SignatureDoesNotMatch', definition: 'Error 403: the server computed a different signature — wrong secret, a changed signed header, or wrong addressing style.', lesson: 'requests' },
  { term: 'SigV4', definition: 'AWS Signature Version 4: canonical request → SHA-256 → string to sign → HMAC with a key derived from secret, day, region and service.', lesson: 'requests' },
  { term: 'Signing key', definition: 'The key SigV4 derives from the secret key for one day, region and service with four HMAC steps.', lesson: 'requests' },
  { term: 'Virtual-hosted-style', definition: 'URLs with the bucket in the host name (http://bucket.host/key). AWS’s default; RustFS needs RUSTFS_SERVER_DOMAINS for it.', lesson: 'requests' },
]
