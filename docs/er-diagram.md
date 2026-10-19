# ER diagram

The real tables of the Siam Bean Mini ERP, as created by the migrations in `supabase/migrations/` (checked against Supabase `list_tables` for the `public` schema on 20 Oct 2026: 10 tables, same columns and foreign keys). Every business table carries `company_id`, `created_by`, `created_at` and `updated_at`; `created_by` is omitted from the boxes below to keep the diagram readable, and every `created_by` points to `users`. Money columns are `numeric(12,2)`. `auth_users` is Supabase's own `auth.users` table; `users.id` is a foreign key to it with `on delete cascade`.

```mermaid
erDiagram
    auth_users ||--|| users : "is the login of"
    companies ||--o{ users : "has"
    companies ||--o{ customers : "owns"
    companies ||--o{ products : "owns"
    companies ||--o{ stock_movements : "owns"
    companies ||--o{ sales_orders : "owns"
    companies ||--o{ order_items : "owns"
    companies ||--o{ invoices : "owns"
    companies ||--o{ payments : "owns"
    companies ||--o{ doc_counters : "numbers"
    customers ||--o{ sales_orders : "places"
    customers ||--o{ invoices : "is billed"
    products ||--o{ stock_movements : "moves"
    products ||--o{ order_items : "is sold on"
    sales_orders ||--|{ order_items : "has lines"
    sales_orders ||--o| invoices : "is confirmed into"
    invoices ||--o{ payments : "is paid by"
    users ||--o{ customers : "created_by"
    users ||--o{ products : "created_by"
    users ||--o{ stock_movements : "created_by"
    users ||--o{ sales_orders : "created_by"
    users ||--o{ order_items : "created_by"
    users ||--o{ invoices : "created_by"
    users ||--o{ payments : "created_by"

    auth_users {
        uuid id PK "Supabase Auth (schema auth, not public)"
    }
    companies {
        bigint id PK
        text name UK
        text tax_id
        text address
        timestamptz created_at
        timestamptz updated_at
    }
    users {
        uuid id PK "= auth.users.id"
        bigint company_id FK
        text full_name
        text email
        text role "admin|sales|warehouse|accountant"
        timestamptz created_at
        timestamptz updated_at
    }
    customers {
        bigint id PK
        bigint company_id FK
        text name "trigram index"
        text tax_id "required"
        int payment_terms_days "0 = Cash"
        text address
        text phone
        boolean active
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    products {
        bigint id PK
        bigint company_id FK
        text sku "unique per company"
        text name
        text unit "kg|box"
        numeric price "excl. VAT, >= 0"
        numeric cost ">= 0"
        int reorder_level
        boolean active
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    stock_movements {
        bigint id PK
        bigint company_id FK
        bigint product_id FK
        int quantity "signed, not 0"
        text movement_type "opening|in|out|adjust|sale"
        text ref_doc
        text reason
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    sales_orders {
        bigint id PK
        bigint company_id FK
        text number "unique per company"
        bigint customer_id FK
        text status "draft|confirmed|cancelled"
        date order_date "Asia/Bangkok"
        timestamptz confirmed_at
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    order_items {
        bigint id PK
        bigint company_id FK
        bigint order_id FK
        bigint product_id FK
        int quantity "> 0"
        numeric unit_price "copied from product"
        numeric unit_cost "copied from product"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    invoices {
        bigint id PK
        bigint company_id FK
        text number "unique per company"
        bigint order_id FK "unique"
        bigint customer_id FK
        date invoice_date "Asia/Bangkok"
        date due_date
        numeric subtotal
        numeric vat "7% of subtotal"
        numeric total "= subtotal + vat"
        text status "open|paid"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    payments {
        bigint id PK
        bigint company_id FK
        bigint invoice_id FK
        numeric amount "> 0"
        date paid_on
        text method "transfer|cash|cheque"
        text note
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    doc_counters {
        bigint company_id PK,FK
        text doc_type PK "SO|INV|IN|OUT|ADJ"
        int last_value
        timestamptz created_at
        timestamptz updated_at
    }
```

## View and functions

- **View `stock_on_hand`** (`security_invoker`): one row per product with `on_hand` = the sum of its `stock_movements.quantity`. There is no quantity column on `products`.
- **`next_doc_number(company_id, doc_type)`** returns `SO-0001`, `INV-0001`, `IN-0001`, `OUT-0001` or `ADJ-0001`, counting per company from `doc_counters` (ADR-0003).
- **Trigger on `stock_movements`** refuses any movement that would make On Hand negative: `Not enough stock for <SKU>`.
- **`confirm_sales_order(order_id, user_id)`** (ADR-0002) returns the new Invoice id. In one transaction it locks the order and its Products (lowest id first), refuses `Not enough stock for <SKU>` / `Add at least one line` / a non-Draft, takes the next `INV` number, writes one `sale` movement per line (`ref_doc` = the INV number, `reason` = `Sales order SO-0001`), writes the Invoice (VAT = `round(subtotal * 0.07, 2)`, Invoice Date = today in Bangkok, Due Date = date + the Customer's Payment Terms) and sets the order Confirmed.
- `record_payment` arrives with the payments ticket.
- Every table has row level security enabled with no policies; `anon` and `authenticated` have no privileges on tables, view or functions. Only FastAPI (`DATABASE_URL`) reads and writes.
