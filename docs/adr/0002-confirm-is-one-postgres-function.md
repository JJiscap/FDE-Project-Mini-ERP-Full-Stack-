# Confirm is one Postgres function

Confirming a Sales Order must check stock, write one negative Stock Movement per Order Line, take the next Invoice number, write the Invoice and mark the order Confirmed, all or nothing (business rule 5). We implement this as a single Postgres function, `confirm_sales_order`. It locks the order and its Products' rows (in product-id order, so no deadlocks) and raises `Not enough stock for <SKU>`. FastAPI calls the function after checking the Role and maps that error to `409`.

## Considered options

- **Python transaction in FastAPI (psycopg).** This would also work. It was rejected because the rule would then live only in the API. In the database, no other path (SQL editor, a future script) can half-confirm an order, which scores under "rules enforced in the database".
- **Several calls from the frontend.** Rejected outright: one day the second call fails and stock is wrong forever.
