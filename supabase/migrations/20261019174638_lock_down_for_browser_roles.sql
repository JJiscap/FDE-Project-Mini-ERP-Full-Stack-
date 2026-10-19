-- Only FastAPI talks to the database (ADR-0004). The browser keys (anon, authenticated)
-- must read nothing, even if the frontend has a bug:
--   * RLS is on for every table, with no policies  -> no row is visible to them
--   * table, view, sequence and function privileges are revoked from them as well

alter table public.companies        enable row level security;
alter table public.users            enable row level security;
alter table public.customers        enable row level security;
alter table public.products         enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.sales_orders     enable row level security;
alter table public.order_items      enable row level security;
alter table public.invoices         enable row level security;
alter table public.payments         enable row level security;
alter table public.doc_counters     enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Objects created by later migrations start closed too.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
