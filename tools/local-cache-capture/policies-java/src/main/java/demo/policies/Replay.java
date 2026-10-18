package demo.policies;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Replays a trace file (one integer key per line) through Caffeine at several maximum sizes and prints the hit
 * ratio. Each request is a read; a miss is followed by a put, like a cache in front of a database.
 */
final class Replay {
    static void run(String[] args) throws Exception {
        Path trace = Path.of(args[0]);
        int[] keys = read(trace);
        String name = trace.getFileName().toString().replace(".txt", "");
        for (int i = 1; i < args.length; i++) {
            replay(name, keys, Integer.parseInt(args[i]));
        }
    }

    static void replay(String trace, int[] keys, int maximumSize) throws Exception {
        Cache<Integer, Integer> cache = Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .executor(Runnable::run) // maintenance on the calling thread: a deterministic replay
                .build();
        Window window = new Window(cache);
        List<long[]> windowSizes = new ArrayList<>();
        int sampleEvery = keys.length / 100;
        long hits = 0;
        for (int i = 0; i < keys.length; i++) {
            Integer key = keys[i];
            if (cache.getIfPresent(key) != null) {
                hits++;
            } else {
                cache.put(key, key);
            }
            if ((i + 1) % sampleEvery == 0) {
                windowSizes.add(new long[] { i + 1, window.maximum() });
            }
        }
        Json.of("lib", "caffeine").with("trace", trace).with("size", maximumSize)
                .with("requests", keys.length).with("hits", hits)
                .with("window", windowSizes)
                .print();
    }

    static int[] read(Path file) throws IOException {
        return Files.lines(file).mapToInt(Integer::parseInt).toArray();
    }

    /** Reads the admission window's current maximum, which Caffeine does not expose (reflection, demo only). */
    static final class Window {
        private final Object bounded;
        private final Method windowMaximum;

        Window(Cache<?, ?> cache) throws ReflectiveOperationException {
            Field field = cache.getClass().getDeclaredField("cache");
            field.setAccessible(true);
            bounded = field.get(cache);
            windowMaximum = find(bounded.getClass(), "windowMaximum");
            windowMaximum.setAccessible(true);
        }

        long maximum() throws ReflectiveOperationException {
            return (long) windowMaximum.invoke(bounded);
        }

        private static Method find(Class<?> type, String name) throws NoSuchMethodException {
            for (Class<?> c = type; c != null; c = c.getSuperclass()) {
                for (Method m : c.getDeclaredMethods()) {
                    if (m.getName().equals(name) && m.getParameterCount() == 0) return m;
                }
            }
            throw new NoSuchMethodException(name);
        }
    }

    private Replay() {}
}
