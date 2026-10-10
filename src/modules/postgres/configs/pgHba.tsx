import type { ConfigEntry } from '@/shared/ui'

/** pg_hba.conf as installed on Ubuntu, plus one rule for the application. */
export const PG_HBA: ConfigEntry[] = [
  {
    section: '# TYPE  DATABASE        USER            ADDRESS                 METHOD',
    key: 'local postgres',
    text: 'local   all             postgres                                peer',
    explain: (
      <p>
        <code>local</code> = Unix socket on the same machine. <code>peer</code> trusts the operating-system user name: the Linux user <code>postgres</code> may log in as the database role <code>postgres</code>, with no password. This is why administration is done with <code>sudo -u postgres psql</code>.
      </p>
    ),
  },
  {
    key: 'local all',
    text: 'local   all             all                                     peer',
    explain: <p>Any OS user may connect over the socket as the role of the same name.</p>,
  },
  {
    key: 'host localhost',
    text: 'host    all             all             127.0.0.1/32            scram-sha-256',
    explain: <p><code>host</code> = TCP, with or without TLS. From the machine itself, any role may log in with its password (SCRAM).</p>,
  },
  {
    key: 'host ::1',
    text: 'host    all             all             ::1/128                 scram-sha-256',
    explain: <p>The same for IPv6 localhost.</p>,
  },
  {
    key: 'replication',
    text: 'local   replication     all                                     peer\nhost    replication     all             127.0.0.1/32            scram-sha-256',
    explain: <p><code>replication</code> is not a database name: it matches replication connections, used by <code>pg_basebackup</code> and standbys (lesson 11).</p>,
  },
  {
    section: '# application servers',
    key: 'app rule',
    text: 'hostssl shop            app_rw          10.0.1.0/24             scram-sha-256',
    explain: (
      <>
        <p>
          Only role <code>app_rw</code>, only database <code>shop</code>, only from the application subnet, only over TLS (<code>hostssl</code>). Anything else from that subnet gets “no pg_hba.conf entry”. The recording below used <code>host</code>, so the client was also accepted without TLS.
        </p>
        <p>Rules are checked <strong>top to bottom; the first line that matches type, database, user and address decides</strong>. If its authentication fails, no later line is tried.</p>
      </>
    ),
  },
]
