package basics;

import com.github.benmanes.caffeine.cache.AsyncLoadingCache;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import com.github.benmanes.caffeine.cache.RemovalCause;
import com.github.benmanes.caffeine.cache.Ticker;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/** The everyday Caffeine API, one section per task. Each section prints "## <name>" and then what happened. */
final class Using {
    record Product(String id, String name, int priceCents) {}

    static final AtomicInteger loads = new AtomicInteger();

    static Product loadProduct(String id) {
        loads.incrementAndGet();
        return new Product(id, "Product " + id, 1000 + Integer.parseInt(id.substring(1)));
    }

    static void section(String name) {
        System.out.println("## " + name);
    }

    static String show(Product p) {
        return p == null ? "null" : p.name() + " (" + p.priceCents() + ")";
    }

    static void main() throws Exception {
        section("build");
        // #region build
        Cache<String, Product> cache = Caffeine.newBuilder()
                .maximumSize(100)                          // at most 100 entries
                .expireAfterWrite(Duration.ofMinutes(10))  // each entry lives 10 minutes
                .build();
        // #endregion
        System.out.println("estimatedSize() = " + cache.estimatedSize());

        section("get-put");
        // #region get-put
        System.out.println("getIfPresent(\"p1\") = " + show(cache.getIfPresent("p1"))); // a miss: null
        cache.put("p1", loadProduct("p1"));
        System.out.println("getIfPresent(\"p1\") = " + show(cache.getIfPresent("p1"))); // a hit
        System.out.println("asMap().containsKey(\"p2\") = " + cache.asMap().containsKey("p2"));
        // #endregion

        section("loader");
        // #region loader
        // get(key, loader): returns the cached value, or runs the loader once (atomically, like computeIfAbsent).
        loads.set(0);
        cache.get("p7", id -> loadProduct(id));
        cache.get("p7", id -> loadProduct(id));
        System.out.println("two calls for p7 → loader ran " + loads.get() + " time(s)");
        // #endregion

        section("invalidate");
        // #region invalidate
        cache.put("p2", loadProduct("p2"));
        cache.invalidate("p2");   // one key
        System.out.println("after invalidate(\"p2\"): estimatedSize() = " + cache.estimatedSize());
        cache.invalidateAll();    // everything
        System.out.println("after invalidateAll(): estimatedSize() = " + cache.estimatedSize());
        // #endregion

        section("bulk");
        // #region bulk
        for (String id : List.of("p1", "p2", "p3")) cache.put(id, loadProduct(id));
        List<String> wanted = List.of("p1", "p3", "p9");
        System.out.println("getAllPresent = " + cache.getAllPresent(wanted).keySet());
        loads.set(0);
        Map<String, Product> all = cache.getAll(wanted, missing -> {   // one call for all the misses
            System.out.println("bulk loader asked for " + missing);
            Map<String, Product> loaded = new HashMap<>();
            for (String id : missing) loaded.put(id, loadProduct(id));
            return loaded;
        });
        System.out.println("getAll = " + all.keySet() + ", loader ran " + loads.get() + " time(s)");
        // #endregion

        section("iterate");
        // #region iterate
        System.out.println("estimatedSize() = " + cache.estimatedSize());
        cache.asMap().forEach((id, product) -> System.out.println(id + " → " + product.name()));  // no defined order
        cache.policy().eviction().ifPresent(eviction ->
                System.out.println("hottest(2) = " + eviction.hottest(2).keySet()));
        // #endregion

        section("loading");
        // #region loading
        // A LoadingCache knows its loader: get(key) loads on a miss.
        LoadingCache<String, Product> products = Caffeine.newBuilder()
                .maximumSize(100)
                .build(Using::loadProduct);
        loads.set(0);
        products.get("p4");
        products.get("p4");
        System.out.println("get(\"p4\") twice → loader ran " + loads.get() + " time(s)");
        // #endregion

        section("async");
        // #region async
        // An AsyncLoadingCache holds CompletableFutures: concurrent callers share one in-flight load.
        AsyncLoadingCache<String, Product> remote = Caffeine.newBuilder()
                .maximumSize(100)
                .buildAsync(id -> {
                    Thread.sleep(20);   // a slow source, run on the cache's executor
                    return loadProduct(id);
                });
        loads.set(0);
        List<CompletableFuture<Product>> calls = List.of(remote.get("p5"), remote.get("p5"), remote.get("p5"));
        CompletableFuture.allOf(calls.toArray(CompletableFuture[]::new)).join();
        System.out.println("3 concurrent get(\"p5\") → " + calls.stream().map(f -> show(f.join())).toList()
                + "; loader ran " + loads.get() + " time(s)");
        // #endregion

        section("removal");
        // #region removal
        AtomicLong nanos = new AtomicLong();   // a fake clock, so expiry is exact
        Ticker ticker = nanos::get;
        Cache<String, String> small = Caffeine.newBuilder()
                .maximumSize(2)
                .expireAfterWrite(Duration.ofMinutes(1))
                .ticker(ticker)
                .executor(Runnable::run)   // run maintenance and listeners on the caller, not in the background
                .removalListener((String key, String value, RemovalCause cause) ->
                        System.out.println("removed " + key + "=" + value + " (" + cause + ")"))
                .build();
        small.put("a", "v1");
        small.put("a", "v2");   // replaces v1
        small.put("b", "v1");
        small.invalidate("b");
        small.put("c", "v1");
        small.put("d", "v1");   // a third entry in a cache of 2
        small.cleanUp();
        nanos.addAndGet(Duration.ofMinutes(2).toNanos());   // two minutes later
        small.cleanUp();
        // #endregion

        section("stats");
        // #region stats
        Cache<String, Product> counted = Caffeine.newBuilder()
                .maximumSize(100)
                .recordStats()   // off by default
                .build();
        for (String id : List.of("p1", "p2", "p3")) counted.put(id, loadProduct(id));
        for (String id : List.of("p1", "p1", "p2", "p3", "p404")) counted.getIfPresent(id);
        CacheStats stats = counted.stats();
        System.out.println("hitCount = " + stats.hitCount() + ", missCount = " + stats.missCount()
                + ", hitRate = " + String.format("%.2f", stats.hitRate()) + ", evictionCount = " + stats.evictionCount());
        // #endregion
        System.exit(0);
    }
}
