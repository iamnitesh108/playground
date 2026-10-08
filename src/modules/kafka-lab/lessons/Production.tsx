import { Callout, Table } from '@/shared/ui'

export default function Production() {
  return (
    <>
      <p>
        The lab favours simplicity: one node, no security, replication factor 1. Here is what changes when data matters.
      </p>

      <h2>Durability</h2>
      <Table
        head={['Setting', 'Lab', 'Production']}
        rows={[
          ['Brokers', '1 (combined with controller)', '3+ brokers, plus 3 dedicated controllers'],
          ['default.replication.factor / internal topics RF', '1', '3'],
          ['min.insync.replicas', '1 (default)', '2 — with acks=all, any one broker can fail with no data loss'],
          ['Producer acks', 'all', 'all'],
          ['Connect storage topics RF', '1', '3'],
          ['topic.creation.default.replication.factor', '1', '3'],
        ]}
      />

      <h2>Security</h2>
      <ul>
        <li><strong>Encrypt and authenticate</strong> client and inter-broker traffic: <code>SASL_SSL</code> listeners (SCRAM, OAuth or mTLS).</li>
        <li><strong>Authorize</strong> with ACLs: each service may read and write only its own topics and groups.</li>
        <li><strong>Protect the Connect REST API</strong> — it can create connectors and reveal configs. Keep it on a private network, behind authentication.</li>
        <li><strong>No passwords in connector JSON</strong>: <code>config.providers=file</code> (or a vault provider) and <code>{'${file:/secrets/db.properties:password}'}</code>.</li>
        <li><strong>Least-privilege database user</strong>: REPLICATION plus SELECT on captured tables, publications created by an admin.</li>
      </ul>

      <h2>Topics as code</h2>
      <ul>
        <li>Keep <code>auto.create.topics.enable=false</code> and create topics from scripts or infrastructure-as-code, with chosen partitions, retention and cleanup policy.</li>
        <li>Pick partition counts for peak consumer parallelism — they can be increased later, never reduced, and increasing moves keys.</li>
      </ul>

      <h2>Formats</h2>
      <p>
        Schemaless JSON is the easiest start. For many teams sharing topics, a Schema Registry with Avro or Protobuf gives
        smaller messages and enforced, versioned schemas — switch the converters and serializers; the pipeline stays the same.
      </p>

      <h2>Watch it</h2>
      <Table
        head={['Signal', 'Why']}
        rows={[
          ['Under-replicated partitions', 'A broker is down or falling behind; durability is reduced'],
          ['Consumer lag per group', 'A consumer is slow, stuck, or stopped'],
          ['Connector / task state', 'FAILED tasks stop data without any client error'],
          ['Replication slot lag (Postgres)', 'An inactive or slow slot retains WAL until the disk fills'],
          ['Request latency, disk usage per broker', 'Capacity planning'],
        ]}
      />
      <Callout tone="note" title="Operating Kafka is a job">
        Managed services (Confluent Cloud, Amazon MSK, Aiven, Redpanda Cloud, …) run brokers, upgrades and often Connect
        for you. The concepts and client settings in this module stay exactly the same.
      </Callout>
    </>
  )
}
