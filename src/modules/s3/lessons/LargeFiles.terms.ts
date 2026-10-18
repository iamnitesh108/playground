import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Abort (multipart)', definition: 'Cancelling an unfinished multipart upload; its parts are deleted and their space freed.', lesson: 'large-files' },
  { term: 'Checksum (x-amz-checksum-*)', definition: 'A CRC or SHA value sent with an upload; the server refuses the upload (BadDigest) if the bytes do not match, and stores it.', lesson: 'large-files' },
  { term: 'Complete (multipart)', definition: 'The request that joins uploaded parts, in part-number order, into the final object.', lesson: 'large-files' },
  { term: 'Content-MD5', definition: 'A header with the base64 MD5 of the body; the server refuses the upload if it does not match.', lesson: 'large-files' },
  { term: 'Multipart upload', definition: 'An upload in parts: create (upload id) → upload numbered parts → complete. Required above 5 GiB.', lesson: 'large-files' },
  { term: 'Part', definition: 'One numbered piece of a multipart upload: 5 MiB to 5 GiB (the last may be smaller), numbers 1–10,000.', lesson: 'large-files' },
  { term: 'Range request', definition: 'A GET with a Range header returning only some bytes, answered with 206 Partial Content.', lesson: 'large-files' },
  { term: 'Upload id', definition: 'The name of one unfinished multipart upload, quoted by every part, complete and abort request.', lesson: 'large-files' },
]
