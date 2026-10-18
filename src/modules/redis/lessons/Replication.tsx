import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Flow, StatTiles, Timeline } from '@/shared/figures'
import { CliSession, LogLines, ReplicationPlayground } from '../components'
import { ReplicationBacklogRing } from '../components/ReplicationBacklogRing'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const R = CAPTURE.replication
const infoValue = (info: string, key: string) => Number(info.match(new RegExp(`^${key}:(\\d+)`, 'm'))?.[1] ?? 0)
/** Bytes the primary sent from its backlog on the partial resync, and the snapshot size of the full sync (both from the logs). */
const PARTIAL_BYTES = Number(R.partialMaster.join('\n').match(/Sending (\d+) bytes of backlog/)?.[1] ?? 0)
const SNAPSHOT_BYTES = Number(R.fullSyncMaster.join('\n').match(/(\d+) bytes written/)?.[1] ?? 0)
const BACKLOG = infoValue(R.infoMaster, 'repl_backlog_size')
/** The experiment waits 1.5 s after the failover before restarting the old primary. */
const RETURN_AT = R.failoverMs + 1500
const SENTINEL_EVENT: Record<string, string> = {
  '+slave': 'a sentinel discovered a replica (from INFO on the primary)',
  '+sdown': 'this sentinel lost contact for down-after-milliseconds: subjectively down',
  '+odown': 'enough sentinels (the quorum) agree: objectively down — a failover may start',
  '+new-epoch': 'a new configuration epoch: a version number for the failover',
  '+try-failover': 'this sentinel wants to run the failover',
  '+vote-for-leader': 'the sentinels elect one leader to do it',
  '+switch-master': 'the new primary is announced: clients asking Sentinel now get it',
  '-sdown': 'contact restored',
}

