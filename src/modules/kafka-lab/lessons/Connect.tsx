import { Callout, CodeBlock, ConfigExplorer, Table } from '@/shared/ui'
import { CONNECT_PROPERTIES } from '../configs/connect'
import { CONNECT_ROOT, CONNECT_TOPICS, CONNECTOR_PLUGINS } from '../transcripts'

export default function Connect() {
  return (
    <>
      <p>
        <strong>Kafka Connect</strong> is a separate Java process — a <strong>worker</strong> — that runs connectors. It
        ships with every Kafka download as <code>bin/connect-distributed.sh</code>, so the compose file starts it from
        the same image as the broker. It is configured by one properties file; connectors are added later through its
        REST API.
      </p>

      <h2>connect-distributed.properties</h2>
      <p>Create <code>config/connect-distributed.properties</code>:</p>
      <ConfigExplorer file="config/connect-distributed.properties" format="properties" entries={CONNECT_PROPERTIES} />

      <Callout tone="note" title="Distributed vs standalone">
        <code>connect-standalone.sh</code> keeps offsets in a local file and takes connector configs as command-line
        files: handy for a one-off experiment, but it cannot scale or fail over. <code>connect-distributed.sh</code> keeps
        everything in Kafka and is managed over REST — the mode you will use everywhere else, even with one worker.
      </Callout>

      <h2>Start it and check</h2>
      <CodeBlock title="start the worker" code={`docker compose up -d connect
docker compose logs -f connect        # wait for "Herder started", then Ctrl-C`} />
      <CodeBlock title="curl -s localhost:8083/" code={CONNECT_ROOT} />
      <CodeBlock
        title={`curl -s localhost:8083/connector-plugins | jq -r '.[] | "\\(.type) \\(.class) \\(.version)"'`}
        code={CONNECTOR_PLUGINS}
      />
      <p>
        If the Debezium line is missing, <code>plugin.path</code> does not point at the folder that <em>contains</em>{' '}
        <code>debezium-connector-postgres/</code>. The worker also created its three internal topics:
      </p>
      <CodeBlock title="docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:19092 --describe --exclude-internal" code={CONNECT_TOPICS} />

      <h2>The REST API you will use</h2>
      <Table
        head={['Request', 'Does']}
        rows={[
          ['GET /connectors?expand=status', 'All connectors with their state'],
          ['PUT /connectors/{name}/config', 'Create or update a connector (idempotent: 201 created, 200 updated)'],
          ['GET /connectors/{name}/status', 'Connector and task states, with the error trace if FAILED'],
          ['POST /connectors/{name}/restart?includeTasks=true&onlyFailed=true', 'Restart what failed'],
          ['PUT /connectors/{name}/pause, …/resume', 'Stop and resume reading without deleting'],
          ['DELETE /connectors/{name}', 'Remove the connector (its replication slot stays in Postgres)'],
          ['GET /connector-plugins', 'Installed connector plugins'],
        ]}
      />

      <h2>Without Docker</h2>
      <CodeBlock
        title="from the Kafka download folder"
        code={`# in connect-distributed.properties: bootstrap.servers=localhost:9092, rest.advertised.host.name=localhost,
# plugin.path=/absolute/path/to/kafka-lab/plugins
bin/connect-distributed.sh /path/to/kafka-lab/config/connect-distributed.properties`}
      />
    </>
  )
}
