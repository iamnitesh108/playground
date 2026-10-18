package demo.orders;

import io.micronaut.configuration.kafka.annotation.KafkaListener;
import io.micronaut.configuration.kafka.annotation.OffsetReset;
import io.micronaut.configuration.kafka.annotation.Topic;
import io.micronaut.context.annotation.Requires;
import io.micronaut.context.annotation.Value;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Consumer mode: one consumer in the group named by app.group.
 * Start the app several times with the same group to share the partitions,
 * or with different groups to give each group its own copy of every order.
 */
@Requires(property = "app.mode", value = "consumer")
@KafkaListener(groupId = "${app.group}", offsetReset = OffsetReset.EARLIEST)
public class OrderListener {

    private static final Logger LOG = LoggerFactory.getLogger(OrderListener.class);

    private final String instance;

    public OrderListener(@Value("${app.instance:app}") String instance) {
        this.instance = instance;
    }

    @Topic("${app.topic}")
    public void receive(ConsumerRecord<String, String> record) {
        LOG.info("[{}] received partition={} offset={} key={} value={}",
                instance, record.partition(), record.offset(), record.key(), record.value());
    }
}
