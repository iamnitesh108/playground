package demo.using;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.time.Duration;
import java.util.List;
import java.util.Properties;

/** Fetch one record by partition and offset — no group, nothing committed. */
public class ReadAtOffset {

    public static void main(String[] args) {
        int partition = Integer.parseInt(args[0]);
        long offset = Long.parseLong(args[1]);
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            TopicPartition tp = new TopicPartition("payments", partition);
            consumer.assign(List.of(tp));       // assign, not subscribe: no group needed
            consumer.seek(tp, offset);
            var records = consumer.poll(Duration.ofSeconds(5)).records(tp);
            if (records.isEmpty()) System.out.println("nothing at " + tp + " offset " + offset);
            else System.out.printf("%s offset %d: key=%s value=%s%n", tp, records.get(0).offset(), records.get(0).key(), records.get(0).value());
        }
    }
}
