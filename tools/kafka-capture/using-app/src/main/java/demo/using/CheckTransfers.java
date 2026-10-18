package demo.using;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Read-process-write, exactly once: read transfers, write a checked copy to transfers-checked,
 * and commit the consumed offsets in the same transaction as the output.
 */
public class CheckTransfers {

    public static void main(String[] args) {
        Properties c = new Properties();
        c.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        c.put(ConsumerConfig.GROUP_ID_CONFIG, "transfer-checker");
        c.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        c.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");            // offsets go into the transaction instead
        c.put(ConsumerConfig.ISOLATION_LEVEL_CONFIG, "read_committed");      // never process aborted input
        c.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        c.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());

        Properties p = new Properties();
        p.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        p.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "transfer-checker-1");
        p.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        p.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(c);
             KafkaProducer<String, String> producer = new KafkaProducer<>(p)) {
            producer.initTransactions();
            consumer.subscribe(List.of("transfers"));
            int empty = 0;
            while (empty < 5) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofSeconds(1));
                if (records.isEmpty()) { empty++; continue; }

                producer.beginTransaction();
                Map<TopicPartition, OffsetAndMetadata> next = new HashMap<>();
                for (ConsumerRecord<String, String> r : records) {
                    String checked = r.value() + " [checked]";
                    producer.send(new ProducerRecord<>("transfers-checked", r.key(), checked));
                    next.put(new TopicPartition(r.topic(), r.partition()), new OffsetAndMetadata(r.offset() + 1));
                    System.out.printf("in offset %d: %s -> out: %s%n", r.offset(), r.value(), checked);
                }
                // the consumed offsets are committed by the producer, atomically with the output
                producer.sendOffsetsToTransaction(next, consumer.groupMetadata());
                producer.commitTransaction();
                System.out.println("committed output and offsets " + next);
            }
        }
    }
}
