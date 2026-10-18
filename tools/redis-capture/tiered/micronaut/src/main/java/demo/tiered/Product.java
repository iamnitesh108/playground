package demo.tiered;

import io.micronaut.serde.annotation.Serdeable;

/** One product page: the row plus its review summary (an aggregate query in Postgres). */
@Serdeable
public record Product(int id, String name, int priceCents, int version, double rating, long reviews) {}
