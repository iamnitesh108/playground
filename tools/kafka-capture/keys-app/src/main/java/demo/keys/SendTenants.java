package demo.keys;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;

import java.util.Properties;

/** Composite keys with a custom partitioner: the partition follows the tenant, not the whole key. */
public class SendTenants {

    public static void main(String[] args) throws Exception {
        Properties props = Config.producer();
        props.put(ProducerConfig.PARTITIONER_CLASS_CONFIG, TenantPartitioner.class.getName());
        String[] keys = { "tenant-a:1001", "tenant-b:1002", "tenant-a:1003", "tenant-c:1004", "tenant-b:1005", "tenant-a:1006" };
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
            for (String key : keys) {
                RecordMetadata meta = producer.send(new ProducerRecord<>("tenant-orders", key, "created")).get();
                System.out.printf("key=%s -> partition %d offset %d%n", key, meta.partition(), meta.offset());
            }
        }
    }
}
