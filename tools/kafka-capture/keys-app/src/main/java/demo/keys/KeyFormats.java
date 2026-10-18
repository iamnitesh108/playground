package demo.keys;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.IntegerSerializer;
import org.apache.kafka.common.serialization.LongSerializer;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/** The same customer id 42, serialised four ways: different bytes, so (usually) a different partition. */
public class KeyFormats {

    public static void main(String[] args) throws Exception {
        String topic = "customers";
        Map<String, byte[]> keys = new LinkedHashMap<>();
        keys.put("StringSerializer  \"42\"", new StringSerializer().serialize(topic, "42"));
        keys.put("IntegerSerializer 42", new IntegerSerializer().serialize(topic, 42));
        keys.put("LongSerializer    42L", new LongSerializer().serialize(topic, 42L));
        keys.put("JSON {\"id\":42}", new StringSerializer().serialize(topic, "{\"id\":42}"));
        keys.put("JSON {\"id\": 42}", new StringSerializer().serialize(topic, "{\"id\": 42}"));

        Properties props = Config.producer();
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        try (KafkaProducer<byte[], String> producer = new KafkaProducer<>(props)) {
            for (Map.Entry<String, byte[]> k : keys.entrySet()) {
                RecordMetadata meta = producer.send(new ProducerRecord<>(topic, k.getValue(), "customer 42")).get();
                System.out.printf("%-24s bytes=%-26s -> partition %d%n", k.getKey(), HexFormat.of().formatHex(k.getValue()), meta.partition());
            }
        }
    }
}
