import { Callout, CodeBlock, Table } from '@/shared/ui'
import { SLOTS_AFTER_DELETE } from '../transcripts'

const KAFKA = [
  ['Client from your machine hangs, logs "Connection to node 1 (kafka/…:19092) could not be established"', 'It bootstrapped, then was told to use an address it cannot resolve (the INTERNAL one).', 'Use localhost:9092 from the host; check advertised.listeners.'],
  ['"Topic payments not present in metadata after 60000 ms"', 'The topic does not exist and auto.create.topics.enable=false.', 'Create the topic (kafka-topics.sh --create).'],
  ['Consumer never receives anything; log repeats COORDINATOR_NOT_AVAILABLE', '__consumer_offsets cannot be created: offsets.topic.replication.factor is higher than the number of brokers.', 'Set it to 1 on a single node (before the first start, or recreate the topic).'],
  ['Kafka exits: "No readable meta.properties files found"', 'The storage directory was never formatted.', 'Run kafka-storage.sh format (the compose command does it).'],
  ['Kafka exits: "Invalid cluster.id … Expected X, but read Y"', 'The data directory was formatted with another cluster id.', 'Use the same id, or start fresh: docker compose down -v.'],
  ['Consumer prints garbage or throws SerializationException', 'Deserializer does not match how the producer serialized.', 'Match them; when unsure, read as String or byte[] first and inspect.'],
  ['CommitFailedException: "…not part of an active group…"', 'Processing between two poll() calls took longer than max.poll.interval.ms, so the consumer was removed.', 'Make processing faster, lower max.poll.records, or raise max.poll.interval.ms. Make processing idempotent: those records will come again.'],
]

const CONNECT = [
  ['"Failed to find any class that implements Connector and which name matches io.debezium…"', 'The plugin is not in plugin.path (or is one directory level too deep/shallow).', 'plugin.path must be the parent of debezium-connector-postgres/. Check GET /connector-plugins.'],
  ['Task FAILED: "logical decoding requires wal_level >= logical"', 'Postgres runs with wal_level=replica.', 'Set wal_level=logical and restart Postgres.'],
  ['Task FAILED: could not access file "decoderbufs"', 'plugin.name was left at its default, decoderbufs, which is not installed.', 'Set "plugin.name": "pgoutput".'],
  ['Task FAILED: permission denied to start WAL sender / to create publication', 'The connector user lacks REPLICATION, or must create a publication it is not allowed to.', 'ALTER ROLE debezium REPLICATION; create the publication as a superuser and set publication.autocreate.mode=disabled.'],
  ['Task FAILED: replication slot "shop_slot" is active for PID …', 'Two connectors (or an old one) use the same slot.name.', 'One slot per connector; stop or delete the other.'],
  ['Task FAILED after Postgres restarted', 'The replication connection broke.', 'POST /connectors/orders-cdc/restart?includeTasks=true&onlyFailed=true'],
  ['Decimal fields look like "AeIg"', 'decimal.handling.mode=precise (default) writes binary, shown as base64 in JSON.', 'Set decimal.handling.mode to string (or double).'],
  ['Connector RUNNING but no topic appears', 'No change yet (an empty table snapshots nothing), or the table is not in the publication / table.include.list.', 'Insert a row; check pg_publication_tables and the include list.'],
]

export default function Troubleshooting() {
  return (
    <>
      <p>Each row: what you see, why it happens, what to do. The messages are the real ones.</p>

      <h2>Kafka and clients</h2>
      <Table head={['You see', 'Because', 'Fix']} rows={KAFKA} />

      <h2>Connect and Debezium</h2>
      <Table head={['You see', 'Because', 'Fix']} rows={CONNECT} />
      <CodeBlock title="the error behind a FAILED task" code={`curl -s localhost:8083/connectors/orders-cdc/status | jq -r '.tasks[].trace' | head -20
docker compose logs connect | grep -E 'ERROR|Exception' | tail`} />

      <h2>The slow disaster: a forgotten slot</h2>
      <p>
        Deleting a connector leaves its replication slot. Postgres then keeps every WAL file from that point on — the disk
        fills slowly, days later. This is what it looked like on this stack after deleting a second connector:
      </p>
      <CodeBlock
        title="SELECT slot_name, plugin, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS behind FROM pg_replication_slots;"
        code={SLOTS_AFTER_DELETE}
      />
      <CodeBlock title="drop a slot nobody uses" code={`SELECT pg_drop_replication_slot('shop_flat_slot');`} />
      <Callout tone="tip" title="Health checks worth automating">
        <ul>
          <li>Every connector and task is RUNNING: <code>GET /connectors?expand=status</code>.</li>
          <li>Consumer lag per group stays bounded: <code>kafka-consumer-groups.sh --describe --all-groups</code>.</li>
          <li>No slot is inactive or far behind: the query above.</li>
        </ul>
      </Callout>
    </>
  )
}
