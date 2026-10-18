package demo.usage;

import io.micronaut.context.ApplicationContext;

/** Runs one demo (APP_MODE) against the Redis in redis.uri, prints what happened, and exits. */
public class Application {

    public static void main(String[] args) throws Exception {
        String mode = System.getenv().getOrDefault("APP_MODE", "usage");
        try (ApplicationContext context = ApplicationContext.run()) {
            switch (mode) {
                case "usage" -> context.getBean(UsageDemo.class).run();
                case "async" -> context.getBean(AsyncDemo.class).run();
                case "pipeline" -> context.getBean(PipelineDemo.class).run();
                case "watch" -> context.getBean(WatchDemo.class).run();
                case "pubsub" -> context.getBean(PubSubDemo.class).run();
                case "config" -> Out.show("connection.getTimeout()", context.getBean(io.lettuce.core.api.StatefulRedisConnection.class).getTimeout());
                case "timeout" -> context.getBean(TimeoutDemo.class).run();
                case "reconnect" -> context.getBean(ReconnectDemo.class).run();
                default -> throw new IllegalArgumentException("unknown APP_MODE " + mode);
            }
        }
    }
}
