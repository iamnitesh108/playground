package demo.runtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * One thread, the same workload as the TypeScript and Rust apps: 65,536 integer keys with Zipf popularity.
 * get = reads that hit; put = writes into a cache half that size, so it evicts as it goes.
 */
final class Bench {
    static final int KEYS = 1 << 16;
    static final int TRACE = 1 << 20;

    static void run() {
        Integer[] keys = new Integer[KEYS];
        for (int i = 0; i < KEYS; i++) keys[i] = i;
        int[] trace = Zipf.trace(TRACE, KEYS, 0.99, 7);

        Cache<Integer, Integer> full = Caffeine.newBuilder().maximumSize(KEYS * 2L).build();
        for (Integer k : keys) full.put(k, k);
        Cache<Integer, Integer> half = Caffeine.newBuilder().maximumSize(KEYS / 2).build();

        report("get", () -> {
            long sink = 0;
            for (int i = 0; i < TRACE; i++) sink += full.getIfPresent(keys[trace[i]]);
            return sink;
        });
        report("put", () -> {
            for (int i = 0; i < TRACE; i++) half.put(keys[trace[i]], i);
            return half.estimatedSize();
        });
    }

    interface Pass {
        long run();
    }

    /** Warm up, then the median of 7 passes over the 1,048,576-key trace. */
    static void report(String op, Pass pass) {
        for (int i = 0; i < 5; i++) pass.run();
        double[] rates = new double[7];
        for (int r = 0; r < rates.length; r++) {
            long t0 = System.nanoTime();
            long sink = pass.run();
            rates[r] = TRACE / ((System.nanoTime() - t0) / 1e9) + (sink == Long.MIN_VALUE ? 1 : 0);
        }
        Out.emit("exp", "bench", "lib", "caffeine", "op", op, "opsPerSec", Math.round(Out.median(rates)), "passes", rates.length);
    }
}
