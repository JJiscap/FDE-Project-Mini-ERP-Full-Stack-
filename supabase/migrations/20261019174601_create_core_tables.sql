-- Core tables of the Siam Bean Mini ERP (see .scratch/mini-erp/spec.md, Schema).
-- Money is numeric(12,2). Stock quantity is never stored on products: On Hand is
-- the sum of stock_movements (see the stock_on_hand view in a later migration).

create extension if not exists pg_trgm with schema extensions;

-- Keeps updated_at honest on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.companies (
  id          bigint generated always as identity primary key,
  name        text not null check (length(btrim(name)) > 0),
  tax_id      text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint companies_name_key unique (name)
);

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  company_id  bigint not null references public.companies (id),
  full_name   text not null check (length(btrim(full_name)) > 0),
  email       text not null,
  role        text not null check (role in ('admin', 'sales', 'warehouse', 'accountant')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index users_company_id_idx on public.users (company_id);

create table public.customers (
  id                  bigint generated always as identity primary key,
  company_id          bigint not null references public.companies (id),
  name                text not null check (length(btrim(name)) > 0),
  tax_id              text not null check (length(btrim(tax_id)) > 0),
  payment_terms_days  integer not null default 0 check (payment_terms_days >= 0),
  address             text,
  phone               text,
  active              boolean not null default true,
  created_by          uuid references public.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index customers_company_id_idx on public.customers (company_id);
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);

create table public.products (
  id             bigint generated always as identity primary key,
  company_id     bigint not null references public.companies (id),
  sku            text not null check (length(btrim(sku)) > 0),
  name           text not null check (length(btrim(name)) > 0),
  unit           text not null check (unit in ('kg', 'box')),
  price          numeric(12,2) not null check (price >= 0),
  cost           numeric(12,2) not null check (cost >= 0),
  reorder_level  integer not null default 0 check (reorder_level >= 0),
  active         boolean not null default true,
  created_by     uuid references public.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint products_company_sku_key unique (company_id, sku)
);

create table public.stock_movements (
  id             bigint generated always as identity primary key,
  company_id     bigint not null references public.companies (id),
  product_id     bigint not null references public.products (id),
  quantity       integer not null check (quantity <> 0),
  movement_type  text not null check (movement_type in ('opening', 'in', 'out', 'adjust', 'sale')),
  ref_doc        text,
  reason         text,
  created_by     uuid references public.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- + in (opening, in), - out (out, sale); an adjustment goes either way.
  constraint stock_movements_sign_matches_type check (
    (movement_type in ('opening', 'in') and quantity > 0)
    or (movement_type in ('out', 'sale') and quantity < 0)
    or movement_type = 'adjust'
  )
);
create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_company_id_idx on public.stock_movements (company_id);

create table public.sales_orders (
  id            bigint generated always as identity primary key,
  company_id    bigint not null references public.companies (id),
  number        text not null,
  customer_id   bigint not null references public.customers (id),
  status        text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  -- Business dates use Bangkok time.
  order_date    date not null default (timezone('Asia/Bangkok', now()))::date,
  confirmed_at  timestamptz,
  created_by    uuid references public.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sales_orders_company_number_key unique (company_id, number)
);
create index sales_orders_company_id_idx on public.sales_orders (company_id);
create index sales_orders_customer_id_idx on public.sales_orders (customer_id);

create table public.order_items (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references public.companies (id),
  order_id    bigint not null references public.sales_orders (id),
  product_id  bigint not null references public.products (id),
  quantity    integer not null check (quantity > 0),
  -- Copied from the product when the line is added; never follows later price changes.
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  unit_cost   numeric(12,2) not null check (unit_cost >= 0),
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create table public.invoices (
  id            bigint generated always as identity primary key,
  company_id    bigint not null references public.companies (id),
  number        text not null,
  order_id      bigint not null unique references public.sales_orders (id),
  customer_id   bigint not null references public.customers (id),
  invoice_date  date not null default (timezone('Asia/Bangkok', now()))::date,
  due_date      date not null,
  subtotal      numeric(12,2) not null check (subtotal >= 0),
  vat           numeric(12,2) not null check (vat >= 0),
  total         numeric(12,2) not null check (total >= 0),
  status        text not null default 'open' check (status in ('open', 'paid')),
  created_by    uuid references public.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invoices_company_number_key unique (company_id, number),
  constraint invoices_total_is_subtotal_plus_vat check (total = subtotal + vat),
  constraint invoices_due_date_not_before_invoice_date check (due_date >= invoice_date)
);
create index invoices_company_id_idx on public.invoices (company_id);
create index invoices_customer_id_idx on public.invoices (customer_id);

create table public.payments (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references public.companies (id),
  invoice_id  bigint not null references public.invoices (id),
  amount      numeric(12,2) not null check (amount > 0),
  paid_on     date not null default (timezone('Asia/Bangkok', now()))::date,
  method      text not null check (method in ('transfer', 'cash', 'cheque')),
  note        text,
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index payments_invoice_id_idx on public.payments (invoice_id);

-- One row per (company, document type); see ADR-0003.
create table public.doc_counters (
  company_id  bigint not null references public.companies (id),
  doc_type    text not null check (doc_type in ('SO', 'INV', 'IN', 'OUT', 'ADJ')),
  last_value  integer not null default 0 check (last_value >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (company_id, doc_type)
);

-- updated_at trigger on every table
create trigger set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.stock_movements
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sales_orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.doc_counters
  for each row execute function public.set_updated_at();
