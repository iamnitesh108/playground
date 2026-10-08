import { Callout, CodeBlock, Table } from '@/shared/ui'

export default function Operations() {
  return (
    <>
      <p>
        Installing is the short part. This lesson covers what operations teams do afterwards: routine tasks, what to
        monitor, what to back up, and how to secure the stack.
      </p>

      <h2>Routine tasks</h2>
      <Table
        head={['Task', 'Ubuntu + systemd', 'Docker']}
        rows={[
          ['Status', 'systemctl status kafka kafka-connect', 'docker compose ps'],
          ['Restart one node', 'systemctl restart kafka', 'docker compose restart kafka'],
          ['Follow logs', 'journalctl -u kafka -f, /var/log/kafka/server.log', 'docker compose logs -f kafka'],
          ['Change a broker setting', 'edit /etc/kafka/server.properties, restart', 'edit the environment, docker compose up -d'],
          ['Change a topic setting', 'kafka-configs.sh --alter (no restart)', 'same, via docker compose exec'],
        ]}
      />
      <Callout tone="tip" title="Rolling restarts">
        Restart one node at a time and wait until{' '}
        <code>kafka-topics.sh --bootstrap-server broker-1:9092 --describe --under-replicated-partitions</code> prints nothing
        before the next. With replication factor 3 and <code>min.insync.replicas=2</code>, producers and consumers keep
        working throughout. Restart controllers one at a time too: a majority must stay up.
      </Callout>

      <h2>Monitoring</h2>
      <p>
        Kafka exposes its metrics over JMX. Set <code>JMX_PORT</code> in the service environment to open a JMX port, or —
        more common — attach the Prometheus JMX exporter as a Java agent through <code>KAFKA_OPTS</code> and scrape it.
        The signals that matter most:
      </p>
      <Table
        head={['Metric (JMX name)', 'Healthy', 'Means when not']}
        rows={[
          ['kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions', '0', 'A broker is down or cannot keep up; durability is reduced'],
          ['kafka.controller:type=KafkaController,name=OfflinePartitionsCount', '0', 'Partitions without a leader: producers and consumers of them are stuck'],
          ['kafka.controller:type=KafkaController,name=ActiveControllerCount', 'sum over controllers = 1', 'No active controller: the cluster cannot change state'],
          ['kafka.server:type=BrokerTopicMetrics,name=BytesInPerSec / BytesOutPerSec', 'stable', 'Traffic, for capacity planning'],
          ['kafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce', 'low, stable', 'Slow disks or overloaded brokers'],
          ['Consumer lag per group (kafka-consumer-groups.sh or an exporter)', 'bounded', 'Consumers are slow, stuck or stopped'],
          ['Connect: connector and task state (REST /connectors?expand=status)', 'RUNNING', 'A FAILED task stops data silently'],
          ['PostgreSQL: replication slot lag (pg_replication_slots)', 'small', 'WAL accumulating on the database disk'],
        ]}
      />
      <p>Also watch disk usage of <code>log.dirs</code> per broker, JVM GC pauses and heap, and file-descriptor use.</p>

      <h2>What to back up</h2>
      <ul>
        <li>
          <strong>Configuration</strong>: <code>/etc/kafka</code>, unit files, Compose files and connector JSON — ideally they
          already live in version control and configuration management.
        </li>
        <li>
          <strong>The cluster id</strong> and node ids: needed to rebuild a node into the same cluster.
        </li>
        <li>
          <strong>Topic data</strong> is protected by replication, not backups. For disaster recovery across data centres,
          replicate to a second cluster with MirrorMaker 2 (it ships with Kafka and runs on Kafka Connect).
        </li>
        <li>
          <strong>Connect state</strong> lives in the <code>connect-configs</code>, <code>connect-offsets</code> and{' '}
          <code>connect-status</code> topics; losing <code>connect-offsets</code> makes source connectors start over (for
          Debezium: a new snapshot).
        </li>
      </ul>

      <h2>Security</h2>
      <Table
        head={['Layer', 'What to set up']}
        rows={[
          ['Encryption', 'TLS listeners (SSL or SASL_SSL) with ssl.keystore.* and ssl.truststore.* on brokers, controllers and clients'],
          ['Authentication', 'SASL — SCRAM-SHA-512 usernames and passwords, OAuth bearer tokens, or mutual TLS certificates'],
          ['Authorisation', 'authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer (KRaft) and ACLs per service with kafka-acls.sh: each may read and write only its own topics and groups'],
          ['Kafka Connect', 'REST API on a private network behind authentication; secrets through config providers; the worker itself authenticates to Kafka like any client'],
          ['Operating system', 'Firewall per port (9092 clients, 9093 Kafka nodes only, 8083 admins only), the unprivileged kafka user, patched JVM'],
          ['Database', 'A dedicated replication user with SELECT on the captured tables only; pg_hba limited to the worker subnet'],
        ]}
      />

      <h2>Before calling it production</h2>
      <ul>
        <li>3 controllers and at least 3 brokers on separate machines (or availability zones).</li>
        <li>Replication factor 3 and <code>min.insync.replicas=2</code> set on every node; producers use <code>acks=all</code>.</li>
        <li><code>auto.create.topics.enable=false</code>; topics created by scripts with chosen partitions and retention.</li>
        <li>Connect storage topics and <code>topic.creation.default.replication.factor</code> at 3.</li>
        <li>TLS and authentication on every listener; ACLs per application.</li>
        <li>Alerts on the metrics above, plus replication-slot lag in PostgreSQL.</li>
        <li>A tested procedure for rolling restarts and upgrades.</li>
      </ul>
      <CodeBlock
        title="a quick health check from any admin host"
        code={`B=broker-1:9092
/opt/kafka/bin/kafka-metadata-quorum.sh --bootstrap-server $B describe --status | grep -E 'LeaderId|CurrentVoters'
/opt/kafka/bin/kafka-topics.sh --bootstrap-server $B --describe --under-replicated-partitions
/opt/kafka/bin/kafka-topics.sh --bootstrap-server $B --describe --unavailable-partitions
/opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server $B --describe --all-groups
curl -s 'http://connect-1:8083/connectors?expand=status' | jq 'map_values(.status.connector.state)'`}
      />
    </>
  )
}
