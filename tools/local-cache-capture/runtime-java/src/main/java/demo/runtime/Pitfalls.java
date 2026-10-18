package demo.runtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.List;

/** Two mistakes that compile fine: a mutable cached object, and a key without equals/hashCode. */
final class Pitfalls {
    /** A mutable value: a plain class with a setter. */
    static final class Cart {
        final List<String> items;
        int totalCents;

        Cart(List<String> items, int totalCents) {
            this.items = items;
            this.totalCents = totalCents;
        }
    }

    // #region badKey
    /** A key class that forgot equals() and hashCode(): two equal-looking keys are different objects. */
    static final class ProductKey {
        final String region;
        final long id;

        ProductKey(String region, long id) {
            this.region = region;
            this.id = id;
        }
    }

    /** The fix: a record gets equals() and hashCode() from its fields. */
    record GoodKey(String region, long id) {}
    // #endregion

    static void run() {
        // Caffeine.newBuilder().build() has no bound at all
        Cache<Long, Long> unbounded = Caffeine.newBuilder().build();
        Out.emit("exp", "unbounded", "lib", "caffeine", "result", "newBuilder().build(): policy().eviction() = "
                + unbounded.policy().eviction().map(e -> "maximum " + e.getMaximum()).orElse("empty (no size bound)"));

        // #region mutation
        // 1. one caller changes the object it got from the cache…
        Cache<String, Cart> carts = Caffeine.newBuilder().maximumSize(100).build();
        carts.put("cart:7", new Cart(new java.util.ArrayList<>(List.of("book")), 1200));
        Cart mine = carts.getIfPresent("cart:7");
        mine.totalCents = 0;                         // e.g. applying a discount for this request only
        mine.items.add("free gift");
        // …and every later reader sees it, without a put
        Cart other = carts.getIfPresent("cart:7");
        // #endregion
        Out.emit("exp", "mutation", "lib", "caffeine", "sameObject", mine == other, "otherSees",
                other.items + " total " + other.totalCents, "originalTotal", 1200);

        // 2. a key without equals/hashCode never hits
        Cache<ProductKey, String> bad = Caffeine.newBuilder().maximumSize(10_000).recordStats().build();
        Cache<GoodKey, String> good = Caffeine.newBuilder().maximumSize(10_000).recordStats().build();
        for (int i = 0; i < 1_000; i++) {
            bad.get(new ProductKey("eu", i % 10), k -> "product");
            good.get(new GoodKey("eu", i % 10), k -> "product");
        }
        bad.cleanUp();
        good.cleanUp();
        Out.emit("exp", "badKey", "lib", "caffeine", "reads", 1_000, "distinctProducts", 10,
                "badHits", bad.stats().hitCount(), "badSize", bad.estimatedSize(),
                "goodHits", good.stats().hitCount(), "goodSize", good.estimatedSize());
    }
}
