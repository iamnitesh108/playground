import { Callout, CodeBlock, ConfigExplorer, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession, LogLines } from '../components'
import { REDIS_CONF } from '../configs/redisConf'
import { CAPTURE, REDIS_VERSION } from '../data/captures'
import styles from './lesson.module.css'

const O = CAPTURE.operations

export default function Operations() {
  return (
    <>
      <LessonGoals
        goals={[
          'install Redis with Docker or an Ubuntu package and a deliberate config file',
          'lock it down with ACL users',
          'read INFO, the slow log, the latency monitor and memory reports — and know what to alert on',
          'find big keys and misbehaving clients, and run through a production checklist',
        ]}
        before="All earlier lessons; especially 7 (eviction), 10 (persistence) and 11 (replication)"
      />

      <h2>Install</h2>
      <p>
        Everything in this module was recorded on Redis {REDIS_VERSION}. Two common ways to run it — written as commands to adapt, not as
        recordings:
      </p>
      <CodeBlock
        title="Docker: the official image, data on a volume, your own config"
        language="bash"
        code={`docker volume create redis-data
docker run -d --name redis --restart unless-stopped \\
  -p 127.0.0.1:6379:6379 \\
  -v redis-data:/data \\
  -v "$PWD/redis.conf":/usr/local/etc/redis/redis.conf:ro \\
  redis:8 redis-server /usr/local/etc/redis/redis.conf

docker exec -it redis redis-cli ping`}
      />
      <p className={styles.note}>
        Inside the container the config needs <code>bind * -::*</code> (Docker forwards the port to the container’s own interface, not to its
        loopback), <code>dir /data</code> so the files land on the volume, and paths that exist in the container (e.g. an{' '}
        <code>aclfile</code> mounted next to the config). Exposure is limited where the port is published: <code>-p 127.0.0.1:6379:6379</code>{' '}
        above, or a private network.
      </p>
      <CodeBlock
        title="Ubuntu: the package"
        language="bash"
        code={`# the distribution's package is usually an older Redis; for 8.x add the
# official repository first (instructions on packages.redis.io)
sudo apt install redis-server
sudoedit /etc/redis/redis.conf          # edit the packaged file; do not replace it
sudo systemctl restart redis-server
sudo systemctl status redis-server
redis-cli ping`}
      />
      <p>Whichever you use, the server tells you at start-up what it does not like. The recorded server, started with no configuration, logged:</p>
      <LogLines title="start-up warnings" lines={O.startupWarnings} highlight={/WARNING/} />

      <h2>The config file</h2>
      <p>
        The lines to review in <code>redis.conf</code> for one role — a dedicated host keeping data that must survive (sessions, counters,
        queues); the cache variant is explained per line. Change these in the packaged file rather than replacing it, which would drop settings
        such as <code>dir</code>, <code>pidfile</code> and <code>logfile</code>. As listed, the lines start a single server. Click a line for what
        it does and its default (as reported by the recorded server):
      </p>
      <ConfigExplorer file="/etc/redis/redis.conf" format="raw" entries={REDIS_CONF} />
      <Callout tone="warn" title="Kernel settings Redis depends on">
        <ul>
          <li><code>vm.overcommit_memory = 1</code>: persistence and full syncs <code>fork()</code> the process; without overcommit the fork of a large instance can fail with “Cannot allocate memory”. Redis logs a warning at start-up when this is not set.</li>
          <li>Transparent huge pages: with THP, copy-on-write after a fork copies 2 MB pages instead of 4 KB ones, which inflates memory and latency. Redis already turns THP off for its own process (<code>disable-thp yes</code>, the default), so the kernel-wide setting (<code>never</code> or <code>madvise</code>) is optional — it matters when that option is off or other processes share the host.</li>
          <li>Enough file descriptors for <code>maxclients</code>, and swap disabled or unused — a swapped-out Redis is a slow Redis.</li>
        </ul>
      </Callout>

      <h2>Users and permissions</h2>
      <p>
        Every application gets its own ACL user, limited to its key prefixes (<code>~checkout:*</code>) and to command categories
        (<code>+@read</code>, <code>-@dangerous</code>). Recorded:
      </p>
      <CliSession title="recorded: an application user with limited rights" steps={O.acl} />
      <p className={styles.note}>
        Note the surprise: <code>ACL WHOAMI</code> was denied — it is only in the <code>@slow</code> category, which this user was not given.
        Connection commands fare the same: with exactly these rights <code>PING</code> and <code>CLIENT SETNAME</code> are refused too
        (<code>HELLO</code> is allowed), and client libraries send them on connect and for pool health checks. Test a new user with the real
        client before rollout, grant <code>+@connection</code> if it needs them, and read <code>ACL LOG</code> when something is denied.
      </p>
      <Predict
        question={<p>User <code>checkout</code> has <code>~checkout:* ~session:* +@read +@write</code>. What does <code>GET billing:invoice:1</code> return?</p>}
        options={['(nil) — the key does not exist for this user', '(error) NOPERM No permissions to access a key', 'The value: GET is a read command']}
        answer={1}
        explanation="The command is allowed (+@read), but the key does not match the user's key patterns, so Redis refuses with NOPERM before looking at the key — recorded above."
      />

      <h2>What to watch: INFO</h2>
      <p><code>INFO</code> returns sections of plain <code>field:value</code> lines. The sections this version has:</p>
      <p className={styles.mono}>{O.infoSections.join(' · ')}</p>
      <div className={styles.grid2}>
        <CodeBlock title="INFO memory (excerpt)" language="text" code={O.infoMemory} />
        <CodeBlock title="INFO stats (excerpt)" language="text" code={O.infoStats} />
        <CodeBlock title="INFO clients (excerpt)" language="text" code={O.infoClients} />
        <CodeBlock title="INFO keyspace" language="text" code={O.infoKeyspace} />
      </div>
      <Table
        head={['Field', 'Means', 'Alert when']}
        rows={[
          ['used_memory vs maxmemory', 'data memory and its limit', 'above ~85% of maxmemory without an eviction policy'],
          ['mem_fragmentation_ratio', 'RSS ÷ used memory', 'well above 1.5 for a long time (fragmentation), or below 1 (swapping)'],
          ['evicted_keys', 'keys removed by maxmemory', 'non-zero on data that must not be evicted; rising fast on a cache'],
          ['keyspace_hits / misses', 'reads that found / did not find the key', 'hit ratio dropping (lesson 14)'],
          ['connected_clients', 'open connections', 'near maxclients, or growing without bound (a connection leak)'],
          ['blocked_clients', 'clients waiting in BLPOP, XREADGROUP BLOCK, …', 'unexpectedly high'],
          ['rejected_connections', 'connections refused at maxclients', 'any'],
          ['instantaneous_ops_per_sec', 'commands per second right now', 'far off its usual range'],
          ['rdb_last_bgsave_status / aof_last_write_status', 'persistence health (INFO persistence)', 'not ok'],
          ['master_link_status, lag', 'replication health (INFO replication)', 'down, or lag growing'],
        ]}
      />

      <h2>Slow commands</h2>
      <p>
        The slow log records commands whose <em>execution</em> took longer than <code>slowlog-log-slower-than</code> microseconds (network time
        is not included). Each entry: id, unix time, duration in microseconds, the command, the client address and name. Recorded with a 10 ms
        threshold:
      </p>
      <CliSession title="recorded: the slow log" steps={O.slowlog} />
      <p className={styles.note}>
        An <code>HGETALL</code> on a 100,000-field hash: one command, one key, and every other client waited behind it (lesson 1). Read big
        collections in pieces with <code>HSCAN</code>, <code>SSCAN</code>, <code>ZSCAN</code> or ranges.
      </p>

      <h2>Latency spikes</h2>
      <p>The latency monitor groups events by cause, including those that are not commands (forks, expiry cycles, fsync):</p>
      <CliSession title="recorded: after a 20,000,000-iteration Lua loop" steps={O.latency} />
      <CodeBlock title="LATENCY DOCTOR (recorded, start)" language="text" code={O.latencyDoctor.split('\n').slice(0, 9).join('\n')} />

      <h2>Memory: per key, and big keys</h2>
      <CliSession title="recorded: MEMORY USAGE" steps={O.memoryUsage} />
      <p>
        <code>redis-cli --bigkeys</code> scans the keyspace with <code>SCAN</code> (safe on a live server) and reports the largest key of each
        type by element count; <code>--memkeys</code> does the same by bytes:
      </p>
      <CodeBlock title="redis-cli --bigkeys (recorded)" language="text" code={O.bigkeys.split('\n').slice(2).join('\n')} />
      <CodeBlock title="redis-cli --memkeys (recorded, summary)" language="text" code={O.memkeys} />
      <p className={styles.note}>
        MEMORY DOCTOR on the same server: “{O.memoryDoctor.split('\n')[0]}” — useful mostly for its warnings about fragmentation and peaks.
      </p>

      <h2>Who is connected</h2>
      <Table
        head={['id', 'addr', 'name', 'age (s)', 'idle (s)', 'flags', 'cmd', 'tot-mem']}
        rows={O.clientList.map((c) => [c.id, c.addr, c.name || '—', c.age, c.idle, c.flags, c.cmd, c['tot-mem']])}
      />
      <TermList
        items={[
          { term: 'name', definition: 'Set by the application with CLIENT SETNAME (e.g. checkout-api). Name every pool: it makes this list readable.' },
          { term: 'flags', definition: 'N = normal client, b = blocked in a blocking command, P = Pub/Sub, M/S = primary/replica link, x = in MULTI.' },
          { term: 'omem / tot-mem', definition: 'Output-buffer memory / total memory of the connection. A large omem is a client not reading its replies.' },
        ]}
      />

      <h2>Backups and upgrades</h2>
      <ul>
        <li><strong>Backups:</strong> copy the RDB file (or the whole <code>appendonlydir</code>) after a successful <code>BGSAVE</code> to another machine or object storage; keep several generations; restore one regularly to prove it works.</li>
        <li><strong>Upgrades:</strong> replicas first, then fail over and upgrade the old primary (Sentinel or Cluster do the switch). Read the release notes for changed behaviour — this module found, for example, that an embedded string’s limit now includes the key, and that full syncs use a separate rdb channel.</li>
        <li><strong>Configuration drift:</strong> runtime <code>CONFIG SET</code> changes vanish on restart unless written to the file; keep the file in version control.</li>
      </ul>

      <h2>Production checklist</h2>
      <Table
        head={['Area', 'Check']}
        rows={[
          ['Network', 'bound to private addresses only; firewall; TLS if traffic leaves a trusted network'],
          ['Access', 'one ACL user per application, least privilege; default user disabled or strongly protected'],
          ['Memory', 'maxmemory set with headroom; the eviction policy matches the data; overcommit_memory = 1; THP off'],
          ['Durability', 'persistence chosen per data class (lesson 10); backups copied off the host and tested'],
          ['Availability', 'replicas plus Sentinel or Cluster; repl-backlog-size sized; failover tested'],
          ['Latency', 'no KEYS, no unbounded HGETALL/SMEMBERS/LRANGE on big keys; slow log and latency monitor on'],
          ['Clients', 'pools with names, timeouts and retries with backoff; pipelining for batches'],
          ['Monitoring', 'memory, evictions, hit ratio, clients, replication lag, persistence status, slow log'],
        ]}
      />
      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Treat <code>redis.conf</code> as code: reviewed, versioned, identical across replicas.</li>
          <li>Decide eviction and persistence per instance; do not mix a must-keep store and a cache with different needs on one instance.</li>
          <li>Alert on trends (memory, lag, hit ratio), not only on the server being down.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'Install from a package or the official image, but always with your own config file: bind, ACLs, maxmemory, a policy and persistence chosen on purpose.',
          'ACL users restrict keys and command categories; test them with the real client, and read ACL LOG when something is denied.',
          'INFO, SLOWLOG, LATENCY and MEMORY USAGE explain most incidents; --bigkeys and CLIENT LIST find the culprits.',
          'Kernel overcommit, THP, backups off the host and rehearsed failovers are part of running Redis, not extras.',
        ]}
      />
    </>
  )
}
