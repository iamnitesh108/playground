package demo.using;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;

/** Two transactions from one producer: the first is committed, the second aborted. */
public class PayTransactionally {

    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "transfers-1");   // stable across restarts: fences older instances

        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
            producer.initTransactions();

            producer.beginTransaction();
            producer.send(new ProducerRecord<>("transfers", "alice", "debit 30"));
            producer.send(new ProducerRecord<>("transfers", "alice", "credit bob 30"));
            producer.commitTransaction();
            System.out.println("committed: debit 30, credit bob 30");

            producer.beginTransaction();
            producer.send(new ProducerRecord<>("transfers", "alice", "debit 500"));
            producer.send(new ProducerRecord<>("transfers", "alice", "credit erin 500"));
            producer.flush();                                                // both are now in the log...
            producer.abortTransaction();                                     // ...and marked as aborted
            System.out.println("aborted:   debit 500, credit erin 500");
        }
    }
}
