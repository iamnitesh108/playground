package demo.keys;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;

/** Where the cluster is, and the producer settings every program starts from. */
final class Config {
    static final String BOOTSTRAP = System.getenv().getOrDefault("KAFKA_BOOTSTRAP", "localhost:9092");

    static Properties producer() {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, BOOTSTRAP);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        return props;
    }

    private Config() {
    }
}
