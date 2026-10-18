package demo.runtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Run with a small heap (-Xmx96m). The same 1 MB values go into a soft-valued cache, an unbounded strong cache
 * and a cache bounded by weight.
 */
final class SoftValues {
    static final int VALUES = 200;
    static final int MB = 1 << 20;
    static final int VALUE = 1_000_000;   // "1 MB" (a 1 MiB array would need two 1 MiB G1 regions)

    static long gcCount() {
        return ManagementFactory.getGarbageCollectorMXBeans().stream().mapToLong(GarbageCollectorMXBean::getCollectionCount).sum();
    }

    static void run(String mode) {
        // #region soft
        Cache<Integer, byte[]> cache = switch (mode) {
            case "soft" -> Caffeine.newBuilder().softValues().build();
            case "strong" -> Caffeine.newBuilder().build();
            default -> Caffeine.newBuilder().maximumWeight(48L * VALUE).weigher((Integer k, byte[] v) -> v.length).build();
        };
        // #endregion
        long gc0 = gcCount();
        List<Map<String, Object>> samples = new ArrayList<>();
        String outcome = "completed";
        try {
            for (int i = 1; i <= VALUES; i++) {
                cache.put(i, new byte[VALUE]);
                if (i % 20 == 0) {
                    cache.cleanUp();
                    samples.add(Map.of("inserted", i, "entries", cache.estimatedSize(), "gcs", gcCount() - gc0));
                }
            }
        } catch (OutOfMemoryError e) {
            long n = cache.estimatedSize();
            cache.invalidateAll();
            outcome = "OutOfMemoryError: " + e.getMessage() + " after " + n + " entries";
        }
        int hits = 0;
        for (int i = VALUES - 30; i <= VALUES; i++) if (cache.getIfPresent(i) != null) hits++;
        Out.emit("exp", "soft", "lib", "caffeine", "mode", mode, "heapMb", Runtime.getRuntime().maxMemory() / MB, "valueMb", 1,
                "samples", samples, "outcome", outcome, "recentHitsOf31", hits, "gcs", gcCount() - gc0);
    }
}
