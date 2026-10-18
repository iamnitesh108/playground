package demo.policies;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import com.github.benmanes.caffeine.cache.RemovalCause;
import com.github.benmanes.caffeine.cache.Scheduler;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/** When does an entry stop being visible, and when is it actually removed (and its listener called)? */
final class Lifetimes {

    /** expireAfterWrite with a hand-moved clock and no scheduler: expired entries wait for maintenance. */
    static void lazy() {
        FakeTicker ticker = new FakeTicker();
        Cache<String, String> cache = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(5))
                .ticker(ticker)
                .executor(Runnable::run)
                .removalListener((String key, String value, RemovalCause cause) ->
                        Json.of("t", ticker.seconds()).with("event", "listener").with("key", key).with("cause", cause).print())
                .build();

        cache.put("a", "1");
        cache.put("b", "2");
        step(ticker, "put a and b", cache.estimatedSize());
        ticker.advance(Duration.ofSeconds(3));
        step(ticker, "getIfPresent(a)", cache.getIfPresent("a"));
        ticker.advance(Duration.ofSeconds(3)); // both are now past their 5 s
        step(ticker, "estimatedSize()", cache.estimatedSize());
        step(ticker, "getIfPresent(a)", cache.getIfPresent("a"));
        step(ticker, "estimatedSize()", cache.estimatedSize());
        cache.cleanUp();
        step(ticker, "cleanUp()", null);
        step(ticker, "estimatedSize()", cache.estimatedSize());
    }

    private static void step(FakeTicker ticker, String op, Object result) {
        Json.of("t", ticker.seconds()).with("event", "op").with("op", op).with("result", result == null ? "null" : result).print();
    }

    /** Real time: is an idle cache ever cleaned up? Without a Scheduler, no; with one, shortly after expiry. */
    static void scheduler() throws InterruptedException {
        record(300, false);
        record(300, true);
        record(2000, true);
    }

    private static void record(long ttlMs, boolean withScheduler) throws InterruptedException {
        long start = System.nanoTime();
        AtomicLong firedAfter = new AtomicLong(-1);
        CountDownLatch fired = new CountDownLatch(1);
        Caffeine<Object, Object> builder = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMillis(ttlMs))
                .removalListener((key, value, cause) -> {
                    firedAfter.set(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start));
                    fired.countDown();
                });
        if (withScheduler) {
            builder.scheduler(Scheduler.systemScheduler());
        }
        Cache<String, String> cache = builder.build();
        cache.put("k", "v");
        boolean done = fired.await(4, TimeUnit.SECONDS);
        Json.of("ttlMs", ttlMs).with("scheduler", withScheduler)
                .with("firedAfterMs", done ? firedAfter.get() : null)
                .with("waitedMs", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start))
                .with("estimatedSize", cache.estimatedSize())
                .print();
    }

    /** One entry, read every 2 s and then left alone: write-based vs access-based expiry. */
    static void writeVsAccess() {
        FakeTicker ticker = new FakeTicker();
        Cache<String, String> afterWrite = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(5)).ticker(ticker).executor(Runnable::run).build();
        Cache<String, String> afterAccess = Caffeine.newBuilder()
                .expireAfterAccess(Duration.ofSeconds(5)).ticker(ticker).executor(Runnable::run).build();
        afterWrite.put("k", "v");
        afterAccess.put("k", "v");
        for (int t : new int[] { 2, 4, 6, 8, 10, 16 }) {
            ticker.advance(Duration.ofSeconds(t).minusNanos((long) (ticker.seconds() * 1e9)));
            Json.of("t", t)
                    .with("afterWrite", afterWrite.getIfPresent("k") != null)
                    .with("afterAccess", afterAccess.getIfPresent("k") != null)
                    .print();
        }
    }

    /** A different lifetime per entry (Expiry): each lands in a timer-wheel level by how far away it expires. */
    static void perEntry() {
        Map<String, Duration> lifetimes = new LinkedHashMap<>();
        lifetimes.put("price:7", Duration.ofSeconds(5));
        lifetimes.put("token:42", Duration.ofSeconds(90));
        lifetimes.put("session:9", Duration.ofMinutes(30));
        lifetimes.put("report:3", Duration.ofHours(2));

        FakeTicker ticker = new FakeTicker();
        Cache<String, String> cache = Caffeine.newBuilder()
                .expireAfter(new Expiry<String, String>() {
                    @Override
                    public long expireAfterCreate(String key, String value, long currentTime) {
                        return lifetimes.get(key).toNanos();
                    }

                    @Override
                    public long expireAfterUpdate(String key, String value, long currentTime, long currentDuration) {
                        return lifetimes.get(key).toNanos();
                    }

                    @Override
                    public long expireAfterRead(String key, String value, long currentTime, long currentDuration) {
                        return currentDuration; // reading does not extend the lifetime
                    }
                })
                .ticker(ticker)
                .executor(Runnable::run)
                .removalListener((String key, String value, RemovalCause cause) ->
                        Json.of("event", "removed").with("key", key).with("t", ticker.seconds()).with("cause", cause).print())
                .build();
        lifetimes.forEach((key, ttl) -> {
            cache.put(key, "v");
            Json.of("event", "put").with("key", key).with("ttlSeconds", ttl.toSeconds()).print();
        });
        Set<String> visible = new LinkedHashSet<>(lifetimes.keySet());
        long end = Duration.ofHours(2).plusMinutes(1).toMillis();
        for (long ms = 0; ms <= end; ms += (ms < 10_000 ? 100 : 1_000)) {
            ticker.advance(Duration.ofMillis(ms < 10_000 ? 100 : 1_000));
            visible.removeIf(key -> {
                boolean gone = cache.policy().getIfPresentQuietly(key) == null;
                if (gone) Json.of("event", "invisible").with("key", key).with("t", ticker.seconds()).print();
                return gone;
            });
            cache.cleanUp();
        }
    }

    private Lifetimes() {}
}
