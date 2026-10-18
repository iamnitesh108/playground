package demo.runtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.LongAdder;
import java.util.function.Function;

/** Reads per second from 1, 2, 4 and 8 threads: Caffeine against a synchronized LRU map. */
final class Throughput {
    static final int KEYS = 1 << 16;
    static final int TRACE = 1 << 20;

    // #region lru
    /** The classic hand-made LRU: an access-ordered LinkedHashMap behind one lock. */
    static <K, V> Map<K, V> synchronizedLru(int max) {
        return Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
                return size() > max;
            }
        });
    }
    // #endregion

    static void run(int seconds) throws Exception {
        Integer[] keys = new Integer[KEYS];
        for (int i = 0; i < KEYS; i++) keys[i] = i;
        int[] trace = Zipf.trace(TRACE, KEYS, 0.99, 7);

        Cache<Integer, Integer> caffeine = Caffeine.newBuilder().maximumSize(2 * KEYS).build();
        Map<Integer, Integer> lru = synchronizedLru(2 * KEYS);
        Map<Integer, Integer> chm = new ConcurrentHashMap<>();
        for (Integer k : keys) {
            caffeine.put(k, k);
            lru.put(k, k);
            chm.put(k, k);
        }
        List<Map.Entry<String, Function<Integer, Integer>>> caches = List.of(
                Map.entry("Caffeine", caffeine::getIfPresent),
                Map.entry("synchronized LinkedHashMap (LRU)", lru::get),
                Map.entry("ConcurrentHashMap (no bound, no policy)", chm::get));
        for (var c : caches) {
            for (int threads : new int[] {1, 2, 4, 8}) {
                measure(c.getValue(), keys, trace, threads, threads == 1 ? 2_000 : 300);   // warm-up (JIT)
                double[] runs = new double[5];
                for (int r = 0; r < runs.length; r++) runs[r] = measure(c.getValue(), keys, trace, threads, seconds * 200L);
                Out.emit("exp", "throughput", "lib", c.getKey(), "threads", threads, "readsPerSec", Math.round(Out.median(runs)),
                        "runs", runs.length, "cores", Runtime.getRuntime().availableProcessors());
            }
        }
    }

    /** Every thread reads keys from its own place in the Zipf trace until the time is up; returns reads/s. */
    static double measure(Function<Integer, Integer> get, Integer[] keys, int[] trace, int threads, long millis) throws Exception {
        LongAdder total = new LongAdder();
        CountDownLatch go = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        long[] deadline = new long[1];
        for (int t = 0; t < threads; t++) {
            int offset = t * (TRACE / 8);
            Thread th = new Thread(() -> {
                try {
                    go.await();
                } catch (InterruptedException e) {
                    return;
                }
                long n = 0;
                int i = offset;
                long sink = 0;
                while (true) {
                    for (int j = 0; j < 1024; j++) {
                        Integer v = get.apply(keys[trace[i]]);
                        if (v != null) sink += v;
                        i = (i + 1) & (TRACE - 1);
                    }
                    n += 1024;
                    if (System.nanoTime() > deadline[0]) break;
                }
                total.add(n + (sink == 42 ? 1 : 0));
                done.countDown();
            });
            th.start();
        }
        long t0 = System.nanoTime();
        deadline[0] = t0 + millis * 1_000_000;
        go.countDown();
        done.await();
        return total.sum() / ((System.nanoTime() - t0) / 1e9);
    }
}
