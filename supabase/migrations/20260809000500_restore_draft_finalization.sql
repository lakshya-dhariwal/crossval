create or replace function public.prevent_finalized_document_mutation() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if old.status = 'finalized' then
    if new.status = 'draft' then
      if new.title is distinct from old.title
        or new.customer is distinct from old.customer
        or new.issue_date is distinct from old.issue_date
        or new.subtotal is distinct from old.subtotal
        or new.total_discount is distinct from old.total_discount
        or new.total_tax is distinct from old.total_tax
        or new.grand_total is distinct from old.grand_total then
        raise exception 'DOCUMENT_FINALIZED' using errcode = 'P0001';
      end if;
      new.finalized_at = null;
      return new;
    end if;
    raise exception 'DOCUMENT_FINALIZED' using errcode = 'P0001';
  end if;

  if old.status = 'draft' and new.status = 'finalized' then
    if new.finalized_at is null then
      raise exception 'FINALIZED_TIMESTAMP_REQUIRED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.status <> old.status then
    raise exception 'INVALID_DOCUMENT_TRANSITION' using errcode = 'P0001';
  end if;
  return new;
end; $$;
