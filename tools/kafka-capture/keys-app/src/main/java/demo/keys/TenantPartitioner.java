package demo.keys;

import org.apache.kafka.clients.producer.Partitioner;
import org.apache.kafka.common.Cluster;
import org.apache.kafka.common.utils.Utils;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Keys look like "tenant:order". Partition by the tenant part only, so one tenant's records stay in
 * order with each other, while the full key still identifies the order (e.g. for compaction).
 */
public class TenantPartitioner implements Partitioner {

    @Override
    public int partition(String topic, Object key, byte[] keyBytes, Object value, byte[] valueBytes, Cluster cluster) {
        int partitions = cluster.partitionsForTopic(topic).size();
        if (key == null) throw new IllegalArgumentException("records on " + topic + " need a tenant:order key");
        String tenant = key.toString().split(":", 2)[0];
        return Utils.toPositive(Utils.murmur2(tenant.getBytes(StandardCharsets.UTF_8))) % partitions;
    }

    @Override
    public void configure(Map<String, ?> configs) {
    }

    @Override
    public void close() {
    }
}
