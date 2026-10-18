package demo.tiered;

import demo.tiered.TieredProductCache.Level;
import demo.tiered.TieredProductCache.Read;
import jakarta.inject.Singleton;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.IntFunction;

/**
 * Reads commands from stdin and prints one JSON line per event, so a script can drive two
 * instances side by side:
 *   get ID · update ID PRICE · update-silent ID PRICE · clear-l1 · bench pg|redis|tiered N ·
 * stampede N on|off · quit
 */
@Singleton
public class Shell {
    private final TieredProductCache cache;
    private final String instance = System.getenv().getOrDefault("INSTANCE", "A");

    public Shell(TieredProductCache cache) {
        this.cache = cache;
        cache.onEvict(key -> print("{\"ev\":\"evict\",\"key\":\"%s\",\"reason\":\"pubsub\"}", key));
    }

    public void run() throws IOException, InterruptedException {
        print("{\"ev\":\"ready\"}");
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null; ) {
            String[] a = line.trim().split("\\s+");
            switch (a[0]) {
                case "get" -> get(Integer.parseInt(a[1]));
                case "update", "update-silent" -> {
                    long t = System.nanoTime();
                    int version = cache.updatePrice(Integer.parseInt(a[1]), Integer.parseInt(a[2]), a[0].equals("update"));
                    print("{\"ev\":\"update\",\"key\":\"product:%s\",\"price\":%s,\"version\":%d,\"publish\":%b,\"ms\":%.3f}",
                            a[1], a[2], version, a[0].equals("update"), ms(t));
                }
                case "clear-l1" -> {
                    cache.clearL1();
                    print("{\"ev\":\"clear-l1\"}");
                }
                case "bench" -> bench(a[1], Integer.parseInt(a[2]));
                case "stampede" -> stampede(Integer.parseInt(a[1]), a[2].equals("on"));
                case "quit" -> {
                    return;
                }
                default -> print("{\"ev\":\"error\",\"message\":\"unknown command %s\"}", a[0]);
            }
        }
    }

    private void get(int id) {
        long t = System.nanoTime();
        Read r = cache.get(id);
        Product p = r.product();
        print("{\"ev\":\"get\",\"key\":\"product:%d\",\"served\":\"%s\",\"ms\":%.3f,\"version\":%d,\"price\":%d}",
                id, r.level(), ms(t), p.version(), p.priceCents());
    }

    /** N reads of Zipf-distributed products through one strategy; where each was served and how
     * long it took. */
    private void bench(String mode, int n) {
        IntFunction<Read> read = switch (mode) {
            case "pg" -> cache::getFromDatabase;
            case "redis" -> cache::getRedisOnly;
            default -> cache::get;
        };
        cache.clearL1();
        Zipf zipf = new Zipf(10_000, 1.1, 42);
        Map<Level, Integer> served = new EnumMap<>(Level.class);
        double[] micros = new double[n];
        long queriesBefore = cache.databaseQueries();
        long start = System.nanoTime();
        for (int i = 0; i < n; i++) {
            int id = zipf.next();
            long t = System.nanoTime();
            Read r = read.apply(id);
            micros[i] = (System.nanoTime() - t) / 1_000.0;
            served.merge(r.level(), 1, Integer::sum);
        }
        double seconds = (System.nanoTime() - start) / 1e9;
        Arrays.sort(micros);
        print("{\"ev\":\"bench\",\"mode\":\"%s\",\"n\":%d,\"l1\":%d,\"l2\":%d,\"pg\":%d,\"pgQueries\":%d,\"p50us\":%.1f,\"p95us\":%.1f,\"p99us\":%.1f,\"avgUs\":%.1f,\"readsPerSec\":%.0f}",
                mode, n, served.getOrDefault(Level.L1, 0), served.getOrDefault(Level.L2, 0), served.getOrDefault(Level.PG, 0),
                cache.databaseQueries() - queriesBefore, micros[n / 2], micros[(int) (n * 0.95)], micros[(int) (n * 0.99)],
                Arrays.stream(micros).average().orElse(0), n / seconds);
    }

    /** N threads ask for the same cold product at once; how many of them reached Postgres. */
    private void stampede(int n, boolean coalesce) throws InterruptedException {
        cache.forget(7);
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch go = new CountDownLatch(1), done = new CountDownLatch(n);
        long before = cache.databaseQueries();
        for (int i = 0; i < n; i++) {
            pool.submit(() -> {
                try {
                    go.await();
                    if (coalesce) cache.get(7);
                    else cache.getUncoalesced(7);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            });
        }
        long t = System.nanoTime();
        go.countDown();
        done.await();
        pool.shutdown();
        print("{\"ev\":\"stampede\",\"n\":%d,\"coalesce\":%b,\"pgQueries\":%d,\"ms\":%.3f}", n, coalesce, cache.databaseQueries() - before, ms(t));
    }

    private static double ms(long since) {
        return (System.nanoTime() - since) / 1e6;
    }

    private void print(String format, Object... args) {
        String body = String.format(Locale.ROOT, format, args);
        System.out.println("{\"inst\":\"" + instance + "\"," + body.substring(1));
        System.out.flush();
    }
}