export default function Replication() {
  const sentinelRows = R.sentinelLog.map((l) => {
    const ev = l.split(' ')[0]
    return [<code key="l">{l}</code>, SENTINEL_EVENT[ev] ?? '']
  })
  return (
    <>
      <LessonGoals
        goals={[
          'follow a replica from its first full copy to a stream of commands, in the real logs',
          'tell a partial resync from a full one, and size the backlog',
          'understand why an acknowledged write can be lost in a failover, and what WAIT does and does not promise',
          'run Sentinel and know what clients must do during a failover',
        ]}
        before="Lesson 10 — RDB snapshots and the AOF"
      />

      <h2>One primary, any number of replicas</h2>
      <p>
        A replica is a Redis server that keeps a copy of another one, the primary. It first receives the whole dataset, then every write command
        the primary executes, in the same order. Replicas give you a hot standby for failover and extra servers for reads.
      </p>
      <Flow
        title="Writes go to the primary; a stream of commands keeps every replica in step"
        cols={4}
        rows={3}
        nodes={[
          { id: 'app', label: 'clients', sub: 'writes and reads', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'primary', label: 'primary', sub: 'executes every write', col: 1, row: 0, rowSpan: 2, hue: 2 },
          { id: 'backlog', label: 'backlog', sub: `last ${(BACKLOG / 1024 / 1024).toFixed(0)} MB of the stream`, col: 1, row: 2, hue: 3, shape: 'log' },
          { id: 'r1', label: 'replica 1', sub: 'read-only copy', col: 3, row: 0, hue: 5, shape: 'store' },
          { id: 'r2', label: 'replica 2', sub: 'back after a short gap', col: 3, row: 1, hue: 5, shape: 'store' },
        ]}
        edges={[
          { from: 'app', to: 'primary', label: 'SET', hue: 1, flow: true },
          { from: 'primary', to: 'r1', label: 'write stream', hue: 2, flow: true },
          { from: 'primary', to: 'backlog', label: 'kept', hue: 3 },
          { from: 'primary', to: 'r2', hue: 2, flow: true },
          { from: 'backlog', to: 'r2', label: 'missed part', hue: 3, dashed: true },
        ]}
      />
      <TermList
        items={[
          { term: 'replication ID', definition: 'A random 40-character id of a primary’s history. A replica that remembers it can ask to continue that history.' },
          { term: 'offset', definition: 'How many bytes of the write stream have been produced (primary) or applied (replica).' },
          { term: 'backlog', definition: 'A ring buffer on the primary with the last repl-backlog-size bytes of the stream, kept for replicas that reconnect.' },
          { term: 'full resync', definition: 'A new snapshot of the whole dataset sent to the replica, then the stream from that point.' },
          { term: 'partial resync', definition: 'Only the part of the stream the replica missed, taken from the backlog.' },
        ]}
      />

      <h2>The first connection: a full copy</h2>
      <p>
        The recording started a primary with 100,000 keys and pointed a replica at it (<code>replicaof 127.0.0.1 6379</code>). The replica has no
        history, so it cannot continue anything and asks for everything:
      </p>
      <Flow
        title="A full sync in Redis 8: the snapshot on one connection, the live stream on another"
        cols={5}
        rows={2}
        nodes={[
          { id: 'replica', label: 'replica', sub: 'no history yet', col: 0, row: 0, rowSpan: 2, hue: 5 },
          { id: 'primary', label: 'primary', sub: 'keeps serving', col: 4, row: 0, hue: 2 },
          { id: 'child', label: 'fork child', sub: 'diskless BGSAVE', col: 4, row: 1, hue: 4 },
          { id: 'buffer', label: 'live stream', sub: 'replica buffers it', col: 2, row: 0, hue: 3, shape: 'queue' },
          { id: 'disk', label: 'replica disk', sub: 'snapshot, then load', col: 2, row: 1, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'primary', to: 'buffer', label: 'main link', hue: 2, flow: true, both: true },
          { from: 'child', to: 'disk', label: 'rdb channel', hue: 4, flow: true },
          { from: 'buffer', to: 'replica', label: 'apply after load', hue: 3 },
          { from: 'disk', to: 'replica', label: 'load', hue: 4 },
        ]}
        steps={[
          { title: 'The replica asks to continue — it cannot', body: <p>Over the main connection the replica asks to continue, but it has no cached replication id (its log: <code>Partial resynchronization not possible (no cached master)</code>). Both sides support the rdb channel, so the replica opens a second connection for the snapshot.</p>, active: ['replica', 'primary', 'primary>buffer'] },
          { title: 'The primary waits, then forks', body: <p><code>Delay next BGSAVE for diskless SYNC</code>: it waits <code>repl-diskless-sync-delay</code> so more replicas can share one snapshot, then a fork child streams the snapshot straight to the replica’s socket ({SNAPSHOT_BYTES.toLocaleString()} bytes here).</p>, active: ['primary', 'child', 'disk', 'child>disk'] },
          { title: 'New writes travel in parallel', body: <p>Over the main connection the replica already receives the live stream and buffers it — the primary does not hold the writes of a long transfer in memory.</p>, active: ['primary', 'buffer', 'primary>buffer'] },
          { title: 'Load, then catch up', body: <p>The replica loads the snapshot, applies the buffered stream (<code>Successfully streamed replication buffer into the db</code>) and from then on follows the live stream.</p>, active: ['replica', 'buffer', 'disk', 'buffer>replica', 'disk>replica'] },
        ]}
      />
      <LogLines title="primary log (recorded)" lines={R.fullSyncMaster} highlight={/Full resync|BGSAVE done|succeeded/} />
      <LogLines title="replica log (recorded)" lines={R.fullSyncReplica} highlight={/not possible|Finished with success/} />
      <p>
        The logs show three Redis 8 details worth knowing:
      </p>
      <ul>
        <li>
          <strong>Diskless sync.</strong> The primary forks and streams the snapshot straight to the replica’s socket — no file on the primary.
          It first waits <code>repl-diskless-sync-delay</code> seconds (<code>Delay next BGSAVE for diskless SYNC</code>) so several replicas can
          share one snapshot.
        </li>
        <li>
          <strong>The rdb channel.</strong> The snapshot travels on a second connection while the replica already buffers the live stream on the
          main one, so the primary does not have to hold every write of a long transfer in memory.
        </li>
        <li>
          <strong>Disk on the replica.</strong> By default (<code>repl-diskless-load disabled</code>) the replica still writes what it receives
          to disk and loads it from there — its log says <code>receiving streamed RDB … to disk</code>. Then it applies the buffered writes.
        </li>
      </ul>
      <CodeBlock title="INFO replication on the primary (recorded)" language="text" code={R.infoMaster} />
      <CodeBlock title="INFO replication on the replica (recorded)" language="text" code={R.infoReplica} />
      <p>
        Redis still says <code>master</code> and <code>slave</code> in INFO. Both sides share one <code>master_replid</code>; the offsets show how
        far each has got, and <code>lag</code> is the seconds since the replica last confirmed its offset (replicas acknowledge every second).
      </p>
      <CliSession title="replicas are read-only (recorded)" steps={R.readOnly} />

      <h2>A short disconnect: continue from the backlog</h2>
      <p>The recording cut the replica’s connection and wrote 100 keys right away; the replica reconnected while the writes were still going:</p>
      <Flow
        title="Partial resync: “continue from my offset”"
        cols={4}
        rows={1}
        nodes={[
          { id: 'replica', label: 'replica', sub: 'PSYNC id + offset', col: 0, row: 0, hue: 5 },
          { id: 'primary', label: 'primary', sub: 'same replication id', col: 1, row: 0, hue: 2 },
          { id: 'backlog', label: 'backlog', sub: 'still has the bytes', col: 2, row: 0, hue: 3, shape: 'log' },
          { id: 'done', label: 'in sync', sub: `${PARTIAL_BYTES} bytes sent`, col: 3, row: 0, hue: 6 },
        ]}
        edges={[
          { from: 'replica', to: 'primary', hue: 5, flow: true },
          { from: 'primary', to: 'backlog', hue: 2 },
          { from: 'backlog', to: 'done', hue: 3, flow: true },
        ]}
      />
      <LogLines title="primary log (recorded)" lines={R.partialMaster} highlight={/accepted/} />
      <LogLines title="replica log (recorded)" lines={R.partialReplica} highlight={/partial resynchronization/i} />
      <p>
        The replica cached its old state and asked to continue <code>&lt;replication id&gt;:&lt;offset&gt;</code>. The primary sent the bytes it had
        missed from its backlog — only the few writes made before it was back — and the rest arrived over the live link. No snapshot, no fork.
      </p>

      <h2>A long disconnect: start again</h2>
      <p>
        Now the backlog was set to {R.backlogTooSmall.backlogBytes.toLocaleString()} bytes and over {R.backlogTooSmall.writtenBytes.toLocaleString()}{' '}
        bytes of values (more on the wire, with keys and protocol framing) were written while the replica was away. The bytes it needed had already been overwritten in the ring:
      </p>
      <LogLines title="primary log (recorded)" lines={R.backlogTooSmall.master} highlight={/lack of backlog|Full resync/} />
      <ReplicationBacklogRing
        title="The backlog is a ring: what the replica missed, against its size (recorded runs)"
        cases={[
          { title: 'short disconnect', backlog: BACKLOG, missed: PARTIAL_BYTES },
          { title: 'long disconnect', backlog: R.backlogTooSmall.backlogBytes, missed: R.backlogTooSmall.writtenBytes },
        ]}
      />
      <p className={own.note}>The second run’s “missed” counts only the values written; keys and protocol framing make the real stream larger still.</p>
      <p>
        A full resync costs a fork on the primary, the whole dataset over the network, and a reload on the replica — painful for a big dataset, and
        it can repeat in a loop if the next disconnect comes before it finishes. The default backlog (1 MB) is small for a busy primary: size it to
        the writes of the longest disconnect you want to survive.
      </p>
      <ReplicationPlayground />

      <h2>Replication is asynchronous</h2>
      <p>
        The primary replies <code>OK</code> to the client as soon as <em>it</em> has executed the write; sending it to replicas happens afterwards.
        A primary that dies right after replying takes the newest writes with it — if a replica is promoted, those writes never existed.{' '}
        <code>WAIT numreplicas timeout</code> lets one client wait until replicas have confirmed its writes. The recording froze the replica process
        and wrote:
      </p>
      <Flow
        title="OK comes from the primary alone; replication follows"
        cols={4}
        rows={1}
        nodes={[
          { id: 'client', label: 'client', sub: 'SET order:9003 → OK', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'primary', label: 'primary', sub: 'executes, replies', col: 1, row: 0, hue: 2 },
          { id: 'stream', label: 'write stream', sub: 'sent afterwards', col: 2, row: 0, hue: 3, shape: 'queue' },
          { id: 'replica', label: 'replica', sub: 'frozen: no ack', col: 3, row: 0, hue: 8 },
        ]}
        edges={[
          { from: 'client', to: 'primary', hue: 1, both: true, flow: true },
          { from: 'primary', to: 'stream', hue: 2, flow: true },
          { from: 'stream', to: 'replica', hue: 8, dashed: true },
        ]}
      />
      <CliSession title="WAIT with a frozen replica (recorded)" steps={R.waitStopped} />
      <Predict
        question={<p><code>WAIT 1 500</code> returned 0. What happened to <code>order:9003</code>?</p>}
        options={['It was rolled back, because no replica confirmed it', 'It is on the primary only; WAIT just reports that no replica has it yet', 'Redis will retry the WAIT until a replica confirms']}
        answer={1}
        explanation="WAIT never undoes anything. It tells the client how many replicas acknowledged — the write itself already happened on the primary. Lose the primary now and promote a replica, and the write is gone."
      />
      <p>
        So WAIT reduces the window but does not make Redis strongly consistent. The server-side variant is <code>min-replicas-to-write N</code> with{' '}
        <code>min-replicas-max-lag S</code>: the primary refuses writes while fewer than N replicas have confirmed within S seconds. That limits how
        much an isolated primary can accept — and loses availability when replicas are down.
      </p>

      <h2>Sentinel: automatic failover</h2>
      <p>
        Sentinel is a separate process (run several) that watches a primary and its replicas, decides together when the primary is down, promotes a
        replica, repoints the others, and tells clients the new address. The recording ran one primary, one replica and three sentinels with:
      </p>
      <CodeBlock
        title="sentinel.conf (each of the three)"
        language="text"
        code={`# name, address of the primary, quorum
sentinel monitor shop 127.0.0.1 6379 2
# no reply for 1 s = down (in this sentinel's view)
sentinel down-after-milliseconds shop 1000
sentinel failover-timeout shop 5000
sentinel parallel-syncs shop 1`}
      />
      <Flow
        title="Three sentinels watch one primary and its replica"
        caption="Schematic: only a few links are drawn. Every sentinel pings both servers once a second, and the sentinels find each other through the __sentinel__:hello channel on the monitored servers."
        cols={3}
        rows={3}
        nodes={[
          { id: 'app', label: 'clients', sub: 'need the primary address', col: 1, row: 0, hue: 1, shape: 'actor' },
          { id: 's1', label: 'sentinel 1', col: 0, row: 1, hue: 7 },
          { id: 's2', label: 'sentinel 2', col: 1, row: 1, hue: 7 },
          { id: 's3', label: 'sentinel 3', col: 2, row: 1, hue: 7 },
          { id: 'primary', label: 'primary', sub: '6379', col: 0, row: 2, hue: 2 },
          { id: 'replica', label: 'replica', sub: '6380', col: 2, row: 2, hue: 5 },
        ]}
        edges={[
          { from: 'app', to: 's2', label: 'who is primary?', hue: 1 },
          { from: 's1', to: 'primary', label: 'PING', hue: 7, dashed: true },
          { from: 's2', to: 'primary', hue: 7, dashed: true },
          { from: 's3', to: 'replica', hue: 7, dashed: true },
          { from: 'primary', to: 'replica', label: 'replication', hue: 2, flow: true },
        ]}
      />
      <p>Then the primary was killed with <code>kill -9</code>. One sentinel’s log:</p>
      <Table head={['event', 'meaning']} rows={sentinelRows} />
      <p>
        <code>SENTINEL GET-MASTER-ADDR-BY-NAME shop</code> answered <code>{R.sentinelBefore}</code> before and <code>{R.sentinelAfter}</code>{' '}
        {(R.failoverMs / 1000).toFixed(1)} s after the kill. That total covers noticing (<code>down-after-milliseconds</code>, 1 s here), agreeing
        on the failure, a random delay of up to a second before a failover starts, electing a leader and promoting the replica — the recording
        measured only the total. In production{' '}
        <code>down-after-milliseconds</code> is usually several seconds to avoid failovers on short hiccups, so expect a failover to take that
        long plus a little.
      </p>
      <Timeline
        title="The failover and the old primary’s return, recorded"
        lanes={[{ id: 'p', label: '6379 (old primary)' }, { id: 'r', label: '6380 (replica)' }, { id: 's', label: 'sentinels' }]}
        segments={[
          { lane: 'p', from: -1500, to: 0, label: 'primary', hue: 2 },
          { lane: 'p', from: 0, to: RETURN_AT, label: 'killed', hue: 8, striped: true },
          { lane: 'p', from: RETURN_AT, to: RETURN_AT + R.convertedAfterMs, label: `back, still says role:${R.oldPrimaryRoleOnReturn}`, hue: 8, striped: true },
          { lane: 'p', from: RETURN_AT + R.convertedAfterMs, to: RETURN_AT + R.convertedAfterMs + 1500, label: 'replica', hue: 5 },
          { lane: 'r', from: -1500, to: R.failoverMs, label: 'replica', hue: 5 },
          { lane: 'r', from: R.failoverMs, to: RETURN_AT + R.convertedAfterMs + 1500, label: 'primary', hue: 2 },
          { lane: 's', from: 1000, to: R.failoverMs, label: 'vote', hue: 7 },
        ]}
        events={[
          { lane: 'p', at: 0, label: 'kill -9', hue: 8 },
          { lane: 's', at: 1000, label: '+sdown', hue: 7 },
          { lane: 'r', at: R.failoverMs, label: `+switch-master ${(R.failoverMs / 1000).toFixed(1)} s`, hue: 2 },
          { lane: 's', at: RETURN_AT + R.convertedAfterMs, label: 'reconfigured', hue: 5 },
        ]}
        start={-1500}
        end={RETURN_AT + R.convertedAfterMs + 1500}
        playable
      />
      <p className={own.note}>
        +sdown is drawn at down-after-milliseconds (1 s); the old primary was restarted by the experiment 1.5 s after the switch. Other times are
        recorded.
      </p>
      <StatTiles
        stats={[
          { label: 'kill → new primary announced', value: `${(R.failoverMs / 1000).toFixed(1)} s`, sub: 'down-after-milliseconds 1000', hue: 2 },
          { label: 'old primary still a primary after restart', value: `${(R.convertedAfterMs / 1000).toFixed(1)} s`, sub: 'until Sentinel demoted it', hue: 8 },
          { label: 'partial resync sent', value: `${PARTIAL_BYTES} B`, sub: 'from the backlog', hue: 6 },
          { label: 'full sync snapshot', value: `${(SNAPSHOT_BYTES / 1024 / 1024).toFixed(1)} MB`, sub: '100,000 keys, over the network', hue: 4 },
        ]}
      />
      <Callout tone="warn" title="The old primary comes back as a primary">
        When the killed server was started again it reported <code>role:{R.oldPrimaryRoleOnReturn}</code> — it still believed it was the
        primary — and Sentinel turned it into a replica of the new one only {(R.convertedAfterMs / 1000).toFixed(1)} s later. A client that still
        had the old address could write to it in that window, and those writes are thrown away when it becomes a replica. Clients must get the
        primary’s address from Sentinel, and reconnect through Sentinel after any error.
      </Callout>
      <CodeBlock title="the returned server, after Sentinel reconfigured it (recorded)" language="text" code={R.oldPrimaryRole} />

      <h2>What clients must do</h2>
      <p>Failover only helps if the application finds the new primary; that is the client library’s job, configured by you.</p>
      <Table
        head={['Situation', 'What a correct client does']}
        rows={[
          ['startup', 'asks any sentinel for the primary of “shop”, connects there'],
          ['failover', 'gets connection errors or READONLY, asks Sentinel again, reconnects'],
          ['reads from replicas', 'accepts that they can be behind the primary (async), and may not see the client’s own last write'],
          ['writes that must survive', 'uses WAIT and handles a result below the target — or keeps that data in a durable database'],
        ]}
      />

      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Run at least three sentinels on separate machines (an odd number); a quorum of 2 needs two of them to agree.</li>
          <li>Size <code>repl-backlog-size</code> from your write rate × the longest disconnect you want to survive, not the 1 MB default.</li>
          <li>Treat replicas as stale: read from them only data that may lag (catalogues, dashboards), never “read your own write” flows.</li>
          <li>Asynchronous replication can lose acknowledged writes on failover; use WAIT or <code>min-replicas-to-write</code> to narrow the window, a durable store when it must be zero.</li>
          <li>Persistence on the primary matters: a primary that restarts empty and fast can wipe its replicas when they resync from it.</li>
          <li>Use a client library with Sentinel support, and test a failover before production does it for you.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'A replica starts with a full copy (a forked snapshot streamed over the network), then applies the primary’s write stream.',
          'After a short disconnect it continues from the backlog; if the backlog no longer holds its offset, it needs a full resync.',
          'Replication is asynchronous: OK comes before the replicas have the write; WAIT reports, it never rolls back.',
          'Sentinel detects (sdown → odown), elects a leader and promotes a replica; clients must ask Sentinel for the primary.',
        ]}
      />
    </>
  )
}
