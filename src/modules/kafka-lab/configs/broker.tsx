import type { ConfigEntry } from '@/shared/ui'

/*
 * Kafka server configuration in three shapes:
 *  - SINGLE_NODE: one server that is broker and controller (dev, test, small internal use)
 *  - CONTROLLER / BROKER: the production layout — 3 dedicated controllers, 3+ brokers
 * All three were run on Kafka 4.3.1. Replace host names with your servers' DNS names.
 */

const roles = (value: string, extra: string): ConfigEntry => ({
  section: 'Identity',
  key: 'process.roles',
  value,
  options: 'broker | controller | broker,controller',
  explain: (
    <>
      <p>
        What this process does. A <strong>broker</strong> stores partitions and serves clients. A{' '}
        <strong>controller</strong> stores the cluster metadata (topics, partition leaders, configs) in a Raft quorum
        called KRaft and makes the decisions. {extra}
      </p>
    </>
  ),
})

const nodeId = (value: string): ConfigEntry => ({
  key: 'node.id',
  value,
  explain: (
    <p>
      Unique integer per process in the cluster; controllers and brokers share the same id space. It is written into
      the data directory when it is formatted and must never change afterwards.
    </p>
  ),
})

const voters: ConfigEntry = {
  key: 'controller.quorum.voters',
  value: '1@controller-1:9093,2@controller-2:9093,3@controller-3:9093',
  explain: (
    <>
      <p>
        The fixed list of controllers, as <code>id@host:port</code> of their CONTROLLER listener. Identical on every node,
        controllers and brokers alike. Three controllers tolerate one failure; five tolerate two.
      </p>
      <p>
        This is a <em>static</em> quorum: changing the controller set later needs a planned restart. Kafka 3.9+ also
        supports a <em>dynamic</em> quorum (<code>controller.quorum.bootstrap.servers</code>, formatted with{' '}
        <code>--initial-controllers</code>) where controllers can be added and removed online with{' '}
        <code>kafka-metadata-quorum.sh</code>.
      </p>
    </>
  ),
}

const protocolMap = (value: string): ConfigEntry => ({
  key: 'listener.security.protocol.map',
  value,
  options: 'PLAINTEXT | SSL | SASL_PLAINTEXT | SASL_SSL',
  explain: (
    <p>
      Maps every listener name to a security protocol. <code>PLAINTEXT</code> has no encryption and no authentication:
      acceptable on an isolated private network while learning, never on a shared network. Production uses{' '}
      <code>SSL</code> or <code>SASL_SSL</code> (see “Operate”). Every listener name used anywhere must appear here.
    </p>
  ),
})

const logDirs: ConfigEntry = {
  section: 'Storage',
  key: 'log.dirs',
  value: '/var/lib/kafka/data',
  explain: (
    <p>
      Where partition data lives (one sub-directory per partition, e.g. <code>payments-0/</code>). Put it on dedicated
      disks — XFS is recommended, mounted with <code>noatime</code> — never on the OS disk. Several disks: comma-separate
      their mount points. Must be owned by the user Kafka runs as.
    </p>
  ),
}

const topicDefaults = (partitions: string, rf: string, minIsr: string, note: string): ConfigEntry[] => [
  {
    section: 'Topic defaults and durability',
    key: 'num.partitions',
    value: partitions,
    defaultValue: '1',
    explain: <p>Partitions for a topic created without <code>--partitions</code>. {note}</p>,
  },
  {
    key: 'default.replication.factor',
    value: rf,
    defaultValue: '1',
    explain: (
      <p>
        Copies of each partition for a topic created without <code>--replication-factor</code>. Cannot exceed the number
        of brokers. {note}
      </p>
    ),
  },
  {
    key: 'min.insync.replicas',
    value: minIsr,
    defaultValue: '1',
    explain: (
      <p>
        With producer <code>acks=all</code>, a write succeeds only if at least this many replicas have it; otherwise the
        producer gets <code>NotEnoughReplicasException</code>. RF 3 + min ISR 2 survives one broker loss with no data
        loss and no downtime — tested: with two of three brokers stopped, writes were refused instead of being stored
        once.
      </p>
    ),
  },
  {
    key: 'auto.create.topics.enable',
    value: 'false',
    defaultValue: 'true',
    explain: (
      <p>
        If true, using an unknown topic name creates it silently with the defaults above — a typo becomes a new topic.
        Create topics on purpose instead; Kafka Connect creates its own via <code>topic.creation.*</code>.
      </p>
    ),
  },
]

const KRAFT_DEFAULTS_NOTE =
  'In KRaft, a topic created with kafka-topics.sh or the AdminClient gets this value from the active controller — set only on brokers, it is ignored (verified on 4.3.1). KIP-1211 makes the controller value authoritative for every creation path.'

