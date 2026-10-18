package demo.cached;

import io.micronaut.core.annotation.Introspected;

@Introspected
public record Product(long id, String name, int priceCents) {}
