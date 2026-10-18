package demo.tiered;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.lettuce.core.SetArgs;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.pubsub.RedisPubSubAdapter;
import io.lettuce.core.pubsub.StatefulRedisPubSubConnection;
import io.micronaut.context.annotation.Value;
import io.micronaut.serde.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.inject.Singleton;
import java.io.IOException;
import java.time.Duration;
import java.util.function.Consumer;

/**
 * Product pages through three levels: Caffeine in this JVM (L1), Redis shared by every instance
 * (L2), Postgres (the
 * source of truth). Reads fall through the levels and fill them on the way back; writes go to
 * Postgres, delete the
 * Redis copy and tell every instance, over Pub/Sub, to drop its Caffeine copy.
 */
@Singleton
public class TieredProductCache {
    public static final String CHANNEL = "cache:invalidate";

    /** Which level answered a read. */
    public enum Level { L1, L2, PG }

    public record Read(Product product, Level level) {}

    private final ProductRepository repository;
    private final RedisCommands<String, String> redis;
    private final StatefulRedisPubSubConnection<String, String> pubSub;
    private final ObjectMapper json;
    private final Duration l2Ttl;
    private Cache<Integer, Read> l1;
    private final Duration l1Ttl;
    private final long l1MaxSize;
    private Consumer<String> onEvict = key -> {};

    public TieredProductCache(ProductRepository repository, StatefulRedisConnection<String, String> redis,
                              StatefulRedisPubSubConnection<String, String> pubSub, ObjectMapper json,
                              @Value("${cache.l1.ttl}") Duration l1Ttl, @Value("${cache.l1.max-size}") long l1MaxSize,
                              @Value("${cache.l2.ttl}") Duration l2Ttl) {
        this.repository = repository;
        this.redis = redis.sync();
        this.pubSub = pubSub;
        this.json = json;
        this.l1Ttl = l1Ttl;
        this.l1MaxSize = l1MaxSize;
        this.l2Ttl = l2Ttl;
        this.l1 = newL1();
    }

    private Cache<Integer, Read> newL1() {
        // a short TTL is the safety net if an invalidation message is ever missed
        return Caffeine.newBuilder()
                .maximumSize(l1MaxSize)
                .expireAfterWrite(l1Ttl)
                .build();
    }

    @PostConstruct
    void listen() {
        pubSub.addListener(new RedisPubSubAdapter<>() {
            @Override
            public void message(String channel, String key) {
                l1.invalidate(Integer.parseInt(key.substring("product:".length())));
                onEvict.accept(key);
            }
        });
        pubSub.sync().subscribe(CHANNEL);
    }

    public void onEvict(Consumer<String> listener) {
        this.onEvict = listener;
    }

    /**
     * L1 → L2 → Postgres. Caffeine's get(key, loader) runs the loader once per key even when
     * many threads ask at the
     * same moment (the others wait for it): a stampede on one instance becomes a single
     * Redis/Postgres read.
     */
    public Read get(int id) {
        Read[] loaded = new Read[1];
        Read cached = l1.get(id, k -> loaded[0] = loadBelowL1(k));
        if (cached == null) return new Read(null, Level.PG);
        return loaded[0] != null ? loaded[0] : new Read(cached.product(), Level.L1);
    }

    /** The same read without single-flight: every caller that misses loads on its own. */
    public Read getUncoalesced(int id) {
        Read cached = l1.getIfPresent(id);
        if (cached != null) return new Read(cached.product(), Level.L1);
        Read loaded = loadBelowL1(id);
        if (loaded != null) l1.put(id, loaded);
        return loaded;
    }

    /** No cache at all: every read is a Postgres query, for comparison. */
    public Read getFromDatabase(int id) {
        return new Read(repository.load(id), Level.PG);
    }

    /** Redis only: the classic single-level cache-aside, for comparison. */
    public Read getRedisOnly(int id) {
        return loadBelowL1(id);
    }

    private Read loadBelowL1(int id) {
        String key = "product:" + id;
        String hit = redis.get(key);
        if (hit != null) return new Read(read(hit), Level.L2);
        Product product = repository.load(id);
        if (product == null) return null;
        redis.set(key, write(product), SetArgs.Builder.ex(l2Ttl));
        return new Read(product, Level.PG);
    }

    /**
     * The write path: Postgres first, then delete (not update) the Redis copy, then tell every
     * instance to drop
     * its L1 copy. With publish = false the last step is skipped, to show what an instance
     * without it serves.
     */
    public int updatePrice(int id, int priceCents, boolean publish) {
        int version = repository.updatePrice(id, priceCents);
        String key = "product:" + id;
        redis.del(key);
        if (publish) redis.publish(CHANNEL, key);
        return version;
    }

    /** Makes a product cold in both caches of this instance. */
    public void forget(int id) {
        l1.invalidate(id);
        redis.del("product:" + id);
    }

    public void clearL1() {
        l1.invalidateAll();
        l1 = newL1();
    }

    public long databaseQueries() {
        return repository.queries();
    }

    private Product read(String value) {
        try {
            return json.readValue(value, Product.class);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private String write(Product product) {
        try {
            return json.writeValueAsString(product);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
