package basics;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import java.lang.management.ManagementFactory;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.function.IntFunction;

/**
 * Why a cache and not a map: heap growth of an unbounded HashMap vs a bounded Caffeine cache, and what one read
 * costs (a cache hit, a map lookup, a Redis GET on localhost, recomputing the value). Prints JSON lines.
 */
final class Why {
    static final int TOTAL = 1_000_000;
    static final int STEP = 100_000;
    static final int KEYS = 10_000;

    static String valueFor(int i) {
        return "{\"id\":" + i + ",\"name\":\"user " + i + "\",\"email\":\"user" + i + "@example.com\",\"plan\":\"basic\"}";
    }

    static double heapMb() {
        for (int i = 0; i < 3; i++) System.gc();
        return ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed() / 1048576.0;
    }

    interface Store {
        void put(String key, String value);
        long size();
    }

    static void report(String kind, int inserted, long size, double mb) {
        System.out.printf("{\"t\":\"heap\",\"kind\":\"%s\",\"inserted\":%d,\"size\":%d,\"mb\":%.1f}%n", kind, inserted, size, mb);
    }

    // #region heap
    static void growth(String kind, Store store) {
        double base = heapMb();
        for (int i = 1; i <= TOTAL; i++) {
            store.put("user:" + i, valueFor(i));   // every key is new: nothing is ever read twice
            if (i % STEP == 0) report(kind, i, store.size(), heapMb() - base);
        }
    }
    // #endregion

    static double median(double[] xs) {
        double[] s = xs.clone();
        Arrays.sort(s);
        return s[s.length / 2];
    }

    static long sink;

    /** ns per call: runs fn over the keys in batches and returns the median batch (after a JIT warm-up). */
    static double perCall(IntFunction<Object> fn, int batch, int rounds) {
        for (int w = 0; w < 5; w++) for (int i = 0; i < batch; i++) sink += fn.apply(i % KEYS) != null ? 1 : 0;
        double[] samples = new double[rounds];
        for (int r = 0; r < rounds; r++) {
            long t0 = System.nanoTime();
            for (int i = 0; i < batch; i++) sink += fn.apply(i % KEYS) != null ? 1 : 0;
            samples[r] = (System.nanoTime() - t0) / (double) batch;
        }
        return median(samples);
    }

    static void main() {
        {
            Map<String, String> map = new HashMap<>();   // grows forever
            growth("map", new Store() {
                public void put(String k, String v) { map.put(k, v); }
                public long size() { return map.size(); }
            });
        }
        {
            Cache<String, String> cache = Caffeine.newBuilder().maximumSize(10_000).build();   // stays at 10,000
            growth("cache", new Store() {
                public void put(String k, String v) { cache.put(k, v); }
                public long size() { cache.cleanUp(); return cache.estimatedSize(); }
            });
        }

        String[] keys = new String[KEYS];
        Cache<String, String> cache = Caffeine.newBuilder().maximumSize(KEYS).build();
        Map<String, String> map = new HashMap<>();
        for (int i = 0; i < KEYS; i++) {
            keys[i] = "user:" + i;
            cache.put(keys[i], valueFor(i));
            map.put(keys[i], valueFor(i));
        }
        cache.cleanUp();
        System.out.printf("{\"t\":\"latency\",\"op\":\"cache-get\",\"ns\":%.2f}%n", perCall(i -> cache.getIfPresent(keys[i]), 1_000_000, 15));
        System.out.printf("{\"t\":\"latency\",\"op\":\"map-get\",\"ns\":%.2f}%n", perCall(i -> map.get(keys[i]), 1_000_000, 15));
        System.out.printf("{\"t\":\"latency\",\"op\":\"compute\",\"ns\":%.2f}%n", perCall(Why::valueFor, 200_000, 15));   // build the value again

        RedisClient client = RedisClient.create("redis://localhost:" + System.getenv().getOrDefault("REDIS_PORT", "6379"));
        try (StatefulRedisConnection<String, String> connection = client.connect()) {
            RedisCommands<String, String> redis = connection.sync();
            for (int i = 0; i < KEYS; i++) redis.set(keys[i], valueFor(i));
            for (int i = 0; i < 20_000; i++) redis.get(keys[i % KEYS]);   // warm-up
            double[] samples = new double[20_000];
            for (int i = 0; i < samples.length; i++) {
                long t0 = System.nanoTime();
                redis.get(keys[i % KEYS]);   // one round trip
                samples[i] = System.nanoTime() - t0;
            }
            Arrays.sort(samples);
            System.out.printf("{\"t\":\"latency\",\"op\":\"redis-get\",\"ns\":%.0f,\"p99\":%.0f}%n",
                    samples[samples.length / 2], samples[(int) (samples.length * 0.99)]);
        }
        client.shutdown();
        System.exit(0);
    }
}
