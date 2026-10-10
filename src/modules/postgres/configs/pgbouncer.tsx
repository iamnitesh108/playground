import type { ConfigEntry } from '@/shared/ui'

/** /etc/pgbouncer/pgbouncer.ini for one application database. Defaults are PgBouncer 1.26's (SHOW CONFIG). */
export const PGBOUNCER_INI: ConfigEntry[] = [
  {
    section: '[databases]',
    key: 'shop',
    text: 'shop = host=127.0.0.1 port=5432 dbname=shop',
    explain: (
      <p>
        The name clients connect to (left) and where PgBouncer forwards them (right). Per-database overrides such as <code>pool_size=</code> or{' '}
        <code>pool_mode=</code> can be added to the right side. Applications change only their port: 6432 instead of 5432.
      </p>
    ),
  },
  {
    section: '\n[pgbouncer]',
    key: 'listen_addr',
    text: 'listen_addr = *',
    defaultValue: 'unset: Unix socket only',
    explain: <p>Where PgBouncer accepts TCP clients. Like PostgreSQL itself, keep it behind a firewall.</p>,
  },
  {
    key: 'listen_port',
    text: 'listen_port = 6432',
    defaultValue: '6432',
    explain: <p>The conventional PgBouncer port.</p>,
  },
  {
    key: 'auth_type',
    text: 'auth_type = scram-sha-256',
    explain: <p>Clients authenticate to PgBouncer with SCRAM. The same credentials are then used towards PostgreSQL.</p>,
  },
  {
    key: 'auth_file',
    text: 'auth_file = /etc/pgbouncer/userlist.txt',
    explain: (
      <p>
        Lines of <code>"role" "secret"</code>. The secret can be the SCRAM verifier copied from <code>pg_authid.rolpassword</code>, so no plain
        password is stored. Larger setups use <code>auth_query</code> to look roles up in PostgreSQL instead.
      </p>
    ),
  },
  {
    key: 'admin_users',
    text: 'admin_users = pooladmin',
    explain: <p>Roles allowed into the admin console: <code>psql -p 6432 -U pooladmin pgbouncer</code>, then <code>SHOW POOLS;</code>, <code>SHOW STATS;</code>, <code>PAUSE;</code>, <code>RELOAD;</code>.</p>,
  },
  {
    key: 'pool_mode',
    text: 'pool_mode = transaction',
    defaultValue: 'session',
    options: 'session | transaction | statement',
    explain: (
      <p>
        When a server connection goes back to the pool: when the client disconnects (<code>session</code>), after every transaction (
        <code>transaction</code>), or after every statement (<code>statement</code>, which forbids multi-statement transactions). Transaction mode
        gives the most sharing; see what it breaks below.
      </p>
    ),
  },
  {
    key: 'default_pool_size',
    text: 'default_pool_size = 20',
    defaultValue: '20',
    explain: <p>Server connections per database + role pair. This is the number that reaches PostgreSQL, so the sum over all pools must stay below <code>max_connections</code>.</p>,
  },
  {
    key: 'max_client_conn',
    text: 'max_client_conn = 1000',
    defaultValue: '100',
    explain: <p>Client connections PgBouncer accepts. Clients are cheap here (a few kB each), so this can be far larger than the pool.</p>,
  },
  {
    key: 'max_prepared_statements',
    text: 'max_prepared_statements = 200',
    defaultValue: '200',
    explain: <p>Since 1.21, PgBouncer tracks protocol-level prepared statements and re-prepares them on whichever server connection a client gets, so drivers’ prepared statements work in transaction mode. 0 turns it off.</p>,
  },
  {
    key: 'query_wait_timeout',
    text: 'query_wait_timeout = 120',
    defaultValue: '120 (seconds)',
    explain: <p>How long a client may wait in the queue for a server connection before PgBouncer disconnects it with an error.</p>,
  },
  {
    key: 'server_reset_query',
    text: 'server_reset_query = DISCARD ALL',
    defaultValue: 'DISCARD ALL',
    explain: <p>Run on a server connection before another client gets it — but only in session mode (unless <code>server_reset_query_always = 1</code>). In transaction mode nothing is reset between clients.</p>,
  },
]
