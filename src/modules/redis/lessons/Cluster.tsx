import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Flow, Proportion, StatTiles, Timeline, type FlowEdge, type FlowNode, type Hue } from '@/shared/figures'
import { CliSession, LogLines, SlotCalculator } from '../components'
import { CAPTURE } from '../data/captures'

const C = CAPTURE.cluster

/** The recorded cluster: primaries with their slot ranges, and which replica follows which primary. */
const PRIMARIES = C.nodes.filter((n) => n.flags.includes('master'))
const port = (addr: string) => addr.split(':')[1]
const rangeOf = (slots: string) => {
  const [a, b] = slots.split(' ')[0].split('-').map(Number)
  return { from: a, to: b ?? a }
}
const ownerOf = (slot: number) => PRIMARIES.find((p) => { const r = rangeOf(p.slots); return slot >= r.from && slot <= r.to })

const TOPOLOGY_NODES: FlowNode[] = [
  { id: 'client', label: 'client', sub: 'caches the slot map', col: 1, row: 0, hue: 1, shape: 'actor' },
  ...PRIMARIES.map((p, i) => ({ id: p.id, label: `primary ${port(p.addr)}`, sub: `slots ${p.slots}`, col: i, row: 1, hue: 2 as Hue })),
  ...C.nodes.filter((n) => n.flags.includes('slave')).map((r) => ({ id: r.id, label: `replica ${port(r.addr)}`, sub: `of ${port(PRIMARIES.find((p) => p.id === r.master)?.addr ?? '')}`, col: PRIMARIES.findIndex((p) => p.id === r.master), row: 2, hue: 5 as Hue, shape: 'store' as const })),
]
const TOPOLOGY_EDGES: FlowEdge[] = [
  ...PRIMARIES.map((p) => ({ from: 'client', to: p.id, hue: 1 as Hue, flow: true })),
  ...C.nodes.filter((n) => n.flags.includes('slave')).map((r) => ({ from: r.master, to: r.id, hue: 2 as Hue, dashed: true })),
]

