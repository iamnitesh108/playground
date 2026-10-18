package demo.tiered;

import jakarta.inject.Singleton;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicLong;
import javax.sql.DataSource;

/** The source of truth. Counts its queries, so a benchmark can show how many reached Postgres.
 * */
@Singleton
public class ProductRepository {
    private static final String PAGE = """
            SELECT p.id, p.name, p.price_cents, p.version,
                   coalesce(avg(r.stars), 0)::float8 AS rating, count(r.product_id) AS reviews
            FROM products p LEFT JOIN reviews r ON r.product_id = p.id
            WHERE p.id = ?
            GROUP BY p.id""";

    private final DataSource db;
    private final AtomicLong queries = new AtomicLong();

    public ProductRepository(DataSource db) {
        this.db = db;
    }

    public Product load(int id) {
        queries.incrementAndGet();
        try (Connection c = db.getConnection(); PreparedStatement s = c.prepareStatement(PAGE)) {
            s.setInt(1, id);
            try (ResultSet r = s.executeQuery()) {
                if (!r.next()) return null;
                return new Product(r.getInt(1), r.getString(2), r.getInt(3), r.getInt(4), r.getDouble(5), r.getLong(6));
            }
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Changes the price and bumps the version; returns the new version. */
    public int updatePrice(int id, int priceCents) {
        try (Connection c = db.getConnection();
             PreparedStatement s = c.prepareStatement("UPDATE products SET price_cents = ?, version = version + 1 WHERE id = ? RETURNING version")) {
            s.setInt(1, priceCents);
            s.setInt(2, id);
            try (ResultSet r = s.executeQuery()) {
                r.next();
                return r.getInt(1);
            }
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
    }

    public long queries() {
        return queries.get();
    }
}
