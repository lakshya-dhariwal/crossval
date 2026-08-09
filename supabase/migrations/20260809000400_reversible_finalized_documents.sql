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

  if new.status = 'finalized' and new.finalized_at is null then
    raise exception 'FINALIZED_TIMESTAMP_REQUIRED' using errcode = 'P0001';
  elsif new.status <> old.status then
    raise exception 'INVALID_DOCUMENT_TRANSITION' using errcode = 'P0001';
  end if;
  return new;
end; $$;

create or replace function public.revert_document_to_draft(
  p_user_id uuid, p_document_id uuid, p_expected_version bigint
) returns setof public.documents language plpgsql security definer set search_path = public as $$
declare current_doc public.documents;
begin
  select * into current_doc
  from public.documents
  where id = p_document_id and user_id = p_user_id
  for update;

  if not found then raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if current_doc.version <> p_expected_version then raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode = 'P0001'; end if;
  if current_doc.status <> 'finalized' then raise exception 'DOCUMENT_NOT_FINALIZED' using errcode = 'P0001'; end if;

  update public.documents
  set status = 'draft', finalized_at = null, version = version + 1
  where id = p_document_id;
  return query select * from public.documents where id = p_document_id;
end; $$;

revoke all on function public.revert_document_to_draft(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.revert_document_to_draft(uuid, uuid, bigint) to service_role;
