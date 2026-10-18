package demo.using;

import org.apache.kafka.clients.consumer.AcknowledgeType;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaShareConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.time.Duration;
import java.util.List;
import java.util.Properties;

/**
 * A worker in the share group "workers": takes jobs, accepts the good ones, releases "retry" jobs
 * (another delivery later) and rejects "poison" jobs (never delivered again). The first attempt at a
 * "slow" job hangs for longer than the record lock, so the broker hands it to another worker meanwhile.
 */
public class ShareWorker {

    public static void main(String[] args) throws InterruptedException {
        String name = args.length > 0 ? args[0] : "worker";
        int idleSeconds = args.length > 1 ? Integer.parseInt(args[1]) : 5;
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "workers");
        props.put(ConsumerConfig.CLIENT_ID_CONFIG, name);
        props.put(ConsumerConfig.SHARE_ACKNOWLEDGEMENT_MODE_CONFIG, "explicit");   // acknowledge each record ourselves
        props.put(ConsumerConfig.SHARE_ACQUIRE_MODE_CONFIG, "record_limit");     // take at most max.poll.records per poll...
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, "1");                  // ...so a slow job only holds itself
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());

        try (KafkaShareConsumer<String, String> consumer = new KafkaShareConsumer<>(props)) {
            consumer.subscribe(List.of("jobs"));
            int empty = 0;
            while (empty < idleSeconds) {
                var records = consumer.poll(Duration.ofSeconds(1));
                if (records.isEmpty()) { empty++; continue; }
                empty = 0;
                for (ConsumerRecord<String, String> r : records) {
                    AcknowledgeType ack = r.value().startsWith("poison") ? AcknowledgeType.REJECT
                            : r.value().startsWith("retry") ? AcknowledgeType.RELEASE
                            : AcknowledgeType.ACCEPT;
                    System.out.printf("%s partition %d offset %d delivery %d: %s -> %s%n", name, r.partition(), r.offset(),
                            r.deliveryCount().orElse((short) 0), r.value(), ack);
                    boolean firstTry = r.deliveryCount().orElse((short) 1) == 1;
                    if (r.value().startsWith("slow") && firstTry) Thread.sleep(20_000);   // stuck longer than the 15 s lock
                    consumer.acknowledge(r, ack);
                }
                // send the acknowledgements now and print what the broker answered
                consumer.commitSync().forEach((tp, error) -> System.out.printf("%s   %s%n", name,
                        error.map(e -> "ack refused: " + e.getMessage()).orElse("ack ok")));
            }
        }
    }
}
