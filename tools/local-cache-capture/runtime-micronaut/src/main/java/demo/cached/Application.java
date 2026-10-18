package demo.cached;

import com.github.benmanes.caffeine.cache.Cache;
import io.micronaut.cache.CacheManager;
import io.micronaut.context.ApplicationContext;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.function.LongFunction;

/** Calls the cached service and prints what ran, as JSON lines. */
public class Application {
    public static void main(String[] args) throws Exception {
        try (ApplicationContext ctx = ApplicationContext.run()) {
            ProductService products = ctx.getBean(ProductService.class);
            List<String> calls = new ArrayList<>();
            String[] script = {"find 42", "find 42", "find 7", "changePriceWrongKey 42", "find 42", "changePrice 42", "find 42", "find 42"};
            for (String step : script) {
                int before = products.queries.get();
                String[] p = step.split(" ");
                long id = Long.parseLong(p[1]);
                switch (p[0]) {
                    case "find" -> products.find(id);
                    case "changePriceWrongKey" -> products.changePriceWrongKey(id, 2499);
                    default -> products.changePrice(id, 2499);
                }
                calls.add("{\"call\":\"" + step + "\",\"ranMethod\":" + (products.queries.get() > before) + "}");
            }
            System.out.println("{\"exp\":\"micronaut\",\"steps\":[" + String.join(",", calls) + "]}");

            @SuppressWarnings("unchecked")
            Cache<Object, Object> nativeCache = (Cache<Object, Object>) ctx.getBean(CacheManager.class).getCache("products").getNativeCache();
            var policy = nativeCache.policy();
            System.out.println("{\"exp\":\"micronautNative\",\"class\":\"" + nativeCache.getClass().getSimpleName()
                    + "\",\"maximum\":" + policy.eviction().map(e -> e.getMaximum()).orElse(-1L)
                    + ",\"expireAfterWriteSeconds\":" + policy.expireAfterWrite().map(e -> e.getExpiresAfter().toSeconds()).orElse(-1L)
                    + ",\"stats\":\"" + nativeCache.stats() + "\",\"keys\":\"" + nativeCache.asMap().keySet() + "\"}");

            stampede("atomic = false (default)", products, products::findNonAtomic, 101);
            stampede("atomic = true", products, products::findAtomic, 102);
        }
    }

    /** 20 threads miss the same id at once. */
    static void stampede(String mode, ProductService products, LongFunction<Product> find, long id) throws Exception {
        int before = products.queries.get();
        CountDownLatch go = new CountDownLatch(1);
        List<Thread> threads = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            Thread t = new Thread(() -> {
                try {
                    go.await();
                } catch (InterruptedException e) {
                    return;
                }
                find.apply(id);
            });
            t.start();
            threads.add(t);
        }
        go.countDown();
        for (Thread t : threads) t.join();
        System.out.println("{\"exp\":\"micronautStampede\",\"mode\":\"" + mode + "\",\"callers\":20,\"methodCalls\":" + (products.queries.get() - before) + "}");
    }
}
