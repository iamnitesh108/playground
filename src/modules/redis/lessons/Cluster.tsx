import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession, LogLines, SlotCalculator } from '../components'
import { CAPTURE } from '../data/captures'

const C = CAPTURE.cluster

const SLOT_NOTE: Record<string, string> = {
  '': 'the empty key',
  '{user:1}:profile': 'tag {user:1}: hashes only “user:1”, same slot as user:1',
  '{user:1}:cart': 'same tag, same slot',
  '{user:1}.following': 'same tag, same slot',
  'user:{1}:x': 'tag {1}: only “1” is hashed',
  'foo{}{bar}': 'the first {…} is empty, so the whole key is hashed',
  'foo{{bar}}zap': 'tag is “{bar” — from the first { to the first } after it',
  'foo{bar}{zap}': 'only the first tag counts: same slot as “bar”',
  '{}': 'empty tag: the whole key is hashed',
  '{a': 'no closing }: the whole key is hashed',
  '{}{user:1}': 'first {…} is empty: the whole key is hashed, the second tag is ignored',
  Hello: 'keys are case-sensitive bytes: a different slot from “hello”',
}

const reply = (r: string) => (r === 'CLUSTERDOWN The' ? 'CLUSTERDOWN The cluster is down' : r.startsWith('MOVED') ? `${r} … (still routed)` : r)

