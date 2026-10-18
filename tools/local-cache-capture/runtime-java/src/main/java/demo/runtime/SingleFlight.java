package demo.runtime;

import com.github.benmanes.caffeine.cache.AsyncCache;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.CacheLoader;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

/** Many callers, one missing key: who calls the loader, how long everyone waits, and what failures do. */
final class SingleFlight {
    static final int CALLERS = 50;
    static final long LOADER_MS = 200;
    final AtomicInteger loaderCalls = new AtomicInteger();

    /** The slow source of truth: 200 ms per call. */
    String load(String key) {
        loaderCalls.incrementAndGet();
        sleep(LOADER_MS);
        return "price of " + key;
    }

    // #region naive
    // --- naive: check, load, put ---
    String naiveGet(Cache<String, String> cache, String key) {
        String value = cache.getIfPresent(key);
        if (value == null) {
            value = load(key);          // every caller that missed runs this
            cache.put(key, value);
        }
        return value;
    }
    // #endregion

    // #region singleflight
    // --- single-flight: one load per key, the others wait for it ---
    String singleFlightGet(Cache<String, String> cache, String key) {
        return cache.get(key, this::load);
    }
    // #endregion

    // #region async
    // --- async: callers share one CompletableFuture ---
    CompletableFuture<String> asyncGet(AsyncCache<String, String> cache, String key) {
        return cache.get(key, (k, executor) -> CompletableFuture.supplyAsync(() -> load(k), executor));
    }
    // #endregion

    static void run() throws Exception {
        stampede("naive", (sf, cache) -> sf.naiveGet(cache, "product:42"));
        stampede("get(key, loader)", (sf, cache) -> sf.singleFlightGet(cache, "product:42"));
        asyncStampede();
        failingSync();
        failingAsync();
        absent();
        bulk();
        recursive();
        refreshVsExpire();
    }

    interface Caller {
        String get(SingleFlight sf, Cache<String, String> cache) throws Exception;
    }

