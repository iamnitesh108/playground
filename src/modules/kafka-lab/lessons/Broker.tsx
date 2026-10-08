import { Callout, CodeBlock, ConfigExplorer, Table } from '@/shared/ui'
import { SERVER_PROPERTIES } from '../configs/server'
import { KAFKA_STARTED } from '../transcripts'

const IN = 'docker compose exec kafka /opt/kafka/bin'
const BS = '--bootstrap-server kafka:19092'

export default function Broker() {
  return (
    <>
      <p>
        A Kafka server reads one file at start-up: <code>server.properties</code>. Create{' '}
        <code>config/server.properties</code> with the content below — use <strong>Copy file</strong> — and click
        through every line. Each one is a decision you will make again on any real cluster.
      </p>

      <ConfigExplorer file="config/server.properties" format="properties" entries={SERVER_PROPERTIES} />

      <Callout tone="tip" title="The three listeners, in one picture">
        <p>
          <code>EXTERNAL</code> (published as <code>localhost:9092</code>) is for programs on your machine.{' '}
          <code>INTERNAL</code> (<code>kafka:19092</code>) is for other containers, like Connect.{' '}
          <code>CONTROLLER</code> (<code>9093</code>) is KRaft’s own traffic. A client may connect through any listener,
          but it only works if the address the broker <em>advertises</em> for that listener is reachable from the
          client.
        </p>
      </Callout>

      <h2>Start it</h2>
      <CodeBlock title="from the kafka-lab folder" code={`docker compose up -d kafka
docker compose logs kafka | tail`} />
      <CodeBlock title="you should see" code={KAFKA_STARTED} />
      <p>
        The first line is the storage formatting from the compose <code>command</code>; on later starts it reports the
        directory as already formatted and continues.
      </p>

      <h2>Your first topic</h2>
      <CodeBlock
        title="create, inspect, write, read"
        code={`${IN}/kafka-topics.sh ${BS} --create --topic hello --partitions 3
${IN}/kafka-topics.sh ${BS} --describe --topic hello

# write three keyed records (key:value)
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh ${BS} --topic hello \\
  --reader-property parse.key=true --reader-property key.separator=: <<'EOF'
k1:first
k2:second
k1:third
EOF

# read everything, with keys and partitions (Ctrl-C to stop)
${IN}/kafka-console-consumer.sh ${BS} --topic hello --from-beginning \\
  --formatter-property print.key=true --formatter-property print.partition=true`}
      />
      <CodeBlock title="output" code={`Partition:2	k1	first
Partition:2	k1	third
Partition:0	k2	second`} />
      <p>
        Both <code>k1</code> records went to the same partition and kept their order; <code>k2</code> went elsewhere.
        Inside the containers you use <code>kafka:19092</code> (INTERNAL); from your machine, any tool uses{' '}
        <code>localhost:9092</code>.
      </p>
      <Callout tone="note" title="Flag names changed in Kafka 4.2">
        The console tools now use <code>--reader-property</code> (producer) and <code>--formatter-property</code>{' '}
        (consumer). The old <code>--property</code> still works on the consumer but prints a deprecation warning.
      </Callout>

      <h2>Without Docker</h2>
      <p>With Java 17+ installed, the same broker runs from the download:</p>
      <CodeBlock
        title="kafka_2.13-4.3.1.tgz"
        code={`curl -fLO https://downloads.apache.org/kafka/4.3.1/kafka_2.13-4.3.1.tgz   # older versions: archive.apache.org/dist/kafka/
tar xzf kafka_2.13-4.3.1.tgz && cd kafka_2.13-4.3.1

KAFKA_CLUSTER_ID="$(bin/kafka-storage.sh random-uuid)"
bin/kafka-storage.sh format --standalone -t "$KAFKA_CLUSTER_ID" -c config/server.properties
bin/kafka-server-start.sh config/server.properties`}
      />
      <Table
        head={['In server.properties', 'Change to']}
        rows={[
          ['controller.quorum.bootstrap.servers', 'localhost:9093'],
          ['listeners', 'PLAINTEXT://:9092,CONTROLLER://:9093  (one client listener is enough)'],
          ['advertised.listeners', 'PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093'],
          ['listener.security.protocol.map', 'PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT'],
          ['inter.broker.listener.name', 'PLAINTEXT'],
          ['log.dirs', 'a directory you own, e.g. /var/lib/kafka-lab'],
        ]}
      />
      <p>
        These localhost values are what the <code>config/server.properties</code> shipped in the download already
        contains. Older downloads (3.x) used <code>controller.quorum.voters=1@localhost:9093</code> instead of the
        bootstrap setting.
      </p>
    </>
  )
}
