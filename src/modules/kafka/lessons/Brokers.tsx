import { Box, Callout, CodeBlock, Column, Connector, Row, TermList, Walkthrough } from '@/shared/ui'
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
        If a broker dies, the controller elects a new leader and the client gets a <code>NOT_LEADER</code> error. It
        refreshes its metadata and retries against the new leader automatically.
      </p>
    ),
  },
]

function BootstrapFlow() {
  return (
    <Walkthrough title="How a client finds the right broker" steps={STEPS}>
      {(step) => (
        <Row gap={0} align="center">
          <Box title="Client" caption="producer or consumer" active={step <= 1 || step === 3} />
          <Column gap={10}>
            {[1, 2, 3].map((id) => {
              const isBootstrap = id === 1
              const forward = (isBootstrap && step <= 1) || (step === 3 && id !== 1) || (step === 4 && id === 3)
              const back = isBootstrap && step === 2
              return (
                <Row key={id} gap={0} align="center">
                  <div style={{ width: 150, display: 'flex' }}>
                    <Connector
                      active={forward || back}
                      direction={back ? 'left' : 'right'}
                      dashed={!isBootstrap && step < 3}
                      label={
                        isBootstrap && step === 1
                          ? 'metadata?'
                          : back
                            ? 'leaders map'
                            : step === 3 && id !== 1
                              ? `P${id - 1}`
                              : step === 4 && id === 3
                                ? 'retry P1'
                                : undefined
                      }
                    />
                  </div>
                  <Box
                    title={`Broker ${id}`}
                    caption={step === 4 && id === 2 ? 'down' : `leader of P${id - 1}${step === 4 && id === 3 ? ' + P1' : ''}`}
                    active={(isBootstrap && step <= 2) || (step === 3 && id !== 1) || (step === 4 && id === 3)}
                    dimmed={step === 4 && id === 2}
                  />
                </Row>
              )
            })}
          </Column>
        </Row>
      )}
    </Walkthrough>
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
        reads and writes for that partition. The other copies are <strong>followers</strong> that continuously copy
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
