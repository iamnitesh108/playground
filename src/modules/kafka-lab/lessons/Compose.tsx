import { Callout, CodeBlock, ConfigExplorer, Table } from '@/shared/ui'
import { COMPOSE_FILE } from '../configs/compose'
import own from './lesson.module.css'

export default function Compose() {
  return (
    <>
      <p>
        Everything lives in one folder. Create it now; the next lessons fill in each file and explain it.
      </p>
      <div className={own.tree}>{`kafka-lab/
├── docker-compose.yml                  ← this lesson
├── config/
│   ├── server.properties               ← the broker (next lesson)
│   └── connect-distributed.properties  ← the Connect worker
├── postgres/
│   └── init.sql                        ← table, CDC user, publication
├── plugins/
│   └── debezium-connector-postgres/    ← Debezium JARs, unpacked
├── connectors/
│   └── orders-cdc.json                 ← the connector configuration
└── app/                                ← the Java examples (Gradle)`}</div>
      <CodeBlock
        title="create the skeleton"
        code={`mkdir -p kafka-lab/{config,postgres,plugins,connectors,app} && cd kafka-lab`}
      />

      <h2>Get the Debezium plugin</h2>
      <p>
        Kafka Connect does not include Debezium. Download the Postgres connector archive from Maven Central, check it, and
        unpack it into <code>plugins/</code>:
      </p>
      <CodeBlock
        title="download, verify and unpack Debezium 3.7.0"
        code={`V=3.7.0.Final
BASE=https://repo1.maven.org/maven2/io/debezium/debezium-connector-postgres/$V
curl -fLO "$BASE/debezium-connector-postgres-$V-plugin.tar.gz"
echo "$(curl -fsSL "$BASE/debezium-connector-postgres-$V-plugin.tar.gz.sha1")  debezium-connector-postgres-$V-plugin.tar.gz" | sha1sum -c -
tar xzf debezium-connector-postgres-$V-plugin.tar.gz -C plugins/
ls plugins/debezium-connector-postgres/ | head     # debezium-connector-postgres-3.7.0.Final.jar, postgresql-42.7.13.jar, …`}
      />
      <p className={own.note}>
        The archive bundles the Postgres JDBC driver and Debezium’s transforms (such as <code>ExtractNewRecordState</code>
        ), so nothing else is needed.
      </p>

      <h2>docker-compose.yml</h2>
      <p>Three services. Click each block to see what it does:</p>
      <ConfigExplorer file="docker-compose.yml" format="raw" entries={COMPOSE_FILE} />

      <h2>Running it</h2>
      <p>You will start services one at a time in the next lessons, but these are the commands you will use:</p>
      <Table
        head={['Command', 'Does']}
        rows={[
          ['docker compose up -d kafka', 'Start one service in the background'],
          ['docker compose up -d', 'Start everything'],
          ['docker compose ps', 'What is running'],
          ['docker compose logs -f connect', 'Follow one service’s log'],
          ['docker compose exec kafka bash', 'A shell inside the Kafka container (the CLI tools are in /opt/kafka/bin)'],
          ['docker compose down', 'Stop and remove containers (Kafka data stays in the volume)'],
          ['docker compose down -v', 'Also delete the volume: a completely fresh start'],
        ]}
      />
      <Callout tone="note" title="Ports already in use?">
        Change the left side of a mapping, e.g. <code>"15432:5432"</code>, and connect to the new host port. 9092 is different: the broker <em>advertises</em>{' '}
        <code>localhost:9092</code>, so pick a new port, use it on <em>both</em> sides of the mapping, and put it in the{' '}
        EXTERNAL entries of <code>listeners</code> and <code>advertised.listeners</code>.
      </Callout>
    </>
  )
}
