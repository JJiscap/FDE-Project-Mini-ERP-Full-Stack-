-- record_payment(invoice, amount, paid_on, method, note, user): record a Payment against an Open Invoice
-- in ONE transaction (US-4, business rules 1 and 9).
--
-- In this order it:
--   1. refuses a bad amount (not above 0, more than 2 decimals), method or note, before touching any row,
--   2. finds the User's Company, then the Invoice in that Company and locks it (a second Payment on the
--      same Invoice waits, then sees the new Balance, so two people can never overpay it together),
--   3. refuses a Paid Invoice (`INV-0001 is already paid`),
--   4. works out the Balance = Total minus the Payments so far, and refuses a Payment above it
--      (`Payment is more than the balance of 4,630.00 THB`),
--   5. inserts the Payment (paid_on defaults to today in Bangkok),
--   6. sets the Invoice Paid when the Balance reaches exactly 0.00.
--
-- Partial Payments are allowed. Returns the id of the new Payment. The Company comes from the User's row,
-- never from the caller. The raised messages are written for people; FastAPI maps them to 409.

create function public.record_payment(
  p_invoice_id bigint,
  p_amount     numeric,
  p_paid_on    date,
  p_method     text,
  p_note       text,
  p_user_id    uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id bigint;
  v_invoice    record;
  v_paid       numeric(12,2);
  v_balance    numeric(12,2);
  v_note       text := nullif(btrim(p_note), '');
  v_payment_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception 'Amount can have at most 2 decimal places';
  end if;
  if p_method is null or p_method not in ('transfer', 'cash', 'cheque') then
    raise exception 'Method must be transfer, cash or cheque';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Note must be at most 500 characters';
  end if;

  select u.company_id into v_company_id
    from public.users u
   where u.id = p_user_id;
  if v_company_id is null then
    raise exception 'User not found';
  end if;

  select i.id, i.number, i.total, i.status into v_invoice
    from public.invoices i
   where i.id = p_invoice_id
     and i.company_id = v_company_id
     for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_invoice.status = 'paid' then
    raise exception '% is already paid', v_invoice.number;
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p
   where p.invoice_id = p_invoice_id and p.company_id = v_company_id;
  v_balance := v_invoice.total - v_paid;
  if p_amount > v_balance then
    raise exception 'Payment is more than the balance of % THB',
      to_char(v_balance, 'FM999,999,999,990.00');
  end if;

  insert into public.payments
         (company_id, invoice_id, amount, paid_on, method, note, created_by)
  values (v_company_id, p_invoice_id, p_amount,
          coalesce(p_paid_on, (timezone('Asia/Bangkok', now()))::date),
          p_method, v_note, p_user_id)
  returning id into v_payment_id;

  if p_amount = v_balance then
    update public.invoices set status = 'paid' where id = p_invoice_id;
  end if;

  return v_payment_id;
end;
$$;

-- Only FastAPI (the database owner) may call it; never the browser keys.
revoke all on function public.record_payment(bigint, numeric, date, text, text, uuid)
  from public, anon, authenticated;
