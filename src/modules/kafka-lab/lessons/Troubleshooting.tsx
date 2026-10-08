import { Callout, CodeBlock, Table } from '@/shared/ui'
import { FORMATTED_AS_ROOT, NO_LOG_DIR, SLOTS_AFTER_DELETE } from '../transcripts'

const START = [
  ['The service will not start: "Invalid -Xlog option … kafkaServer-gc.log"', 'LOG_DIR is not set, so the scripts try to write logs into /opt/kafka/logs, which the kafka user cannot create.', 'Set Environment="LOG_DIR=/var/log/kafka" in the unit and make the directory owned by kafka.'],
  ['"No readable meta.properties files found"', 'The data directory was never formatted.', 'Run kafka-storage.sh format as the kafka user (in Docker: set CLUSTER_ID).'],
  ['AccessDeniedException on __cluster_metadata-0 files', 'The directory was formatted as root.', 'sudo chown -R kafka:kafka /var/lib/kafka/data (or wipe and format as kafka).'],
  ['"Invalid cluster.id … Expected X, but read Y"', 'This node was formatted with a different cluster id from the rest — or a Docker volume from an older setup.', 'Use the one cluster id everywhere; for a new cluster, wipe the directory or volume first.'],
  ['Brokers never become ready; kafka-metadata-quorum.sh describe --status shows no LeaderId', 'Fewer than a majority of controllers are up or reachable on 9093, or controller.quorum.voters differs between nodes.', 'Start all controllers; identical voter list everywhere; open 9093 between Kafka nodes.'],
  ['"Too many open files"', 'File-descriptor limit too low.', 'LimitNOFILE=100000 in the unit (check /proc/<pid>/limits).'],
  ['"Map failed" / OutOfMemoryError with plenty of heap free', 'vm.max_map_count reached (many partitions).', 'vm.max_map_count=262144 in /etc/sysctl.d/, sysctl --system.'],
]

const CLIENTS = [
  ['Client connects, then logs "Connection to node 1 (host/…:9092) could not be established"', 'It bootstrapped, then was told to use an advertised address it cannot reach or resolve.', 'Fix advertised.listeners: an address valid from the client’s network (DNS name; a separate listener per network).'],
  ['"Topic payments not present in metadata after 60000 ms"', 'The topic does not exist and auto.create.topics.enable=false.', 'Create the topic.'],
  ['Consumer groups never work; COORDINATOR_NOT_AVAILABLE in the logs', '__consumer_offsets cannot be created: offsets.topic.replication.factor is larger than the number of brokers.', 'Set it to the broker count (1 on a single node) before the first start.'],
  ['Topics come out with replication factor 1 on a 3-broker cluster', 'default.replication.factor is set on the brokers but not on the controllers.', 'Set topic defaults on every node; fix existing topics with kafka-reassign-partitions.sh.'],
  ['Producer: NotEnoughReplicasException', 'acks=all and fewer in-sync replicas than min.insync.replicas.', 'Bring brokers back; this is the safety mechanism working.'],
  ['CommitFailedException: "…not part of an active group…"', 'More time than max.poll.interval.ms between two poll() calls; the consumer was removed from the group.', 'Faster processing, smaller max.poll.records, or a larger max.poll.interval.ms; make processing idempotent.'],
  ['Garbage values or SerializationException', 'Consumer deserializer does not match the producer serializer.', 'Match them; when unsure, read as String or byte[] and inspect.'],
]

const CONNECT = [
  ['"Failed to find any class that implements Connector and which name matches io.debezium…"', 'The plugin is not under plugin.path, or one directory level off.', 'plugin.path must be the parent of debezium-connector-postgres/; check GET /connector-plugins.'],
  ['Connector FAILED: "logical decoding requires wal_level >= logical"', 'PostgreSQL still runs with wal_level=replica.', 'Set wal_level=logical and restart PostgreSQL (a reload is not enough).'],
  ['Connector FAILED: could not access file "decoderbufs"', 'plugin.name left at its default, decoderbufs, which is not installed.', '"plugin.name": "pgoutput".'],
  ['Connector FAILED: permission denied to start WAL sender / to create publication', 'The user lacks REPLICATION, or must create a publication it may not.', 'ALTER ROLE debezium REPLICATION; create the publication as a superuser, publication.autocreate.mode=disabled.'],
  ['Connector FAILED: password authentication failed / no pg_hba.conf entry', 'pg_hba.conf has no rule for the worker’s address, or listen_addresses is localhost only.', 'Add a host … scram-sha-256 line for the worker subnet; listen_addresses; reload/restart.'],
  ['Connector FAILED: "replication slot … is active for PID …"', 'Two connectors use the same slot.name.', 'One slot per connector.'],
  ['Placeholder ${file:…} not replaced / FileNotFoundException', 'config.providers missing on the worker, or the file is not readable by the worker’s user (uid 1000 in the container).', 'Add config.providers=file to the worker config; fix owner and mode of the secrets file.'],
  ['Decimal fields look like "AeIg"', 'decimal.handling.mode=precise (default) writes binary.', '"decimal.handling.mode": "string".'],
]

export default function Troubleshooting() {
  return (
    <>
      <p>What you see, why it happens, and what to do. The messages are the real ones.</p>

      <h2>Where to look</h2>
      <Table
        head={['', 'Ubuntu + systemd', 'Docker']}
        rows={[
          ['Kafka', 'journalctl -u kafka; /var/log/kafka/server.log, controller.log', 'docker compose logs kafka'],
          ['Connect', 'journalctl -u kafka-connect; /var/log/kafka-connect/connect.log', 'docker compose logs connect'],
          ['Connector errors', 'curl -s <worker>:8083/connectors/<name>/status | jq -r ".tasks[].trace"', 'same, via the published port'],
          ['PostgreSQL', 'journalctl -u postgresql; /var/log/postgresql/', 'docker compose logs postgres'],
        ]}
      />

      <h2>Kafka will not start or form a cluster</h2>
      <Table head={['You see', 'Because', 'Fix']} rows={START} />
      <CodeBlock title="LOG_DIR missing (tested)" code={NO_LOG_DIR} />
      <CodeBlock title="formatted as root (tested)" code={FORMATTED_AS_ROOT} />

      <h2>Clients</h2>
      <Table head={['You see', 'Because', 'Fix']} rows={CLIENTS} />

      <h2>Connect and Debezium</h2>
      <Table head={['You see', 'Because', 'Fix']} rows={CONNECT} />

      <h2>The slow disaster: a forgotten replication slot</h2>
      <p>
        Deleting a connector leaves its replication slot behind. PostgreSQL then keeps every WAL file from that point —
        the disk fills days later. After deleting a second connector during testing:
      </p>
      <CodeBlock title="pg_replication_slots" code={SLOTS_AFTER_DELETE} />
      <CodeBlock title="remove a slot nobody uses" code={`SELECT pg_drop_replication_slot('shop_flat_slot');`} />
      <Callout tone="tip" title="Automate these checks">
        <ul>
          <li>Every connector and task RUNNING: <code>GET /connectors?expand=status</code>.</li>
          <li>No under-replicated partitions: <code>kafka-topics.sh --describe --under-replicated-partitions</code> prints nothing.</li>
          <li>Consumer lag bounded: <code>kafka-consumer-groups.sh --describe --all-groups</code>.</li>
          <li>No inactive or lagging replication slot: the query above.</li>
        </ul>
      </Callout>
    </>
  )
}
