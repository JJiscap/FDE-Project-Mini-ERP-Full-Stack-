"""Reset the Siam Bean demo data to the state before the demo.

    cd backend && uv run python -m scripts.reset_demo

What it does, in ONE transaction (all or nothing), for the Siam Bean company:
- deletes its payments, invoices, order items, sales orders and every stock
  movement, and deletes its document counters, so the next order is SO-0001,
  the next invoice INV-0001, and IN-/OUT-/ADJ- restart at 0001;
- puts the 4 sample products back to their seed values (name, unit, price,
  cost, reorder level, active) with Opening Stock 170 / 35 / 90 / 240;
- puts the 200 customers back to their seed values (all active) and creates
  any seed customer that is missing;
- leaves the 5 demo Users and their logins alone.

Extra products and customers made while testing are DELETED, not deactivated.
The app itself never deletes them (rule 7), but this script is the sanctioned
exception for demo data: once the orders are gone nothing refers to them, and
a deactivated leftover would show up in lists and search during the demo.

Safe to run again. It refuses any company that is not Siam Bean or a TEST-*
company. It prints counts only. Tests call `reset_company` on a TEST-* company.
"""

from __future__ import annotations

import psycopg

from app.core.db import connect
from scripts.demo_data import PRODUCTS, customer_specs, load_master_data
from scripts.seed import COMPANY_NAME

DEFAULT_CUSTOMERS = 200


def _check_company(conn: psycopg.Connection, company_id: int) -> str:
    row = conn.execute("select name from public.companies where id = %s", (company_id,)).fetchone()
    if row is None:
        raise RuntimeError(f"Company {company_id} not found.")
    name = row["name"]
    if name != COMPANY_NAME and not name.startswith("TEST-"):
        raise RuntimeError(
            f"Refusing to reset company {company_id}: it is neither {COMPANY_NAME!r} (Siam Bean) "
            "nor a TEST-* company."
        )
    return name


def reset_company(
    conn: psycopg.Connection, company_id: int, *, total_customers: int = DEFAULT_CUSTOMERS
) -> dict[str, int]:
    """Restore the fresh demo state of one company. Returns row counts (products, customers, movements)."""
    _check_company(conn, company_id)
    customers = customer_specs(total_customers)
    with conn.transaction():
        # Children first, so foreign keys never block a delete.
        for table in ("payments", "invoices", "order_items", "sales_orders", "stock_movements", "doc_counters"):
            conn.execute(f"delete from public.{table} where company_id = %s", (company_id,))

        # Extras made while testing: nothing refers to them any more.
        conn.execute(
            "delete from public.products where company_id = %s and not (sku = any(%s))",
            (company_id, [p.sku for p in PRODUCTS]),
        )
        conn.execute(
            "delete from public.customers where company_id = %s and not (name = any(%s))",
            (company_id, [c.name for c in customers]),
        )

        # Seed rows that drifted go back to their seed values.
        conn.execute(
            """
            update public.products p
               set name = v.name, unit = v.unit, cost = v.cost, price = v.price,
                   reorder_level = v.reorder_level, active = true
              from unnest(%(skus)s::text[], %(names)s::text[], %(units)s::text[],
                          %(costs)s::numeric[], %(prices)s::numeric[], %(levels)s::int[])
                   as v(sku, name, unit, cost, price, reorder_level)
             where p.company_id = %(company)s and p.sku = v.sku
            """,
            {
                "company": company_id,
                "skus": [p.sku for p in PRODUCTS],
                "names": [p.name for p in PRODUCTS],
                "units": [p.unit for p in PRODUCTS],
                "costs": [p.cost for p in PRODUCTS],
                "prices": [p.price for p in PRODUCTS],
                "levels": [p.reorder_level for p in PRODUCTS],
            },
        )
        conn.execute(
            """
            update public.customers c
               set tax_id = v.tax_id, payment_terms_days = v.terms, address = v.address,
                   phone = v.phone, active = true
              from unnest(%(names)s::text[], %(tax_ids)s::text[], %(terms)s::int[],
                          %(addresses)s::text[], %(phones)s::text[])
                   as v(name, tax_id, terms, address, phone)
             where c.company_id = %(company)s and c.name = v.name
            """,
            {
                "company": company_id,
                "names": [s.name for s in customers],
                "tax_ids": [s.tax_id for s in customers],
                "terms": [s.payment_terms_days for s in customers],
                "addresses": [s.address for s in customers],
                "phones": [s.phone for s in customers],
            },
        )

        # Missing seed rows come back; Opening Stock is re-created (all movements were deleted).
        load_master_data(conn, company_id, total_customers)

        return {
            table: conn.execute(
                f"select count(*) as n from public.{table} where company_id = %s", (company_id,)
            ).fetchone()["n"]
            for table in ("products", "customers", "stock_movements")
        }


def main() -> None:
    with connect(autocommit=True) as conn:
        row = conn.execute("select id from public.companies where name = %s", (COMPANY_NAME,)).fetchone()
        if row is None:
            raise SystemExit(f"{COMPANY_NAME} not found. Run `uv run python -m scripts.seed` first.")
        counts = reset_company(conn, row["id"])
    print(
        f"Reset {COMPANY_NAME}: {counts['products']} products, {counts['customers']} customers, "
        f"{counts['stock_movements']} opening stock movements; orders, invoices, payments and counters cleared."
    )


if __name__ == "__main__":
    main()
