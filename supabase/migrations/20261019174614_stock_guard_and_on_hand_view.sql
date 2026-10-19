-- Stock can never go negative (business rule 2), and On Hand is the sum of movements (rule 3).

-- Runs before every stock movement insert. Locks the product row so two
-- concurrent movements for the same product are checked one after the other.
create function public.stock_movements_no_negative()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sku      text;
  v_on_hand  bigint;
begin
  select p.sku into v_sku
    from public.products p
   where p.id = new.product_id
     for update;

  if v_sku is null then
    -- Unknown product: the foreign key reports it.
    return new;
  end if;

  select coalesce(sum(m.quantity), 0) into v_on_hand
    from public.stock_movements m
   where m.product_id = new.product_id;

  if v_on_hand + new.quantity < 0 then
    raise exception 'Not enough stock for %', v_sku;
  end if;

  return new;
end;
$$;

create trigger stock_movements_no_negative
  before insert on public.stock_movements
  for each row execute function public.stock_movements_no_negative();

-- One row per product with its On Hand. Nobody types this number.
create view public.stock_on_hand
with (security_invoker = true)
as
select p.id                              as product_id,
       p.company_id,
       p.sku,
       p.name,
       p.unit,
       p.price,
       p.cost,
       p.reorder_level,
       p.active,
       coalesce(sum(m.quantity), 0)::bigint as on_hand
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
 group by p.id;
