package demo.policies;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/** A few requests against a tiny cache: after each one, what was evicted and what is left. */
final class Order {
    static void run(String[] args) {
        int maximumSize = Integer.parseInt(args[0]);
        List<String> evicted = new ArrayList<>();
        Cache<String, String> cache = Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .executor(Runnable::run)
                .removalListener((String key, String value, com.github.benmanes.caffeine.cache.RemovalCause cause) -> evicted.add(key))
                .build();
        for (int i = 1; i < args.length; i++) {
            String key = args[i];
            boolean hit = cache.getIfPresent(key) != null;
            if (!hit) cache.put(key, key);
            cache.cleanUp(); // run the pending maintenance now, so the listener has fired
            Json.of("lib", "caffeine").with("step", i).with("key", key).with("hit", hit)
                    .with("evicted", List.copyOf(evicted))
                    .with("contents", new TreeSet<>(cache.asMap().keySet()))
                    .print();
            evicted.clear();
        }
    }

    private Order() {}
}
