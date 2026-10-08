import { Callout, CodeBlock, ConfigExplorer, Table, Tabs } from '@/shared/ui'
import { CONNECT_PROPERTIES } from '../configs/connect'
import { CONNECT_UNIT } from '../configs/os'
import { CONNECT_TOPICS, CONNECTOR_PLUGINS } from '../transcripts'

function OnUbuntu() {
  return (
    <>
      <p>
        Connect is part of every Kafka release, so a Connect server is installed exactly like a Kafka server — Java, the{' '}
        <code>kafka</code> user, <code>/opt/kafka</code> (steps 1–4 of the Ubuntu lesson) — without formatting any storage.
        It can also share a machine with a broker in small setups.
      </p>
      <CodeBlock
        title="plugin, log directory, secrets"
        code={`DBZ=3.7.0.Final
BASE=https://repo1.maven.org/maven2/io/debezium/debezium-connector-postgres/$DBZ
sudo mkdir -p /opt/kafka-connect/plugins /var/log/kafka-connect
cd /tmp
curl -fsSLO "$BASE/debezium-connector-postgres-$DBZ-plugin.tar.gz"
echo "$(curl -fsSL "$BASE/debezium-connector-postgres-$DBZ-plugin.tar.gz.sha1")  debezium-connector-postgres-$DBZ-plugin.tar.gz" | sha1sum -c -
sudo tar -xzf "debezium-connector-postgres-$DBZ-plugin.tar.gz" -C /opt/kafka-connect/plugins
sudo chown kafka:kafka /var/log/kafka-connect && sudo chmod 750 /var/log/kafka-connect

# the database password, readable by the service only (an editor keeps it out of shell history)
sudoedit /etc/kafka/connect-secrets.properties          # one line: password=…
sudo chown root:kafka /etc/kafka/connect-secrets.properties
sudo chmod 640 /etc/kafka/connect-secrets.properties`}
      />
      <p>
        Write <code>/etc/kafka/connect-distributed.properties</code> (above) with the same ownership and mode, then the
        unit:
      </p>
      <ConfigExplorer file="/etc/systemd/system/kafka-connect.service" format="raw" entries={CONNECT_UNIT} />
      <CodeBlock
        code={`sudo systemctl daemon-reload
sudo systemctl enable --now kafka-connect
curl -s localhost:8083/ | jq          # {"version":"4.3.1", …, "kafka_cluster_id":"…"}`}
      />
      <p>Open port 8083 only to the hosts that manage connectors and to the other Connect workers.</p>
    </>
  )
}

function InDocker() {
  return (
    <>
      <p>
        The Docker lesson builds an image from <code>apache/kafka:4.3.1</code> with the Debezium plugin in{' '}
        <code>/opt/kafka/plugins</code> and mounts this properties file and the secrets file into the container. Values
        that differ in the container:
      </p>
      <Table
        head={['Setting', 'Ubuntu server', 'Compose stack']}
        rows={[
          ['bootstrap.servers', 'broker-1:9092,broker-2:9092,…', 'kafka:19092'],
          ['rest.advertised.host.name', 'the host’s DNS name', 'connect'],
          ['plugin.path', '/opt/kafka-connect/plugins', '/opt/kafka/plugins'],
          ['secrets file', '/etc/kafka/connect-secrets.properties', '/etc/kafka-connect/secrets.properties'],
          ['heap', 'Environment= in the unit', 'KAFKA_HEAP_OPTS in compose.yaml'],
        ]}
      />
    </>
  )
}

export default function ConnectWorker() {
  return (
    <>
      <p>
        <strong>Kafka Connect</strong> runs connectors — plugins that copy data between Kafka and other systems. A{' '}
        <strong>worker</strong> is one Connect JVM; in <strong>distributed mode</strong> workers sharing a{' '}
        <code>group.id</code> form a cluster that keeps all its state in Kafka topics and is managed over a REST API.
        Distributed mode is what you run everywhere, even with a single worker.
      </p>

      <h2>connect-distributed.properties</h2>
      <ConfigExplorer file="/etc/kafka/connect-distributed.properties" format="properties" entries={CONNECT_PROPERTIES} />

      <h2>Install and start</h2>
      <Tabs items={[{ label: 'Ubuntu', content: <OnUbuntu /> }, { label: 'Docker', content: <InDocker /> }]} />

      <h2>Check it</h2>
      <CodeBlock title={`curl -s localhost:8083/connector-plugins | jq -r '.[] | "\\(.type) \\(.class) \\(.version)"'`} code={CONNECTOR_PLUGINS} />
      <p>
        If Debezium is missing, <code>plugin.path</code> does not point to the directory that <em>contains</em>{' '}
        <code>debezium-connector-postgres/</code>. On first start the worker also created its storage topics:
      </p>
      <CodeBlock title="kafka-topics.sh --describe --exclude-internal (connect topics)" code={CONNECT_TOPICS} />

      <h2>More than one worker</h2>
      <ul>
        <li>Start the same configuration on two or more hosts — same <code>group.id</code> and storage topic names, each with its own <code>rest.advertised.host.name</code>.</li>
        <li>Workers share connectors and tasks; if one dies, its tasks move to the others (after <code>scheduled.rebalance.max.delay.ms</code>, 5 minutes by default, in case it comes back).</li>
        <li>Use replication factor 3 for the three storage topics once there are 3 brokers.</li>
        <li>Put a load balancer in front of port 8083, or call any worker — requests are forwarded to the right one.</li>
      </ul>
      <Callout tone="warn" title="The REST API is powerful">
        Anyone who can reach port 8083 can create connectors and read their configuration. Keep it on a private network,
        restrict it in the firewall, and use config providers so secrets never appear in connector configs.
      </Callout>
    </>
  )
}
