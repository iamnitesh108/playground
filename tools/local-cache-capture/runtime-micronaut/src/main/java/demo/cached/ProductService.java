package demo.cached;

import io.micronaut.cache.annotation.CacheConfig;
import io.micronaut.cache.annotation.CacheInvalidate;
import io.micronaut.cache.annotation.Cacheable;
import jakarta.inject.Singleton;
import java.util.concurrent.atomic.AtomicInteger;

@Singleton
@CacheConfig("products")
public class ProductService {
    final AtomicInteger queries = new AtomicInteger();

    /** The first call per id runs the query; later calls are answered by the "products" Caffeine cache. */
    @Cacheable
    public Product find(long id) {
        return query(id);
    }

    /** atomic = true: concurrent misses for one id wait for a single call (Caffeine's get(key, loader)). */
    @Cacheable(value = "slow-products", atomic = true)
    public Product findAtomic(long id) {
        return slowQuery(id);
    }

    /** The default (atomic = false): every concurrent miss runs the method. */
    @Cacheable("slow-products")
    public Product findNonAtomic(long id) {
        return slowQuery(id);
    }

    /** Wrong: the key is built from every parameter, (id, priceCents), so the cached find(id) entry stays. */
    @CacheInvalidate
    public void changePriceWrongKey(long id, int priceCents) {
        queries.incrementAndGet();          // UPDATE products SET price_cents = ? WHERE id = ?
    }

    /** Right: the key is built from id only, the same key find(id) used. */
    @CacheInvalidate(parameters = "id")
    public void changePrice(long id, int priceCents) {
        queries.incrementAndGet();          // UPDATE products SET price_cents = ? WHERE id = ?
    }

    private Product query(long id) {
        queries.incrementAndGet();          // stands in for SELECT … FROM products WHERE id = ?
        return new Product(id, "Product " + id, 1999);
    }

    private Product slowQuery(long id) {
        try {
            Thread.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return query(id);
    }
}
