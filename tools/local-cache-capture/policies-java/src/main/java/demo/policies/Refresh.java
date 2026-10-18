package demo.policies;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * One reader asks for the same key every 100 ms; loading it takes 200 ms. With expireAfterWrite the reader waits
 * for every reload; with refreshAfterWrite it keeps getting the old value while the new one loads in the background.
 */
final class Refresh {
    static final Duration LIFETIME = Duration.ofMillis(1000);
    static final long LOAD_MS = 200;

    static void run() throws InterruptedException {
        for (String mode : new String[] { "expireAfterWrite", "refreshAfterWrite" }) {
            measure(mode);
        }
    }

    private static void measure(String mode) throws InterruptedException {
        long start = System.nanoTime();
        AtomicInteger version = new AtomicInteger();
        Caffeine<Object, Object> builder = Caffeine.newBuilder();
        if (mode.equals("refreshAfterWrite")) {
            builder.refreshAfterWrite(LIFETIME); // after 1 s, the next read triggers a reload but is served the old value
        } else {
            builder.expireAfterWrite(LIFETIME); // after 1 s, the entry is gone and the next read loads it
        }
        LoadingCache<String, Integer> cache = builder.build(key -> {
            long from = elapsedMs(start);
            Thread.sleep(LOAD_MS); // the database query
            int v = version.incrementAndGet();
            Json.of("mode", mode).with("event", "load").with("from", from).with("to", elapsedMs(start))
                    .with("version", v).with("thread", Thread.currentThread().getName().startsWith("main") ? "caller" : "background").print();
            return v;
        });
        for (int i = 0; i <= 30; i++) {
            long due = start + TimeUnit.MILLISECONDS.toNanos(i * 100L);
            long wait = due - System.nanoTime();
            if (wait > 0) TimeUnit.NANOSECONDS.sleep(wait);
            long at = System.nanoTime();
            int value = cache.get("price:7");
            Json.of("mode", mode).with("event", "read").with("at", elapsedMs(start))
                    .with("ms", (System.nanoTime() - at) / 1e6).with("version", value).print();
        }
    }

    private static long elapsedMs(long start) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
    }

    private Refresh() {}
}
