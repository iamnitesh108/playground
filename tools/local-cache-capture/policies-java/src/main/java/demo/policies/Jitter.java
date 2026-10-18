package demo.policies;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import com.github.benmanes.caffeine.cache.LoadingCache;
import java.time.Duration;
import java.util.Random;

/**
 * 1,000 keys loaded at the same moment, then every key read once a second for 3 minutes (hand-moved clock).
 * A fixed 60 s lifetime makes them all expire, and reload, in the same second; ±10 % jitter spreads the reloads.
 */
final class Jitter {
    static final int KEYS = 1_000;
    static final int SECONDS = 180;
    static final Duration TTL = Duration.ofSeconds(60);

    static void run() {
        for (boolean jitter : new boolean[] { false, true }) {
            FakeTicker ticker = new FakeTicker();
            long[] loads = new long[SECONDS + 1];
            Caffeine<Object, Object> builder = Caffeine.newBuilder().ticker(ticker).executor(Runnable::run);
            LoadingCache<Integer, Integer> cache = (jitter ? builder.expireAfter(new Jittered(new Random(42))) : builder.expireAfterWrite(TTL))
                    .build(key -> {
                        loads[(int) ticker.seconds()]++;
                        return key;
                    });
            for (int s = 0; s <= SECONDS; s++) {
                for (int key = 0; key < KEYS; key++) cache.get(key);
                ticker.advance(Duration.ofSeconds(1));
            }
            Json.of("jitter", jitter).with("loadsPerSecond", loads).print();
        }
    }

    /** Each entry lives 60 s ± 10 %, chosen when it is loaded. */
    record Jittered(Random random) implements Expiry<Object, Object> {
        @Override
        public long expireAfterCreate(Object key, Object value, long currentTime) {
            return (long) (TTL.toNanos() * (0.9 + 0.2 * random.nextDouble()));
        }

        @Override
        public long expireAfterUpdate(Object key, Object value, long currentTime, long currentDuration) {
            return expireAfterCreate(key, value, currentTime);
        }

        @Override
        public long expireAfterRead(Object key, Object value, long currentTime, long currentDuration) {
            return currentDuration;
        }
    }

    private Jitter() {}
}
