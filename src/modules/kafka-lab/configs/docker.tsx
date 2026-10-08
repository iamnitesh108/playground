import type { ConfigEntry } from '@/shared/ui'

/* Container files. Each block is exactly what was run with Kafka 4.3.1, Postgres 18 and Debezium 3.7.0. */

export const COMPOSE_SINGLE: ConfigEntry[] = [
  {
    key: 'project name',
    text: 'name: kafka-stack',
    explain: <p>Prefix for container, network and volume names, so several stacks on one host do not collide.</p>,
  },
  {
    section: '\nservices:',
    key: 'kafka: image and ports',
    text: `  kafka:
    image: apache/kafka:4.3.1
    hostname: kafka
    restart: unless-stopped
    ports:
      - "9092:9092"`,
    explain: (
      <p>
        The official Apache image (Alpine Linux, Java 21, runs as <code>appuser</code>, uid 1000). Pin an exact version —
        never <code>latest</code> — so every node runs the same release. Only the EXTERNAL listener is published to the
        host; INTERNAL and CONTROLLER stay on the compose network.
      </p>
    ),
  },
  {
    key: 'kafka: identity and listeners',
    text: `    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:19092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER`,
    explain: (
      <>
        <p>
          The image turns every <code>KAFKA_*</code> variable into a <code>server.properties</code> line:{' '}
          <code>KAFKA_</code> is dropped, <code>_</code> becomes <code>.</code>, <code>__</code> becomes <code>_</code>,{' '}
          <code>___</code> becomes <code>-</code>, and the name is lower-cased. <code>KAFKA_NODE_ID</code> →{' '}
          <code>node.id</code>.
        </p>
        <p>
          Two client listeners because two kinds of clients exist: containers on the compose network must be sent{' '}
          <code>kafka:19092</code>, programs on the host must be sent <code>localhost:9092</code>. On a server, replace{' '}
          <code>localhost</code> with the host’s DNS name.
        </p>
      </>
    ),
  },
  {
    key: 'kafka: cluster id and storage',
    text: `      CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
      KAFKA_LOG_DIRS: /var/lib/kafka/data`,
    explain: (
      <p>
        With <code>CLUSTER_ID</code> set, the image formats the storage directory automatically on first start and leaves
        it alone afterwards (tested: data survived restarts). Generate your own id once with{' '}
        <code>docker run --rm --entrypoint /opt/kafka/bin/kafka-storage.sh apache/kafka:4.3.1 random-uuid</code> and keep
        it: a volume formatted with one id refuses to start with another.
      </p>
    ),
  },
  {
    key: 'kafka: topic defaults',
    text: `      KAFKA_NUM_PARTITIONS: 3
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_SHARE_COORDINATOR_STATE_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_SHARE_COORDINATOR_STATE_TOPIC_MIN_ISR: 1`,
    explain: (
      <p>
        Single node, so internal topics get one replica (the defaults of 3 cannot be met). Quote <code>"false"</code>:
        unquoted, YAML turns it into a boolean.
      </p>
    ),
  },
  {
    key: 'kafka: heap, volume, health',
    text: `      KAFKA_HEAP_OPTS: -Xms1g -Xmx1g
    volumes:
      - kafka-data:/var/lib/kafka/data
    healthcheck:
      test: ["CMD-SHELL", "/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 > /dev/null 2>&1"]
      interval: 10s
      timeout: 10s
      retries: 10
      start_period: 20s`,
    explain: (
      <p>
        A named volume keeps data when the container is recreated. The health check asks the broker for its API versions
        — it succeeds only when the broker really accepts requests, which other services wait for.
      </p>
    ),
  },
  {
    key: 'postgres',
    text: `  postgres:
    image: postgres:18
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: shop
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: change-me
    command: ["postgres", "-c", "wal_level=logical", "-c", "max_wal_senders=10", "-c", "max_replication_slots=10"]
    volumes:
      - pg-data:/var/lib/postgresql
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/10-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d shop"]
      interval: 10s
      timeout: 5s
      retries: 10`,
    explain: (
      <>
        <p>
          <code>-c name=value</code> sets server parameters without editing <code>postgresql.conf</code>. Scripts in{' '}
          <code>/docker-entrypoint-initdb.d/</code> run once, when the data directory is empty.
        </p>
        <p>
          Postgres 18 images keep data under <code>/var/lib/postgresql/18/docker</code>, so mount the parent{' '}
          <code>/var/lib/postgresql</code> (older images used <code>/var/lib/postgresql/data</code>).
        </p>
      </>
    ),
  },
  {
    key: 'connect: build and wait',
    text: `  connect:
    build: ./connect
    image: kafka-connect-debezium:4.3.1-3.7.0
    hostname: connect
    restart: unless-stopped
    depends_on:
      kafka:
        condition: service_healthy
      postgres:
        condition: service_healthy
    ports:
      - "8083:8083"`,
    explain: (
      <p>
        Built from <code>connect/Dockerfile</code> (next file) and tagged with both versions it contains.{' '}
        <code>condition: service_healthy</code> starts Connect only after the Kafka and Postgres health checks pass —
        plain <code>depends_on</code> would only wait for the containers to exist.
      </p>
    ),
  },
  {
    key: 'connect: config, secrets, health',
    text: String.raw`    environment:
      KAFKA_HEAP_OPTS: -Xms512m -Xmx1g
    volumes:
      - ./connect/connect-distributed.properties:/etc/kafka-connect/connect-distributed.properties:ro
      - ./connect/secrets.properties:/etc/kafka-connect/secrets.properties:ro
    healthcheck:
      test: ["CMD", "bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8083 && printf 'GET / HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q ' 200 ' <&3"]
      interval: 10s
      timeout: 5s
      retries: 20`,
    explain: (
      <>
        <p>
          Configuration and secrets are mounted, not baked into the image: the same image runs in every environment.
          The secrets file must be readable by uid 1000 (<code>sudo chown 1000:1000 connect/secrets.properties</code>,{' '}
          <code>chmod 600</code>).
        </p>
        <p>
          The image has no <code>curl</code>, so the health check speaks HTTP through bash’s built-in{' '}
          <code>/dev/tcp</code> and looks for a 200 status from the REST API.
        </p>
      </>
    ),
  },
  {
    section: '\nvolumes:',
    key: 'named volumes',
    text: `  kafka-data:
  pg-data:`,
    explain: <p>Declares the volumes. <code>docker compose down</code> keeps them; <code>down -v</code> deletes them.</p>,
  },
]

