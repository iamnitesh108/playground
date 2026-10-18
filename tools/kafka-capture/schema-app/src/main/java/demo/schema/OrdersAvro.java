package demo.schema;

import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import io.confluent.kafka.serializers.KafkaAvroSerializer;
import org.apache.avro.Schema;
import org.apache.avro.generic.GenericData;
import org.apache.avro.generic.GenericRecord;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.Properties;

/**
 * Sends and reads Avro orders through Schema Registry.
 *   produce v1|v2   send three orders written with that schema version
 *   consume         read every order as a GenericRecord (the deserializer fetches each schema by id)
 *   raw             read the bytes and show the 5-byte header: magic byte + schema id
 */
public class OrdersAvro {

    static final String TOPIC = "orders-avro";

    public static void main(String[] args) throws Exception {
        String bootstrap = System.getenv().getOrDefault("KAFKA_BOOTSTRAP", "localhost:9092");
        String registry = System.getenv().getOrDefault("SCHEMA_REGISTRY", "http://localhost:8081");
        switch (args[0]) {
            case "produce" -> produce(bootstrap, registry, args[1]);
            case "consume" -> consume(bootstrap, registry);
            case "raw" -> raw(bootstrap);
            default -> throw new IllegalArgumentException(args[0]);
        }
    }

    static Schema schema(String version) throws Exception {
        try (InputStream in = OrdersAvro.class.getResourceAsStream("/order-" + version + ".avsc")) {
            return new Schema.Parser().parse(in);
        }
    }

    static void produce(String bootstrap, String registry, String version) throws Exception {
        Properties p = new Properties();
        p.put("bootstrap.servers", bootstrap);
        p.put("key.serializer", StringSerializer.class.getName());
        p.put("value.serializer", KafkaAvroSerializer.class.getName());
        p.put("schema.registry.url", registry);     // the serializer registers the schema (auto.register.schemas=true by default)
        Schema schema = schema(version);
        int first = version.equals("v1") ? 1 : 4;
        try (KafkaProducer<String, GenericRecord> producer = new KafkaProducer<>(p)) {
            for (String customer : List.of("alice", "bob", "carol")) {
                GenericRecord order = new GenericData.Record(schema);
                order.put("id", "order-" + first);
                order.put("customer", customer);
                order.put("amount", 10.0 * first);
                if (version.equals("v2")) order.put("currency", "USD");
                RecordMetadata meta = producer.send(new ProducerRecord<>(TOPIC, customer, order)).get();
                System.out.printf("sent %s with schema %s -> partition=%d offset=%d%n", order, version, meta.partition(), meta.offset());
                first++;
            }
        }
    }

    static void consume(String bootstrap, String registry) {
        Properties p = new Properties();
        p.put("bootstrap.servers", bootstrap);
        p.put("group.id", "orders-avro-reader");
        p.put("auto.offset.reset", "earliest");
        p.put("key.deserializer", StringDeserializer.class.getName());
        p.put("value.deserializer", KafkaAvroDeserializer.class.getName());
        p.put("schema.registry.url", registry);     // schemas are fetched by the id in each record, then cached
        try (KafkaConsumer<String, GenericRecord> consumer = new KafkaConsumer<>(p)) {
            consumer.subscribe(List.of(TOPIC));
            int seen = 0;
            long until = System.currentTimeMillis() + 15000;
            while (seen < 6 && System.currentTimeMillis() < until) {
                for (ConsumerRecord<String, GenericRecord> r : consumer.poll(Duration.ofMillis(500))) {
                    System.out.printf("offset=%d key=%s value=%s%n", r.offset(), r.key(), r.value());
                    seen++;
                }
            }
        }
    }

    static void raw(String bootstrap) {
        Properties p = new Properties();
        p.put("bootstrap.servers", bootstrap);
        p.put("group.id", "orders-avro-raw");
        p.put("auto.offset.reset", "earliest");
        p.put("key.deserializer", StringDeserializer.class.getName());
        p.put("value.deserializer", ByteArrayDeserializer.class.getName());
        try (KafkaConsumer<String, byte[]> consumer = new KafkaConsumer<>(p)) {
            consumer.subscribe(List.of(TOPIC));
            int seen = 0;
            long until = System.currentTimeMillis() + 15000;
            while (seen < 6 && System.currentTimeMillis() < until) {
                for (ConsumerRecord<String, byte[]> r : consumer.poll(Duration.ofMillis(500))) {
                    ByteBuffer b = ByteBuffer.wrap(r.value());
                    byte magic = b.get();
                    int schemaId = b.getInt();
                    StringBuilder hex = new StringBuilder();
                    for (int i = 0; i < r.value().length; i++) hex.append(String.format("%02x ", r.value()[i]));
                    System.out.printf("offset=%d bytes=%d magic=%d schemaId=%d payload=%d bytes | %s%n",
                            r.offset(), r.value().length, magic, schemaId, r.value().length - 5, hex.toString().trim());
                    seen++;
                }
            }
        }
    }
}
