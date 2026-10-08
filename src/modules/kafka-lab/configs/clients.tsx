import type { ConfigEntry } from '@/shared/ui'

/** Producer settings, as used by PaymentProducer. */
export const PRODUCER_PROPERTIES: ConfigEntry[] = [
  {
    section: 'Required',
    key: 'bootstrap.servers',
    value: 'localhost:9092',
    explain: <p>One or more brokers to start from. The client then learns every broker from the metadata (the <em>advertised</em> listeners). From your laptop: the EXTERNAL listener.</p>,
  },
  {
    key: 'key.serializer',
    value: 'org.apache.kafka.common.serialization.StringSerializer',
    explain: <p>Turns your key object into bytes. Others: <code>LongSerializer</code>, <code>ByteArraySerializer</code>, JSON/Avro/Protobuf serializers from your framework or Schema Registry.</p>,
  },
  {
    key: 'value.serializer',
    value: 'org.apache.kafka.common.serialization.StringSerializer',
    explain: <p>Same for the value. The consumer must use the matching deserializer.</p>,
  },
  {
    section: 'Durability',
    key: 'acks',
    value: 'all',
    defaultValue: 'all',
    options: '0 | 1 | all',
    explain: <p>Wait until every in-sync replica has the record before a send counts as successful. <code>1</code> = leader only (can lose data on failover), <code>0</code> = don’t wait at all.</p>,
  },
  {
    key: 'enable.idempotence',
    value: 'true',
    defaultValue: 'true',
    explain: <p>Number batches with a producer id + sequence so the broker drops duplicates caused by the producer’s own retries. Requires <code>acks=all</code>.</p>,
  },
  {
    key: 'delivery.timeout.ms',
    value: '120000',
    defaultValue: '120000',
    explain: <p>Upper bound for a send to succeed, retries included. After it, the callback receives an error. Retries themselves are effectively unlimited within this time (<code>retries</code> = 2147483647).</p>,
  },
  {
    section: 'Throughput',
    key: 'linger.ms',
    value: '5',
    defaultValue: '5 (since Kafka 4.0; was 0)',
    explain: <p>Wait up to this long for more records to fill a batch. A few milliseconds of latency buys much fewer, larger requests.</p>,
  },
  {
    key: 'batch.size',
    value: '16384',
    defaultValue: '16384',
    explain: <p>Maximum bytes per batch, per partition. Raise (64–256 KB) for high-throughput producers.</p>,
  },
  {
    key: 'compression.type',
    value: 'none',
    defaultValue: 'none',
    options: 'none | gzip | snappy | lz4 | zstd',
    explain: <p>Compress whole batches. <code>lz4</code> or <code>zstd</code> usually cut network and disk use a lot for JSON.</p>,
  },
  {
    key: 'buffer.memory',
    value: '33554432',
    defaultValue: '33554432 (32 MB)',
    explain: <p>Memory for records waiting to be sent. When full, <code>send()</code> blocks up to <code>max.block.ms</code> (default 60 s), then throws.</p>,
  },
  {
    section: 'Identity',
    key: 'client.id',
    value: 'payment-service',
    explain: <p>A name that appears in broker logs, metrics and quotas. Optional but makes debugging much easier.</p>,
  },
]

/** Consumer settings, as used by PaymentConsumer. */
export const CONSUMER_PROPERTIES: ConfigEntry[] = [
  {
    section: 'Required',
    key: 'bootstrap.servers',
    value: 'localhost:9092',
    explain: <p>Same as the producer.</p>,
  },
  {
    key: 'group.id',
    value: 'billing',
    explain: <p>The consumer group. Members of one group share the partitions; different groups each receive every record. Committed offsets are stored under this name.</p>,
  },
  {
    key: 'key.deserializer',
    value: 'org.apache.kafka.common.serialization.StringDeserializer',
    explain: <p>Turns key bytes back into an object. Must match the producer’s serializer.</p>,
  },
  {
    key: 'value.deserializer',
    value: 'org.apache.kafka.common.serialization.StringDeserializer',
    explain: <p>Same for values. Reading JSON as a String and parsing it yourself (e.g. Jackson) is the most forgiving option.</p>,
  },
  {
    section: 'Where to start, when to commit',
    key: 'auto.offset.reset',
    value: 'earliest',
    defaultValue: 'latest',
    options: 'earliest | latest | none | by_duration:<ISO-8601>',
    explain: <p>Used only when the group has no committed offset. <code>earliest</code> reads everything still retained; the default <code>latest</code> skips existing records and only sees new ones.</p>,
  },
  {
    key: 'enable.auto.commit',
    value: 'false',
    defaultValue: 'true',
    explain: (
      <p>
        With <code>true</code>, offsets are committed in the background every <code>auto.commit.interval.ms</code> (5 s).
        With <code>false</code>, you call <code>commitSync()</code> after processing — you decide exactly what “done”
        means. That gives at-least-once delivery: make your processing safe to repeat.
      </p>
    ),
  },
  {
    section: 'Liveness',
    key: 'max.poll.records',
    value: '500',
    defaultValue: '500',
    explain: <p>Maximum records returned by one <code>poll()</code>. Lower it if processing each record is slow.</p>,
  },
  {
    key: 'max.poll.interval.ms',
    value: '300000',
    defaultValue: '300000 (5 min)',
    explain: <p>If your code does not call <code>poll()</code> again within this time, the consumer is considered stuck and removed from the group; its next commit fails with <code>CommitFailedException</code>.</p>,
  },
  {
    key: 'session.timeout.ms',
    value: '45000',
    defaultValue: '45000',
    explain: <p>A consumer that sends no heartbeat for this long is considered dead and its partitions are reassigned. Heartbeats run on a background thread every <code>heartbeat.interval.ms</code> (3 s).</p>,
  },
  {
    section: 'Optional',
    key: 'isolation.level',
    value: 'read_uncommitted',
    defaultValue: 'read_uncommitted',
    options: 'read_uncommitted | read_committed',
    explain: <p><code>read_committed</code> hides records of aborted or still-open producer transactions. Needed for exactly-once pipelines.</p>,
  },
  {
    key: 'group.instance.id',
    value: 'billing-1',
    explain: <p>Static membership: give each instance a stable id (e.g. its pod name) and a restart within <code>session.timeout.ms</code> keeps its partitions without a rebalance.</p>,
  },
]
