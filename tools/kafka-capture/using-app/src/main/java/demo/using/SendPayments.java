package demo.using;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;

import java.nio.charset.StandardCharsets;
import java.util.Properties;

/** Send keyed records with a header and print where each one landed. */
public class SendPayments {

    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "all");

        String[][] payments = { { "alice", "{\"amount\":25}" }, { "bob", "{\"amount\":40}" }, { "alice", "{\"amount\":15}" }, { "carol", "{\"amount\":90}" } };
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
            for (String[] p : payments) {
                ProducerRecord<String, String> record = new ProducerRecord<>("payments", p[0], p[1]);
                record.headers().add("source", "checkout".getBytes(StandardCharsets.UTF_8));
                RecordMetadata meta = producer.send(record).get();   // .get() waits for the broker's ack
                System.out.printf("sent key=%s value=%s -> partition %d offset %d%n", p[0], p[1], meta.partition(), meta.offset());
            }
        }
    }
}
