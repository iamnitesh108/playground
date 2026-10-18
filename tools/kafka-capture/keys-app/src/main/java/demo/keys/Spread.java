package demo.keys;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RoundRobinPartitioner;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;
import java.util.concurrent.Future;

/**
 * Sends records without a usable key and prints where they went, in runs.
 * usage: Spread <topic> <count> <batch.size> <linger.ms> <null | empty | ignore-keys | round-robin>
 */
public class Spread {

    public static void main(String[] args) throws Exception {
        String topic = args[0];
        int count = Integer.parseInt(args[1]);
        String mode = args[4];

        Properties props = Config.producer();
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, args[2]);
        props.put(ProducerConfig.LINGER_MS_CONFIG, args[3]);
        if (mode.equals("ignore-keys")) props.put(ProducerConfig.PARTITIONER_IGNORE_KEYS_CONFIG, "true");
        if (mode.equals("round-robin")) props.put(ProducerConfig.PARTITIONER_CLASS_CONFIG, RoundRobinPartitioner.class.getName());

        String value = "x".repeat(100);
        List<Future<org.apache.kafka.clients.producer.RecordMetadata>> sent = new ArrayList<>();
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
            for (int i = 0; i < count; i++) {
                String key = switch (mode) {
                    case "null" -> null;
                    case "empty" -> "";
                    default -> "customer-" + (i % 5);   // keyed, but the key is ignored
                };
                sent.add(producer.send(new ProducerRecord<>(topic, key, value)));   // no .get(): let batches fill
            }
            producer.flush();
        }

        // print consecutive records that went to the same partition as one run
        Map<Integer, Integer> perPartition = new TreeMap<>();
        int runStart = 0;
        for (int i = 0; i < count; i++) {
            int p = sent.get(i).get().partition();
            perPartition.merge(p, 1, Integer::sum);
            boolean last = i == count - 1 || sent.get(i + 1).get().partition() != p;
            if (last) {
                System.out.printf("records %3d-%3d -> partition %d%n", runStart + 1, i + 1, p);
                runStart = i + 1;
            }
        }
        perPartition.forEach((p, n) -> System.out.printf("partition %d: %d records%n", p, n));
    }
}
