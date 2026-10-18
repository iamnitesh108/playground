package demo.using;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Properties;

/** Read as a member of a group, print each record, commit after processing. */
public class ReadPayments {

    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "payments-reader");
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");      // a new group starts at the beginning
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");        // we commit ourselves, after processing
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            consumer.subscribe(List.of("payments"));
            int empty = 0;
            while (empty < 3) {                                               // stop after ~3 s without records
                var records = consumer.poll(Duration.ofSeconds(1));
                if (records.isEmpty()) { empty++; continue; }
                for (ConsumerRecord<String, String> r : records) {
                    Header source = r.headers().lastHeader("source");
                    System.out.printf("partition %d offset %d key=%s value=%s source=%s%n", r.partition(), r.offset(), r.key(), r.value(),
                            source == null ? "-" : new String(source.value(), StandardCharsets.UTF_8));
                }
                consumer.commitSync();
            }
        }
    }
}
