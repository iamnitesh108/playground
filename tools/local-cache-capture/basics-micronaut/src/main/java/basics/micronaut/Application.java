package basics.micronaut;

import com.github.benmanes.caffeine.cache.Cache;
import io.micronaut.cache.SyncCache;
import io.micronaut.context.ApplicationContext;
import io.micronaut.inject.qualifiers.Qualifiers;

/** Calls the cached service and prints what ran: the method body, or the cache. */
public class Application {
    static void find(ProductService service, String label) {
        Product p = service.find("p1");
        System.out.println(label + " find(\"p1\") → " + p.priceCents() + ", method ran " + service.calls.get() + " time(s)");
    }

    public static void main(String[] args) {
        try (ApplicationContext context = ApplicationContext.run()) {
            ProductService service = context.getBean(ProductService.class);
            find(service, "#1");
            find(service, "#2");
            find(service, "#3");
            service.updatePriceWrongKey("p1", 1899);
            System.out.println("   updatePriceWrongKey(\"p1\", 1899)   @CacheInvalidate on (id, priceCents)");
            find(service, "#4");
            service.updatePrice("p1", 1799);
            System.out.println("   updatePrice(\"p1\", 1799)           @CacheInvalidate(parameters = \"id\")");
            find(service, "#5");

            SyncCache<?> products = context.getBean(SyncCache.class, Qualifiers.byName("products"));
            Cache<?, ?> caffeine = (Cache<?, ?>) products.getNativeCache();
            System.out.println("native cache: " + caffeine.getClass().getSimpleName()
                    + ", maximum = " + caffeine.policy().eviction().orElseThrow().getMaximum()
                    + ", expireAfterWrite = " + caffeine.policy().expireAfterWrite().orElseThrow().getExpiresAfter());
            var stats = caffeine.stats();
            System.out.println("stats: hitCount = " + stats.hitCount() + ", missCount = " + stats.missCount());
        }
    }
}
