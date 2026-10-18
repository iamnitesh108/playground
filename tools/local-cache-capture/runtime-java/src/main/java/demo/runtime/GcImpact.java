package demo.runtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sun.management.GarbageCollectionNotificationInfo;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.TreeMap;
import javax.management.NotificationEmitter;
import javax.management.openmbean.CompositeData;

/**
 * Run twice with the same heap (-Xmx2g, G1): a small cache and a big one, under the same request load.
 * Every collection is recorded through the GC notifications the JVM publishes.
 */
final class GcImpact {
    static final int VALUE_BYTES = 1024;
    static final int KEYS = 2_000_000;

    record Gc(String name, String action, String cause, long ms) {}

    static void run(int entries, int seconds) throws Exception {
        Cache<Integer, byte[]> cache = Caffeine.newBuilder().maximumSize(entries).build();
        int[] trace = Zipf.trace(1 << 20, KEYS, 0.8, 11);
        for (int i = 0; i < entries; i++) cache.put(i, new byte[VALUE_BYTES]);
        cache.cleanUp();
        System.gc();
        long liveMb = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed() >> 20;

        List<Gc> gcs = new ArrayList<>();
        for (GarbageCollectorMXBean bean : ManagementFactory.getGarbageCollectorMXBeans()) {
            ((NotificationEmitter) bean).addNotificationListener((n, h) -> {
                if (!n.getType().equals(GarbageCollectionNotificationInfo.GARBAGE_COLLECTION_NOTIFICATION)) return;
                var info = GarbageCollectionNotificationInfo.from((CompositeData) n.getUserData());
                synchronized (gcs) {
                    gcs.add(new Gc(info.getGcName(), info.getGcAction(), info.getGcCause(), info.getGcInfo().getDuration()));
                }
            }, null, null);
        }

        // the request load: read a Zipf key, load it on a miss, and make some short-lived garbage per request
        SplittableRandom rnd = new SplittableRandom(3);
        long requests = 0, misses = 0, sink = 0;
        long end = System.nanoTime() + seconds * 1_000_000_000L;
        int i = 0;
        while (System.nanoTime() < end) {
            for (int j = 0; j < 256; j++) {
                int key = trace[i++ & ((1 << 20) - 1)];
                byte[] v = cache.getIfPresent(key);
                if (v == null) {
                    misses++;
                    v = new byte[VALUE_BYTES];
                    cache.put(key, v);
                }
                byte[] garbage = new byte[2048 + rnd.nextInt(2048)];   // the request's own temporary objects
                sink += garbage.length + v.length;
                requests++;
            }
        }
        Thread.sleep(200);
        Map<String, long[]> byName = new TreeMap<>();
        long max = 0;
        synchronized (gcs) {
            for (Gc g : gcs) {
                long[] a = byName.computeIfAbsent(g.name() + " / " + g.action().replace("end of ", ""), k -> new long[2]);
                a[0]++;
                a[1] += g.ms();
                if (!g.name().contains("Concurrent")) max = Math.max(max, g.ms());
            }
        }
        Map<String, Object> summary = new TreeMap<>();
        byName.forEach((k, v) -> summary.put(k, Map.of("count", v[0], "ms", v[1])));
        Out.emit("exp", "gc", "lib", "caffeine", "entries", entries, "valueBytes", VALUE_BYTES, "liveHeapMb", liveMb,
                "heapMaxMb", Runtime.getRuntime().maxMemory() >> 20, "seconds", seconds, "requests", requests,
                "hitRatio", 1 - misses / (double) requests, "collections", summary, "maxPauseMs", max, "sink", sink % 2);
    }
}
