package demo.usage;

import io.lettuce.core.KeyScanCursor;
import io.lettuce.core.KeyValue;
import io.lettuce.core.ScanArgs;
import io.lettuce.core.ScanCursor;
import io.lettuce.core.SetArgs;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import jakarta.inject.Singleton;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static demo.usage.Out.say;
import static demo.usage.Out.show;

/** The everyday commands through Lettuce's synchronous API. */
@Singleton
public class UsageDemo {

    private final RedisCommands<String, String> redis;

    // Micronaut creates one connection from redis.uri; it is thread-safe and shared by the whole app
    public UsageDemo(StatefulRedisConnection<String, String> connection) {
        this.redis = connection.sync();
    }

    public void run() {
        redis.flushdb();

        say("strings");
        show("set(\"user:1:name\", \"Ann\")", redis.set("user:1:name", "Ann"));
        show("get(\"user:1:name\")", redis.get("user:1:name"));
        show("get(\"user:2:name\")", redis.get("user:2:name"));
        show("set(\"lock:report\", \"worker-1\", nx().ex(30))", redis.set("lock:report", "worker-1", SetArgs.Builder.nx().ex(30)));
        show("set(\"lock:report\", \"worker-2\", nx().ex(30))", redis.set("lock:report", "worker-2", SetArgs.Builder.nx().ex(30)));
        show("mget(\"user:1:name\", \"user:2:name\")", redis.mget("user:1:name", "user:2:name"));
        show("exists(\"user:1:name\")", redis.exists("user:1:name"));
        show("del(\"user:1:name\")", redis.del("user:1:name"));

        say("counters");
        show("incr(\"page:home:views\")", redis.incr("page:home:views"));
        show("incrby(\"page:home:views\", 10)", redis.incrby("page:home:views", 10));

        say("expiry");
        show("setex(\"otp:7\", 300, \"381920\")", redis.setex("otp:7", 300, "381920"));
        show("ttl(\"otp:7\")", redis.ttl("otp:7"));
        show("persist(\"otp:7\")", redis.persist("otp:7"));
        show("ttl(\"otp:7\")", redis.ttl("otp:7"));

        say("hashes");
        show("hset(\"user:1\", {name, email, plan})", redis.hset("user:1", Map.of("name", "Ann", "email", "ann@example.com", "plan", "pro")));
        show("hget(\"user:1\", \"plan\")", redis.hget("user:1", "plan"));
        show("hincrby(\"user:1\", \"logins\", 1)", redis.hincrby("user:1", "logins", 1));
        show("hgetall(\"user:1\")", redis.hgetall("user:1"));

        say("lists as a queue");
        show("lpush(\"jobs:email\", \"job-1\", \"job-2\")", redis.lpush("jobs:email", "job-1", "job-2"));
        show("lrange(\"jobs:email\", 0, -1)", redis.lrange("jobs:email", 0, -1));
        show("rpop(\"jobs:email\")", redis.rpop("jobs:email"));
        KeyValue<String, String> next = redis.brpop(1, "jobs:email");
        show("brpop(1, \"jobs:email\")", next);
        show("brpop(1, \"jobs:email\")  (empty: waits 1 s)", redis.brpop(1, "jobs:email"));

        say("sets");
        show("sadd(\"tags:post:9\", \"redis\", \"cache\", \"redis\")", redis.sadd("tags:post:9", "redis", "cache", "redis"));
        show("sismember(\"tags:post:9\", \"cache\")", redis.sismember("tags:post:9", "cache"));
        show("scard(\"tags:post:9\")", redis.scard("tags:post:9"));

        say("sorted sets");
        show("zadd(\"leaderboard\", 3200, \"ann\")", redis.zadd("leaderboard", 3200, "ann"));
        show("zadd(\"leaderboard\", 2800, \"bob\")", redis.zadd("leaderboard", 2800, "bob"));
        show("zadd(\"leaderboard\", 4100, \"eve\")", redis.zadd("leaderboard", 4100, "eve"));
        show("zincrby(\"leaderboard\", 500, \"bob\")", redis.zincrby("leaderboard", 500, "bob"));
        show("zrevrangeWithScores(\"leaderboard\", 0, 2)", redis.zrevrangeWithScores("leaderboard", 0, 2));
        show("zrevrank(\"leaderboard\", \"ann\")", redis.zrevrank("leaderboard", "ann"));

        say("SCAN instead of KEYS");
        for (int i = 1; i <= 5; i++) redis.set("session:" + i, "s" + i);
        List<String> found = new ArrayList<>();
        ScanCursor cursor = ScanCursor.INITIAL;
        int calls = 0;
        do {
            KeyScanCursor<String> page = redis.scan(cursor, ScanArgs.Builder.matches("session:*").limit(2));
            found.addAll(page.getKeys());
            cursor = page;
            calls++;
        } while (!cursor.isFinished());
        found.sort(null);
        show("scan(match \"session:*\", count 2) until finished", found + " in " + calls + " calls");
    }
}
