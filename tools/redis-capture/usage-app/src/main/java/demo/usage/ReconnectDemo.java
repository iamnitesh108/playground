package demo.usage;

import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import jakarta.inject.Singleton;

import static demo.usage.Out.say;
import static demo.usage.Out.show;

/** INCR every 250 ms while the server restarts: Lettuce reconnects by itself. */
@Singleton
public class ReconnectDemo {

    private final StatefulRedisConnection<String, String> connection;

    public ReconnectDemo(StatefulRedisConnection<String, String> connection) {
        this.connection = connection;
    }

    public void run() throws InterruptedException {
        RedisCommands<String, String> redis = connection.sync();
        redis.del("visits");
        long start = System.currentTimeMillis();
        for (int i = 0; i < 24; i++) {
            long t = System.currentTimeMillis();
            try {
                Long value = redis.incr("visits");
                show(String.format("%5d ms  incr(\"visits\")", t - start), value + (System.currentTimeMillis() - t > 100 ? "  (waited " + (System.currentTimeMillis() - t) + " ms)" : ""));
            } catch (RuntimeException e) {
                show(String.format("%5d ms  incr(\"visits\")", t - start), e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            Thread.sleep(250);
        }
        say("done");
    }
}
