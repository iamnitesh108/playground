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
