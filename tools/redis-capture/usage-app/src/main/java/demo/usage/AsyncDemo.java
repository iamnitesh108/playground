package demo.usage;

import io.lettuce.core.RedisFuture;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.async.RedisAsyncCommands;
import io.lettuce.core.api.reactive.RedisReactiveCommands;
import jakarta.inject.Singleton;
import reactor.core.publisher.Flux;

import java.util.List;

import static demo.usage.Out.say;
import static demo.usage.Out.show;

/** The same connection, used without blocking: futures and Reactor types. */
@Singleton
public class AsyncDemo {

    private final RedisAsyncCommands<String, String> async;
    private final RedisReactiveCommands<String, String> reactive;

    public AsyncDemo(StatefulRedisConnection<String, String> connection) {
        this.async = connection.async();
        this.reactive = connection.reactive();
    }

    public void run() throws Exception {
        say("async: the call returns at once, the reply completes the future later");
        RedisFuture<String> set = async.set("greeting", "hello");
        RedisFuture<String> get = async.get("greeting");
        show("async.set(\"greeting\", \"hello\").get()", set.get());
        show("async.get(\"greeting\").get()", get.get());

        say("reactive: build a pipeline of operations, nothing runs until subscribed");
        List<Long> counts = Flux.just("a", "b", "c")
                .flatMap(item -> reactive.incr("counter:" + item))
                .collectList()
                .block();
        show("Flux(a, b, c).flatMap(reactive.incr(\"counter:\" + item))", counts);
    }
}
