import type { ConfigEntry } from '@/shared/ui'
import { CAPTURE } from '../data/captures'

const D = CAPTURE.operations.defaults
const live = <p>Can be changed at runtime with <code>CONFIG SET</code>; write it to the file too (or run <code>CONFIG REWRITE</code>) so a restart keeps it.</p>
const restart = <p><strong>Needs a restart.</strong></p>

/**
 * Lines to set in redis.conf for one role: a dedicated server with 8 GB RAM holding data that must survive
 * (sessions, counters, queues) — not a disposable cache. The cache variant is described per line.
 * It starts as written on a single server. Defaults are those of the recorded server.
 */
export const REDIS_CONF: ConfigEntry[] = [
  {
    section: '# Network',
    key: 'bind',
    text: 'bind 127.0.0.1 -10.0.4.5',
    defaultValue: D.bind,
    explain: (
      <>
        <p>Which addresses Redis listens on. The default <code>{D.bind}</code> listens on every interface; list only loopback and the private address your applications use. A leading <code>-</code> marks an address as optional: without it, Redis refuses to start when that address does not exist on the machine. Redis must never be reachable from the internet.</p>
        <p>In a container, bind inside the container (<code>bind * -::*</code>) and limit who can reach it where the port is published, e.g. <code>-p 127.0.0.1:6379:6379</code> or a private network.</p>
        {restart}
      </>
    ),
  },
  {
    key: 'protected-mode',
    text: 'protected-mode yes',
    defaultValue: D['protected-mode'],
    explain: <p>When the <code>default</code> user has no password and no specific <code>bind</code> addresses are set, protected mode makes Redis answer only clients connecting over loopback. It is a safety net for forgotten passwords, not a substitute for ACLs and a firewall. Keep it on.</p>,
  },
  {
    key: 'port',
    text: 'port 6379',
    defaultValue: '6379',
    explain: <>{restart}</>,
  },
  {
    key: 'maxclients',
    text: 'maxclients 10000',
    defaultValue: D.maxclients,
    explain: <p>Upper limit of client connections; the process also needs enough open file descriptors (ulimit). Each connection costs memory for its buffers. Use connection pools in applications rather than raising this.</p>,
  },
  {
    key: 'timeout',
    text: 'timeout 0',
    defaultValue: D.timeout,
    explain: <p>Close connections idle for this many seconds; 0 never closes them. Pools keep connections open on purpose, so 0 is usual; set it to clean up after clients that leak connections.</p>,
  },
  {
    key: 'tcp-keepalive',
    text: 'tcp-keepalive 300',
    defaultValue: D['tcp-keepalive'],
    explain: <p>Seconds between TCP keepalive probes, so dead peers (a crashed client host) are detected and their connections freed.</p>,
  },
  {
    section: '# Security',
    key: 'aclfile',
    text: 'aclfile /etc/redis/users.acl',
    defaultValue: '(none)',
    explain: (
      <>
        <p>Users and their permissions, one <code>user …</code> line each, managed with <code>ACL SETUSER</code> and saved with <code>ACL SAVE</code>. The file must exist, or Redis refuses to start: create it first (it may be empty), e.g. <code>sudo install -o redis -g redis -m 640 /dev/null /etc/redis/users.acl</code>. Give every application its own user restricted to its key prefixes and command categories, and disable or password-protect the <code>default</code> user. <code>requirepass</code> (default <code>“{D.requirepass}”</code>, empty) is the old single-password form: it only sets the password of <code>default</code>.</p>
        {restart}
      </>
    ),
  },
  {
    section: '# Memory',
    key: 'maxmemory',
    text: 'maxmemory 6gb',
    defaultValue: D.maxmemory,
    explain: <><p>The memory limit for data. The default <code>0</code> means no limit: Redis grows until the operating system kills it. Leave room for fragmentation, client buffers and a forked child during persistence — roughly 60–75% of RAM on a dedicated host.</p>{live}</>,
  },
  {
    key: 'maxmemory-policy',
    text: 'maxmemory-policy noeviction',
    defaultValue: D['maxmemory-policy'],
    explain: <><p>What happens at the limit (lesson 7). <code>noeviction</code> (also the default) rejects writes with an OOM error — right for this data, which must not silently disappear: alert on memory long before the limit. A cache instance instead uses <code>allkeys-lfu</code> or <code>allkeys-lru</code>; mixed data with TTLs only on cache keys wants a <code>volatile-*</code> policy — better, run the cache as a separate instance.</p>{live}</>,
  },
  {
    key: 'maxmemory-samples',
    text: 'maxmemory-samples 5',
    defaultValue: D['maxmemory-samples'],
    explain: <p>Keys sampled per eviction — it only matters with an evicting policy (the cache variant). Higher is closer to true LRU/LFU and costs a little CPU; 5 is a good default.</p>,
  },
  {
    key: 'lazyfree-lazy-eviction',
    text: 'lazyfree-lazy-eviction yes',
    defaultValue: D['lazyfree-lazy-eviction'],
    explain: <p>Free evicted values in a background thread (<code>bio_lazy_free</code>) instead of on the main thread. The siblings <code>lazyfree-lazy-expire</code> and <code>lazyfree-lazy-user-del</code> (make <code>DEL</code> behave like <code>UNLINK</code>) do the same for expiry and deletes; all default to <code>no</code>. Turning them on avoids stalls when big keys go away.</p>,
  },
  {
    key: 'activedefrag',
    text: '# activedefrag yes',
    defaultValue: D.activedefrag,
    explain: <p>Lets Redis move values in the background to reduce fragmentation. Worth enabling when <code>mem_fragmentation_ratio</code> stays well above 1.5 on a long-running instance. Commented out here because it needs the modified jemalloc shipped with Redis: on a build without it (the one used for these recordings) Redis refuses to start with this line. Try <code>CONFIG SET activedefrag yes</code> first; if it is accepted, put it in the file.</p>,
  },
  {
    section: '# Persistence',
    key: 'save',
    text: 'save 3600 1 300 100 60 10000',
    defaultValue: D.save,
    explain: <><p>RDB snapshot rules: “after 3600 s if ≥ 1 change, after 300 s if ≥ 100, after 60 s if ≥ 10000”. Kept here for backup files next to the AOF. A cache instance sets <code>save ""</code> (and <code>appendonly no</code>) to avoid forks altogether (lesson 10).</p>{live}</>,
  },
  {
    key: 'appendonly',
    text: 'appendonly yes',
    defaultValue: D.appendonly,
    explain: <><p>Log every write to the append-only file. Off by default. Turn it on for any data that must survive a restart with more than a snapshot’s precision.</p>{live}</>,
  },
  {
    key: 'appendfsync',
    text: 'appendfsync everysec',
    defaultValue: D.appendfsync,
    explain: <p><code>everysec</code> normally keeps every acknowledged write through a process crash and loses about the last second on power loss — up to 2 s in the worst case, when a slow disk makes Redis postpone writes; <code>always</code> fsyncs before every reply and loses nothing, at a large cost in throughput (measured in lesson 10).</p>,
  },
  {
    key: 'aof-use-rdb-preamble',
    text: 'aof-use-rdb-preamble yes',
    defaultValue: D['aof-use-rdb-preamble'],
    explain: <p>A rewritten AOF starts with an RDB snapshot (the <code>.base.rdb</code> file) followed by commands, so loading is fast.</p>,
  },
  {
    section: '# Replication',
    key: 'repl-backlog-size',
    text: 'repl-backlog-size 64mb',
    defaultValue: D['repl-backlog-size'],
    explain: <p>Size of the ring buffer that lets a reconnecting replica resume (lesson 11). The default is 1 MB; size it for write rate × the longest disconnection you want to survive without a full resync.</p>,
  },
  {
    key: 'min-replicas-to-write',
    text: '# min-replicas-to-write 1',
    defaultValue: D['min-replicas-to-write'],
    explain: <p>Commented out on purpose: only for a primary that has replicas. With it, the primary refuses writes (<code>NOREPLICAS Not enough good replicas to write</code>) unless at least this many replicas are connected and recently acknowledged (with <code>min-replicas-max-lag</code>) — on a single server every write would fail. It limits how much a primary cut off from its replicas can accept — and then lose — during a network split.</p>,
  },
  {
    key: 'repl-diskless-sync',
    text: 'repl-diskless-sync yes',
    defaultValue: D['repl-diskless-sync'],
    explain: <p>Stream the snapshot for a full sync straight to the replica’s socket instead of writing it to disk first. The primary waits <code>repl-diskless-sync-delay</code> ({D['repl-diskless-sync-delay']} s by default) so several replicas can share one transfer.</p>,
  },
  {
    section: '# Observability',
    key: 'slowlog-log-slower-than',
    text: 'slowlog-log-slower-than 10000',
    defaultValue: D['slowlog-log-slower-than'],
    explain: <p>Record commands that take longer than this many microseconds (default 10 ms) in the slow log, which keeps the last <code>slowlog-max-len</code> ({D['slowlog-max-len']}) entries. Many teams use 1000 (1 ms).</p>,
  },
  {
    key: 'latency-monitor-threshold',
    text: 'latency-monitor-threshold 100',
    defaultValue: D['latency-monitor-threshold'],
    explain: <p>Record latency events (slow commands, forks, expiry cycles, AOF fsync) longer than this many milliseconds, for <code>LATENCY LATEST</code> and <code>LATENCY DOCTOR</code>. 0 = off.</p>,
  },
  {
    key: 'notify-keyspace-events',
    text: 'notify-keyspace-events ""',
    defaultValue: D['notify-keyspace-events'] || '""',
    explain: <p>Publish Pub/Sub events when keys change or expire, e.g. <code>Ex</code> for expirations. Off by default because it costs CPU; and like all Pub/Sub, events are lost while nobody listens.</p>,
  },
  {
    section: '# Performance',
    key: 'io-threads',
    text: 'io-threads 4',
    defaultValue: D['io-threads'],
    explain: <><p>Extra threads that read requests from and write replies to sockets. Commands still run on the main thread one at a time. Helps when many clients send small commands and the network work dominates; 1 (the default) means off.</p>{restart}</>,
  },
  {
    key: 'client-output-buffer-limit',
    text: 'client-output-buffer-limit pubsub 32mb 8mb 60',
    defaultValue: D['client-output-buffer-limit'],
    explain: <p>Per class of client: a hard limit and a soft limit plus seconds. A client over the limit is disconnected so its unread replies do not eat the server’s memory (recorded for a slow subscriber in lesson 13). The <code>replica</code> class must be large enough for a full sync.</p>,
  },
  {
    key: 'busy-reply-threshold',
    text: 'busy-reply-threshold 5000',
    defaultValue: D['busy-reply-threshold'],
    explain: <p>After a script has run this many milliseconds, other clients get a <code>BUSY</code> error instead of waiting, and <code>SCRIPT KILL</code> becomes possible (lesson 1).</p>,
  },
]
