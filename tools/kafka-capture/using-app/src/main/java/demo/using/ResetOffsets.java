package demo.using;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;

import java.util.Map;
import java.util.Properties;
import java.util.stream.Collectors;

/** Move a group back to the beginning (the group must have no running members). */
public class ResetOffsets {

    public static void main(String[] args) throws Exception {
        String group = args.length > 0 ? args[0] : "payments-reader";
        Properties props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        try (Admin admin = Admin.create(props)) {
            var partitions = admin.listConsumerGroupOffsets(group).partitionsToOffsetAndMetadata().get().keySet();
            var earliest = admin.listOffsets(partitions.stream().collect(Collectors.toMap(tp -> tp, tp -> OffsetSpec.earliest()))).all().get();
            Map<TopicPartition, OffsetAndMetadata> target = earliest.entrySet().stream()
                    .collect(Collectors.toMap(Map.Entry::getKey, e -> new OffsetAndMetadata(e.getValue().offset())));
            admin.alterConsumerGroupOffsets(group, target).all().get();
            target.forEach((tp, o) -> System.out.printf("%s -> %d%n", tp, o.offset()));
        }
    }
}
