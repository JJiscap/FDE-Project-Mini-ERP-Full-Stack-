-- Document numbers (SO-0001, INV-0001, IN-, OUT-, ADJ-) from a counter table, ADR-0003.
-- The increment happens in the caller's transaction: a rollback also rolls back
-- the counter, so numbers have no gaps. The row lock makes concurrent callers
-- take turns, so nobody gets the same number twice.

create function public.next_doc_number(p_company_id bigint, p_doc_type text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_value integer;
begin
  insert into public.doc_counters as c (company_id, doc_type, last_value)
  values (p_company_id, p_doc_type, 1)
  on conflict (company_id, doc_type)
  do update set last_value = c.last_value + 1
  returning c.last_value into v_value;

  -- lpad() would cut a number longer than 4 digits, so only pad the short ones.
  return p_doc_type || '-' ||
         case when v_value < 10000 then lpad(v_value::text, 4, '0') else v_value::text end;
end;
$$;
