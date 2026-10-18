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

## capture-keys.mjs — record keys and partitioning

Records the "Record keys and partitioning" lesson into `src/modules/kafka/data/keys.ts`. It runs
its own broker container, `kafka-keys`, on ports 19492/19493 (same settings as the practicals),
so it never collides with the other scripts; only `sleep` and the image name come from
`lib/lab.mjs`. It imports the lesson's TypeScript murmur2 partitioner
(`src/modules/kafka/simulation/murmur2.ts`, Node 22.6+ strips the types) and fails if a keyed
record recorded on the broker landed anywhere else than that partitioner predicts.

- `keys-app/` — plain Java on `kafka-clients` 4.3.1, one small program per experiment:
  - `SendKeyed` (keyed records, the partition computed by hand with `Utils.murmur2`, and one
    record with an explicit partition);
  - `Spread` (records without a usable key: `null`, empty `""`, keys with
    `partitioner.ignore.keys=true`, and `RoundRobinPartitioner`; prints runs of consecutive
    records per partition);
  - `KeyFormats` (the id 42 as String, Integer, Long and two JSON spellings);
  - `TenantPartitioner` + `SendTenants` (a custom partitioner hashing the tenant part of a
    `tenant:order` key);
  - `SendStatuses` (3,000 events keyed by status or by order id) and `SlowWorker` (a group member
    taking 5 ms per record), for skew and consumer lag.
- The CLI parts: console producer with `parse.key` / `key.separator` / `null.marker`, console
  consumer with `print.partition` / `print.key` / `print.offset`, `kafka-dump-log.sh` for the
  stored key sizes, `kafka-topics.sh --alter --partitions` to move keys, and a compacted topic
  (`segment.ms=100`, `min.cleanable.dirty.ratio=0.01`) for the rejected key-less record and a
  compaction before/after.

What the recording changes: ports are shown as 9092/9093; Kafka's 22-character ids are cut to 6
characters; stack-trace lines and the KIP-848 banner are removed; the console producer's error
keeps its first two lines without the log timestamp; `kafka-dump-log.sh` keeps offset, key and
value sizes; `kafka-consumer-groups.sh --describe` drops the CONSUMER-ID and HOST columns and is
sorted by partition; the remapped topic's records are sorted by customer. The run fails if the
output contains the user name, the home directory or the capture port.

```sh
cd tools/kafka-capture/keys-app
gradle installDist                      # build/install/keys-app/lib/*.jar

cd ..
node capture-keys.mjs ../../src/modules/kafka/data/keys.ts      # ~2 minutes
```

Which partitions the sticky partitioner picks is random and differs between runs; the run
lengths (all records on one partition with the default `batch.size`, 16-record runs with
`batch.size=1024`) and everything keyed do not. librdkafka's default `consistent_random`
partitioner is described in the lesson but not recorded (no librdkafka client in the lab).

## capture-segments.mjs — segments: the log on disk

Records the lesson *Segments: the log on disk* into `src/modules/kafka/data/segments.ts`. Uses its own
container `kafka-segments` (ports 19892/19893) with `log.retention.check.interval.ms=1000`, so the
retention step takes seconds instead of minutes; the container is removed when the script exits.

- A one-partition topic `payments` with `segment.bytes=1048576` (the minimum; `4096` is recorded being
  refused), 3000 records of 1000 bytes from `kafka-producer-perf-test.sh`, and `ls -l` of the
  partition directory before and after.
- `kafka-dump-log.sh` of the first segment's `.log`, `.index` and `.timeindex`; the lookup of offset
  1500 (segment, index entries around it, the batches from the entry's position, and a console
  consumer started at `--offset 1500`).
- `segment.ms=10000` on topic `clicks`: three records, 13 seconds without writes (still one segment),
  two more records (the roll).
- Retention: 600 new records, then `retention.ms=10000` — the segments holding only old records are
  renamed to `.deleted`, the mixed one stays and becomes the log start; 12 seconds later every record
  has expired and Kafka rolls an empty segment before deleting the old active one.
- Checks: an index entry is 8 bytes, and the lesson's model (`simulation/segmentedLog.ts`) fed the
  recorded batches builds the same offset index and rolls at the same offset as the broker.

What the recording changes: ports are shown as 9092/9093 and `/opt/kafka/bin/` is left out of the
commands; `kafka-dump-log.sh` batch lines keep base and last offset, count, position, CreateTime and
size, and long dumps are cut with a `…` line saying how much was left out. The run fails if the output
contains the user name, the home directory or the capture port.

```sh
cd tools/kafka-capture
node capture-segments.mjs ../../src/modules/kafka/data/segments.ts      # ~1 minute
```

Throughput figures, timestamps and where the 600 extra records roll (by batch boundaries) differ
between runs; the file layout and the rules do not.

## capture-compaction.mjs — log compaction internals

Records the lesson *Log compaction internals* into `src/modules/kafka/data/compaction.ts`. Uses its own
container `kafka-compaction` (ports 20092/20093) with `log.cleaner.backoff.ms=1000`, so the cleaner looks for
work every second instead of every 15; the container is removed when the script exits. The facts the lesson
states come from the Kafka 4.3.1 source (`LogCleaner`, `Cleaner`, `LogCleanerManager`, `SkimpyOffsetMap`,
`CleanerConfig`, `LogConfig`) and `docs/design/design.md`; this script only records what they predict.

- Topic `profiles`, one partition, `segment.ms=2000`, written in three rounds 2.5 s apart (one segment each)
  with the console producer (`parse.key`, `null.marker=NULL` for a tombstone), first as a `delete` topic.
- `kafka-configs.sh --alter` to `cleanup.policy=compact`, `min.cleanable.dirty.ratio=0.01`,
  `delete.retention.ms=5000`; the script waits until `cleaner-offset-checkpoint` says `profiles 0 6`.
- 8 s later one more write rolls the active segment; it waits for `profiles 0 8` (the second cleaning,
  which drops the superseded record and the tombstone past its delete horizon).
- At each stage: `ls -l` of the partition, `kafka-dump-log.sh --print-data-log` of every `.log` (shortened to
  batch offsets, count and `deleteHorizonMs`, and record offset, key and payload), a console consumer from the
  beginning, and the checkpoint file; at the end the summary lines of `log-cleaner.log`.
- Checks: the lesson's model (`simulation/logCompactor.ts`), fed the same records and times, keeps exactly the
  offsets the consumer read after each cleaning, and the first cleaning set a delete horizon.

What the recording changes: ports are shown as 9092/9093, `/opt/kafka/bin/` is left out of the commands,
the topic id in the cleaner log is cut to 6 characters, and log timestamps are removed. The run fails if
the output contains the user name, the home directory or the capture port.

```sh
cd tools/kafka-capture
node capture-compaction.mjs ../../src/modules/kafka/data/compaction.ts      # ~1 minute
```

When the cleaner starts after the switch to `compact`, and therefore the exact times, differ between runs;
which offsets survive each cleaning does not.