    /** Starts every caller at the same moment and records what each one waited. */
    static List<Double> together(int callers, java.util.concurrent.Callable<?> call, List<String> errors) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(callers);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Double>> waits = new ArrayList<>();
        for (int i = 0; i < callers; i++) {
            waits.add(pool.submit(() -> {
                go.await();
                long t0 = System.nanoTime();
                try {
                    call.call();
                } catch (Exception e) {
                    synchronized (errors) {
                        errors.add(describe(e));
                    }
                }
                return Out.ms(System.nanoTime() - t0);
            }));
        }
        go.countDown();
        List<Double> out = new ArrayList<>();
        for (Future<Double> f : waits) out.add(f.get());
        pool.shutdown();
        return out;
    }

    static void stampede(String mode, Caller caller) throws Exception {
        SingleFlight sf = new SingleFlight();
        Cache<String, String> cache = Caffeine.newBuilder().maximumSize(1_000).build();
        List<String> errors = new ArrayList<>();
        List<Double> waits = together(CALLERS, () -> caller.get(sf, cache), errors);
        Out.emit("exp", "stampede", "lib", "caffeine", "mode", mode, "callers", CALLERS, "loaderMs", LOADER_MS,
                "loaderCalls", sf.loaderCalls.get(), "waits", waits, "errors", errors.size());
    }

    static void asyncStampede() throws Exception {
        SingleFlight sf = new SingleFlight();
        AsyncCache<String, String> cache = Caffeine.newBuilder().maximumSize(1_000).buildAsync();
        Set<CompletableFuture<String>> futures = ConcurrentHashMap.newKeySet();
        List<String> errors = new ArrayList<>();
        List<Double> waits = together(CALLERS, () -> {
            CompletableFuture<String> f = sf.asyncGet(cache, "product:42");
            futures.add(f);
            return f.join();
        }, errors);
        Out.emit("exp", "stampede", "lib", "caffeine", "mode", "AsyncCache", "callers", CALLERS, "loaderMs", LOADER_MS,
                "loaderCalls", sf.loaderCalls.get(), "waits", waits, "errors", errors.size(), "distinctFutures", futures.size());
    }

    // #region failing
    /** The loader throws after 100 ms. */
    static String failingLoad(AtomicInteger calls) {
        calls.incrementAndGet();
        sleep(100);
        throw new IllegalStateException("database timeout");
    }
    // #endregion

    static void failingSync() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        Cache<String, String> cache = Caffeine.newBuilder().maximumSize(1_000).build();
        List<String> errors = new ArrayList<>();
        long t0 = System.nanoTime();
        // #region failingCall
        List<Double> waits = together(10, () -> cache.get("product:42", k -> failingLoad(calls)), errors);
        // #endregion
        Out.emit("exp", "failure", "lib", "caffeine", "mode", "get(key, loader)", "callers", 10, "loaderCalls", calls.get(),
                "errors", errors.size(), "error", errors.get(0), "cachedAfter", cache.getIfPresent("product:42") != null,
                "waits", waits, "totalMs", Out.ms(System.nanoTime() - t0));
    }

    static void failingAsync() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AsyncCache<String, String> cache = Caffeine.newBuilder().maximumSize(1_000).buildAsync();
        List<String> errors = new ArrayList<>();
        long t0 = System.nanoTime();
        List<Double> waits = together(10, () -> cache.get("product:42", (k, ex) -> CompletableFuture.supplyAsync(() -> failingLoad(calls), ex)).join(), errors);
        Thread.sleep(50);
        Out.emit("exp", "failure", "lib", "caffeine", "mode", "AsyncCache", "callers", 10, "loaderCalls", calls.get(),
                "errors", errors.size(), "error", errors.get(0), "cachedAfter", cache.getIfPresent("product:42") != null,
                "waits", waits, "totalMs", Out.ms(System.nanoTime() - t0));
    }

    /** A key that does not exist in the database, read three times. */
    static void absent() {
        // #region absent
        AtomicInteger nullCalls = new AtomicInteger();
        Cache<String, String> plain = Caffeine.newBuilder().maximumSize(1_000).build();
        for (int i = 0; i < 3; i++) plain.get("product:999", k -> { nullCalls.incrementAndGet(); return null; });

        AtomicInteger optCalls = new AtomicInteger();
        Cache<String, Optional<String>> negative = Caffeine.newBuilder().maximumSize(1_000).expireAfterWrite(Duration.ofSeconds(30)).build();
        for (int i = 0; i < 3; i++) negative.get("product:999", k -> { optCalls.incrementAndGet(); return Optional.empty(); });
        // #endregion
        Out.emit("exp", "absent", "lib", "caffeine", "reads", 3, "nullLoaderCalls", nullCalls.get(), "nullSize", plain.estimatedSize(),
                "optionalLoaderCalls", optCalls.get(), "optionalSize", negative.estimatedSize());
    }

    /** getAll: one bulk query for the keys that are missing, none for the ones cached. */
    static void bulk() {
        List<List<String>> bulkCalls = new ArrayList<>();
        // #region bulk
        LoadingCache<String, String> cache = Caffeine.newBuilder().maximumSize(1_000).build(new CacheLoader<>() {
            @Override
            public String load(String key) {
                return "price of " + key;
            }

            @Override
            public Map<String, String> loadAll(Set<? extends String> keys) {
                bulkCalls.add(keys.stream().map(String::valueOf).sorted().toList());   // one SELECT … WHERE id IN (…)
                Map<String, String> found = new java.util.HashMap<>();
                for (String k : keys) found.put(k, "price of " + k);
                return found;
            }
        });
        cache.get("product:1");
        cache.get("product:2");
        Map<String, String> all = cache.getAll(List.of("product:1", "product:2", "product:3", "product:4", "product:5"));
        // #endregion
        Out.emit("exp", "bulk", "lib", "caffeine", "requested", 5, "returned", all.size(), "bulkCalls", bulkCalls);
    }

    /** A loader that reads the same cache for the same key: Caffeine documents this as unsupported. */
    static void recursive() throws Exception {
        Cache<String, String> cache = Caffeine.newBuilder().maximumSize(1_000).build();
        ExecutorService one = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            return t;
        });
        Future<String> f = one.submit(() -> {
            try {
                // #region recursive
                return cache.get("product:42", k -> cache.get("product:42", k2 -> "inner"));
                // #endregion
            } catch (RuntimeException e) {
                return e.getClass().getName() + ": " + e.getMessage();
            }
        });
        String result;
        try {
            result = f.get(3, TimeUnit.SECONDS);
        } catch (java.util.concurrent.TimeoutException e) {
            result = "no answer after 3 s (thread stuck)";
        }
        Out.emit("exp", "recursive", "lib", "caffeine", "result", result);
    }

    /** refreshAfterWrite serves the old value while it reloads; expireAfterWrite makes the reader wait. */
    static void refreshVsExpire() throws Exception {
        for (String mode : List.of("expireAfterWrite", "refreshAfterWrite")) {
            AtomicInteger version = new AtomicInteger();
            Function<String, String> loader = k -> {
                sleep(LOADER_MS);
                return "v" + version.incrementAndGet();
            };
            // #region refresh
            Caffeine<Object, Object> b = Caffeine.newBuilder().maximumSize(1_000);
            LoadingCache<String, String> cache = mode.equals("expireAfterWrite")
                    ? b.expireAfterWrite(Duration.ofMillis(500)).build(loader::apply)
                    : b.refreshAfterWrite(Duration.ofMillis(500)).build(loader::apply);
            // #endregion
            List<Map<String, Object>> reads = new ArrayList<>();
            long start = System.nanoTime();
            for (int i = 0; i < 16; i++) {
                long t0 = System.nanoTime();
                String v = cache.get("product:42");
                reads.add(Map.of("atMs", Math.round(Out.ms(t0 - start)), "tookMs", Out.ms(System.nanoTime() - t0), "value", v));
                sleep(100);
            }
            Out.emit("exp", "refresh", "lib", "caffeine", "mode", mode, "afterMs", 500, "loaderMs", LOADER_MS, "reads", reads);
        }
    }

    /** "CompletionException ← IllegalStateException: database timeout" */
    static String describe(Throwable e) {
        StringBuilder s = new StringBuilder(e.getClass().getSimpleName());
        while (e.getCause() != null) {
            e = e.getCause();
            s.append(" ← ").append(e.getClass().getSimpleName());
        }
        return s.append(": ").append(e.getMessage()).toString();
    }

    static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
