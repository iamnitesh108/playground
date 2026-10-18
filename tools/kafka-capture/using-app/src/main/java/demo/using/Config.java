package demo.using;

/** Where the cluster is. Every program reads KAFKA_BOOTSTRAP so the same code runs anywhere. */
final class Config {
    static final String BOOTSTRAP = System.getenv().getOrDefault("KAFKA_BOOTSTRAP", "localhost:9092");

    private Config() {
    }
}
