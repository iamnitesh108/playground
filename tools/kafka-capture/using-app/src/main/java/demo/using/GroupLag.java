package demo.using;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;

import java.util.Map;
import java.util.Properties;
import java.util.stream.Collectors;

/** Lag per partition: the end of the log minus what the group has committed. */
public class GroupLag {

    public static void main(String[] args) throws Exception {
        String group = args.length > 0 ? args[0] : "payments-reader";
        Properties props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);
        try (Admin admin = Admin.create(props)) {
            Map<TopicPartition, OffsetAndMetadata> committed = admin.listConsumerGroupOffsets(group).partitionsToOffsetAndMetadata().get();
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> ends = admin.listOffsets(
                    committed.keySet().stream().collect(Collectors.toMap(tp -> tp, tp -> OffsetSpec.latest()))).all().get();
            committed.entrySet().stream().sorted(Map.Entry.comparingByKey((a, b) -> a.partition() - b.partition())).forEach(e -> {
                long end = ends.get(e.getKey()).offset();
                long at = e.getValue().offset();
                System.out.printf("%s committed=%d end=%d lag=%d%n", e.getKey(), at, end, end - at);
            });
        }
    }
}
