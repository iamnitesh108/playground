package demo.keys;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.utils.Utils;

import java.nio.charset.StandardCharsets;

/** Keyed records: the partition is murmur2(key bytes) % partitions, unless the record names a partition itself. */
public class SendKeyed {

    public static void main(String[] args) throws Exception {
        String[][] orders = { { "alice", "order-1" }, { "bob", "order-2" }, { "alice", "order-3" },
                { "carol", "order-4" }, { "dave", "order-5" }, { "alice", "order-6" } };
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(Config.producer())) {
            int partitions = producer.partitionsFor("orders").size();
            for (String[] o : orders) {
                RecordMetadata meta = producer.send(new ProducerRecord<>("orders", o[0], o[1])).get();
                // the same formula the producer used, computed by hand
                byte[] keyBytes = o[0].getBytes(StandardCharsets.UTF_8);
                int expected = Utils.toPositive(Utils.murmur2(keyBytes)) % partitions;
                System.out.printf("key=%-5s value=%s -> partition %d offset %d   (murmur2 %% %d = %d)%n",
                        o[0], o[1], meta.partition(), meta.offset(), partitions, expected);
            }
            // an explicit partition wins over the key: alice's hash says partition 0
            RecordMetadata meta = producer.send(new ProducerRecord<>("orders", 2, "alice", "order-7")).get();
            System.out.printf("key=alice value=order-7 partition=2 given -> partition %d offset %d%n", meta.partition(), meta.offset());
        }
    }
}
