import { Callout, CodeBlock, ConfigExplorer, Table } from '@/shared/ui'
import { COMPOSE_CLUSTER, COMPOSE_SINGLE, CONNECT_DOCKERFILE } from '../configs/docker'
import { COMPOSE_HEALTHY, FAILURE_TEST, QUORUM_STATUS, RF3_TOPIC } from '../transcripts'
import own from './lesson.module.css'

export default function InstallDocker() {
  return (
    <>
      <p>
        The official <code>apache/kafka</code> image contains the same release as the download, configured through
        environment variables instead of a file. This lesson builds a complete single-host stack — Kafka, PostgreSQL and
        Kafka Connect with Debezium — and then the production layout of three controllers and three brokers. Both ran
        with Docker Compose files exactly as shown (Compose v2: <code>docker compose …</code>).
      </p>

      <h2>How the image is configured</h2>
      <Table
        head={['Property', 'Environment variable', 'Rule']}
        rows={[
          ['node.id', 'KAFKA_NODE_ID', '. becomes _'],
          ['listener.security.protocol.map', 'KAFKA_LISTENER_SECURITY_PROTOCOL_MAP', 'upper case, KAFKA_ prefix'],
          ['a_b (an underscore)', 'KAFKA_A__B', '_ becomes __'],
          ['a-b (a dash)', 'KAFKA_A___B', '- becomes ___'],
        ]}
      />
      <ul>
        <li>
          <code>CLUSTER_ID</code> — when set, the image formats an empty data directory on first start (the step you run
          by hand on a server) and skips it afterwards.
        </li>
        <li>
          A properties file can be mounted at <code>/mnt/shared/config</code> instead; environment variables override
          values in it.
        </li>
        <li>The image runs as <code>appuser</code> (uid 1000) on Alpine Linux with Java 21.</li>
      </ul>

      <h2>Single-host stack</h2>
      <div className={own.tree}>{`kafka-stack/
├── compose.yaml
├── postgres/
│   └── init.sql                        ← from the PostgreSQL lesson
└── connect/
    ├── Dockerfile                      ← Connect image with Debezium
    ├── connect-distributed.properties  ← from the Kafka Connect lesson (Compose values)
    └── secrets.properties              ← password=…  (owner uid 1000, mode 600)`}</div>
      <ConfigExplorer file="compose.yaml" format="raw" entries={COMPOSE_SINGLE} />

      <h3>The Connect image</h3>
      <ConfigExplorer file="connect/Dockerfile" format="raw" entries={CONNECT_DOCKERFILE} />

      <h3>Run it</h3>
      <CodeBlock
        code={`sudo chown 1000:1000 connect/secrets.properties && chmod 600 connect/secrets.properties
docker compose up -d --build
docker compose ps --format '{{.Name}}  {{.Status}}'`}
      />
      <CodeBlock title="after about a minute" code={COMPOSE_HEALTHY} />
      <Table
        head={['Task', 'Command']}
        rows={[
          ['Follow logs', 'docker compose logs -f kafka'],
          ['Kafka CLI', 'docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:19092 --list'],
          ['Restart one service', 'docker compose restart connect'],
          ['Upgrade', 'change the image tag, docker compose up -d (recreates that container, keeps the volume)'],
          ['Stop, keep data', 'docker compose down'],
          ['Stop and delete data', 'docker compose down -v'],
        ]}
      />
      <Callout tone="note" title="Configuration in the Connect container">
        In the Compose stack, <code>connect-distributed.properties</code> uses the container network names:{' '}
        <code>bootstrap.servers=kafka:19092</code>, <code>rest.advertised.host.name=connect</code>,{' '}
        <code>plugin.path=/opt/kafka/plugins</code>, and the secrets file is{' '}
        <code>/etc/kafka-connect/secrets.properties</code>.
      </Callout>

      <h2>Production layout: 3 controllers + 3 brokers</h2>
      <p>
        The same image, six times. In a real deployment each service runs on its own host (or as pods on different
        Kubernetes nodes); on one machine this file is a faithful rehearsal of the topology.
      </p>
      <ConfigExplorer file="compose.yaml (cluster)" format="raw" entries={COMPOSE_CLUSTER} />
      <CodeBlock
        code={`docker compose up -d
docker compose exec broker-1 /opt/kafka/bin/kafka-metadata-quorum.sh --bootstrap-server broker-1:19092 describe --status
docker compose exec broker-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server broker-1:19092 --create --topic payments
docker compose exec broker-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server broker-1:19092 --describe --topic payments`}
      />
      <CodeBlock title="quorum" code={QUORUM_STATUS} />
      <CodeBlock title="topic created with the cluster defaults" code={RF3_TOPIC} />
      <p>Then stop brokers and produce with <code>acks=all</code>:</p>
      <CodeBlock title="what happened" code={FAILURE_TEST} />
      <p>
        That is the durability contract: with replication factor 3 and <code>min.insync.replicas=2</code>, one broker can
        fail with no impact; with two gone, Kafka refuses writes rather than keep data in a single copy.
      </p>

      <Callout tone="tip" title="Kubernetes">
        On Kubernetes, run Kafka with an operator (for example Strimzi): you declare the cluster, node pools, listeners
        and Kafka Connect with plugins in custom resources, and the operator creates the pods, volumes, certificates and
        rolling restarts. Every setting in these lessons still applies.
      </Callout>
    </>
  )
}
