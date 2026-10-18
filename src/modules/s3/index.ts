import type { LearningModule } from '@/core/module'

export const s3Module: LearningModule = {
  id: 's3',
  title: 'Object storage with S3 (RustFS)',
  description:
    'Never stored a file outside your own disk? Start here. What object storage is and why “S3” is the language every storage server speaks, running RustFS (an open-source S3-compatible server, like MinIO) on your machine, using it from the web console, the command line, Micronaut, TypeScript and Rust — then how it works: requests and signatures, large uploads, access and sharing, versioning and lifecycle, surviving disk failures, and running it in production. Recorded on a real RustFS server.',
  tags: ['s3', 'object storage', 'rustfs', 'minio', 'buckets', 'presigned urls', 'erasure coding', 'micronaut', 'typescript', 'rust'],
  groups: [
    {
      title: 'Basics',
      lessons: [
        { slug: 'what', title: 'What object storage is', summary: 'Files, disks and objects; buckets, keys and metadata; and why S3 became the standard API every storage server speaks.', load: () => import('./lessons/What') },
        { slug: 'run', title: 'Running RustFS', summary: 'One command to start an S3 server, the web console, credentials, ports and where your data really lives.', load: () => import('./lessons/Run') },
        { slug: 'using', title: 'Using S3 day to day', summary: 'Buckets and files from the console and the command line, then the same tasks in Micronaut, TypeScript and Rust.', load: () => import('./lessons/Using') },
      ],
    },
    {
      title: 'How it works',
      lessons: [
        { slug: 'requests', title: 'The S3 API on the wire', summary: 'Every action is an HTTP request: paths and hosts, request signing step by step, ETags, errors and consistency.', load: () => import('./lessons/Requests') },
        { slug: 'large-files', title: 'Large files: multipart and ranges', summary: 'Uploading in parts, resuming and aborting, downloading a byte range, and checksums that prove nothing changed.', load: () => import('./lessons/LargeFiles') },
        { slug: 'access', title: 'Access, policies and sharing', summary: 'Access keys and users, bucket and user policies, presigned links that expire, and uploads straight from a browser.', load: () => import('./lessons/Access') },
      ],
    },
    {
      title: 'Keeping data safe',
      lessons: [
        { slug: 'versioning', title: 'Versioning, object lock and lifecycle', summary: 'Undoing overwrites and deletes, write-once retention, and rules that expire or clean up data on their own.', load: () => import('./lessons/Versioning') },
        { slug: 'durability', title: 'Surviving disk failures', summary: 'Erasure coding, data and parity shards, bit rot and healing, and RustFS across several disks and nodes.', load: () => import('./lessons/Durability') },
      ],
    },
    {
      title: 'In production',
      lessons: [
        { slug: 'patterns', title: 'Patterns and operations', summary: 'Uploads that bypass your app, naming keys, events, monitoring, a security checklist, and moving data between S3 servers.', load: () => import('./lessons/Patterns') },
        { slug: 'glossary', title: 'Glossary and cheat sheet', summary: 'Every term in the module, searchable, and the commands and API calls you will use most.', load: () => import('./lessons/Glossary') },
      ],
    },
  ],
}
