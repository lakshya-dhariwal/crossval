create or replace function public.persist_document_snapshot(
  p_user_id uuid, p_document_id uuid, p_expected_version bigint, p_title text, p_customer text,
  p_issue_date date, p_status public.document_status, p_finalized_at timestamptz,
  p_subtotal numeric, p_total_discount numeric, p_total_tax numeric, p_grand_total numeric,
  p_lines jsonb
) returns setof public.documents language plpgsql security definer set search_path = public as $$
declare current_doc public.documents; line jsonb; line_id uuid;
begin
  select * into current_doc from public.documents where id = p_document_id and user_id = p_user_id for update;
  if not found then raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if current_doc.version <> p_expected_version then raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode = 'P0001'; end if;
  if current_doc.status = 'finalized' then raise exception 'DOCUMENT_FINALIZED' using errcode = 'P0001'; end if;

  -- The document lock makes this complete replacement atomic. Deleting first also
  -- avoids transient unique-position conflicts while an inserted row moves.
  delete from public.line_items where document_id = p_document_id;
  for line in select * from jsonb_array_elements(p_lines) loop
    line_id := coalesce((line->>'id')::uuid, gen_random_uuid());
    insert into public.line_items(id, document_id, position, description, quantity, unit_price, discount_type, discount_value, tax_percent, subtotal, discount_amount, discounted_amount, tax_amount, line_total)
    values (line_id, p_document_id, (line->>'position')::integer, line->>'description', (line->>'quantity')::numeric, (line->>'unitPrice')::numeric, (line->>'discountType')::public.discount_type, (line->>'discountValue')::numeric, (line->>'taxPercent')::numeric, (line->>'subtotal')::numeric, (line->>'discountAmount')::numeric, (line->>'discountedAmount')::numeric, (line->>'taxAmount')::numeric, (line->>'lineTotal')::numeric);
  end loop;
  update public.documents set title=p_title, customer=p_customer, issue_date=p_issue_date, status=p_status, finalized_at=p_finalized_at, subtotal=p_subtotal, total_discount=p_total_discount, total_tax=p_total_tax, grand_total=p_grand_total, version=version+1 where id=p_document_id;
  return query select * from public.documents where id=p_document_id;
end; $$;
revoke all on function public.persist_document_snapshot(uuid, uuid, bigint, text, text, date, public.document_status, timestamptz, numeric, numeric, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.persist_document_snapshot(uuid, uuid, bigint, text, text, date, public.document_status, timestamptz, numeric, numeric, numeric, numeric, jsonb) to service_role;
