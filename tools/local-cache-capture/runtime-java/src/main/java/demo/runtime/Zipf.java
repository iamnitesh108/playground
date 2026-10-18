package demo.runtime;

import java.util.Arrays;
import java.util.SplittableRandom;

/** Keys with Zipf popularity: key 0 is the most popular, then 1, … (a few keys get most reads). */
final class Zipf {
    private Zipf() {}

    static int[] trace(int length, int keys, double s, long seed) {
        double[] cdf = new double[keys];
        double sum = 0;
        for (int k = 0; k < keys; k++) {
            sum += 1 / Math.pow(k + 1, s);
            cdf[k] = sum;
        }
        SplittableRandom rnd = new SplittableRandom(seed);
        int[] out = new int[length];
        for (int i = 0; i < length; i++) {
            int idx = Arrays.binarySearch(cdf, rnd.nextDouble() * sum);
            out[i] = Math.min(keys - 1, idx >= 0 ? idx : -idx - 1);
        }
        return out;
    }
}
