import { Callout, CodeBlock, Tabs } from '@/shared/ui'

const BS = '--bootstrap-server localhost:9092'

export default function Cli() {
  return (
    <>
      <p>
        Kafka ships with shell scripts in its <code>bin/</code> directory (<code>kafka-topics.sh</code> and friends; on
        some systems without the <code>.sh</code>). All of them need to know where the cluster is via{' '}
        <code>--bootstrap-server</code>.
      </p>

      <h2>Run a broker locally</h2>
      <CodeBlock
        title="single-node KRaft broker with Docker"
        code={`docker run -d --name kafka -p 9092:9092 apache/kafka:latest
docker exec -it kafka /opt/kafka/bin/kafka-topics.sh ${BS} --list`}
      />

      <h2>Everyday commands</h2>
      <Tabs
        items={[
          {
            label: 'Topics',
            content: (
              <CodeBlock
                code={`kafka-topics.sh ${BS} --list
kafka-topics.sh ${BS} --describe --topic orders        # partitions, leaders, ISR
kafka-topics.sh ${BS} --create --topic orders --partitions 6 --replication-factor 3
kafka-topics.sh ${BS} --alter  --topic orders --partitions 12   # can only grow
kafka-topics.sh ${BS} --delete --topic orders
kafka-topics.sh ${BS} --describe --under-replicated-partitions`}
              />
            ),
          },
          {
            label: 'Produce',
            content: (
              <CodeBlock
                code={`# type one record per line, Ctrl-D to finish
kafka-console-producer.sh ${BS} --topic orders

# with keys: "order-42:{...}"
kafka-console-producer.sh ${BS} --topic orders \\
  --property parse.key=true --property key.separator=:`}
              />
            ),
          },
          {
            label: 'Consume',
            content: (
              <CodeBlock
                code={`# Kafka 4.2+ renames --property to --formatter-property (the old name still works, with a warning)

# from the beginning, showing keys, partitions, offsets
kafka-console-consumer.sh ${BS} --topic orders --from-beginning \\
  --property print.key=true --property print.partition=true \\
  --property print.offset=true --property print.timestamp=true

# as part of a group (commits offsets)
kafka-console-consumer.sh ${BS} --topic orders --group debug-reader

# a single partition from a given offset
kafka-console-consumer.sh ${BS} --topic orders --partition 2 --offset 1500 --max-messages 10`}
              />
            ),
          },
          {
            label: 'Groups',
            content: (
              <CodeBlock
                code={`kafka-consumer-groups.sh ${BS} --list
kafka-consumer-groups.sh ${BS} --describe --group billing    # per-partition CURRENT-OFFSET, LOG-END-OFFSET, LAG, owner
kafka-consumer-groups.sh ${BS} --describe --group billing --members --verbose
kafka-consumer-groups.sh ${BS} --describe --group billing --state

# rewind (group must be inactive); --dry-run first, then --execute
kafka-consumer-groups.sh ${BS} --group billing --topic orders \\
  --reset-offsets --to-earliest --dry-run
kafka-consumer-groups.sh ${BS} --delete --group old-group`}
              />
            ),
          },
          {
            label: 'Configs',
            content: (
              <CodeBlock
                code={`kafka-configs.sh ${BS} --describe --entity-type topics --entity-name orders
kafka-configs.sh ${BS} --alter --entity-type topics --entity-name orders \\
  --add-config retention.ms=172800000
kafka-configs.sh ${BS} --describe --entity-type brokers --entity-name 1 --all

# offsets at the ends of each partition (earliest -2, latest -1)
kafka-get-offsets.sh ${BS} --topic orders --time -1`}
              />
            ),
          },
          {
            label: 'Connect',
            content: (
              <CodeBlock
                code={`curl -s localhost:8083/                                  # worker version
curl -s localhost:8083/connector-plugins                 # installed plugins
curl -s 'localhost:8083/connectors?expand=status'        # everything at a glance
curl -s localhost:8083/connectors/orders-connector/config
curl -X PUT -H 'Content-Type: application/json' --data @c.json \\
     localhost:8083/connectors/orders-connector/config     # create or update
curl -X POST 'localhost:8083/connectors/orders-connector/restart?includeTasks=true&onlyFailed=true'
curl -X PUT  localhost:8083/connectors/orders-connector/pause
curl -X DELETE localhost:8083/connectors/orders-connector`}
              />
            ),
          },
          {
            label: 'Postgres (CDC)',
            content: (
              <CodeBlock
                code={`SHOW wal_level;                                   -- must be 'logical'

-- slots, whether someone is reading, and how much WAL each one holds back
SELECT slot_name, plugin, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag
FROM pg_replication_slots;

SELECT * FROM pg_publication_tables;              -- which tables are published
ALTER TABLE outbox REPLICA IDENTITY FULL;         -- full "before" images on update/delete
SELECT pg_drop_replication_slot('old_slot');      -- free WAL held by an unused slot`}
              />
            ),
          },
        ]}
      />

      <Callout tone="tip" title="Reading consumer group output">
        In <code>--describe --group</code>, <code>CURRENT-OFFSET</code> is the committed offset,{' '}
        <code>LOG-END-OFFSET</code> is the end of the partition, and <code>LAG</code> is the difference. A{' '}
        <code>CONSUMER-ID</code> of <code>-</code> means no live member owns that partition.
      </Callout>
    </>
  )
}
