import type { ConfigEntry } from '@/shared/ui'

const restart = <p><strong>Needs a restart</strong> (context <code>postmaster</code>); a reload is not enough.</p>
const reload = <p>Applied on reload: <code>SELECT pg_reload_conf();</code> or <code>systemctl reload</code>.</p>

/** A starting postgresql.conf for a dedicated server with 16 GB RAM. Defaults are PostgreSQL 18's. */
export const POSTGRESQL_CONF: ConfigEntry[] = [
  {
    section: '# Connections',
    key: 'listen_addresses',
    text: "listen_addresses = '*'",
    defaultValue: 'localhost',
    explain: (
      <>
        <p>Which network interfaces accept TCP connections. The default accepts only local ones, so a remote client gets “Connection refused”. <code>'*'</code> listens everywhere; access is then decided by <code>pg_hba.conf</code> and your firewall.</p>
        {restart}
      </>
    ),
  },
  {
    key: 'port',
    text: 'port = 5432',
    defaultValue: '5432',
    explain: <>{restart}</>,
  },
  {
    key: 'max_connections',
    text: 'max_connections = 200',
    defaultValue: '100',
    explain: (
      <>
        <p>Upper limit of concurrent connections, each one a backend process. 3 of them are kept for superusers (<code>superuser_reserved_connections</code>). Raising it costs memory per connection; put a pooler in front instead (lesson 10).</p>
        {restart}
      </>
    ),
  },
  {
    section: '# Memory',
    key: 'shared_buffers',
    text: 'shared_buffers = 4GB',
    defaultValue: '128MB',
    explain: (
      <>
        <p>The shared page cache. A common starting point is about 25% of RAM on a dedicated server; the operating system’s cache holds much of the rest.</p>
        {restart}
      </>
    ),
  },
  {
    key: 'effective_cache_size',
    text: 'effective_cache_size = 12GB',
    defaultValue: '4GB',
    explain: <p>Allocates nothing. It tells the planner how much data is likely cached (shared buffers + OS cache), which makes index scans look cheaper. Often set to 50–75% of RAM. Applies per session.</p>,
  },
  {
    key: 'work_mem',
    text: 'work_mem = 16MB',
    defaultValue: '4MB',
    explain: <p>Memory for <em>each</em> sort or hash operation before it spills to disk. One complex query can use several multiples of it, in every connection at once — raise it carefully, or per session for reports (<code>SET work_mem = '256MB'</code>).</p>,
  },
  {
    key: 'maintenance_work_mem',
    text: 'maintenance_work_mem = 1GB',
    defaultValue: '64MB',
    explain: <p>Memory for VACUUM, CREATE INDEX and adding foreign keys. Larger values make index builds and vacuum faster.</p>,
  },
  {
    section: '# WAL and checkpoints',
    key: 'wal_level',
    text: 'wal_level = replica',
    defaultValue: 'replica',
    options: 'minimal | replica | logical',
    explain: (
      <>
        <p><code>replica</code> supports WAL archiving and standbys; <code>logical</code> adds what logical decoding needs (change data capture). <code>minimal</code> disables both.</p>
        {restart}
      </>
    ),
  },
  {
    key: 'max_wal_size',
    text: 'max_wal_size = 4GB',
    defaultValue: '1GB',
    explain: <><p>WAL volume that triggers a checkpoint (lesson 8). Raise it for write-heavy servers to space checkpoints out.</p>{reload}</>,
  },
  {
    key: 'io_method',
    text: 'io_method = worker',
    defaultValue: 'worker',
    options: 'worker | io_uring | sync',
    explain: (
      <>
        <p>New in PostgreSQL 18: how asynchronous reads are performed. <code>worker</code> uses the <code>io worker</code> processes (3 by default, <code>io_workers</code>); <code>io_uring</code> is available on Linux builds that support it; <code>sync</code> is the pre-18 behaviour.</p>
        {restart}
      </>
    ),
  },
  {
    section: '# Safety nets',
    key: 'idle_in_transaction_session_timeout',
    text: "idle_in_transaction_session_timeout = '5min'",
    defaultValue: '0 (off)',
    explain: <p>Ends a session that sits inside an open transaction doing nothing. Such sessions hold locks and stop VACUUM from cleaning up (lesson 3).</p>,
  },
  {
    key: 'lock_timeout',
    text: "lock_timeout = '0'",
    defaultValue: '0 (off)',
    explain: <p>Keep it off globally, and set it per session before migrations (<code>SET lock_timeout = '3s'</code>), so a DDL statement gives up instead of queuing behind a long query and blocking everyone behind it (lesson 5).</p>,
  },
  {
    key: 'statement_timeout',
    text: "statement_timeout = '0'",
    defaultValue: '0 (off)',
    explain: <p>A global limit also kills legitimate long jobs (backups, migrations). Set it per role instead: <code>ALTER ROLE app_rw SET statement_timeout = '30s';</code></p>,
  },
  {
    section: '# Logging',
    key: 'log_min_duration_statement',
    text: "log_min_duration_statement = '500ms'",
    defaultValue: '-1 (off)',
    explain: <p>Logs every statement that runs longer than this, with its duration — the simplest way to find slow queries. The <code>pg_stat_statements</code> extension gives aggregated statistics on top.</p>,
  },
  {
    key: 'log_lock_waits',
    text: 'log_lock_waits = on',
    defaultValue: 'off',
    explain: <p>Logs a message when a session waits longer than <code>deadlock_timeout</code> (1 s) for a lock, naming who holds it.</p>,
  },
  {
    key: 'log_connections',
    text: "log_connections = 'authentication'",
    defaultValue: "'' (off)",
    options: 'receipt, authentication, authorization, setup_durations, all',
    explain: <p>In PostgreSQL 18 this became a list of connection stages to log, instead of on/off. <code>authentication</code> logs who logged in and which pg_hba.conf line matched.</p>,
  },
  {
    section: '# Security',
    key: 'password_encryption',
    text: 'password_encryption = scram-sha-256',
    defaultValue: 'scram-sha-256',
    explain: <p>How new passwords are stored. Keep SCRAM; <code>md5</code> is deprecated.</p>,
  },
  {
    key: 'ssl',
    text: 'ssl = on',
    defaultValue: 'off (Ubuntu packages: on, with a self-signed certificate)',
    explain: <><p>Encrypts client connections. Needs <code>ssl_cert_file</code> and <code>ssl_key_file</code>; use a real certificate so clients can verify the server with <code>sslmode=verify-full</code>.</p>{reload}</>,
  },
]
