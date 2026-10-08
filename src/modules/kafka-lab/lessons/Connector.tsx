import { Callout, CodeBlock, ConfigExplorer, Table } from '@/shared/ui'
import { CONNECTOR_CONFIG } from '../configs/connector'
import { CDC_RECORDS, CONNECTOR_STATUS } from '../transcripts'

export default function Connector() {
  return (
    <>
      <p>
        The worker is running but idle. A <strong>connector</strong> tells it what to do: “stream changes of{' '}
        <code>public.orders</code> from this Postgres into Kafka”. Its configuration is JSON, sent over REST.
      </p>

      <h2>The connector configuration</h2>
      <p>
        Keep it in version control next to your other infrastructure files — for example{' '}
        <code>/etc/kafka/connectors/orders-cdc.json</code> on the Connect server, or <code>connectors/orders-cdc.json</code>{' '}
        in the deployment repository. The database host and secrets path follow the Ubuntu layout; in the Compose stack
        they are <code>postgres</code> and <code>/etc/kafka-connect/secrets.properties</code>.
      </p>
      <ConfigExplorer file="orders-cdc.json" format="json" entries={CONNECTOR_CONFIG} />

      <h2>Register it</h2>
      <CodeBlock
        title="create (or update) the connector"
        code={`curl -s -X PUT -H 'Content-Type: application/json' \\
  --data @orders-cdc.json \\
  http://connect-1:8083/connectors/orders-cdc/config

curl -s http://connect-1:8083/connectors/orders-cdc/status`}
      />
      <p>
        <code>connect-1:8083</code> is any Connect worker (or the load balancer in front of them); in the Compose stack,{' '}
        <code>localhost:8083</code>.
      </p>
      <CodeBlock title="status" code={CONNECTOR_STATUS} />
      <p>
        <code>PUT …/config</code> takes the config object alone, creates the connector if it does not exist and updates it
        otherwise — safe to run on every deploy. (The alternative, <code>POST /connectors</code>, wants{' '}
        <code>{'{"name": …, "config": {…}}'}</code> and fails if the name exists.)
      </p>

      <h2>Make some changes</h2>
      <CodeBlock
        title="insert, update, delete"
        code={`psql -h postgres-1 -U postgres -d shop \\
  -c "INSERT INTO orders (customer, amount) VALUES ('alice', 120.50), ('bob', 75.00);" \\
  -c "UPDATE orders SET status = 'PAID' WHERE customer = 'alice';" \\
  -c "DELETE FROM orders WHERE customer = 'bob';"
# Compose: docker compose exec postgres psql -U postgres -d shop -c "…"`}
      />
      <CodeBlock
        title="read the topic"
        code={`/opt/kafka/bin/kafka-console-consumer.sh \\
  --bootstrap-server broker-1:9092 --topic shop.public.orders --from-beginning \\
  --formatter-property print.key=true --formatter-property print.offset=true \\
  --formatter-property key.separator=' | '
# Compose: docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:19092 …`}
      />
      <CodeBlock title="what Kafka received (trimmed)" code={CDC_RECORDS} />

      <h2>Reading a change event</h2>
      <Table
        head={['Part', 'Meaning']}
        rows={[
          ['key {"id":1}', 'The primary key. All changes of one row share it, so they stay in order in one partition.'],
          ['op', 'c = create (insert), u = update, d = delete, r = read during the snapshot, t = truncate'],
          ['before / after', 'The row before and after. Insert: before is null. Delete: after is null. Updates carry before only with REPLICA IDENTITY FULL.'],
          ['source', 'Where it came from: database, schema, table, transaction id (txId), WAL position (lsn), snapshot flag'],
          ['ts_ms', 'When Debezium processed the change (source.ts_ms: when the database committed it)'],
          ['offset 4 → null value', 'A tombstone after the delete, so log compaction can forget the key (tombstones.on.delete=true by default)'],
        ]}
      />
      <Callout tone="note" title="How types arrive">
        <code>amount</code> is <code>"120.50"</code> — a string, because of <code>decimal.handling.mode=string</code>.{' '}
        <code>created_at</code> (timestamptz) is an ISO-8601 string. A plain <code>timestamp</code> column would arrive as
        a number of microseconds since 1970, and a <code>jsonb</code> column as a JSON string.
      </Callout>

      <h2>What Debezium created</h2>
      <ul>
        <li>The topic <code>shop.public.orders</code> (1 partition, via <code>topic.creation.default.*</code>).</li>
        <li>The topic <code>__debezium-heartbeat.shop</code>, which gets a record every 10 s.</li>
        <li>The replication slot <code>shop_slot</code> in Postgres: <code>SELECT * FROM pg_replication_slots;</code></li>
        <li>Its position in the <code>connect-offsets</code> topic, so a restart resumes where it stopped.</li>
      </ul>
    </>
  )
}
