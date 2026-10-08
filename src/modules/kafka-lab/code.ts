// Generated from the sources that were compiled and run against the stack in this module.
// Edit the Java, re-test, then regenerate — keep them identical.

export const PAYMENT_PRODUCER_JAVA = String.raw`
package com.example.shop;

import java.util.Properties;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;

public class PaymentProducer {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, "true");
        props.put(ProducerConfig.LINGER_MS_CONFIG, "5");
        props.put(ProducerConfig.CLIENT_ID_CONFIG, "payment-service");

        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
            for (int i = 1; i <= 6; i++) {
                String orderId = "order-" + (i % 3 + 1);
                String json = "{\"orderId\":\"%s\",\"amount\":%d,\"status\":\"PAID\"}".formatted(orderId, i * 10);
                ProducerRecord<String, String> record = new ProducerRecord<>("payments", orderId, json);

                producer.send(record, (metadata, error) -> {
                    if (error != null) {
                        System.err.println("send failed: " + error);
                    } else {
                        System.out.printf("sent key=%s -> %s-%d @ offset %d%n",
                                orderId, metadata.topic(), metadata.partition(), metadata.offset());
                    }
                });
            }
            producer.flush();
        }
    }
}
`

export const PAYMENT_CONSUMER_JAVA = String.raw`
package com.example.shop;

import java.time.Duration;
import java.util.List;
import java.util.Properties;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;

public class PaymentConsumer {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "billing");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");

        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);

        // Ctrl-C: wake the poll loop so the consumer can leave the group cleanly.
        Thread mainThread = Thread.currentThread();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            consumer.wakeup();
            try {
                mainThread.join();
            } catch (InterruptedException ignored) {
            }
        }));

        try {
            consumer.subscribe(List.of("payments"));
            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
                for (ConsumerRecord<String, String> r : records) {
                    System.out.printf("partition %d offset %d key=%s value=%s%n",
                            r.partition(), r.offset(), r.key(), r.value());
                    // ... your business logic goes here ...
                }
                if (!records.isEmpty()) {
                    consumer.commitSync(); // commit only after processing: at-least-once
                }
            }
        } catch (WakeupException e) {
            // expected on shutdown
        } finally {
            consumer.close(); // leaves the group, so its partitions are reassigned at once
        }
    }
}
`

export const ORDER_CDC_CONSUMER_JAVA = String.raw`
package com.example.shop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;

/** Keeps an in-memory copy of the orders table, fed by Debezium change events. */
public class OrderCdcConsumer {
    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "order-projection");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");

        ObjectMapper json = new ObjectMapper();
        Map<Long, JsonNode> orders = new HashMap<>();
        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);

        Thread mainThread = Thread.currentThread();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            consumer.wakeup();
            try {
                mainThread.join();
            } catch (InterruptedException ignored) {
            }
        }));

        try {
            consumer.subscribe(List.of("shop.public.orders"));
            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
                for (ConsumerRecord<String, String> r : records) {
                    if (r.value() == null) {
                        // Tombstone: follows every delete so log compaction can drop the key.
                        System.out.println("tombstone for key " + r.key());
                        continue;
                    }
                    JsonNode event = json.readTree(r.value());
                    String op = event.get("op").asText();
                    JsonNode row = op.equals("d") ? event.get("before") : event.get("after");
                    long id = row.get("id").asLong();

                    switch (op) {
                        case "c", "r", "u" -> orders.put(id, row); // create, snapshot read, update
                        case "d" -> orders.remove(id);
                        default -> System.out.println("ignoring op " + op);
                    }
                    System.out.printf("op=%s id=%d -> %d orders in memory%n", op, id, orders.size());
                }
                if (!records.isEmpty()) {
                    consumer.commitSync();
                }
            }
        } catch (WakeupException e) {
            // expected on shutdown
        } finally {
            consumer.close();
        }
    }
}
`

export const BUILD_GRADLE = String.raw`
plugins {
    id 'application'
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.apache.kafka:kafka-clients:4.3.1'
    implementation 'com.fasterxml.jackson.core:jackson-databind:2.21.2'
    runtimeOnly 'org.slf4j:slf4j-simple:2.0.17'
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

application {
    // gradle run -Pmain=com.example.shop.PaymentConsumer
    mainClass = providers.gradleProperty('main').getOrElse('com.example.shop.PaymentProducer')
}
`

export const SETTINGS_GRADLE = String.raw`
rootProject.name = 'kafka-lab-app'
`
