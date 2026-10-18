package demo.usage;

import io.lettuce.core.RedisCommandTimeoutException;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import jakarta.inject.Singleton;

import static demo.usage.Out.say;
import static demo.usage.Out.show;

/** A command timeout (?timeout= in redis.uri) while the server is busy with something else. */
@Singleton
public class TimeoutDemo {

    private final StatefulRedisConnection<String, String> connection;

    public TimeoutDemo(StatefulRedisConnection<String, String> connection) {
        this.connection = connection;
    }

    public void run() throws InterruptedException {
        RedisCommands<String, String> redis = connection.sync();
        redis.set("user:1:name", "Ann");
        show("timeout for every command", connection.getTimeout());
        say("ready");                       // the recording now makes the server busy for 2 s
        Thread.sleep(300);
        long t = System.nanoTime();
        try {
            redis.get("user:1:name");
        } catch (RedisCommandTimeoutException e) {
            show("get(\"user:1:name\") after " + ms(t), e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        Thread.sleep(2500);
        t = System.nanoTime();
        show("get(\"user:1:name\") again, after " + ms(t) + " (connection still usable)", redis.get("user:1:name"));
    }

    private static String ms(long start) {
        return String.format("%d ms", (System.nanoTime() - start) / 1_000_000);
    }
}
