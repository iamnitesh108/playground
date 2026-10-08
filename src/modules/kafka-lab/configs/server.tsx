import type { ConfigEntry } from '@/shared/ui'

/** config/server.properties — one node that is both broker and controller (KRaft). */
export const SERVER_PROPERTIES: ConfigEntry[] = [
  {
    section: 'Who am I',
    key: 'process.roles',
    value: 'broker,controller',
    options: 'broker | controller | broker,controller',
    explain: (
      <p>
        What this process does. A <strong>broker</strong> stores partitions and serves clients; a <strong>controller</strong>{' '}
        manages cluster metadata (topics, leaders) with the KRaft protocol. One process doing both is “combined mode”
        — ideal for a laptop. Production clusters usually run 3 dedicated controllers and separate brokers.
      </p>
    ),
  },
  {
    key: 'node.id',
    value: '1',
    explain: <p>A unique integer per node in the cluster. Brokers and controllers share the same id space.</p>,
  },
  {
    key: 'controller.quorum.bootstrap.servers',
    value: 'kafka:9093',
    explain: (
      <>
        <p>
          Where to find the controllers (<code>host:port</code> of their CONTROLLER listener). Since Kafka 3.9 this
          “dynamic quorum” setting replaces the older <code>controller.quorum.voters=1@kafka:9093</code>, which lists
          every voter with its node id and cannot change without a restart.
        </p>
        <p>
          Use <code>localhost:9093</code> when Kafka runs directly on your machine; <code>kafka</code> is the container’s
          hostname in Docker Compose.
        </p>
      </>
    ),
  },
  {
    section: 'Network: who listens where',
    key: 'listeners',
    value: 'INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093',
    explain: (
      <>
        <p>
          The sockets this process <em>binds</em>: <code>NAME://host:port</code>. An empty host means all interfaces.
          The names are labels you choose; their protocols come from <code>listener.security.protocol.map</code>.
        </p>
        <p>
          Here: <code>INTERNAL</code> for other containers, <code>EXTERNAL</code> for apps on your machine,{' '}
          <code>CONTROLLER</code> for KRaft traffic.
        </p>
      </>
    ),
  },
  {
    key: 'advertised.listeners',
    value: 'INTERNAL://kafka:19092,EXTERNAL://localhost:9092,CONTROLLER://kafka:9093',
    explain: (
      <>
        <p>
          The addresses the broker <em>tells clients to use</em> in its metadata reply. A client connects to{' '}
          <code>bootstrap.servers</code>, receives these addresses, and from then on uses them.
        </p>
        <p>
          That is why there are two client listeners: a container must be sent <code>kafka:19092</code>, while an app on
          your laptop must be sent <code>localhost:9092</code>. Advertising an address the client cannot reach is the
          single most common Kafka setup bug.
        </p>
      </>
    ),
  },
  {
    key: 'listener.security.protocol.map',
    value: 'INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT',
    options: 'PLAINTEXT | SSL | SASL_PLAINTEXT | SASL_SSL',
    explain: (
      <p>
        Maps each listener name to a security protocol. <code>PLAINTEXT</code> = no encryption, no authentication: fine
        locally, never on a shared network. Production uses <code>SSL</code> (TLS) and/or <code>SASL_SSL</code>{' '}
        (TLS + username/password or Kerberos/OAuth).
      </p>
    ),
  },
  {
    key: 'inter.broker.listener.name',
    value: 'INTERNAL',
    explain: <p>Which listener brokers use to talk to each other (replication). Must be one of the listeners.</p>,
  },
  {
    key: 'controller.listener.names',
    value: 'CONTROLLER',
    explain: <p>Which listener(s) carry controller traffic. Required in KRaft mode; never used by clients.</p>,
  },
  {
    section: 'Storage',
    key: 'log.dirs',
    value: '/var/lib/kafka/data',
    explain: (
      <p>
        Where partition data is stored (one subdirectory per partition, e.g. <code>orders-0/</code>). Comma-separate
        several disks. The shipped example uses <code>/tmp/kraft-combined-logs</code>, which is wiped on reboot on many
        systems — fine for a try-out, not for data you keep.
      </p>
    ),
  },
  {
    section: 'Topic defaults',
    key: 'num.partitions',
    value: '3',
    defaultValue: '1',
    explain: <p>Partition count for topics created without an explicit <code>--partitions</code>. 3 lets you try consumer groups with up to 3 members.</p>,
  },
  {
    key: 'default.replication.factor',
    value: '1',
    defaultValue: '1',
    explain: <p>Replication factor for topics created without one. Can never exceed the number of brokers — so 1 on a single node, 3 in production.</p>,
  },
  {
    key: 'auto.create.topics.enable',
    value: 'false',
    defaultValue: 'true',
    explain: (
      <p>
        If true, producing to or consuming from an unknown topic creates it silently with the defaults above. Turning it
        off means typos fail loudly and every topic is created on purpose. Kafka Connect can still create its own
        topics (see <code>topic.creation.*</code> in the connector).
      </p>
    ),
  },
  {
    section: 'Internal topics (single node: 1 replica)',
    key: 'offsets.topic.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: (
      <p>
        Replication of <code>__consumer_offsets</code>, where consumer groups store their committed offsets. The default
        3 cannot be satisfied by one broker: consumer groups would fail with <code>COORDINATOR_NOT_AVAILABLE</code>.
      </p>
    ),
  },
  {
    key: 'transaction.state.log.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: <p>Replication of <code>__transaction_state</code>, used by transactional producers. Same reason as above.</p>,
  },
  {
    key: 'transaction.state.log.min.isr',
    value: '1',
    defaultValue: '2',
    explain: <p>Minimum in-sync replicas for the transaction log. Must not exceed its replication factor.</p>,
  },
  {
    key: 'share.coordinator.state.topic.replication.factor',
    value: '1',
    defaultValue: '3',
    explain: <p>Replication of <code>__share_group_state</code>, used by share groups (queue-style consumption, Kafka 4.x).</p>,
  },
  {
    key: 'share.coordinator.state.topic.min.isr',
    value: '1',
    defaultValue: '2',
    explain: <p>Minimum in-sync replicas for the share-group state topic.</p>,
  },
  {
    section: 'Retention',
    key: 'log.retention.hours',
    value: '168',
    defaultValue: '168',
    explain: <p>Delete data older than 7 days. Per-topic override: <code>retention.ms</code>. Also available: <code>log.retention.bytes</code> (size cap per partition).</p>,
  },
  {
    key: 'log.segment.bytes',
    value: '1073741824',
    defaultValue: '1073741824 (1 GiB)',
    explain: <p>Size at which a partition’s current segment file is closed and a new one started. Retention deletes whole closed segments.</p>,
  },
  {
    section: 'Development comfort',
    key: 'group.initial.rebalance.delay.ms',
    value: '0',
    defaultValue: '3000',
    explain: (
      <p>
        How long the group coordinator waits for more members before the first rebalance of a new group. The 3 s default
        avoids repeated rebalances when many consumers start together; 0 makes local experiments start instantly.
      </p>
    ),
  },
]
