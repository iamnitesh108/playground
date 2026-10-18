package demo.policies;

import java.util.Arrays;

/** One entry point, one experiment per command; every experiment prints JSON lines. */
public final class Main {
    public static void main(String[] args) throws Exception {
        String[] rest = Arrays.copyOfRange(args, 1, args.length);
        switch (args[0]) {
            case "replay" -> Replay.run(rest);
            case "order" -> Order.run(rest);
            case "lazy" -> Lifetimes.lazy();
            case "scheduler" -> Lifetimes.scheduler();
            case "write-vs-access" -> Lifetimes.writeVsAccess();
            case "per-entry" -> Lifetimes.perEntry();
            case "refresh" -> Refresh.run();
            case "jitter" -> Jitter.run();
            default -> throw new IllegalArgumentException("unknown command " + args[0]);
        }
    }

    private Main() {}
}