export const CONNECT_DOCKERFILE: ConfigEntry[] = [
  {
    section: '# Stage 1: download the connector plugin and verify its checksum.',
    key: 'download stage',
    text: `FROM curlimages/curl:8.16.0 AS plugins
ARG DEBEZIUM_VERSION=3.7.0.Final
ARG MAVEN=https://repo1.maven.org/maven2/io/debezium/debezium-connector-postgres
WORKDIR /tmp/plugins`,
    explain: (
      <p>
        A throw-away build stage with <code>curl</code>, <code>sha1sum</code> and <code>tar</code>. Nothing from it
        reaches the final image except what is copied explicitly. The versions are build arguments, so upgrading is{' '}
        <code>--build-arg DEBEZIUM_VERSION=…</code>.
      </p>
    ),
  },
  {
    key: 'download, verify, unpack',
    text: `RUN curl -fsSLO "$MAVEN/$DEBEZIUM_VERSION/debezium-connector-postgres-$DEBEZIUM_VERSION-plugin.tar.gz" \\
 && echo "$(curl -fsSL "$MAVEN/$DEBEZIUM_VERSION/debezium-connector-postgres-$DEBEZIUM_VERSION-plugin.tar.gz.sha1")  debezium-connector-postgres-$DEBEZIUM_VERSION-plugin.tar.gz" | sha1sum -c - \\
 && tar xzf "debezium-connector-postgres-$DEBEZIUM_VERSION-plugin.tar.gz" \\
 && rm "debezium-connector-postgres-$DEBEZIUM_VERSION-plugin.tar.gz"`,
    explain: (
      <p>
        The plugin archive comes from Maven Central and is checked against its published SHA-1 before unpacking — a
        corrupted or tampered download fails the build. <code>curl -f</code> makes HTTP errors fatal.
      </p>
    ),
  },
  {
    section: '\n# Stage 2: the same Kafka version as the brokers, plus the plugin. Nothing else is installed.',
    key: 'runtime image',
    text: `FROM apache/kafka:4.3.1
COPY --from=plugins /tmp/plugins /opt/kafka/plugins
EXPOSE 8083
CMD ["/opt/kafka/bin/connect-distributed.sh", "/etc/kafka-connect/connect-distributed.properties"]`,
    explain: (
      <>
        <p>
          Kafka Connect ships inside every Kafka distribution, so the official Kafka image is the base — same version as
          the brokers. Baking the plugin in makes the image immutable: what was tested is what runs.
        </p>
        <p>
          The alternative is Debezium’s own image, <code>quay.io/debezium/connect:3.7.0.Final</code>, configured with
          variables such as <code>BOOTSTRAP_SERVERS</code>, <code>GROUP_ID</code>, <code>CONFIG_STORAGE_TOPIC</code>,{' '}
          <code>OFFSET_STORAGE_TOPIC</code>, <code>STATUS_STORAGE_TOPIC</code> and <code>CONNECT_*</code> for any other
          worker property (from its entrypoint script; not run in this module’s tests).
        </p>
      </>
    ),
  },
]

