package basics;

/** Runs one of the recorded programs: "using" (the API tour) or "why" (heap growth and read latency). */
public final class Main {
    public static void main(String[] args) throws Exception {
        switch (args.length > 0 ? args[0] : "") {
            case "using" -> Using.main();
            case "why" -> Why.main();
            default -> throw new IllegalArgumentException("usage: basics-java using|why");
        }
    }
}