export default function Cluster() {
  const t = C.failover.timeline
  const suspected = t.find((x) => x.victimFlags.includes('fail?'))
  const failed = t.find((x) => /fail(,|$)/.test(x.victimFlags) && !x.victimFlags.includes('fail?'))
  const down = t.find((x) => x.reply.startsWith('CLUSTERDOWN'))
  const back = [...t].reverse().find((x) => x.state === 'ok' && !x.reply.startsWith('CLUSTERDOWN'))
  const election = C.failoverReplicaLog.filter((l) => /election|Failover|after successful failover/i.test(l))
  return (
    <>
      <LessonGoals
        goals={[
          'compute which of 16384 slots a key lives in, and which node owns it',
          'read MOVED, ASK and CROSSSLOT errors, and use hash tags to keep related keys together',
          'follow a slot migration and a primary failure in a real six-node cluster',
          'know what a cluster asks of your client and your key design',
        ]}
        before="Lesson 11 — replication and failover"
      />

      <h2>Sharding by hash slot</h2>
      <p>
        One Redis server holds what fits in one machine’s memory and serves what one thread can execute. Redis Cluster spreads the keyspace over
        several primaries, each with its own replicas. The unit of distribution is the <strong>hash slot</strong>: there are 16384 of them, every
        key belongs to exactly one, and every slot belongs to exactly one primary.
      </p>
      <TermList
        items={[
          { term: 'hash slot', definition: 'CRC16(key) mod 16384. The client computes it; the cluster maps slots to nodes.' },
          { term: 'hash tag', definition: 'A part of the key in {braces}. If present and not empty, only that part is hashed — so keys with the same tag share a slot.' },
          { term: 'MOVED', definition: 'Reply from a node that does not own the slot: “ask that node instead, from now on”.' },
          { term: 'ASK', definition: 'Reply during a slot migration: “ask that node, for this one command only”.' },
          { term: 'cluster bus', definition: 'A second port (client port + 10000) on which nodes ping each other and gossip about the cluster state.' },
        ]}
      />

      <h2>Building one</h2>
      <p>
        The recording started six empty nodes with <code>cluster-enabled yes</code> and <code>cluster-node-timeout 2000</code>, then ran{' '}
        <code>redis-cli --cluster create … --cluster-replicas 1</code>: three primaries, one replica each.
      </p>
      <CodeBlock title="redis-cli --cluster create (recorded, node ids shortened)" language="text" code={C.create} />
      <p>
        The slots were split into three equal ranges and each primary got one replica. All six nodes run on one host here, hence the warning
        that replicas share a host with their primary; in production put each replica on a different machine from its primary.
      </p>
      <div>
        <CodeBlock title="CLUSTER INFO" language="text" code={C.info} />
        <Table head={['node', 'address', 'flags', 'replica of', 'slots']} rows={C.nodes.map((n) => [n.id, n.addr, n.flags, n.master, n.slots || '—'])} />
      </div>

      <h2>Key → slot → node</h2>
      <SlotCalculator />
      <p>
        The calculator runs the same CRC16 (XMODEM) as Redis; it was checked against <code>CLUSTER KEYSLOT</code> on the real cluster for the keys
        below and 300 random ones.
      </p>
      <Table
        head={['key', 'slot', 'why']}
        rows={C.slots.map((s) => [<code key="k">{s.key === '' ? '""' : s.key}</code>, s.slot, SLOT_NOTE[s.key] ?? ''])}
      />

      <h2>Asking the wrong node: MOVED</h2>
      <p>A plain connection to node 7001, asking for a key whose slot lives elsewhere:</p>
      <CliSession title="connected to 127.0.0.1:7001 without cluster mode (recorded)" steps={C.moved} prompt="127.0.0.1:7001>" />
      <p>
        The node does not proxy the request; it tells the client where the slot lives. <code>redis-cli -c</code> (cluster mode) follows the
        redirect:
      </p>
      <CodeBlock title={C.followedCmd} language="text" code={C.followed} />
      <p>
        A real client does better: at startup it loads the whole slot map (<code>CLUSTER SHARDS</code>), sends each command straight to the right
        node, and refreshes the map when it gets a MOVED. A cluster-unaware client library does not work with a cluster.
      </p>

      <h2>Multi-key commands and hash tags</h2>
      <p>
        A command that touches several keys must have them all in one slot — the cluster never coordinates across nodes. Transactions and scripts
        follow the same rule.
      </p>
      <CliSession title="CROSSSLOT, and the same keys with a hash tag (recorded)" steps={C.multiKey} />
      <Predict
        question={<p>Which pair can be written with one <code>MSET</code> in a cluster?</p>}
        options={['user:1:profile and user:1:cart', '{user:1}:profile and {user:1}:cart', 'user:{1}:profile and {user}:1:cart']}
        answer={1}
        explanation="Both keys hash only “user:1”, so they share slot 10778. Without tags the full keys hash to different slots; the third pair hashes “1” and “user”, two different strings."
      />
      <Callout tone="warn" title="Tags group keys — and load">
        Everything with the same tag lives on one node. Tag per user, per order, per tenant: small groups that spread over all slots. Never one tag
        for a whole feature (<code>{'{cart}'}:…</code>): that puts all of it on one node and recreates the single-server limit.
      </Callout>

      <h2>Moving a slot: ASK</h2>
      <p>
        Resharding moves slots between primaries while clients keep working, one key at a time. The recording moved slot {C.ask.slot} (holding{' '}
        <code>cart:7</code>) from {C.ask.src} (source) to {C.ask.dst} (target) by hand, and asked for keys half-way through:
      </p>
      <CliSession title="a slot half-way through migration (recorded)" steps={C.ask.steps} prompts={{ source: 'source>', target: 'target>' }} />
      <Table
        head={['State', 'Who answers a key of that slot']}
        rows={[
          ['source MIGRATING, key still there', 'the source, normally (cart:7 → "apple")'],
          ['source MIGRATING, key already moved', 'the source replies ASK <slot> <target>'],
          ['target IMPORTING, client sent ASKING first', 'the target serves it, for that one command'],
          ['target IMPORTING, no ASKING', 'the target replies MOVED back to the source: the slot is not officially its own yet'],
          ['after CLUSTER SETSLOT … NODE <target>', 'the target; the source now replies MOVED'],
        ]}
      />
      <p>
        <code>redis-cli --cluster reshard</code> and <code>rebalance</code> run these same steps for you. Large keys move as one piece and block both
        nodes while they do — another reason to avoid huge keys.
      </p>
      <Callout tone="note" title="Redis 8.4+: atomic slot migration">
        Since Redis 8.4 a cluster can also move whole slot ranges with <code>CLUSTER MIGRATION IMPORT</code> (<code>COMMAND DOCS</code> on the
        recorded 8.8 server lists it “since 8.4.0”): the target copies the slots in the background and takes them over in one step, so clients do not
        see keys half-way between two nodes. The key-by-key MIGRATE / ASK path shown above is what <code>redis-cli --cluster reshard</code> still
        uses, and what every cluster client must handle.
      </Callout>

      <h2>When a primary dies</h2>
      <p>
        The recording killed primary {C.failover.victim} (node timeout {C.failover.nodeTimeoutMs} ms) and asked another node about it, and about{' '}
        <code>{C.failover.probeKey}</code> (a key in its slots), every 50 ms:
      </p>
      <Table
        head={['ms after the kill', 'cluster_state', 'flags of the dead node', `GET ${C.failover.probeKey} on another node`]}
        rows={t.map((x) => [x.ms, x.state, x.victimFlags, reply(x.reply)])}
      />
      <p>
        At {suspected?.ms} ms the dead node is flagged <code>fail?</code> (PFAIL: this node has not heard from it for the node timeout). Nodes
        gossip these suspicions; when a majority of primaries agree, it becomes <code>fail</code> ({failed?.ms} ms) and{' '}
        {down ? <>clients get <code>CLUSTERDOWN</code> ({down.ms} ms)</> : 'the cluster stops'}: by default (<code>cluster-require-full-coverage yes</code>)
        the cluster refuses <em>all</em> keys while any slot has no primary. Its replica then started an election:
      </p>
      <LogLines title="the replica’s log (recorded)" lines={election} highlight={/won/} />
      <p>
        The delay is deliberate: 500 ms plus a random part plus 1000 ms per rank (the replica with the most data goes first), so replicas do not
        compete. It needs votes from a majority of primaries, takes a new config epoch, and claims the slots. The cluster was serving again at{' '}
        {back?.ms} ms:
      </p>
      <Table head={['address', 'flags', 'slots']} rows={C.afterFailover.map((n) => [n.addr, n.flags, n.slots || '—'])} />
      <p>
        The promoted replica owns the dead primary’s slots (except slot {C.ask.slot}, moved earlier). Writes acknowledged by the old primary but not
        yet replicated are lost, exactly as with Sentinel (lesson 11).
      </p>
      <Callout tone="note" title="Found while recording: a replica must finish its first sync">
        In an earlier run of the recording script (not kept in the data) the primary was killed a few seconds after the cluster was created. Its
        replica refused to take over (“Disconnected from master for longer than allowed”): it had never completed its first copy, because with
        diskless sync the primary waits <code>repl-diskless-sync-delay</code> ({C.disklessSyncDelay} s) before starting it. With the default{' '}
        <code>cluster-replica-validity-factor</code> (10) a replica whose data is that old is not promoted automatically; setting the factor to 0, or
        an operator running <code>CLUSTER FAILOVER FORCE</code> / <code>TAKEOVER</code>, promotes it anyway — with whatever data it has. Check{' '}
        <code>master_link_status:up</code> on every replica before you rely on it.
      </Callout>

      <h2>What a cluster changes for your code</h2>
      <Table
        head={['Topic', 'Rule']}
        rows={[
          ['client', 'a cluster-aware library that caches the slot map and follows MOVED / ASK'],
          ['databases', 'only database 0; SELECT is not available'],
          ['multi-key commands, MULTI, scripts', 'all keys in one slot — use hash tags'],
          ['KEYS, SCAN, DBSIZE, FLUSHALL', 'per node: to scan everything, scan every primary'],
          ['Pub/Sub', 'classic PUBLISH reaches every node; sharded SPUBLISH / SSUBSCRIBE stays in the channel’s slot'],
          ['availability', 'a slot without a primary stops the whole cluster (full coverage) unless configured otherwise'],
        ]}
      />

      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Use a cluster when one primary cannot hold the data or the write load — not by default; it adds client and key-design constraints.</li>
          <li>Design keys so that everything one operation touches shares a tag (<code>{'{order:42}'}:items</code>, <code>{'{order:42}'}:status</code>), with many small tags.</li>
          <li>Watch for hot slots: one very busy key or tag is served by one node however many you add.</li>
          <li>Give every primary at least one replica on another machine, and verify each replica is in sync.</li>
          <li>Keep keys small: big keys make migrations and failovers slow.</li>
          <li>Plan the node timeout: failover takes roughly the timeout plus an election, and the cluster refuses requests in between.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'slot = CRC16(key or its hash tag) mod 16384; each slot belongs to one primary.',
          'MOVED means “that node owns this slot”; ASK means “this one key already moved, try the target with ASKING”.',
          'Multi-key commands, transactions and scripts need all keys in one slot — hash tags make that possible.',
          'A dead primary is suspected after the node timeout, failed by majority, and replaced by an elected replica; meanwhile the cluster is down.',
        ]}
      />
    </>
  )
}
