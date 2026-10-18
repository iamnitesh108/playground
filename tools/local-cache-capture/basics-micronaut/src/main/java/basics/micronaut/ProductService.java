package basics.micronaut;

import io.micronaut.cache.annotation.CacheConfig;
import io.micronaut.cache.annotation.CacheInvalidate;
import io.micronaut.cache.annotation.Cacheable;
import jakarta.inject.Singleton;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** A service whose reads are cached by annotation; the cache "products" is configured in application.yml. */
@Singleton
@CacheConfig("products")
public class ProductService {
    private final Map<String, Integer> prices = new ConcurrentHashMap<>(Map.of("p1", 1999, "p2", 2499));
    final AtomicInteger calls = new AtomicInteger();

    @Cacheable   // key = the arguments (here: id); on a hit the method body does not run
    public Product find(String id) {
        calls.incrementAndGet();   // stands in for a database query
        return new Product(id, "Product " + id, prices.get(id));
    }

    @CacheInvalidate(parameters = "id")   // after the update, remove the entry cached for this id
    public void updatePrice(String id, int priceCents) {
        prices.put(id, priceCents);
    }

    @CacheInvalidate   // wrong: the key is built from (id, priceCents), which find() never cached
    public void updatePriceWrongKey(String id, int priceCents) {
        prices.put(id, priceCents);
    }
}
