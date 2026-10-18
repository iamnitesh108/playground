package demo.runtime;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Measurement;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.binder.cache.CaffeineCacheMetrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.micrometer.prometheus.PrometheusConfig;
import io.micrometer.prometheus.PrometheusMeterRegistry;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.LockSupport;
import java.util.stream.Collectors;

/** recordStats(): the numbers Caffeine keeps, and the meters Micrometer exports from them. */
final class Stats {
    static void run() {
        // #region stats
        LoadingCache<Integer, String> cache = Caffeine.newBuilder()
                .maximumSize(1_000)
                .recordStats()                                  // off by default: counting costs a little
                .build(id -> {
                    LockSupport.parkNanos(100_000);             // a 0.1 ms query
                    return "product " + id;
                });
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        CaffeineCacheMetrics.monitor(registry, cache, "products");
        PrometheusMeterRegistry prometheus = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
        CaffeineCacheMetrics.monitor(prometheus, cache, "products");     // what a /metrics endpoint would serve
        // #endregion

        int[] trace = Zipf.trace(20_000, 10_000, 0.99, 5);
        for (int id : trace) cache.get(id);
        cache.cleanUp();

        // #region statsRead
        CacheStats s = cache.stats();
        Map<String, Object> stats = new LinkedHashMap<>();
        // #endregion
        stats.put("requestCount", s.requestCount());
        stats.put("hitCount", s.hitCount());
        stats.put("missCount", s.missCount());
        stats.put("hitRate", s.hitRate());
        stats.put("missRate", s.missRate());
        stats.put("loadSuccessCount", s.loadSuccessCount());
        stats.put("loadFailureCount", s.loadFailureCount());
        stats.put("totalLoadTime", s.totalLoadTime());
        stats.put("averageLoadPenalty", s.averageLoadPenalty());
        stats.put("evictionCount", s.evictionCount());
        stats.put("evictionWeight", s.evictionWeight());
        Out.emit("exp", "stats", "lib", "caffeine", "requests", trace.length, "keys", 10_000, "maximumSize", 1_000,
                "stats", stats, "toString", s.toString(), "estimatedSize", cache.estimatedSize());

        List<Map<String, Object>> meters = new ArrayList<>();
        for (Meter m : registry.getMeters().stream().sorted(Comparator.comparing((Meter x) -> x.getId().getName())
                .thenComparing(x -> x.getId().getTags().toString())).toList()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", m.getId().getName());
            row.put("type", m.getId().getType().name().toLowerCase());
            row.put("tags", m.getId().getTags().stream().filter(t -> !t.getKey().equals("cache")).map(Tag::getValue)
                    .collect(Collectors.joining(",")));
            Measurement first = m.measure().iterator().next();
            row.put("value", first.getValue());
            row.put("description", m.getId().getDescription());
            meters.add(row);
        }
        Out.emit("exp", "meters", "lib", "caffeine", "cacheTag", "products", "meters", meters);
        List<String> scrape = prometheus.scrape().lines().filter(l -> l.startsWith("cache_")).sorted().toList();
        Out.emit("exp", "prometheus", "lib", "caffeine", "lines", scrape);
    }
}
