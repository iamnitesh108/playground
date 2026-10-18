package demo.runtime;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/** Prints one JSON object per line: what the capture script records. */
final class Out {
    private Out() {}

    /** Builds an object from alternating keys and values: emit("step", "x", "n", 3). */
    static void emit(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        System.out.println(json(m));
        System.out.flush();
    }

    static String json(Object o) {
        if (o == null) return "null";
        if (o instanceof String s) return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + '"';
        if (o instanceof Double d) return Double.isFinite(d) ? String.valueOf(Math.round(d * 1000) / 1000.0) : "null";
        if (o instanceof Number || o instanceof Boolean) return o.toString();
        if (o instanceof Map<?, ?> m) {
            return m.entrySet().stream().map(e -> json(String.valueOf(e.getKey())) + ":" + json(e.getValue())).collect(Collectors.joining(",", "{", "}"));
        }
        if (o instanceof Collection<?> c) return c.stream().map(Out::json).collect(Collectors.joining(",", "[", "]"));
        if (o instanceof long[] a) return json(Arrays.stream(a).boxed().toList());
        if (o instanceof double[] a) return json(Arrays.stream(a).boxed().toList());
        return json(o.toString());
    }

    static double median(double[] xs) {
        double[] s = xs.clone();
        Arrays.sort(s);
        return s.length % 2 == 1 ? s[s.length / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    }

    static double ms(long nanos) {
        return nanos / 1_000_000.0;
    }
}
