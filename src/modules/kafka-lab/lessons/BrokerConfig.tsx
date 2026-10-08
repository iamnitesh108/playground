import { Callout, CodeBlock, ConfigExplorer, Table, Tabs } from '@/shared/ui'
import { BROKER_PROPERTIES, CONTROLLER_PROPERTIES, SINGLE_NODE_PROPERTIES } from '../configs/broker'
import { RF1_BY_MISTAKE } from '../transcripts'

export default function BrokerConfig() {
  return (
    <>
      <p>
        Every Kafka process reads one properties file at start-up, conventionally <code>/etc/kafka/server.properties</code>
        . Whether you install on Ubuntu or run containers, these are the settings you decide on. Pick the layout you are
        building and click through every line.
      </p>

      <Tabs
        items={[
          {
            label: 'Single node',
            content: <ConfigExplorer file="/etc/kafka/server.properties — kafka-1" format="properties" entries={SINGLE_NODE_PROPERTIES} />,
          },
          {
            label: 'Cluster: controller',
            content: <ConfigExplorer file="/etc/kafka/server.properties — controller-1" format="properties" entries={CONTROLLER_PROPERTIES} />,
          },
          {
            label: 'Cluster: broker',
            content: <ConfigExplorer file="/etc/kafka/server.properties — broker-1" format="properties" entries={BROKER_PROPERTIES} />,
          },
        ]}
      />

      <h2>For a cluster, per node</h2>
      <Table
        head={['Node', 'process.roles', 'node.id', 'advertised.listeners']}
        rows={[
          ['controller-1 / -2 / -3', 'controller', '1 / 2 / 3', '— (controllers do not serve clients)'],
          ['broker-1', 'broker', '4', 'PLAINTEXT://broker-1:9092'],
          ['broker-2', 'broker', '5', 'PLAINTEXT://broker-2:9092'],
          ['broker-3', 'broker', '6', 'PLAINTEXT://broker-3:9092'],
        ]}
      />
      <p>
        Everything else is identical on all nodes of the same role — including <code>controller.quorum.voters</code> and
        the topic defaults. Keep the files in configuration management (Ansible, Salt, Puppet, …) and template only these
        three values.
      </p>

      <Callout tone="warn" title="Topic defaults belong on the controllers">
        <p>
          In KRaft, the active controller creates topics, so <code>num.partitions</code>,{' '}
          <code>default.replication.factor</code> and <code>min.insync.replicas</code> must be set on the controllers. During
          testing, with these only on the brokers, <code>kafka-topics.sh --create</code> produced:
        </p>
        <CodeBlock title="what happens when the defaults are only on the brokers" code={RF1_BY_MISTAKE} />
        <p>Set them identically on every node, as the files above do.</p>
      </Callout>

      <h2>Listeners in one picture</h2>
      <ul>
        <li><code>listeners</code> — where this process binds.</li>
        <li><code>advertised.listeners</code> — what it tells clients to use. Must be resolvable and reachable <em>from the client</em>.</li>
        <li><code>listener.security.protocol.map</code> — the protocol of each listener name.</li>
        <li><code>inter.broker.listener.name</code> / <code>controller.listener.names</code> — which listener carries replication and KRaft traffic.</li>
      </ul>
      <p>
        Clients that reach the brokers through different networks (inside a container network and from outside, or
        private and public) need one listener each, every one advertising the address valid on its network. The Docker
        lesson shows exactly that.
      </p>

      <h2>Setting a value for one topic</h2>
      <p>Topic-level settings override the server defaults and can be changed while running:</p>
      <CodeBlock
        title="per-topic overrides"
        code={`kafka-topics.sh  --bootstrap-server broker-1:9092 --create --topic payments --partitions 12 --replication-factor 3
kafka-configs.sh --bootstrap-server broker-1:9092 --alter --entity-type topics --entity-name payments \\
  --add-config retention.ms=1209600000,min.insync.replicas=2
kafka-configs.sh --bootstrap-server broker-1:9092 --describe --entity-type topics --entity-name payments`}
      />
    </>
  )
}
