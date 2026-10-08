import type { ConfigEntry } from '@/shared/ui'

/** docker-compose.yml, block by block. */
export const COMPOSE_FILE: ConfigEntry[] = [
  {
    section: 'services:',
    key: 'kafka: image, hostname, ports',
    text: `  kafka:
    image: apache/kafka:4.3.1
    hostname: kafka
    ports:
      - "9092:9092"`,
    explain: (
      <p>
        The official Apache Kafka image (Java 21 inside). <code>hostname: kafka</code> is how other containers reach it.
        Only the EXTERNAL listener (9092) is published to your machine; 19092 and 9093 stay inside the Compose network.
      </p>
    ),
  },
  {
    key: 'kafka: volumes',
    text: `    volumes:
      - ./config/server.properties:/config/server.properties:ro
      - kafka-data:/var/lib/kafka/data`,
    explain: (
      <p>
        Your <code>server.properties</code> is mounted read-only. The named volume keeps topic data across{' '}
        <code>docker compose down</code> / <code>up</code> (delete it with <code>down -v</code>).
      </p>
    ),
  },
  {
    key: 'kafka: command',
    text: `    command:
      - sh
      - -c
      - |
        /opt/kafka/bin/kafka-storage.sh format --standalone --ignore-formatted \\
          --cluster-id 4L6g3nShT-eMCtK--X86sw --config /config/server.properties
        exec /opt/kafka/bin/kafka-server-start.sh /config/server.properties`,
    explain: (
      <>
        <p>
          The same two commands you would type on a laptop install. A KRaft node’s storage must be <strong>formatted</strong>{' '}
          once with a cluster id before the first start. <code>--standalone</code> makes this node the only controller
          voter; <code>--ignore-formatted</code> makes the command a no-op on later starts.
        </p>
        <p>
          The cluster id is any base64 UUID; generate your own with <code>kafka-storage.sh random-uuid</code>. A data
          directory formatted with one id refuses to start with another.
        </p>
      </>
    ),
  },
  {
    key: 'postgres',
    text: `  postgres:
    image: postgres:18
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: shop
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    command: ["postgres", "-c", "wal_level=logical", "-c", "max_wal_senders=10", "-c", "max_replication_slots=10"]
    volumes:
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro`,
    explain: (
      <p>
        <code>-c</code> flags set <code>postgresql.conf</code> values without editing the file. Files in{' '}
        <code>/docker-entrypoint-initdb.d/</code> run once, when the database is first created — re-run them by removing
        the container (no volume is used here, so data is lost on <code>down</code>).
      </p>
    ),
  },
  {
    key: 'connect',
    text: `  connect:
    image: apache/kafka:4.3.1
    hostname: connect
    depends_on: [kafka, postgres]
    ports:
      - "8083:8083"
    volumes:
      - ./config/connect-distributed.properties:/config/connect-distributed.properties:ro
      - ./plugins:/opt/connect-plugins:ro
    command: ["/opt/kafka/bin/connect-distributed.sh", "/config/connect-distributed.properties"]`,
    explain: (
      <>
        <p>
          Kafka Connect ships inside every Kafka distribution, so the same image runs it — just a different command. The
          Debezium plugin is mounted from <code>./plugins</code>.
        </p>
        <p>
          <code>depends_on</code> only orders container start-up; it does not wait for Kafka to be ready. Connect retries
          until the broker answers, so this is fine.
        </p>
      </>
    ),
  },
  {
    section: 'volumes:',
    key: 'named volume',
    text: '  kafka-data:',
    explain: <p>Declares the named volume used by the kafka service.</p>,
  },
]
