package demo.orders;

import io.micronaut.configuration.kafka.annotation.KafkaClient;
import io.micronaut.configuration.kafka.annotation.KafkaKey;
import io.micronaut.configuration.kafka.annotation.Topic;
import org.apache.kafka.clients.producer.RecordMetadata;

/** Micronaut generates the implementation: a KafkaProducer that sends to the topic. */
@KafkaClient(id = "orders-producer", acks = KafkaClient.Acknowledge.ALL)
public interface OrderProducer {

    /** The key decides the partition: the same customer always lands in the same partition. */
    @Topic("${app.topic}")
    RecordMetadata send(@KafkaKey String customerId, String order);
}
