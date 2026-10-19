-- confirm_sales_order(order, user): Confirm a Draft Sales Order in ONE transaction (ADR-0002, business rule 5).
--
-- All or nothing. In this order it:
--   1. finds the order in the User's Company and locks it (a second Confirm waits, then sees Confirmed),
--   2. refuses an order that is not a Draft, or has no lines,
--   3. locks every Product on the order, lowest id first (so two Confirms can't deadlock),
--   4. refuses with `Not enough stock for <SKU>` if any Product is short (lines of one Product are added up),
--   5. takes the next INV number from doc_counters (after the stock check, so a refused Confirm uses none,
--      and a rollback gives the number back anyway: ADR-0003),
--   6. writes one negative `sale` Stock Movement per line (ref_doc = the INV number),
--   7. writes the Invoice: Subtotal, VAT = round(Subtotal x 0.07, 2) on the whole Subtotal, Total,
--      Invoice Date = today in Bangkok, Due Date = Invoice Date + the Customer's Payment Terms,
--   8. sets the order Confirmed.
--
-- numeric round() is half away from zero, which is half up for money (never negative):
-- the same rule as app.core.money.vat_for. Returns the id of the new Invoice.
-- The raised messages are written for people; FastAPI maps them to 409.

create function public.confirm_sales_order(p_order_id bigint, p_user_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id  bigint;
  v_order       record;
  v_terms       integer;
  v_short_sku   text;
  v_subtotal    numeric(12,2);
  v_vat         numeric(12,2);
  v_invoice_no  text;
  v_invoice_id  bigint;
  v_today       date := (timezone('Asia/Bangkok', now()))::date;
begin
  select u.company_id into v_company_id
    from public.users u
   where u.id = p_user_id;
  if v_company_id is null then
    raise exception 'User not found';
  end if;

  select o.id, o.number, o.status, o.customer_id into v_order
    from public.sales_orders o
   where o.id = p_order_id
     and o.company_id = v_company_id
     for update;
  if not found then
    raise exception 'Sales Order not found';
  end if;
  if v_order.status <> 'draft' then
    raise exception '% is % and can''t be changed', v_order.number, v_order.status;
  end if;

  if not exists (
    select 1 from public.order_items i
     where i.order_id = p_order_id and i.company_id = v_company_id
  ) then
    raise exception 'Add at least one line';
  end if;

  -- Lock the Products in id order: the stock check below can't be overtaken by another Confirm.
  perform 1
     from public.products p
    where p.company_id = v_company_id
      and p.id in (select i.product_id from public.order_items i where i.order_id = p_order_id)
    order by p.id
      for update;

  select p.sku into v_short_sku
    from public.products p
    join (select i.product_id, sum(i.quantity) as needed
            from public.order_items i
           where i.order_id = p_order_id and i.company_id = v_company_id
           group by i.product_id) n on n.product_id = p.id
   where (select coalesce(sum(m.quantity), 0)
            from public.stock_movements m
           where m.product_id = p.id) < n.needed
   order by p.id
   limit 1;
  if v_short_sku is not null then
    raise exception 'Not enough stock for %', v_short_sku;
  end if;

  select c.payment_terms_days into v_terms
    from public.customers c
   where c.id = v_order.customer_id and c.company_id = v_company_id;
  if v_terms is null then
    raise exception 'Customer not found';
  end if;

  select sum(i.quantity * i.unit_price) into v_subtotal
    from public.order_items i
   where i.order_id = p_order_id and i.company_id = v_company_id;
  v_vat := round(v_subtotal * 0.07, 2);

  v_invoice_no := public.next_doc_number(v_company_id, 'INV');

  insert into public.stock_movements
         (company_id, product_id, quantity, movement_type, ref_doc, reason, created_by)
  select v_company_id, i.product_id, -i.quantity, 'sale', v_invoice_no,
         'Sales order ' || v_order.number, p_user_id
    from public.order_items i
   where i.order_id = p_order_id and i.company_id = v_company_id
   order by i.id;

  insert into public.invoices
         (company_id, number, order_id, customer_id, invoice_date, due_date,
          subtotal, vat, total, status, created_by)
  values (v_company_id, v_invoice_no, p_order_id, v_order.customer_id, v_today, v_today + v_terms,
          v_subtotal, v_vat, v_subtotal + v_vat, 'open', p_user_id)
  returning id into v_invoice_id;

  update public.sales_orders
     set status = 'confirmed', confirmed_at = now()
   where id = p_order_id;

  return v_invoice_id;
end;
$$;

-- Only FastAPI (the database owner) may call it; never the browser keys.
revoke all on function public.confirm_sales_order(bigint, uuid) from public, anon, authenticated;