export const SINGLE_NODE_PROPERTIES: ConfigEntry[] = [
  roles('broker,controller', 'One process doing both is “combined mode”: fine for development, CI and small internal use; not for production.'),
  nodeId('1'),
  {
    key: 'controller.quorum.bootstrap.servers',
    value: 'kafka-1:9093',
    explain: (
      <p>
        Where to find the controller quorum. With one combined node it is the node itself. This is the dynamic-quorum
        setting (Kafka 3.9+); a single node is formatted with <code>--standalone</code>, which makes it the only voter.
      </p>
    ),
  },
  {
    section: 'Network',
    key: 'listeners',
    value: 'PLAINTEXT://:9092,CONTROLLER://:9093',
    explain: (
      <p>
        The sockets this process <em>binds</em>, as <code>NAME://host:port</code>. An empty host means all interfaces.
        PLAINTEXT serves clients; CONTROLLER carries KRaft traffic and is never used by clients.
      </p>
    ),
  },
  {
    key: 'advertised.listeners',
    value: 'PLAINTEXT://kafka-1:9092,CONTROLLER://kafka-1:9093',
    explain: (
      <>
        <p>
          The addresses the server <em>tells clients to use</em>. A client connects to any address in{' '}
          <code>bootstrap.servers</code>, receives these in the metadata response, and from then on uses only them.
        </p>
        <p>
          Use a name every client can resolve — the server’s DNS name. <code>localhost</code> here works only for
          clients on the same machine; a wrong advertised address is the most common Kafka setup bug.
        </p>
      </>
    ),
  },
  protocolMap('PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT'),
  {
    key: 'inter.broker.listener.name',
    value: 'PLAINTEXT',
    explain: <p>The listener brokers use to replicate from each other. Must be one of <code>listeners</code>.</p>,
  },
  {
    key: 'controller.listener.names',
    value: 'CONTROLLER',
    explain: <p>Which listener carries controller traffic. Required in KRaft.</p>,
  },
  logDirs,
  ...topicDefaults('3', '1', '1', 'With one node, replication is impossible: everything is 1.'),
  {
    section: 'Internal topics (one broker → 1 replica)',
    key: 'offsets.topic.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: (
      <p>
        Replicas of <code>__consumer_offsets</code>, where consumer groups commit. The default 3 cannot be met by one
        broker and consumer groups never work (<code>COORDINATOR_NOT_AVAILABLE</code>). Leave the defaults on a 3+ broker
        cluster.
      </p>
    ),
  },
  {
    key: 'transaction.state.log.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: <p>Replicas of <code>__transaction_state</code> (transactional producers).</p>,
  },
  {
    key: 'transaction.state.log.min.isr',
    value: '1',
    defaultValue: '2',
    explain: <p>Must not exceed the transaction log’s replication factor.</p>,
  },
  {
    key: 'share.coordinator.state.topic.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: <p>Replicas of <code>__share_group_state</code> (share groups, Kafka 4.x).</p>,
  },
  {
    key: 'share.coordinator.state.topic.min.isr',
    value: '1',
    defaultValue: '2',
    explain: <p>Must not exceed the share-group state topic’s replication factor.</p>,
  },
  {
    section: 'Retention',
    key: 'log.retention.hours',
    value: '168',
    defaultValue: '168',
    explain: (
      <p>
        Keep data 7 days, then delete whole closed segments. Per topic: <code>retention.ms</code>. Size limit per
        partition: <code>log.retention.bytes</code>. Size it from disk capacity and how long consumers may be offline.
      </p>
    ),
  },
  {
    key: 'log.segment.bytes',
    value: '1073741824',
    defaultValue: '1073741824 (1 GiB)',
    explain: <p>Size at which a partition’s active segment file is closed. Retention can only delete closed segments.</p>,
  },
]

export const CONTROLLER_PROPERTIES: ConfigEntry[] = [
  roles('controller', 'A dedicated controller holds no topic data and serves no clients, so it needs little disk and memory — but it must stay up: a majority of controllers is required for the cluster to change anything.'),
  nodeId('1'),
  voters,
  {
    section: 'Network',
    key: 'listeners',
    value: 'CONTROLLER://:9093',
    explain: <p>Controllers only listen for KRaft traffic from other controllers and from brokers.</p>,
  },
  {
    key: 'controller.listener.names',
    value: 'CONTROLLER',
    explain: <p>Which listener carries controller traffic.</p>,
  },
  protocolMap('CONTROLLER:PLAINTEXT'),
  logDirs,
  ...topicDefaults('6', '3', '2', KRAFT_DEFAULTS_NOTE),
]

export const BROKER_PROPERTIES: ConfigEntry[] = [
  roles('broker', 'Brokers do the heavy lifting: disks, network and page cache. Scale throughput and storage by adding brokers.'),
  nodeId('4'),
  voters,
  {
    key: 'controller.listener.names',
    value: 'CONTROLLER',
    explain: <p>Brokers must also know which listener name is the controllers’, to connect to the quorum.</p>,
  },
  {
    section: 'Network',
    key: 'listeners',
    value: 'PLAINTEXT://:9092',
    explain: <p>The client and replication listener. Add separate listeners if internal and external clients need different addresses or security.</p>,
  },
  {
    key: 'advertised.listeners',
    value: 'PLAINTEXT://broker-1:9092',
    explain: <p>This broker’s own resolvable name. Each broker advertises itself; clients talk directly to the broker that leads each partition.</p>,
  },
  protocolMap('PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT'),
  {
    key: 'inter.broker.listener.name',
    value: 'PLAINTEXT',
    explain: <p>Listener used for replication between brokers.</p>,
  },
  logDirs,
  ...topicDefaults(
    '6',
    '3',
    '2',
    'Keep the same value as the controllers: they decide for kafka-topics.sh and AdminClient, while auto-created topics may still read the broker’s value — identical settings avoid surprises.',
  ),
]