const MOVED = (C.moved.find((s) => s.out.includes('MOVED'))?.out ?? '').match(/MOVED (\d+) (\S+)/)
const VICTIM_ID = C.nodes.find((n) => n.addr === C.failover.victim)?.id
const VICTIM_REPLICA = C.nodes.find((n) => n.master === VICTIM_ID)
/** From the recorded migration: a key the source still served, and the key it had already moved. */
const ASK_KEPT = C.ask.steps.find((s) => s.who === 'source' && s.cmd.startsWith('GET ') && !s.out.startsWith('(error)'))
const ASK_KEPT_KEY = ASK_KEPT?.cmd.slice(4) ?? ''
const ASK_MOVED_KEY = C.ask.steps.find((s) => s.cmd.startsWith('MIGRATE '))?.cmd.split(' KEYS ')[1] ?? ''
const TAGGED = C.slots.find((s) => s.key === '{user:1}:profile')

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
      <Flow title="The recorded cluster: three primaries, one replica each" cols={3} rows={3} rowHeight={100} nodes={TOPOLOGY_NODES} edges={TOPOLOGY_EDGES} />
      <Proportion
        title="16384 hash slots, split between the primaries (recorded)"
        parts={PRIMARIES.map((p, i) => {
          const r = rangeOf(p.slots)
          return { label: `${port(p.addr)}: ${r.from}–${r.to}`, value: r.to - r.from + 1, hue: ([2, 3, 7] as Hue[])[i % 3], display: `${(r.to - r.from + 1).toLocaleString()} slots` }
        })}
      />
      <div>
        <CodeBlock title="CLUSTER INFO" language="text" code={C.info} />
        <Table head={['node', 'address', 'flags', 'replica of', 'slots']} rows={C.nodes.map((n) => [n.id, n.addr, n.flags, n.master, n.slots || '—'])} />
      </div>

      <h2>Key → slot → node</h2>
      {TAGGED && (
        <Flow
          title={`From a key to the node that owns it: ${TAGGED.key}`}
          cols={5}
          rows={1}
          nodes={[
            { id: 'key', label: TAGGED.key, sub: 'the key', col: 0, row: 0, hue: 1 },
            { id: 'tag', label: TAGGED.key.match(/\{([^}]+)\}/)?.[1] ?? TAGGED.key, sub: 'hash tag: only this', col: 1, row: 0, hue: 3 },
            { id: 'crc', label: 'CRC16', sub: 'in the client', col: 2, row: 0, hue: 1 },
            { id: 'slot', label: `slot ${TAGGED.slot}`, sub: 'mod 16384', col: 3, row: 0, hue: 3 },
            { id: 'node', label: `node ${port(ownerOf(TAGGED.slot)?.addr ?? '')}`, sub: `owns ${ownerOf(TAGGED.slot)?.slots ?? ''}`, col: 4, row: 0, hue: 2 },
          ]}
          edges={[
            { from: 'key', to: 'tag', hue: 3, flow: true },
            { from: 'tag', to: 'crc', hue: 1, flow: true },
            { from: 'crc', to: 'slot', hue: 3, flow: true },
            { from: 'slot', to: 'node', hue: 2, flow: true },
          ]}
        />
      )}
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
      {MOVED && (
        <Flow
          title="MOVED: the node redirects, the client goes there and remembers"
          cols={3}
          rows={2}
          nodes={[
            { id: 'client', label: 'client', sub: 'old or no slot map', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
            { id: 'wrong', label: 'node 7001', sub: 'not the owner', col: 2, row: 0, hue: 8 },
            { id: 'right', label: `node ${port(MOVED[2])}`, sub: `owns slot ${MOVED[1]}`, col: 2, row: 1, hue: 2 },
          ]}
          edges={[
            { from: 'client', to: 'wrong', label: `MOVED ${MOVED[1]} …${port(MOVED[2])}`, hue: 8, both: true },
            { from: 'client', to: 'right', label: 'retry, update map', hue: 2, flow: true },
          ]}
          steps={[
            { title: 'Asked the wrong node', body: <p>The node does not own slot {MOVED[1]}; it does not proxy, it answers <code>MOVED {MOVED[1]} {MOVED[2]}</code>.</p>, active: ['client', 'wrong', 'client>wrong'] },
            { title: 'Retry at the owner', body: <p>The client sends the command to {MOVED[2]} and updates its slot map, so the next command for that slot goes straight there.</p>, active: ['client', 'right', 'client>right'] },
          ]}
        />
      )}
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
      <Flow
        title={`Slot ${C.ask.slot} half-way between two nodes: ASK`}
        cols={4}
        rows={2}
        nodes={[
          { id: 'client', label: 'client', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'src', label: `source ${port(C.ask.src)}`, sub: 'MIGRATING', col: 2, row: 0, hue: 2 },
          { id: 'dst', label: `target ${port(C.ask.dst)}`, sub: 'IMPORTING', col: 2, row: 1, hue: 2 },
          { id: 'old', label: ASK_KEPT_KEY, sub: 'not moved yet', col: 3, row: 0, hue: 3, shape: 'store' },
          { id: 'new', label: ASK_MOVED_KEY, sub: 'already moved', col: 3, row: 1, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'client', to: 'src', label: 'GET', hue: 1, flow: true },
          { from: 'src', to: 'old', hue: 2 },
          { from: 'src', to: 'dst', label: 'MIGRATE key by key', hue: 2, dashed: true },
          { from: 'client', to: 'dst', label: 'ASKING + GET', hue: 1, flow: true },
          { from: 'dst', to: 'new', hue: 2 },
        ]}
        steps={[
          { title: 'A key still on the source', body: <p>The source answers normally: <code>{ASK_KEPT?.cmd}</code> → <code>{ASK_KEPT?.out}</code>.</p>, active: ['client', 'src', 'old', 'client>src', 'src>old'] },
          { title: 'A key that has already moved', body: <p>The source no longer has it and answers <code>ASK {C.ask.slot} {C.ask.dst}</code>: “try the target, for this command only”.</p>, active: ['client', 'src', 'src>dst', 'client>src'] },
          { title: 'ASKING, then the command', body: <p>The client sends <code>ASKING</code> and repeats the command at the target, which serves it although the slot is not officially its own yet. Without ASKING the target would answer MOVED back to the source.</p>, active: ['client', 'dst', 'new', 'client>dst', 'dst>new'] },
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
      {suspected && failed && back && (
        <>
          <Timeline
            title={`Primary ${C.failover.victim} killed at 0 ms (node timeout ${C.failover.nodeTimeoutMs} ms): states as the probe sampled them`}
            lanes={[{ id: 'v', label: `primary ${port(C.failover.victim)}` }, { id: 'c', label: 'cluster_state' }, { id: 'r', label: `replica ${port(VICTIM_REPLICA?.addr ?? '')}` }]}
            segments={[
              { lane: 'v', from: 0, to: back.ms + 500, label: 'killed', hue: 8, striped: true },
              { lane: 'c', from: 0, to: down?.ms ?? failed.ms, label: 'ok', hue: 6 },
              { lane: 'c', from: down?.ms ?? failed.ms, to: back.ms, label: 'fail', hue: 8, striped: true },
              { lane: 'c', from: back.ms, to: back.ms + 500, label: 'ok', hue: 6 },
              { lane: 'r', from: 0, to: back.ms, label: 'replica', hue: 5 },
              { lane: 'r', from: back.ms, to: back.ms + 500, label: 'primary', hue: 2 },
            ]}
            events={[
              { lane: 'v', at: suspected.ms, label: 'fail? (PFAIL)', hue: 4 },
              { lane: 'r', at: back.ms, label: 'won the election', hue: 2 },
            ]}
            end={back.ms + 500}
            playable
          />
          <StatTiles
            stats={[
              { label: 'suspected (fail?)', value: `${suspected.ms} ms`, sub: `node timeout ${C.failover.nodeTimeoutMs} ms`, hue: 4 },
              { label: 'failed by majority', value: `${failed.ms} ms`, sub: 'CLUSTERDOWN for every key', hue: 8 },
              { label: 'serving again', value: `${back.ms} ms`, sub: 'replica promoted', hue: 6 },
            ]}
          />
        </>
      )}
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
      <p>A cluster looks like one Redis to your data, but not to your code: a few commands and habits work differently.</p>
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
