package demo.usage;

import io.lettuce.core.LettuceFutures;
import io.lettuce.core.RedisFuture;
import io.lettuce.core.TransactionResult;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.async.RedisAsyncCommands;
import io.lettuce.core.api.sync.RedisCommands;
import jakarta.inject.Singleton;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static demo.usage.Out.say;
import static demo.usage.Out.show;

/** Many commands at once: a pipeline (fast, not atomic) and MULTI/EXEC (atomic). */
@Singleton
public class PipelineDemo {

    private static final int N = 10_000;

    private final StatefulRedisConnection<String, String> connection;

    public PipelineDemo(StatefulRedisConnection<String, String> connection) {
        this.connection = connection;
    }

    public void run() {
        RedisCommands<String, String> redis = connection.sync();
        redis.del("hits");

        say(N + " INCRs one by one: each call waits for its reply");
        long t = System.nanoTime();
        for (int i = 0; i < N; i++) redis.incr("hits");
        show("sync loop", ms(t));

        say(N + " INCRs as one pipeline: queue them all, send once, then wait");
        RedisAsyncCommands<String, String> async = connection.async();
        t = System.nanoTime();
        connection.setAutoFlushCommands(false);
        List<RedisFuture<Long>> futures = new ArrayList<>(N);
        for (int i = 0; i < N; i++) futures.add(async.incr("hits"));
        connection.flushCommands();
        LettuceFutures.awaitAll(Duration.ofSeconds(10), futures.toArray(new RedisFuture[0]));
        connection.setAutoFlushCommands(true);
        show("pipeline", ms(t));
        show("get(\"hits\")", redis.get("hits"));

        say("a transaction: queued, then executed as one unit");
        show("multi()", redis.multi());
        show("decrby(\"stock:42\", 3)", redis.decrby("stock:42", 3));
        show("rpush(\"orders:42\", \"order-1001\")", redis.rpush("orders:42", "order-1001"));
        TransactionResult result = redis.exec();
        show("exec()", result);
        show("exec().wasDiscarded()", result.wasDiscarded());
    }

    private static String ms(long start) {
        return String.format("%.1f ms", (System.nanoTime() - start) / 1e6);
    }
}
