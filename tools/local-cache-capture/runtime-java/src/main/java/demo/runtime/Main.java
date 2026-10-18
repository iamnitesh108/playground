package demo.runtime;

/** Runs one experiment, named by the first argument; each prints JSON lines. */
public final class Main {
    public static void main(String[] args) throws Exception {
        Out.emit("exp", "runtime", "java", System.getProperty("java.version"), "cores", Runtime.getRuntime().availableProcessors(),
                "gc", java.lang.management.ManagementFactory.getGarbageCollectorMXBeans().stream().map(b -> b.getName()).toList());
        switch (args[0]) {
            case "singleflight" -> SingleFlight.run();
            case "throughput" -> Throughput.run(Integer.parseInt(args[1]));
            case "footprint" -> Footprint.run();
            case "weight" -> Weight.run();
            case "soft" -> SoftValues.run(args[1]);
            case "gc" -> GcImpact.run(Integer.parseInt(args[1]), Integer.parseInt(args[2]));
            case "stats" -> Stats.run();
            case "pitfalls" -> Pitfalls.run();
            case "bench" -> Bench.run();
            default -> throw new IllegalArgumentException(args[0]);
        }
        System.exit(0);
    }
}
