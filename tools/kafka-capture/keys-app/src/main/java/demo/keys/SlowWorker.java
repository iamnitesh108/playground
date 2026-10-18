package demo.keys;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;

/**
 * A group member that needs a fixed time per record, like a real handler calling a database.
 * usage: SlowWorker <name> <group> <topic> <ms per record> <seconds to run>
 */
public class SlowWorker {

    public static void main(String[] args) throws Exception {
        String name = args[0];
        long msPerRecord = Long.parseLong(args[3]);
        long until = System.currentTimeMillis() + Long.parseLong(args[4]) * 1000;

        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, args[1]);
        props.put(ConsumerConfig.CLIENT_ID_CONFIG, name);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, "20");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());

        Map<Integer, Integer> handled = new TreeMap<>();
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            consumer.subscribe(List.of(args[2]));
            while (System.currentTimeMillis() < until) {
                for (ConsumerRecord<String, String> r : consumer.poll(Duration.ofMillis(200))) {
                    Thread.sleep(msPerRecord);                       // the "work"
                    handled.merge(r.partition(), 1, Integer::sum);
                }
                consumer.commitSync();
            }
            List<Integer> owned = consumer.assignment().stream().map(TopicPartition::partition).sorted().toList();
            System.out.printf("%s owned partitions %s, handled %s%n", name, owned, handled);
        }
    }
}
