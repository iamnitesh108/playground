package demo.start;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/** Everyday PostgreSQL tasks from Java with plain JDBC and a HikariCP pool. */
public class UsageDemo {

    static void say(String section) {
        System.out.println("# " + section);
    }

    public static void main(String[] args) throws Exception {
        say("connect");
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(System.getenv().getOrDefault("DB_URL", "jdbc:postgresql://localhost:5432/shop"));
        config.setUsername("app");
        config.setPassword(System.getenv("DB_PASSWORD"));
        config.setMaximumPoolSize(5);
        config.addDataSourceProperty("reWriteBatchedInserts", "true");
        try (HikariDataSource pool = new HikariDataSource(config)) {
            try (Connection c = pool.getConnection();
                 ResultSet rs = c.createStatement().executeQuery("SELECT current_user, current_database()")) {
                rs.next();
                System.out.println("connected as " + rs.getString(1) + " to " + rs.getString(2));
            }

            say("insert");
            long customerId;
            try (Connection c = pool.getConnection();
                 PreparedStatement ps = c.prepareStatement(
                     "INSERT INTO customers (name, email, city) VALUES (?, ?, ?) RETURNING id")) {
                ps.setString(1, "Eve");
                ps.setString(2, "eve@example.com");
                ps.setString(3, "Madrid");
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    customerId = rs.getLong("id");
                }
                System.out.println("new customer id = " + customerId);
            }

            say("select");
            try (Connection c = pool.getConnection();
                 PreparedStatement ps = c.prepareStatement(
                     "SELECT id, name FROM customers WHERE city = ? ORDER BY name")) {
                ps.setString(1, "Lisbon");
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) System.out.println(rs.getLong("id") + " " + rs.getString("name"));
                }
                // a parameter is only ever a value: this finds nobody, it does not change the query
                ps.setString(1, "Lisbon' OR '1'='1");
                try (ResultSet rs = ps.executeQuery()) {
                    System.out.println("injection attempt found a row: " + rs.next());
                }
            }

            say("transaction");
            try (Connection c = pool.getConnection()) {
                c.setAutoCommit(false);
                try {
                    placeOrder(c, customerId, 1, 2, new BigDecimal("90.00"));
                    placeOrder(c, customerId, 999, 1, new BigDecimal("10.00")); // no such product: fails
                    c.commit();
                } catch (SQLException e) {
                    c.rollback();
                    System.out.println("rolled back: " + e.getSQLState() + " " + e.getMessage().lines().findFirst().orElse(""));
                } finally {
                    c.setAutoCommit(true);
                }
                try (ResultSet rs = c.createStatement().executeQuery(
                         "SELECT count(*) FROM orders WHERE customer_id = " + customerId)) {
                    rs.next();
                    System.out.println("orders for Eve after rollback = " + rs.getLong(1));
                }
            }

            say("batch");
            try (Connection c = pool.getConnection();
                 PreparedStatement ps = c.prepareStatement(
                     "INSERT INTO orders (customer_id, product_id, quantity, amount) VALUES (?, ?, ?, ?)")) {
                c.setAutoCommit(false);
                for (int i = 1; i <= 1000; i++) {
                    ps.setLong(1, customerId);
                    ps.setLong(2, 4);
                    ps.setInt(3, 1);
                    ps.setBigDecimal(4, new BigDecimal("8.50"));
                    ps.addBatch();
                }
                long start = System.nanoTime();
                int[] counts = ps.executeBatch();
                c.commit();
                System.out.println("batched " + counts.length + " inserts, committed in "
                    + ((System.nanoTime() - start) / 1_000_000) + " ms");
            }

            say("upsert");
            try (Connection c = pool.getConnection();
                 PreparedStatement ps = c.prepareStatement("""
                     INSERT INTO stock (product_id, quantity) VALUES (?, ?)
                     ON CONFLICT (product_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity
                     RETURNING quantity""")) {
                for (int add : List.of(3, 4)) {
                    ps.setLong(1, 2);
                    ps.setInt(2, add);
                    try (ResultSet rs = ps.executeQuery()) {
                        rs.next();
                        System.out.println("mouse stock = " + rs.getInt(1));
                    }
                }
            }

            say("keyset");
            try (Connection c = pool.getConnection();
                 PreparedStatement ps = c.prepareStatement(
                     "SELECT id, amount FROM orders WHERE customer_id = ? AND id > ? ORDER BY id LIMIT 400")) {
                long after = 0;
                int pages = 0;
                while (true) {
                    ps.setLong(1, customerId);
                    ps.setLong(2, after);
                    int rows = 0;
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            after = rs.getLong("id");
                            rows++;
                        }
                    }
                    if (rows == 0) break;
                    pages++;
                    System.out.println("page " + pages + ": " + rows + " rows, last id " + after);
                }
            }
        }
    }

    static void placeOrder(Connection c, long customerId, long productId, int quantity, BigDecimal amount)
            throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO orders (customer_id, product_id, quantity, amount) VALUES (?, ?, ?, ?) RETURNING id")) {
            ps.setLong(1, customerId);
            ps.setLong(2, productId);
            ps.setInt(3, quantity);
            ps.setBigDecimal(4, amount);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                System.out.println("order " + rs.getLong(1) + " inserted (not committed yet)");
            }
        }
    }
}
