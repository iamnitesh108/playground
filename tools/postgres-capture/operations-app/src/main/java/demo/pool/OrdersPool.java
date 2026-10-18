package demo.pool;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** A HikariCP pool under a burst of requests, then a pool that has run dry. Prints JSON. */
public class OrdersPool {

    static HikariDataSource pool() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(System.getenv("JDBC_URL"));  // jdbc:postgresql://db:5432/shop
        config.setUsername(System.getenv("DB_USER"));
        config.setPassword(System.getenv("DB_PASSWORD"));
        config.setPoolName("orders-pool");
        config.setMaximumPoolSize(5);         // at most 5 connections to PostgreSQL
        config.setMinimumIdle(5);             // keep all 5 open: a fixed-size pool
        config.setConnectionTimeout(1_000);   // wait at most 1 s for one, then throw
        config.setMaxLifetime(1_800_000);     // replace connections after 30 min
        config.setKeepaliveTime(300_000);     // ping idle connections every 5 min
        config.addDataSourceProperty("ApplicationName", "orders-api");
        return new HikariDataSource(config);
    }

    public static void main(String[] args) throws Exception {
        try (HikariDataSource ds = pool()) {
            HikariPoolMXBean stats = ds.getHikariPoolMXBean();
            while (stats.getIdleConnections() < 5) Thread.sleep(10); // minimumIdle fills the pool in the background
            // 1. twenty requests at once, each a 200 ms query, on twenty threads
            ExecutorService threads = Executors.newFixedThreadPool(20);
            Set<Integer> pids = new ConcurrentSkipListSet<>();
            long start = System.nanoTime();
            List<Future<Long>> done = new ArrayList<>();
            for (int i = 0; i < 20; i++) {
                done.add(threads.submit(() -> {
                    try (Connection c = ds.getConnection();
                         ResultSet rs = c.createStatement().executeQuery("SELECT pg_backend_pid(), pg_sleep(0.2)")) {
                        rs.next();
                        pids.add(rs.getInt(1));
                    }
                    return (System.nanoTime() - start) / 1_000_000;
                }));
            }
            Thread.sleep(100);
            String during = String.format("{\"active\":%d,\"idle\":%d,\"waiting\":%d,\"total\":%d}",
                    stats.getActiveConnections(), stats.getIdleConnections(), stats.getThreadsAwaitingConnection(), stats.getTotalConnections());
            List<Long> doneMs = new ArrayList<>();
            for (Future<Long> f : done) doneMs.add(f.get());
            threads.shutdown();

            // 2. every connection borrowed and never closed: the next caller times out
            List<Connection> leaked = new ArrayList<>();
            for (int i = 0; i < 5; i++) leaked.add(ds.getConnection());
            long waitStart = System.nanoTime();
            String error;
            try (Connection c = ds.getConnection()) {
                error = "got a connection";
            } catch (SQLException e) {
                error = e.getClass().getSimpleName() + ": " + e.getMessage();
            }
            long waitedMs = (System.nanoTime() - waitStart) / 1_000_000;
            for (Connection c : leaked) c.close();

            System.out.printf("{\"during\":%s,\"lastDoneMs\":%d,\"pids\":%d,\"timeout\":{\"error\":\"%s\",\"waitedMs\":%d}}%n",
                    during, Collections.max(doneMs), pids.size(), error.replace("\"", "\\\""), waitedMs);
        }
    }
}
