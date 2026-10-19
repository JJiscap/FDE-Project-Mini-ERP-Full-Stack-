"""The demo data of Siam Bean Co.: products, customers and how to load them.

Shared by `scripts.seed`, `scripts.reset_demo` and the pytest harness
(`tests/conftest.py`). The 4 products and 3 customers come straight from
docs/scenario.md; the rest of the 200 customers are generated fictional cafés.
Loading is idempotent: it never changes or duplicates what already exists.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

import psycopg


@dataclass(frozen=True)
class ProductSpec:
    sku: str
    name: str
    unit: str
    cost: Decimal
    price: Decimal
    reorder_level: int
    opening_stock: int


@dataclass(frozen=True)
class CustomerSpec:
    name: str
    tax_id: str
    payment_terms_days: int
    address: str | None = None
    phone: str | None = None


PRODUCTS: tuple[ProductSpec, ...] = (
    ProductSpec("ARB-1KG", "Arabica, 1 kg bag", "kg", Decimal("320.00"), Decimal("450.00"), 50, 170),
    ProductSpec("ROB-1KG", "Robusta, 1 kg bag", "kg", Decimal("220.00"), Decimal("320.00"), 40, 35),
    ProductSpec("BLD-1KG", "House Blend, 1 kg bag", "kg", Decimal("260.00"), Decimal("380.00"), 30, 90),
    ProductSpec("DRP-10", "Drip bags, box of 10", "box", Decimal("90.00"), Decimal("150.00"), 100, 240),
)

# Tax IDs are fictional. Payment terms: Café Lune 30 days, Brew Lab Ari Cash, Sukhumvit Corner 15 days.
SAMPLE_CUSTOMERS: tuple[CustomerSpec, ...] = (
    CustomerSpec("Café Lune", "0105561000011", 30, "88 Soi Ari 1, Phaya Thai, Bangkok 10400", "02-555-0101"),
    CustomerSpec("Brew Lab Ari", "0105562000022", 0, "12 Soi Ari 4, Phaya Thai, Bangkok 10400", "02-555-0102"),
    CustomerSpec(
        "Sukhumvit Corner Café", "0105563000033", 15, "245 Sukhumvit Rd, Khlong Toei, Bangkok 10110", "02-555-0103"
    ),
)

_DISTRICTS = (
    "Ari", "Thonglor", "Ekkamai", "Silom", "Sathorn", "Phrom Phong", "Ladprao", "Bang Na",
    "On Nut", "Rama 9", "Chatuchak", "Bang Rak", "Yaowarat", "Thewet", "Phaya Thai",
    "Sala Daeng", "Saphan Khwai", "Nana", "Ratchada", "Bearing",
)  # fmt: skip
_KINDS = (
    "Roasters", "Coffee Bar", "Corner Café", "Brew House", "Espresso Lab",
    "Bean & Leaf", "Cup Society", "Daily Grind", "Slow Bar", "Café",
)  # fmt: skip
_TERMS = (30, 15, 0)  # mixed payment terms: 30 days, 15 days, Cash

MAX_GENERATED = len(_DISTRICTS) * len(_KINDS)


def generated_cafes(count: int) -> list[CustomerSpec]:
    """`count` fictional cafés. Always the same names, in the same order.

    Every (district, kind) pair is used once, so names are unique (up to 200).
    """
    if not 0 <= count <= MAX_GENERATED:
        raise ValueError(f"count must be between 0 and {MAX_GENERATED}")
    cafes = []
    for i in range(count):
        number = i + 1
        district = _DISTRICTS[i % len(_DISTRICTS)]
        kind = _KINDS[(i // len(_DISTRICTS) + i) % len(_KINDS)]
        cafes.append(
            CustomerSpec(
                name=f"{district} {kind}",
                tax_id=f"0105570{number:06d}",  # 13 digits
                payment_terms_days=_TERMS[number % len(_TERMS)],
                address=f"{number + 10}/{number % 9 + 1} Soi {district} {number % 30 + 1}, Bangkok 10110",
                phone=f"02-555-{number:04d}",
            )
        )
    return cafes


def load_products(conn: psycopg.Connection, company_id: int) -> None:
    """Insert the 4 sample products and their Opening Stock movements, once."""
    with conn.transaction():
        for p in PRODUCTS:
            conn.execute(
                """
                insert into public.products
                    (company_id, sku, name, unit, cost, price, reorder_level)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (company_id, sku) do nothing
                """,
                (company_id, p.sku, p.name, p.unit, p.cost, p.price, p.reorder_level),
            )
            conn.execute(
                """
                insert into public.stock_movements
                    (company_id, product_id, quantity, movement_type, ref_doc)
                select pr.company_id, pr.id, %s, 'opening', 'OPENING'
                  from public.products pr
                 where pr.company_id = %s and pr.sku = %s
                   and not exists (
                       select 1 from public.stock_movements m
                        where m.product_id = pr.id and m.movement_type = 'opening'
                   )
                """,
                (p.opening_stock, company_id, p.sku),
            )


def load_customers(conn: psycopg.Connection, company_id: int, total: int = 200) -> None:
    """Make sure the company has the 3 sample customers plus generated cafés up to `total`."""
    specs = (list(SAMPLE_CUSTOMERS) + generated_cafes(max(total - len(SAMPLE_CUSTOMERS), 0)))[:total]
    with conn.transaction():
        conn.execute(
            """
            insert into public.customers
                (company_id, name, tax_id, payment_terms_days, address, phone)
            select %(company)s, v.name, v.tax_id, v.terms, v.address, v.phone
              from unnest(
                       %(names)s::text[], %(tax_ids)s::text[], %(terms)s::int[],
                       %(addresses)s::text[], %(phones)s::text[]
                   ) as v(name, tax_id, terms, address, phone)
             where not exists (
                   select 1 from public.customers c
                    where c.company_id = %(company)s and c.name = v.name
             )
            """,
            {
                "company": company_id,
                "names": [s.name for s in specs],
                "tax_ids": [s.tax_id for s in specs],
                "terms": [s.payment_terms_days for s in specs],
                "addresses": [s.address for s in specs],
                "phones": [s.phone for s in specs],
            },
        )


def load_master_data(conn: psycopg.Connection, company_id: int, total_customers: int = 200) -> None:
    """Products with Opening Stock, then customers. Safe to run again."""
    load_products(conn, company_id)
    load_customers(conn, company_id, total_customers)
