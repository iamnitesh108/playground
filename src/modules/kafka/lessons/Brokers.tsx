import { Callout, CodeBlock, TermList } from '@/shared/ui'
import { Flow } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import own from './Brokers.module.css'

/** Which broker leads / follows each partition of a 3-partition, RF=3 topic. */
const PLACEMENT = [
  { broker: 1, leads: [0], follows: [1, 2] },
  { broker: 2, leads: [1], follows: [0, 2] },
  { broker: 3, leads: [2], follows: [0, 1] },
]

function ClusterLayout() {
  return (
    <div className={own.cluster}>
      {PLACEMENT.map(({ broker, leads, follows }) => (
        <div key={broker} className={own.broker}>
          <div className={own.brokerName}>Broker {broker}</div>
          <div className={own.chips}>
            {leads.map((p) => (
              <span key={p} className={cx(own.chip, own.leader)}>
                orders-P{p} · leader
              </span>
            ))}
            {follows.map((p) => (
              <span key={p} className={own.chip}>
                orders-P{p} · follower
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className={own.controller}>
        Controller quorum (KRaft) — stores cluster metadata, elects partition leaders
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: 'Connect to any broker',
    body: (
      <p>
        The client is configured with <code>bootstrap.servers</code> — one or more broker addresses. It only needs
        one of them to answer.
      </p>
    ),
  },
  {
    title: 'Ask for metadata',
    body: (
      <p>
        It sends a <strong>metadata request</strong>: “which brokers exist, and who leads each partition of the topics
        I care about?”
      </p>
    ),
  },
  {
    title: 'Receive the map',
    body: (
      <p>
        Any broker can answer, because every broker caches the cluster metadata published by the controller. Reply:
        P0 → broker 1, P1 → broker 2, P2 → broker 3.
      </p>
    ),
  },
  {
    title: 'Talk to leaders directly',
    body: (
      <p>
        From now on the client sends each request straight to the <strong>leader</strong> of the partition involved.
        Writes for P1 go to broker 2, reads of P2 come from broker 3. No central router, so no bottleneck.
      </p>
    ),
  },
  {
    title: 'Leader moves? Refresh.',
    body: (
      <p>
        If a broker dies, the controller elects a new leader and the client gets a <code>NOT_LEADER_OR_FOLLOWER</code> error. It
        refreshes its metadata and retries against the new leader automatically.
      </p>
    ),
  },
]

function BootstrapFlow() {
  return (
    <Flow
      title="How a client finds the right broker"
      cols={5}
      rows={3}
      rowHeight={72}
      nodes={[
        { id: 'client', label: 'client', sub: 'your app', col: 0, row: 1, hue: 7, shape: 'actor' },
        { id: 'b1', label: 'broker 1', sub: 'leader of P0', col: 2, row: 0, hue: 3 },
        { id: 'b2', label: 'broker 2', sub: 'leader of P1', col: 2, row: 1, hue: 3 },
        { id: 'b3', label: 'broker 3', sub: 'leader of P2', col: 2, row: 2, hue: 3 },
        { id: 'ctrl', label: 'controller', sub: 'publishes metadata', col: 4, row: 1, hue: 5 },
      ]}
      edges={[
        { from: 'client', to: 'b1', label: 'bootstrap · P0', both: true, hue: 7 },
        { from: 'client', to: 'b2', label: 'P1', flow: true, hue: 7 },
        { from: 'client', to: 'b3', label: 'P2', flow: true, hue: 7 },
        { from: 'ctrl', to: 'b1', dashed: true, hue: 5 },
        { from: 'ctrl', to: 'b2', dashed: true, hue: 5 },
        { from: 'ctrl', to: 'b3', dashed: true, hue: 5 },
      ]}
      steps={STEPS.map((step, i) => ({
        ...step,
        active: [
          ['client', 'b1', 'client>b1'],
          ['client', 'b1', 'client>b1'],
          ['b1', 'client', 'client>b1', 'ctrl', 'ctrl>b1', 'ctrl>b2', 'ctrl>b3'],
          ['client', 'b1', 'b2', 'b3', 'client>b1', 'client>b2', 'client>b3'],
          ['client', 'b3', 'client>b3', 'ctrl', 'ctrl>b3'],
        ][i],
      }))}
      caption="Step 5: broker 2 is down (dimmed); the controller made broker 3 the new leader of P1, so the client’s retry for P1 goes to broker 3."
    />
  )
}

function Topology() {
  return (
    <Flow
      title="A KRaft cluster: a controller quorum above, brokers below, clients talking to brokers"
      cols={3}
      rows={3}
      rowHeight={76}
      nodes={[
        { id: 'c1', label: 'controller 1', sub: 'active (quorum leader)', col: 0, row: 0, hue: 5 },
        { id: 'c2', label: 'controller 2', sub: 'metadata log replica', col: 1, row: 0, hue: 5 },
        { id: 'c3', label: 'controller 3', sub: 'metadata log replica', col: 2, row: 0, hue: 5 },
        { id: 'b1', label: 'broker 1', sub: 'partitions on disk', col: 0, row: 1, hue: 3 },
        { id: 'b2', label: 'broker 2', sub: 'partitions on disk', col: 1, row: 1, hue: 3 },
        { id: 'b3', label: 'broker 3', sub: 'partitions on disk', col: 2, row: 1, hue: 3 },
        { id: 'prod', label: 'producers', sub: 'write to leaders', col: 0, row: 2, hue: 7, shape: 'actor' },
        { id: 'cons', label: 'consumers', sub: 'read from leaders', col: 2, row: 2, hue: 1, shape: 'actor' },
      ]}
      edges={[
        { from: 'c1', to: 'c2', label: 'Raft', both: true, hue: 5 },
        { from: 'c2', to: 'c3', label: 'Raft', both: true, hue: 5 },
        { from: 'c1', to: 'b1', label: 'metadata', dashed: true, hue: 5 },
        { from: 'c2', to: 'b2', dashed: true, hue: 5 },
        { from: 'c3', to: 'b3', dashed: true, hue: 5 },
        { from: 'prod', to: 'b1', flow: true, hue: 7 },
        { from: 'prod', to: 'b2', flow: true, hue: 7 },
        { from: 'b2', to: 'cons', flow: true, hue: 1 },
        { from: 'b3', to: 'cons', flow: true, hue: 1 },
      ]}
      caption="Schematic of a 3 + 3 layout. Brokers fetch the metadata log from the controllers (every broker keeps a copy); clients never talk to controllers. A laptop setup runs one process with both roles."
    />
  )
}

function AdvertisedListener() {
  return (
    <Flow
      title="The advertised-listener trap: bootstrap works, everything after it fails"
      cols={3}
      rows={2}
      rowHeight={80}
      nodes={[
        { id: 'client', label: 'client on your laptop', sub: 'bootstrap localhost:9092', col: 0, row: 0, hue: 7, shape: 'actor' },
        { id: 'broker', label: 'broker in a container', sub: 'advertises kafka:9092', col: 2, row: 0, hue: 3 },
        { id: 'nowhere', label: 'kafka:9092', sub: 'unknown name outside', col: 1, row: 1, hue: 8 },
      ]}
      edges={[
        { from: 'client', to: 'broker', label: '1. bootstrap + metadata OK', both: true, hue: 6 },
        { from: 'broker', to: 'nowhere', label: '2. “use this”', dashed: true, hue: 3 },
        { from: 'client', to: 'nowhere', label: '3. connect fails', dashed: true, hue: 8 },
      ]}
    />
  )
}

export default function Brokers() {
  return (
    <>
      <p>
        A <strong>broker</strong> is a Kafka server: a single running process that stores records on disk and serves
        them to clients. A <strong>cluster</strong> is a group of brokers working together. Production clusters
        usually have three or more, so the loss of one machine loses no data.
      </p>

      <h2>Who stores what</h2>
      <p>
        Each partition (next lesson) lives on several brokers. One copy is the <strong>leader</strong> — it handles all
        writes and, by default, all reads for that partition. The other copies are <strong>followers</strong> that continuously copy
        the leader. Leadership is spread so every broker does a fair share of the work.
      </p>
      <ClusterLayout />

      <h2>The controller</h2>
      <p>
        Someone has to keep track of which brokers are alive, which topics exist, and who leads each partition. That
        is the <strong>controller</strong>. In modern Kafka it runs on the built-in <strong>KRaft</strong> consensus
        protocol: a small quorum of controller nodes keeps the metadata log and agrees on changes.
      </p>
      <Callout tone="note" title="ZooKeeper, briefly">
        Older Kafka stored metadata in a separate system called ZooKeeper. KRaft replaced it; Kafka 4.0 removed
        ZooKeeper completely. If a tutorial asks you to start ZooKeeper first, it is out of date.
      </Callout>
      <Topology />
      <p>
        A node’s job is set by <code>process.roles</code>. Big clusters run dedicated controllers; a laptop or test
        setup commonly runs a single process that is both:
      </p>
      <CodeBlock
        title="server.properties — single-node KRaft (broker + controller in one)"
        code={`
process.roles=broker,controller
node.id=1
controller.quorum.voters=1@127.0.0.1:9093

# Two listeners: one for clients, one for controller traffic
listeners=PLAINTEXT://127.0.0.1:9092,CONTROLLER://127.0.0.1:9093
advertised.listeners=PLAINTEXT://127.0.0.1:9092
controller.listener.names=CONTROLLER
inter.broker.listener.name=PLAINTEXT
listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT

log.dirs=/var/lib/kafka

# KRaft storage must be formatted once before the first start:
#   kafka-storage.sh format -t $(kafka-storage.sh random-uuid) -c server.properties
`}
      />

      <h2>How clients find their way</h2>
      <BootstrapFlow />

      <Callout tone="warn" title="The classic connection bug">
        <p>
          <code>listeners</code> is where the broker <em>binds</em>. <code>advertised.listeners</code> is the address
          it <em>tells clients to use</em> in the metadata reply. If the advertised address is not reachable from the
          client (say, a container-internal hostname), the bootstrap succeeds but every following request fails.
        </p>
      </Callout>
      <AdvertisedListener />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Broker', definition: 'A Kafka server process that stores partitions and serves clients.' },
          { term: 'Cluster', definition: 'A set of brokers (and controllers) acting as one system.' },
          { term: 'Controller', definition: 'The node(s) managing cluster metadata and electing partition leaders.' },
          { term: 'KRaft', definition: 'Kafka’s built-in Raft consensus for metadata; replaces ZooKeeper.' },
          { term: 'bootstrap.servers', definition: 'Initial broker addresses a client uses to discover the whole cluster.' },
          { term: 'Metadata', definition: 'The map of brokers, topics, partitions and their leaders.' },
          { term: 'Listener', definition: 'A network endpoint (host, port, protocol) a broker accepts connections on.' },
          { term: 'Leader / follower', definition: 'The replica that serves a partition vs. the replicas that copy it.' },
        ]}
      />
    </>
  )
}
