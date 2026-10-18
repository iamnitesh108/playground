import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Cluster', definition: 'One running PostgreSQL server and its data directory, holding several databases. Not a group of machines.', lesson: 'setup' },
  { term: 'Data directory', definition: 'Where a cluster keeps its files: tables, WAL, configuration and status. Owned by the postgres OS user.', lesson: 'setup' },
  { term: 'postgresql.conf', definition: 'The main configuration file: memory, connections, logging, WAL and replication settings.', lesson: 'setup' },
  { term: 'pg_hba.conf', definition: 'Host-based authentication: which role may connect to which database, from where, with which method. First matching line wins.', lesson: 'setup' },
  { term: 'Role', definition: 'A user or group inside PostgreSQL. Roles with LOGIN can connect; roles own objects and hold privileges.', lesson: 'setup' },
  { term: 'Superuser', definition: 'A role that skips every privilege check (postgres by default). Never for applications.', lesson: 'setup' },
  { term: 'scram-sha-256', definition: 'Password authentication where the password never crosses the network; the default since PostgreSQL 14.', lesson: 'setup' },
  { term: 'peer', definition: 'Authentication for local socket connections: the OS user name must equal the role name. No password.', lesson: 'setup' },
  { term: 'Least privilege', definition: 'Give each role only the privileges it needs: an owner role for migrations, a read/write role for the app, a read-only role for reports.', lesson: 'setup' },
  { term: 'ALTER SYSTEM', definition: 'SQL that writes a setting to postgresql.auto.conf; most take effect after SELECT pg_reload_conf(), some need a restart.', lesson: 'setup' },
]
