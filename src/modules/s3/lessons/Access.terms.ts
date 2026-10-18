import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Access key', definition: 'The public half of a credential pair, sent with every request to say who is asking. Also an extra key pair a user can own (a service account).', lesson: 'access' },
  { term: 'AccessDenied', definition: 'Error 403: the request was not signed, or no policy allows it, or a Deny matched.', lesson: 'access' },
  { term: 'ARN', definition: 'Amazon Resource Name, how policies name things: arn:aws:s3:::catalog (the bucket), arn:aws:s3:::catalog/* (its objects).', lesson: 'access' },
  { term: 'Bucket policy', definition: 'A policy attached to a bucket, naming principals; with Principal "*" it applies to everyone, signed or not.', lesson: 'access' },
  { term: 'CORS', definition: 'Cross-Origin Resource Sharing: bucket rules that let JavaScript on other websites call the bucket from a browser.', lesson: 'access' },
  { term: 'Explicit deny', definition: 'A matching Deny statement. It always wins over any Allow.', lesson: 'access' },
  { term: 'Policy', definition: 'A JSON document of Allow/Deny statements with Action, Resource and optional Condition.', lesson: 'access' },
  { term: 'Presigned URL', definition: 'A URL carrying its own signature and expiry, allowing one GET or PUT without keys until it expires.', lesson: 'access' },
  { term: 'Principal', definition: 'Who a bucket policy statement is about; "*" means everyone.', lesson: 'access' },
  { term: 'Public access block', definition: 'A bucket setting that ignores public policies and refuses new ones.', lesson: 'access' },
  { term: 'Root user', definition: 'The credentials given at start-up (RUSTFS_ACCESS_KEY / RUSTFS_SECRET_KEY); can do everything.', lesson: 'access' },
  { term: 'Service account', definition: 'RustFS’s name for an extra access key owned by a user, optionally with a narrower policy.', lesson: 'access' },
  { term: 'Statement', definition: 'One rule in a policy: Effect, Action, Resource, optional Condition (and Principal in bucket policies).', lesson: 'access' },
]
