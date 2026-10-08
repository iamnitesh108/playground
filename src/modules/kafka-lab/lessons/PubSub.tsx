import { Callout, CodeBlock, Tabs } from '@/shared/ui'
import { BUILD_GRADLE, PAYMENT_CONSUMER_JAVA, PAYMENT_PRODUCER_JAVA, SETTINGS_GRADLE } from '../code'
import { CONSUMER_OUTPUT, GROUP_DESCRIBE, PRODUCER_OUTPUT } from '../transcripts'

export default function PubSub() {
  return (
    <>
      <p>
        In pub-sub, your code decides what an event is and sends it. Here a payment service publishes payments to the
        topic <code>payments</code>, and a billing service consumes them. Both connect from your machine through{' '}
        <code>localhost:9092</code>.
      </p>

      <h2>The project</h2>
      <CodeBlock title="create the topic first (auto-creation is off)" code={`docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \\
  --bootstrap-server kafka:19092 --create --topic payments --partitions 3`} />
      <Tabs
        items={[
          { label: 'build.gradle', content: <CodeBlock title="app/build.gradle" code={BUILD_GRADLE} /> },
          { label: 'settings.gradle', content: <CodeBlock title="app/settings.gradle" code={SETTINGS_GRADLE} /> },
          {
            label: 'Maven',
            content: (
              <CodeBlock
                title="pom.xml dependencies (same artifacts)"
                code={`<dependency>
  <groupId>org.apache.kafka</groupId>
  <artifactId>kafka-clients</artifactId>
  <version>4.3.1</version>
</dependency>
<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
  <version>2.21.2</version>
</dependency>
<dependency>
  <groupId>org.slf4j</groupId>
  <artifactId>slf4j-simple</artifactId>
  <version>2.0.17</version>
  <scope>runtime</scope>
</dependency>`}
              />
            ),
          },
        ]}
      />
      <p>Sources go in <code>app/src/main/java/com/example/shop/</code>.</p>

      <h2>The producer</h2>
      <CodeBlock title="PaymentProducer.java" code={PAYMENT_PRODUCER_JAVA} />
      <ul>
        <li><code>new ProducerRecord&lt;&gt;("payments", orderId, json)</code> — topic, key, value. The key picks the partition.</li>
        <li><code>send()</code> returns immediately; the callback runs when the broker has acknowledged (or the send failed for good).</li>
        <li><code>flush()</code> waits for everything in flight; closing the producer (try-with-resources) does too. Forgetting both loses the last batch.</li>
      </ul>
      <CodeBlock title="cd app && gradle run" code={PRODUCER_OUTPUT} />
      <p>
        Each key always lands on the same partition — <code>order-1</code> on 1, <code>order-2</code> and{' '}
        <code>order-3</code> on 0 — and the callbacks arrive batch by batch per partition, not in send order. Partition 2
        stayed empty: three keys over three partitions do not spread evenly.
      </p>

      <h2>The consumer</h2>
      <CodeBlock title="PaymentConsumer.java" code={PAYMENT_CONSUMER_JAVA} />
      <ul>
        <li><code>subscribe()</code> joins the group <code>billing</code>; Kafka assigns it partitions.</li>
        <li><code>poll()</code> returns up to <code>max.poll.records</code> records; call it again within <code>max.poll.interval.ms</code>.</li>
        <li><code>commitSync()</code> after processing: a crash before it means those records are delivered again (at-least-once).</li>
        <li><code>wakeup()</code> from the shutdown hook makes <code>poll()</code> throw, so <code>close()</code> runs and the consumer leaves the group immediately instead of after <code>session.timeout.ms</code>.</li>
      </ul>
      <CodeBlock title="gradle run -Pmain=com.example.shop.PaymentConsumer" code={CONSUMER_OUTPUT} />
      <CodeBlock title="after Ctrl-C: kafka-consumer-groups.sh --bootstrap-server kafka:19092 --describe --group billing" code={GROUP_DESCRIBE} />

      <h2>Try the group behaviour</h2>
      <ol>
        <li>Start two consumers in two terminals. Each gets some of the three partitions; run the producer and watch the records split between them.</li>
        <li>Stop one: within a moment the other takes over its partitions (a <em>rebalance</em>).</li>
        <li>Change <code>GROUP_ID_CONFIG</code> to <code>"audit"</code> and run it: a new group reads every record again from the start, without affecting <code>billing</code>.</li>
        <li>Run the billing consumer again: it prints nothing old — its committed offsets say it is done.</li>
      </ol>
      <Callout tone="note" title="Frameworks">
        Spring for Apache Kafka (<code>@KafkaListener</code>) and Micronaut Kafka wrap exactly this loop: they create the
        consumer from your properties, call <code>poll()</code>, invoke your method per record and commit according to
        their ack mode. Knowing the plain client makes their settings easy to read.
      </Callout>
    </>
  )
}
