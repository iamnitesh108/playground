package demo.tiered;

/**
 * Product ids with a Zipf (power-law) popularity, the shape of real traffic: a few products get
 * most reads.
 * Deterministic (xorshift32 with a fixed seed), so every language's benchmark reads the same
 * sequence.
 */
public final class Zipf {
    private final double[] cdf;
    private int state;

    public Zipf(int products, double skew, int seed) {
        cdf = new double[products];
        double sum = 0;
        for (int i = 0; i < products; i++) cdf[i] = sum += 1 / Math.pow(i + 1, skew);
        for (int i = 0; i < products; i++) cdf[i] /= sum;
        state = seed;
    }

    /** Next product id, 1-based. */
    public int next() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        double u = (state >>> 1) / (double) Integer.MAX_VALUE;
        int lo = 0, hi = cdf.length - 1;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (cdf[mid] < u) lo = mid + 1;
            else hi = mid;
        }
        return lo + 1;
    }
}
