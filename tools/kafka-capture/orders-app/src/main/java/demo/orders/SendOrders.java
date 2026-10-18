package demo.orders;

import io.micronaut.context.annotation.Value;
import jakarta.inject.Singleton;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/** Producer mode: sends a few orders and prints where each one landed. */
@Singleton
public class SendOrders {

    private static final Logger LOG = LoggerFactory.getLogger(SendOrders.class);
    private static final List<String> CUSTOMERS = List.of("alice", "bob", "carol", "dave", "erin", "frank");

    private final OrderProducer producer;
    private final int count;
    private final int firstOrder;

    public SendOrders(OrderProducer producer, @Value("${app.count:6}") int count, @Value("${app.first-order:1001}") int firstOrder) {
        this.producer = producer;
        this.count = count;
        this.firstOrder = firstOrder;
    }

    public void send() {
        for (int i = 0; i < count; i++) {
            String customer = CUSTOMERS.get(i % CUSTOMERS.size());
            String order = "order-" + (firstOrder + i);
            RecordMetadata meta = producer.send(customer, order);   // waits for the broker's acknowledgement
            LOG.info("sent key={} value={} -> partition={} offset={}", customer, order, meta.partition(), meta.offset());
        }
    }
}
