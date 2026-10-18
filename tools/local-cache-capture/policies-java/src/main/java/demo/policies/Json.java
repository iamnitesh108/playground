package demo.policies;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/** A tiny JSON line writer, so the experiments need nothing but Caffeine. */
final class Json {
    private final Map<String, Object> fields = new LinkedHashMap<>();

    static Json of(String key, Object value) {
        return new Json().with(key, value);
    }

    Json with(String key, Object value) {
        fields.put(key, value);
        return this;
    }

    void print() {
        System.out.println(encode(fields));
    }

    private static String encode(Object value) {
        if (value == null) return "null";
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream()
                    .map(e -> '"' + e.getKey().toString() + "\":" + encode(e.getValue()))
                    .collect(Collectors.joining(",", "{", "}"));
        }
        if (value instanceof Collection<?> list) {
            return list.stream().map(Json::encode).collect(Collectors.joining(",", "[", "]"));
        }
        if (value instanceof long[] longs) {
            return java.util.Arrays.stream(longs).mapToObj(Long::toString).collect(Collectors.joining(",", "[", "]"));
        }
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        return '"' + value.toString().replace("\\", "\\\\").replace("\"", "\\\"") + '"';
    }
}
