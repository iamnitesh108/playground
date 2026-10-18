package demo.keys;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;

/**
 * Payment events keyed two ways: by status (3 values, 80% PAID) or by order id (one per event).
 * usage: SendStatuses <topic> <count> <status | order>
 */
public class SendStatuses {

    public static void main(String[] args) {
        String topic = args[0];
        int count = Integer.parseInt(args[1]);
        boolean byStatus = args[2].equals("status");
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(Config.producer())) {
            for (int i = 0; i < count; i++) {
                String status = i % 20 < 16 ? "PAID" : i % 20 < 19 ? "PENDING" : "FAILED";
                String key = byStatus ? status : "order-" + i;
                producer.send(new ProducerRecord<>(topic, key, "{\"order\":" + i + ",\"status\":\"" + status + "\"}"));
            }
        }
        System.out.printf("sent %d records to %s keyed by %s%n", count, topic, args[2]);
    }
}
