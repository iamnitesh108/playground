import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'ACL', definition: 'Access control list entry: allow or deny a principal an operation (READ, WRITE, DESCRIBE…) on a resource (topic, group, cluster, transactional id).', lesson: 'security' },
  { term: 'mTLS', definition: 'Mutual TLS: the client also presents a certificate, which then authenticates it.', lesson: 'security' },
  { term: 'Principal', definition: 'The authenticated identity of a client (e.g. User:app) that ACLs are written for.', lesson: 'security' },
  { term: 'SASL', definition: 'Authentication framework used by Kafka listeners; mechanisms include PLAIN, SCRAM-SHA-256/512, GSSAPI and OAUTHBEARER.', lesson: 'security' },
  { term: 'SCRAM', definition: 'SASL mechanism with salted, hashed passwords stored in the cluster metadata, so passwords never cross the wire.', lesson: 'security' },
  { term: 'security.protocol', definition: 'Client and listener setting: PLAINTEXT, SSL, SASL_PLAINTEXT or SASL_SSL.', lesson: 'security' },
  { term: 'super.users', definition: 'Broker setting listing principals that bypass ACLs, such as the admin user and the brokers themselves.', lesson: 'security' },
]
