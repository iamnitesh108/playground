import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'aws CLI', definition: 'Amazon’s command-line tool. Works with any S3 server given an endpoint, region, keys and path-style addressing.', lesson: 'run' },
  { term: 'Console', definition: 'RustFS’s web interface on port 9001, for browsing buckets, uploading, users, policies and settings.', lesson: 'run' },
  { term: 'Endpoint', definition: 'The address of an S3 server, e.g. http://localhost:9000. Clients default to AWS unless told otherwise.', lesson: 'run' },
  { term: 'Health endpoints', definition: '/health (the process is alive) and /health/ready (it can read and write), answered without credentials.', lesson: 'run' },
  { term: 'Inline data', definition: 'Small objects that RustFS stores inside their xl.meta file instead of separate part files.', lesson: 'run' },
  { term: 'rc', definition: 'RustFS’s command-line client (image rustfs/rc): aliases, object commands, mirror, and the RustFS admin API.', lesson: 'run' },
  { term: 'RustFS', definition: 'An open-source (Apache 2.0) S3-compatible object storage server written in Rust; used throughout this module.', lesson: 'run' },
  { term: 'Secret key', definition: 'The private half of a credential pair. Never sent; used to sign requests.', lesson: 'run' },
  { term: 'Volume', definition: 'Container storage outside the container’s own file system, so /data survives replacing the container.', lesson: 'run' },
  { term: 'xl.meta', definition: 'The metadata file RustFS writes for every object on each drive (size, ETag, checksums, where the parts are; small objects inline).', lesson: 'run' },
]
