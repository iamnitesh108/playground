import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Connection pool', definition: 'Open connections lent out and returned instead of opened and closed per request.', lesson: 'pooling' },
  { term: 'Pool size', definition: 'The most server connections a pool keeps; extra requests wait for one. Size it from CPU cores, not users.', lesson: 'pooling' },
  { term: 'PgBouncer', definition: 'A lightweight proxy that pools server connections for many clients.', lesson: 'pooling' },
  { term: 'Session pooling', definition: 'A server connection is lent to a client until it disconnects. Safe for every feature, little sharing.', lesson: 'pooling' },
  { term: 'Transaction pooling', definition: 'A server connection is lent for one transaction. Most sharing; session state (SET, advisory locks, LISTEN) leaks or disappears.', lesson: 'pooling' },
  { term: 'Statement pooling', definition: 'A server connection is lent for one statement; multi-statement transactions are refused.', lesson: 'pooling' },
  { term: 'max_prepared_statements', definition: 'PgBouncer 1.21+: tracks protocol-level prepared statements per server connection so they work in transaction mode (default 200 since 1.24).', lesson: 'pooling' },
  { term: 'max_connections', definition: 'The server’s limit on connections (default 100, restart to change); a few are reserved for superusers.', lesson: 'pooling' },
  { term: 'HikariCP', definition: 'The usual JDBC connection pool in Java: maximumPoolSize, connectionTimeout, maxLifetime.', lesson: 'pooling' },
  { term: 'cl_waiting', definition: 'PgBouncer SHOW POOLS column: clients waiting for a server connection.', lesson: 'pooling' },
]
