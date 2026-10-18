package demo.policies;

import com.github.benmanes.caffeine.cache.Ticker;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

/** A clock the experiment moves by hand: Caffeine reads time only through its Ticker. */
final class FakeTicker implements Ticker {
    private final AtomicLong nanos = new AtomicLong();

    @Override
    public long read() {
        return nanos.get();
    }

    void advance(Duration d) {
        nanos.addAndGet(d.toNanos());
    }

    double seconds() {
        return nanos.get() / 1e9;
    }
}