export const COMPOSE_CLUSTER: ConfigEntry[] = [
  {
    key: 'project and shared settings',
    text: `name: kafka-cluster

x-kafka-common: &kafka-common
  image: apache/kafka:4.3.1
  restart: unless-stopped

x-kafka-env: &kafka-env
  CLUSTER_ID: 4L6g3nShT-eMCtK--X86sw
  KAFKA_CONTROLLER_QUORUM_VOTERS: 1@controller-1:9093,2@controller-2:9093,3@controller-3:9093
  KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
  KAFKA_LOG_DIRS: /var/lib/kafka/data
  KAFKA_HEAP_OPTS: -Xms512m -Xmx512m
  # Topic defaults and durability: in KRaft the controllers apply these, so set them on every node.
  KAFKA_DEFAULT_REPLICATION_FACTOR: 3
  KAFKA_MIN_INSYNC_REPLICAS: 2
  KAFKA_NUM_PARTITIONS: 6
  KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"`,
    explain: (
      <>
        <p>
          YAML anchors (<code>&amp;kafka-env</code>) hold the settings every node shares; each service merges them with{' '}
          <code>{'<<: *kafka-env'}</code>. All six nodes share one <code>CLUSTER_ID</code> and the same voter list.
        </p>
        <p>
          The topic defaults sit here, on <strong>every</strong> node, on purpose. With them only on the brokers, a topic
          created with <code>kafka-topics.sh</code> got replication factor 1 — the controller’s default — and lost its
          only leader when one broker stopped.
        </p>
      </>
    ),
  },
  {
    key: 'broker settings',
    text: `x-broker-env: &broker-env
  <<: *kafka-env
  KAFKA_PROCESS_ROLES: broker
  KAFKA_LISTENERS: INTERNAL://:19092,EXTERNAL://:9092
  KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT
  KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL`,
    explain: <p>What the three brokers share on top of the common settings: role, listeners and replication listener.</p>,
  },
  ...[1, 2, 3].map(
    (n): ConfigEntry => ({
      section: n === 1 ? '\nservices:' : undefined,
      key: `controller-${n}`,
      text: `  controller-${n}:
    <<: *kafka-common
    hostname: controller-${n}
    environment:
      <<: *kafka-env
      KAFKA_NODE_ID: ${n}
      KAFKA_PROCESS_ROLES: controller
      KAFKA_LISTENERS: CONTROLLER://:9093
    volumes:
      - controller-${n}-data:/var/lib/kafka/data`,
      explain: <p>Controller {n}: only the CONTROLLER listener, no published ports — clients never talk to controllers.</p>,
    }),
  ),
  ...[1, 2, 3].map(
    (n): ConfigEntry => ({
      key: `broker-${n}`,
      text: `  broker-${n}:
    <<: *kafka-common
    hostname: broker-${n}
    depends_on: [controller-1, controller-2, controller-3]
    ports:
      - "${n}9092:9092"
    environment:
      <<: *broker-env
      KAFKA_NODE_ID: ${n + 3}
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://broker-${n}:19092,EXTERNAL://localhost:${n}9092
    volumes:
      - broker-${n}-data:/var/lib/kafka/data`,
      explain: (
        <p>
          Broker {n} (node id {n + 3}). Each broker advertises its own address; on the host it is reached on port{' '}
          {n}9092, so <code>bootstrap.servers=localhost:19092,localhost:29092,localhost:39092</code>.
        </p>
      ),
    }),
  ),
  {
    section: '\nvolumes:',
    key: 'volumes',
    text: `  controller-1-data:
  controller-2-data:
  controller-3-data:
  broker-1-data:
  broker-2-data:
  broker-3-data:`,
    explain: <p>One volume per node. In real deployments each broker volume is a dedicated disk.</p>,
  },
]
