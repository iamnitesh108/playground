# kafka-capture

Records the three hands-on practicals of the `kafka` module against a real Kafka, so the lessons
show what the broker, the command-line tools and a Micronaut application actually printed instead
of hand-written examples. Every run uses a throwaway single-node broker (KRaft) in a container;
nothing touches an installed Kafka.

- `lib/lab.mjs` — starts and removes the broker container (`docker.io/apache/kafka:4.3.1`, host
  network, port 19092), runs the Kafka CLI tools inside it, keeps long-running console consumers
  and application instances with the time each output line arrived, and waits until a consumer
  group is stable with every partition assigned (so a snapshot is never taken between two
  rebalances).
- `orders-app/` — a small Micronaut 4.5 application, the code the lessons show:
  - `OrderProducer` — a `@KafkaClient` that sends an order with the customer as the key;
  - `SendOrders` — producer mode: sends a few orders and logs the partition and offset of each;
  - `OrderListener` — consumer mode: a `@KafkaListener` whose group comes from `app.group`;
  - environment variables select the mode, topic, group and instance name (`APP_MODE`,
    `APP_TOPIC`, `APP_GROUP`, `APP_INSTANCE`, `APP_COUNT`, `APP_FIRST_ORDER`, `KAFKA_BOOTSTRAP`).
- `capture.mjs` — runs practical 1 (a producer and a consumer), practical 2 (three partitions, one
  to four consumers in one group, a consumer stopping) and practical 3 (two groups, lag, catching
  up, resetting offsets and replaying), each first with the CLI and then with the application, and
  writes `src/modules/kafka/data/practicals.ts`. Each practical starts on a fresh broker, so topics
  and groups never leak from one into the next.

What the recordings change: the port 19092 is shown as 9092; generated member ids and
`console-consumer-…` group names are shortened; the informational banner Kafka 4.x tools print
about the new consumer rebalance protocol (KIP-848) is removed. The run fails if the output
contains the current user's name or home directory.

## Run

Needs `podman`, the `docker.io/apache/kafka:4.3.1` image, Java 17 and Gradle 8.x (recorded with Gradle 8.8
and the Micronaut Gradle plugin `io.micronaut.application` 4.4.0).

```sh
cd tools/kafka-capture/orders-app
gradle installDist                       # builds build/install/orders-app/bin/orders-app

cd ..
node capture.mjs ../../src/modules/kafka/data/practicals.ts      # ~5 minutes
```

The container `kafka-practicals` is removed when the run ends. Ids, timestamps and which consumer
a rebalance gives a partition to can differ between runs; the behaviour does not.

## What the recordings leave out

- The app runs on Micronaut 4.5.0, whose platform pulls in `kafka-clients` 3.7.0 — a 3.x client
  talking to a 4.3.1 broker (fully compatible; it uses the classic group protocol).
- For CLI commands that succeed, only standard output is kept. A console consumer stopped by
  `--timeout-ms` also prints an `ERROR … TimeoutException` line and
  `Processed a total of N messages` on standard error; these are not in the recordings.
- The `> hello` lines of the console-producer steps show what was typed (the input piped to the
  tool), not output the tool printed.

## capture-ecosystem.mjs — Schema Registry and Kafka Streams

Records the lessons *Schemas and Schema Registry* and *Kafka Streams* into
`src/modules/kafka/data/ecosystem.ts` (the recorded outputs, plus the app sources imported with `?raw`).

```sh
G=gradle   # Gradle 8.8
(cd schema-app && $G installDist) && (cd streams-app && $G installDist)
node capture-ecosystem.mjs ../../src/modules/kafka/data/ecosystem.ts
```

- Starts its own containers on the host network: `kafka-eco` (`apache/kafka:4.3.1`, ports 19692/19693, with a
  one-replica transaction log so exactly-once works) and `schema-eco` (`confluentinc/cp-schema-registry:8.0.0`, port 18085).
  Both are removed when the script exits.
- `schema-app/`: a plain Java producer/consumer with `KafkaAvroSerializer`. Records producing with `order-v1.avsc` and
  `order-v2.avsc`, the registry REST calls (subjects, versions, schema by id), the raw bytes of each record (magic byte +
  schema id), and a compatibility check and registration of an incompatible v3 (409).
- `streams-app/`: a Kafka Streams 4.3.1 app (`OrderStats`) with a filter, a count, a 10-second tumbling window count and a
  count after a key change. Records `topology.describe()`, the output topics, the internal topics and their configs,
  an interactive query, the task split when a second instance joins, and the warning for a late record.
  The orders carry fixed event times in the past, so the topics are created with `retention.ms=-1`.
- Sanitised: ports become 9092/9093/8081, UUIDs are shortened; the script refuses to write if the output contains the
  user name or home directory.

## Security and monitoring (`capture-ops.mjs`)

Records the *Security* and *Monitoring* lessons into `src/modules/kafka/data/ops.ts`. It uses its
own containers and ports, so it can run next to `capture.mjs`:

| Container   | What it is                                                                 | Ports (shown as)                                   |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| `kafka-sec` | SASL/SCRAM-SHA-512 listener, a SASL_SSL (TLS, PEM) listener, the StandardAuthorizer, deny by default | 19792 (9092), 19793 (9093), 19794 (9094) |
| `kafka-mon` | a plain broker with JMX open (`KAFKA_JMX_PORT`)                            | 19796 (9092), 19797 (9093), JMX 19799 (9999)       |

```sh
cd tools/kafka-capture
node capture-ops.mjs ../../src/modules/kafka/data/ops.ts      # ~3 minutes, needs podman and openssl
```

What it does:

- **Security** — makes a private CA and a broker certificate with `openssl` in a temporary folder
  (mounted as `/cfg`), formats the storage with `kafka-storage.sh format --add-scram` for the
  `admin` user, starts the broker, then records: a PLAINTEXT client and a wrong password failing,
  a second SCRAM user `app`, the producer denied then allowed after a WRITE ACL, the consumer
  denied on the group, then on the topic, then allowed, `kafka-acls --list`, a TLS client without
  and with the CA in its truststore, the `openssl s_client` handshake and the broker's
  `Failed authentication` log lines.
- **Monitoring** — reads the health gauges with `kafka-jmx.sh`, samples MessagesInPerSec,
  BytesInPerSec and the handler/network idle MBeans once a second while
  `kafka-producer-perf-test.sh` sends 4,000,000 records, then the Produce/Fetch request times,
  the log flush stats and the client metrics of both perf tools (`--print-metrics`). Finally a
  steady 2,000 records/s producer runs while a consumer group keeps up, stops and restarts; the
  lag is taken from `kafka-consumer-groups.sh --describe` about once a second.

What the recordings change: ports as in the table; stack-trace lines, deprecation warnings, the
KIP-848 banner and log timestamps are removed; for the failing commands only the lines naming
the error are kept; the cluster id and member ids are shortened. The run fails if the output
contains the current user's name, home directory or the temporary folder.

Notes:

- The handler idle percentage is computed from the meter's count (idle nanoseconds divided by
  the thread count) differenced once a second, not read from its `OneMinuteRate`.
- `kafka-jmx.sh` waits forever when `--attributes` names an attribute that one of the queried
  MBeans lacks, so the sampler queries all attributes.
- An under-replicated partition needs several brokers and is not recorded.
- Throughput and latencies depend on the machine; the behaviour does not.

## capture-more.mjs — everyday use, transactions, share groups

Records the "Using Kafka day to day" lesson and practicals 4 (transactions and exactly-once) and
5 (share groups) into `src/modules/kafka/data/more.ts`. It runs its own broker container,
`kafka-more`, on ports 19592/19593, so it never collides with `capture.mjs`; only `sleep` and the
image name come from `lib/lab.mjs`. The broker gets the same settings as the practicals, plus
replication factor 1 and min ISR 1 for the internal topics of transactions
(`__transaction_state`) and share groups (`__share_group_state`), which otherwise want three
brokers. Share groups need no switch: `share.version` is finalized on a new 4.3 cluster.

- `using-app/` — plain Java on `kafka-clients` 4.3.1 (no framework), one small program per task,
  each with its own `main` and reading the address from `KAFKA_BOOTSTRAP`:
  - `TopicAdmin` (create, list, describe, add partitions, change `retention.ms`, delete),
    `SendPayments` (keyed records with a header), `ReadPayments` (a group, commit after
    processing), `GroupLag`, `ResetOffsets`, `ReadAtOffset` (assign and seek);
  - `PayTransactionally` (one committed and one aborted transaction), `ReadTransfers`
    (read_uncommitted vs read_committed), `CheckTransfers` (read-process-write with
    `sendOffsetsToTransaction`);
  - `ShareWorker` (`KafkaShareConsumer`, explicit acknowledgement, one record per poll; "retry"
    jobs are released, "poison" jobs rejected, and the first attempt at a "slow" job outlives its
    15 s lock).
- Each part starts on a fresh broker. Long-running tools keep their output line by line with the
  time each line arrived (the share-group timeline uses those times).

What the recording changes: ports are shown as 9092/9093; Kafka's 22-character ids (members,
topics, cluster) are cut to 6 characters; the KIP-848 banner is removed; `kafka-dump-log.sh` and
`kafka-configs.sh --all` output is trimmed to the fields the lessons use. The run fails if the
output contains the user name, the home directory or the capture port.

```sh
cd tools/kafka-capture/using-app
gradle installDist                      # build/install/using-app/lib/*.jar

cd ..
node capture-more.mjs ../../src/modules/kafka/data/more.ts      # ~4 minutes
```

Which share consumer gets which record, and the exact timings, differ between runs; the
behaviour does not. In these runs `kafka-share-groups.sh --describe --offsets` kept showing a
START-OFFSET one below the last acknowledged record even after the consumers had stopped, with
LAG 0, so the script waits for LAG 0 rather than for a particular start offset.
