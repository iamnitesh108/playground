package demo.using;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.AlterConfigOp;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.NewPartitions;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.config.ConfigResource;

import java.util.List;
import java.util.Map;
import java.util.Properties;

/** Topics from code: create, list, describe, add partitions, change a config, delete. */
public class TopicAdmin {

    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, Config.BOOTSTRAP);

        try (Admin admin = Admin.create(props)) {
            // create: name, partitions, replication factor (1 on a single broker)
            admin.createTopics(List.of(new NewTopic("invoices", 3, (short) 1))).all().get();
            System.out.println("created invoices");

            System.out.println("topics: " + admin.listTopics().names().get());

            TopicDescription d = admin.describeTopics(List.of("invoices")).allTopicNames().get().get("invoices");
            d.partitions().forEach(p -> System.out.println("  partition " + p.partition() + " leader " + p.leader().id()));

            // partitions can only be added, never removed
            admin.createPartitions(Map.of("invoices", NewPartitions.increaseTo(6))).all().get();
            System.out.println("invoices now has "
                    + admin.describeTopics(List.of("invoices")).allTopicNames().get().get("invoices").partitions().size() + " partitions");

            // change one topic config: keep records for 1 day
            ConfigResource topic = new ConfigResource(ConfigResource.Type.TOPIC, "invoices");
            admin.incrementalAlterConfigs(Map.of(topic, List.of(
                    new AlterConfigOp(new ConfigEntry("retention.ms", "86400000"), AlterConfigOp.OpType.SET)))).all().get();
            System.out.println("retention.ms = " + admin.describeConfigs(List.of(topic)).all().get().get(topic).get("retention.ms").value());

            admin.deleteTopics(List.of("invoices")).all().get();
            System.out.println("deleted invoices");
        }
    }
}
