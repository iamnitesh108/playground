package demo.runtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;

/** A cache bounded by bytes, not by entries: which entries go when the weight is exceeded. */
final class Weight {
    static final long MAX_BYTES = 1_000_000;   // 1 MB budget

    // #region weight
    // the cached value is a rendered image (or page, or JSON) whose size varies
    static Cache<String, byte[]> newCache(List<String> evicted) {
        return Caffeine.newBuilder()
                .maximumWeight(MAX_BYTES)
                .weigher((String key, byte[] value) -> value.length)
                .removalListener((String key, byte[] value, com.github.benmanes.caffeine.cache.RemovalCause cause) ->
                        evicted.add(key + " (" + cause + ")"))
                .executor(Runnable::run)        // run maintenance on the caller, so the trace is in order
                .build();
    }
    // #endregion

    static void run() {
        List<String> evicted = new ArrayList<>();
        Cache<String, byte[]> cache = newCache(evicted);
        String[][] steps = {
            {"put", "a", "300000"}, {"put", "b", "300000"}, {"get", "a"}, {"get", "a"}, {"put", "c", "300000"},
            {"put", "d", "200000"}, {"put", "d", "200000"}, {"put", "e", "400000"}, {"put", "e", "400000"},
            {"put", "e", "400000"}, {"put", "huge", "2000000"},
        };
        for (String[] s : steps) {
            if (s[0].equals("put")) cache.put(s[1], new byte[Integer.parseInt(s[2])]);
            else cache.getIfPresent(s[1]);
            cache.cleanUp();
            Out.emit("exp", "weight", "lib", "caffeine", "op", s[0], "key", s[1], "bytes", s.length > 2 ? Integer.parseInt(s[2]) : 0,
                    "present", new TreeMap<>(cache.asMap()).keySet(), "weightedSize", cache.policy().eviction().get().weightedSize().getAsLong(),
                    "evicted", new ArrayList<>(evicted));
            evicted.clear();
        }
    }
}
