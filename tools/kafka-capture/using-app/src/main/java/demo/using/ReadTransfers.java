package demo.using;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.time.Duration;
import java.util.List;
import java.util.Properties;

/** Read partition 0 of transfers with the isolation level given as the first argument. */
public class ReadTransfers {

    public static void main(String[] args) {
        String isolation = args.length > 0 ? args[0] : "read_committed";
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        props.put(ConsumerConfig.ISOLATION_LEVEL_CONFIG, isolation);         // read_uncommitted | read_committed
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            TopicPartition tp = new TopicPartition("transfers", 0);
            consumer.assign(List.of(tp));
            consumer.seekToBeginning(List.of(tp));
            for (int i = 0; i < 3; i++) {
                for (ConsumerRecord<String, String> r : consumer.poll(Duration.ofSeconds(1))) {
                    System.out.printf("%s offset %d: %s%n", isolation, r.offset(), r.value());
                }
            }
            System.out.printf("%s position after reading: %d%n", isolation, consumer.position(tp));
        }
    }
}
