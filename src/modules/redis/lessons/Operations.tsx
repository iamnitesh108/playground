import { Callout, CodeBlock, ConfigExplorer, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarChart, Flow, Proportion, StatTiles } from '@/shared/figures'
import { CliSession, LogLines } from '../components'
import { OperationsChecklist } from '../components/OperationsChecklist'
import { REDIS_CONF } from '../configs/redisConf'
import { CAPTURE, REDIS_VERSION } from '../data/captures'
import styles from './lesson.module.css'

const O = CAPTURE.operations

/** A field of a recorded INFO excerpt. */
const field = (text: string, k: string) => text.match(new RegExp(`^${k}:(.*)$`, 'm'))?.[1]?.trim() ?? ''
const human = (v: string) => Number.parseFloat(v) * ({ K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[v.slice(-1)] ?? 1)
const usedMemory = human(field(O.infoMemory, 'used_memory_human'))
const rssMemory = human(field(O.infoMemory, 'used_memory_rss_human'))
const maxMemory = human(field(O.infoMemory, 'maxmemory_human'))
const mbOf = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
/** Slow log entries: duration (µs) and command, from the recorded SLOWLOG GET. */
const SLOW = [...(O.slowlog[0].out ?? '').matchAll(/3\) \(integer\) (\d+)\n\s+4\) 1\) "([^"]+)"/g)].map((m) => ({ us: Number(m[1]), command: m[2] }))
const slowThreshold = Number(O.defaults['slowlog-log-slower-than'])
const latency = (O.latency[0].out ?? '').match(/"([^"]+)"[\s\S]*?3\) \(integer\) (\d+)[\s\S]*?4\) \(integer\) (\d+)/)
const MEM = O.memoryUsage.map((s) => ({ key: s.cmd.split(' ').pop()!, bytes: Number(s.out.match(/\d+/)?.[0] ?? 0) }))
const aclReply = (prefix: string) => O.acl.find((s) => s.cmd.startsWith(prefix))?.out.split(' ').slice(0, 2).join(' ') ?? ''

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
      <Flow
        title="A production layout: what talks to what (lessons 10–11 explain each part)"
        cols={5}
        rows={3}
        rowHeight={74}
        nodes={[
          { id: 'apps', label: 'applications', sub: 'pooled clients', col: 0, row: 1, hue: 1, shape: 'queue' },
          { id: 'primary', label: 'primary', sub: 'all writes', col: 2, row: 1, hue: 2 },
          { id: 'r1', label: 'replica 1', sub: 'reads, standby', col: 4, row: 0, hue: 5 },
          { id: 'r2', label: 'replica 2', sub: 'reads, standby', col: 4, row: 1, hue: 5 },
          { id: 'sentinels', label: '3 Sentinels', sub: 'watch, fail over', col: 2, row: 0, hue: 5, shape: 'queue' },
          { id: 'disk', label: 'RDB / AOF', sub: 'local disk', col: 2, row: 2, hue: 4, shape: 'store' },
          { id: 'backup', label: 'backups', sub: 'another machine', col: 4, row: 2, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'apps', to: 'primary', label: 'commands', flow: true, hue: 1 },
          { from: 'primary', to: 'r1', flow: true, hue: 2 },
          { from: 'primary', to: 'r2', label: 'replication', flow: true, hue: 2 },
          { from: 'sentinels', to: 'primary', label: 'PING', hue: 5, dashed: true },
          { from: 'apps', to: 'sentinels', label: 'who is primary?', hue: 5, dashed: true },
          { from: 'primary', to: 'disk', label: 'persist', hue: 4 },
          { from: 'disk', to: 'backup', label: 'copy off host', flow: true, hue: 4 },
        ]}
        steps={[
          { title: 'Applications talk to the primary', body: <p>Every write goes to one primary through pooled, named connections (an ACL user per application).</p>, active: ['apps', 'primary', 'apps>primary'] },
          { title: 'Replicas copy every write', body: <p>Replicas follow the primary's write stream asynchronously; they can serve reads that tolerate a little staleness and stand by for failover.</p>, active: ['primary', 'r1', 'r2', 'primary>r1', 'primary>r2'] },
          { title: 'Persistence and backups', body: <p>The primary writes RDB snapshots and/or the AOF to local disk; a job copies them off the host — a backup on the same disk is not a backup.</p>, active: ['primary', 'disk', 'backup', 'primary>disk', 'disk>backup'] },
          { title: 'Sentinels watch and fail over', body: <p>Three Sentinels on separate hosts ping the primary; if a quorum agrees it is down, they promote a replica. Clients ask a Sentinel for the current primary's address.</p>, active: ['sentinels', 'primary', 'apps', 'r1', 'r2', 'sentinels>primary', 'apps>sentinels'] },
        ]}
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
      <Flow
        title="How Redis decides, for every command of user checkout (replies as recorded)"
        cols={5}
        rows={2}
        rowHeight={84}
        nodes={[
          { id: 'cmd', label: 'command', sub: 'from the app', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'auth', label: 'authenticated?', sub: 'AUTH user pass', col: 1, row: 0, hue: 2 },
          { id: 'category', label: 'command allowed?', sub: '+@read +@write …', col: 2, row: 0, hue: 2 },
          { id: 'keys', label: 'keys allowed?', sub: '~checkout:* ~session:*', col: 3, row: 0, hue: 2 },
          { id: 'run', label: 'executed', sub: aclReply('SET checkout:cart:7'), col: 4, row: 0, hue: 6 },
          { id: 'wrongpass', label: 'refused', sub: aclReply('AUTH checkout wrong'), col: 1, row: 1, hue: 8 },
          { id: 'nocmd', label: 'refused', sub: aclReply('FLUSHALL'), col: 2, row: 1, hue: 8 },
          { id: 'nokey', label: 'refused', sub: aclReply('GET billing'), col: 3, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'cmd', to: 'auth', flow: true, hue: 1 },
          { from: 'auth', to: 'category', label: 'yes', flow: true, hue: 2 },
          { from: 'category', to: 'keys', label: 'yes', flow: true, hue: 2 },
          { from: 'keys', to: 'run', label: 'yes', flow: true, hue: 6 },
          { from: 'auth', to: 'wrongpass', label: 'no', hue: 8 },
          { from: 'category', to: 'nocmd', label: 'no', hue: 8 },
          { from: 'keys', to: 'nokey', label: 'no', hue: 8 },
        ]}
        steps={[
          { title: 'Wrong password', body: <p><code>AUTH checkout wrong-password</code> fails before any command: <code>WRONGPASS</code>.</p>, active: ['cmd', 'auth', 'wrongpass', 'cmd>auth', 'auth>wrongpass'] },
          { title: 'A command outside the user’s categories', body: <p><code>FLUSHALL</code> (and <code>KEYS</code>, and even <code>ACL WHOAMI</code>) is not in the granted categories: <code>NOPERM</code> for the command.</p>, active: ['cmd', 'auth', 'category', 'nocmd', 'cmd>auth', 'auth>category', 'category>nocmd'] },
          { title: 'A key outside the user’s patterns', body: <p><code>GET billing:invoice:1</code>: GET is allowed, but the key matches neither <code>~checkout:*</code> nor <code>~session:*</code> — <code>NOPERM</code> for the key, before the key is even read.</p>, active: ['cmd', 'auth', 'category', 'keys', 'nokey', 'cmd>auth', 'auth>category', 'category>keys', 'keys>nokey'] },
          { title: 'Everything matches', body: <p><code>SET checkout:cart:7 apple</code> passes all three checks and runs: <code>OK</code>.</p>, active: ['cmd', 'auth', 'category', 'keys', 'run', 'cmd>auth', 'auth>category', 'category>keys', 'keys>run'] },
        ]}
      />
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
      <StatTiles
        title="The recorded server at a glance (from the excerpts below)"
        stats={[
          { label: 'used memory', value: field(O.infoMemory, 'used_memory_human'), sub: `of maxmemory ${field(O.infoMemory, 'maxmemory_human')}`, hue: 3, bar: { value: usedMemory, max: maxMemory } },
          { label: 'fragmentation ratio', value: field(O.infoMemory, 'mem_fragmentation_ratio'), sub: `RSS ${field(O.infoMemory, 'used_memory_rss_human')}`, hue: 7 },
          { label: 'keys in db0', value: Number(field(O.infoKeyspace, 'db0').match(/keys=(\d+)/)?.[1] ?? 0), hue: 3 },
          { label: 'connected clients', value: field(O.infoClients, 'connected_clients'), sub: `max ${field(O.infoClients, 'maxclients')}`, hue: 1 },
          { label: 'evicted keys', value: field(O.infoStats, 'evicted_keys'), sub: field(O.infoMemory, 'maxmemory_policy'), hue: 6 },
        ]}
      />
      <Proportion
        title="Where the memory limit stands (recorded INFO memory)"
        parts={[
          { label: 'used_memory (data, buffers)', value: usedMemory, display: mbOf(usedMemory), hue: 3 },
          { label: 'extra the OS sees (RSS − used)', value: Math.max(0, rssMemory - usedMemory), display: mbOf(Math.max(0, rssMemory - usedMemory)), hue: 7 },
          { label: 'free below maxmemory', value: Math.max(0, maxMemory - rssMemory), display: mbOf(Math.max(0, maxMemory - rssMemory)), hue: 6 },
        ]}
      />
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
      <BarChart
        title="Slow log entries (recorded) against the threshold"
        bars={SLOW.map((s) => ({ label: s.command, value: s.us / 1000, display: `${(s.us / 1000).toFixed(1)} ms`, hue: 8 }))}
        max={Math.max(...SLOW.map((s) => s.us / 1000), slowThreshold / 1000) * 1.3}
        marker={{ value: slowThreshold / 1000, label: `slowlog-log-slower-than ${slowThreshold.toLocaleString()} µs (the default) — anything longer is logged` }}
      />
      <CliSession title="recorded: the slow log" steps={O.slowlog} />
      <p className={styles.note}>
        An <code>HGETALL</code> on a 100,000-field hash: one command, one key, and every other client waited behind it (lesson 1). Read big
        collections in pieces with <code>HSCAN</code>, <code>SSCAN</code>, <code>ZSCAN</code> or ranges.
      </p>

      <h2>Latency spikes</h2>
      <p>The latency monitor groups events by cause, including those that are not commands (forks, expiry cycles, fsync):</p>
      {latency && (
        <StatTiles
          stats={[
            { label: 'event', value: latency[1], sub: 'what caused the spike', hue: 2 },
            { label: 'latest spike', value: `${latency[2]} ms`, sub: 'one Lua loop', hue: 8 },
            { label: 'worst ever', value: `${latency[3]} ms`, sub: 'since monitoring started', hue: 8 },
          ]}
        />
      )}
      <CliSession title="recorded: after a 20,000,000-iteration Lua loop" steps={O.latency} />
      <CodeBlock title="LATENCY DOCTOR (recorded, start)" language="text" code={O.latencyDoctor.split('\n').slice(0, 9).join('\n')} />

      <h2>Memory: per key, and big keys</h2>
      <CliSession title="recorded: MEMORY USAGE" steps={O.memoryUsage} />
      <BarChart
        title="MEMORY USAGE of three keys (recorded): one small, two big"
        bars={MEM.map((m) => ({ label: m.key, value: m.bytes, display: m.bytes > 1024 * 1024 ? mbOf(m.bytes) : `${m.bytes} B`, hue: m.bytes > 1024 * 1024 ? 8 : 3 }))}
      />
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
      <OperationsChecklist
        title="Before go-live"
        areas={[
          { area: 'Network', hue: 7, checks: ['bound to private addresses only', 'firewall in front', 'TLS if traffic leaves a trusted network'] },
          { area: 'Access', hue: 2, checks: ['one ACL user per application', 'least privilege: key patterns and categories', 'default user disabled or strongly protected'] },
          { area: 'Memory', hue: 3, checks: ['maxmemory set with headroom', 'eviction policy matches the data', 'vm.overcommit_memory = 1; THP not in the way'] },
          { area: 'Durability', hue: 4, checks: ['persistence chosen per data class (lesson 10)', 'backups copied off the host', 'a restore actually tested'] },
          { area: 'Availability', hue: 5, checks: ['replicas plus Sentinel or Cluster', 'repl-backlog-size sized for outages', 'failover rehearsed'] },
          { area: 'Latency', hue: 8, checks: ['no KEYS in application code', 'no unbounded HGETALL / SMEMBERS / LRANGE on big keys', 'slow log and latency monitor on'] },
          { area: 'Clients', hue: 1, checks: ['named pools with timeouts', 'retries with backoff', 'pipelining for batches'] },
          { area: 'Monitoring', hue: 6, checks: ['memory and evictions', 'hit ratio and clients', 'replication lag and persistence status'] },
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
