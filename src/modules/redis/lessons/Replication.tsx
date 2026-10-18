import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession, LogLines, ReplicationPlayground } from '../components'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const R = CAPTURE.replication
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
      <LogLines title="primary log (recorded)" lines={R.fullSyncMaster} highlight={/Full resync|BGSAVE done|succeeded/} />
      <LogLines title="replica log (recorded)" lines={R.fullSyncReplica} highlight={/not possible|Finished with success/} />
      <p>
        The primary forks and streams a snapshot straight to the replica’s socket (diskless sync: no file on the primary). The replica, by default (<code>repl-diskless-load disabled</code>), still writes what it receives to disk and loads it from there — its log says <code>receiving streamed RDB … to disk</code>. Redis 8 sends the snapshot over a
        separate <em>rdb channel</em>: the snapshot travels on a second connection while the replica already buffers the live stream on the main
        one, so the primary does not have to hold every write of a long transfer in memory. Then the replica loads the snapshot and applies the
        buffered writes. Note the line <code>Delay next BGSAVE for diskless SYNC</code>: with diskless sync the primary waits{' '}
        <code>repl-diskless-sync-delay</code> seconds so that several replicas can share one snapshot.
      </p>
      <div className={own.grid2}>
        <CodeBlock title="INFO replication on the primary" language="text" code={R.infoMaster} />
        <CodeBlock title="INFO replication on the replica" language="text" code={R.infoReplica} />
      </div>
      <p>
        Redis still says <code>master</code> and <code>slave</code> in INFO. Both sides share one <code>master_replid</code>; the offsets show how
        far each has got, and <code>lag</code> is the seconds since the replica last confirmed its offset (replicas acknowledge every second).
      </p>
      <CliSession title="replicas are read-only (recorded)" steps={R.readOnly} />

      <h2>A short disconnect: continue from the backlog</h2>
      <p>The recording cut the replica’s connection and wrote 100 keys right away; the replica reconnected while the writes were still going:</p>
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
      <Callout tone="warn" title="The old primary comes back as a primary">
        When the killed server was started again it reported <code>role:{R.oldPrimaryRoleOnReturn}</code> — it still believed it was the
        primary — and Sentinel turned it into a replica of the new one only {(R.convertedAfterMs / 1000).toFixed(1)} s later. A client that still
        had the old address could write to it in that window, and those writes are thrown away when it becomes a replica. Clients must get the
        primary’s address from Sentinel, and reconnect through Sentinel after any error.
      </Callout>
      <CodeBlock title="the returned server, after Sentinel reconfigured it (recorded)" language="text" code={R.oldPrimaryRole} />

      <h2>What clients must do</h2>
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
