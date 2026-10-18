package demo.usage;

import io.lettuce.core.RedisClient;
import io.lettuce.core.TransactionResult;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import jakarta.inject.Singleton;

import static demo.usage.Out.say;
import static demo.usage.Out.show;

/**
 * Optimistic locking from code. WATCH belongs to a connection, so a transaction with WATCH
 * needs a connection of its own (not the shared one other threads also use).
 */
@Singleton
public class WatchDemo {

    private final RedisClient client;

    public WatchDemo(RedisClient client) {
        this.client = client;
    }

    public void run() {
        try (StatefulRedisConnection<String, String> mine = client.connect();
             StatefulRedisConnection<String, String> other = client.connect()) {
            RedisCommands<String, String> redis = mine.sync();
            redis.set("balance:7", "100");

            for (int attempt = 1; attempt <= 3; attempt++) {
                redis.watch("balance:7");
                int balance = Integer.parseInt(redis.get("balance:7"));
                if (attempt == 1) {
                    say("meanwhile another client changes the balance");
                    show("other.incrby(\"balance:7\", 50)", other.sync().incrby("balance:7", 50));
                }
                redis.multi();
                redis.set("balance:7", String.valueOf(balance - 30));
                TransactionResult result = redis.exec();
                show("attempt " + attempt + ": read " + balance + ", exec()", result.wasDiscarded() ? "discarded (balance changed) - retry" : "committed " + result);
                if (!result.wasDiscarded()) break;
            }
            show("get(\"balance:7\")", redis.get("balance:7"));
        }
    }
}
