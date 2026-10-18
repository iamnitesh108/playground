package demo.usage;

import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.pubsub.RedisPubSubAdapter;
import io.lettuce.core.pubsub.StatefulRedisPubSubConnection;
import jakarta.inject.Singleton;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static demo.usage.Out.say;
import static demo.usage.Out.show;

/** Publish and subscribe. A subscribed connection can do nothing else, so it is a separate one. */
@Singleton
public class PubSubDemo {

    private final RedisClient client;
    private final StatefulRedisConnection<String, String> connection;

    public PubSubDemo(RedisClient client, StatefulRedisConnection<String, String> connection) {
        this.client = client;
        this.connection = connection;
    }

    public void run() throws InterruptedException {
        CountDownLatch received = new CountDownLatch(2);
        try (StatefulRedisPubSubConnection<String, String> sub = client.connectPubSub()) {
            sub.addListener(new RedisPubSubAdapter<>() {
                @Override
                public void message(String channel, String message) {
                    show("listener got", channel + ": " + message);
                    received.countDown();
                }
            });
            sub.sync().subscribe("orders");
            say("subscribed to orders");
            show("publish(\"orders\", \"order 1001 paid\")", connection.sync().publish("orders", "order 1001 paid"));
            show("publish(\"orders\", \"order 1002 paid\")", connection.sync().publish("orders", "order 1002 paid"));
            received.await(2, TimeUnit.SECONDS);
        }
        show("publish(\"orders\", \"order 1003 paid\") after unsubscribing", connection.sync().publish("orders", "order 1003 paid"));
    }
}
