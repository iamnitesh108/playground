package demo.usage;

/** Prints one call and its result, so the run reads like a transcript. */
final class Out {

    private Out() {
    }

    static void show(String call, Object result) {
        System.out.println(call + "  ->  " + result);
    }

    static void say(String text) {
        System.out.println("# " + text);
    }
}
