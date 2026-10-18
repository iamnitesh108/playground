package demo.runtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** Heap bytes per entry, measured as the growth of the heap after a full GC. */
final class Footprint {
    static final int N = 1_000_000;

    /** A typical cached value: a small product. */
    record Product(long id, String name, int priceCents) {}

    static long usedAfterGc() {
        for (int i = 0; i < 4; i++) {
            System.gc();
            SingleFlight.sleep(60);
        }
        return ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
    }

    /** Bytes per object for N objects made by `make`, kept alive in an array (array slot excluded). */
    static double perObject(Supplier<Object> make) {
        Object[] keep = new Object[N];
        long before = usedAfterGc();
        for (int i = 0; i < N; i++) keep[i] = make.get();
        long after = usedAfterGc();
        double per = (after - before) / (double) N;
        if (keep[N - 1] == null) throw new IllegalStateException();
        return per;
    }

    static void run() {
        Long[] keys = new Long[N];
        for (int i = 0; i < N; i++) keys[i] = 1_000_000L + i;
        Object value = new Object();

        // What the keys and values themselves cost (they are the same whatever the map is)
        int[] counter = {0};
        double longKey = perObject(() -> Long.valueOf(2_000_000L + counter[0]++));
        counter[0] = 0;
        double stringKey = perObject(() -> "product:" + (100_000 + counter[0]++));
        counter[0] = 0;
        double product = perObject(() -> new Product(counter[0], "Product " + (100_000 + counter[0]++), 1999));
        Out.emit("exp", "objects", "lib", "java", "longKey", longKey, "stringKey", stringKey,
                "productValue", product, "n", N);

        // The structure only: keys and values exist before, so the growth is what the map adds per entry
        List<Map.Entry<String, Supplier<Consumer<Long>>>> maps = List.of(
                Map.entry("HashMap", () -> { Map<Long, Object> m = new HashMap<>(); return k -> m.put(k, value); }),
                Map.entry("ConcurrentHashMap", () -> { Map<Long, Object> m = new ConcurrentHashMap<>(); return k -> m.put(k, value); }),
                Map.entry("Caffeine, unbounded", () -> { Cache<Long, Object> c = Caffeine.newBuilder().build(); return k -> c.put(k, value); }),
                Map.entry("Caffeine, maximumSize", () -> {
                    Cache<Long, Object> c = Caffeine.newBuilder().maximumSize(N).build();
                    return k -> { c.put(k, value); if (k == keys[N - 1]) c.cleanUp(); };
                }),
                Map.entry("Caffeine, maximumSize + expireAfterWrite", () -> {
                    Cache<Long, Object> c = Caffeine.newBuilder().maximumSize(N).expireAfterWrite(Duration.ofMinutes(10)).build();
                    return k -> { c.put(k, value); if (k == keys[N - 1]) c.cleanUp(); };
                }),
                Map.entry("Caffeine, maximumSize + expireAfterAccess + recordStats", () -> {
                    Cache<Long, Object> c = Caffeine.newBuilder().maximumSize(N).expireAfterAccess(Duration.ofMinutes(10)).recordStats().build();
                    return k -> { c.put(k, value); if (k == keys[N - 1]) c.cleanUp(); };
                }));
        for (var m : maps) {
            long before = usedAfterGc();
            Consumer<Long> put = m.getValue().get();
            for (Long k : keys) put.accept(k);
            long after = usedAfterGc();
            Out.emit("exp", "footprint", "lib", "java", "structure", m.getKey(), "n", N, "bytesPerEntry", (after - before) / (double) N,
                    "alive", put.hashCode() != 0);
        }
    }
}
