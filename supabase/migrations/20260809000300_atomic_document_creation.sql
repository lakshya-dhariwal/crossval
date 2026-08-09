create or replace function public.persist_document_snapshot(
  p_user_id uuid, p_document_id uuid, p_expected_version bigint, p_title text, p_customer text,
  p_issue_date date, p_status public.document_status, p_finalized_at timestamptz,
  p_subtotal numeric, p_total_discount numeric, p_total_tax numeric, p_grand_total numeric,
  p_lines jsonb
) returns setof public.documents language plpgsql security definer set search_path = public as $$
declare current_doc public.documents; line jsonb; line_id uuid; line_parent uuid;
begin
  select * into current_doc from public.documents where id = p_document_id and user_id = p_user_id for update;
  if not found then raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if current_doc.version <> p_expected_version then raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode = 'P0001'; end if;
  if current_doc.status = 'finalized' then raise exception 'DOCUMENT_FINALIZED' using errcode = 'P0001'; end if;

  delete from public.line_items where document_id = p_document_id;
  for line in select * from jsonb_array_elements(p_lines) loop
    if line ? 'id' and nullif(line->>'id', '') is not null then
      line_id := (line->>'id')::uuid;
      select document_id into line_parent from public.line_items where id = line_id;
      if line_parent is not null and line_parent <> p_document_id then raise exception 'LINE_DOCUMENT_MISMATCH' using errcode = 'P0001'; end if;
    else
      line_id := gen_random_uuid();
    end if;
    insert into public.line_items(id, document_id, position, description, quantity, unit_price, discount_type, discount_value, tax_percent, subtotal, discount_amount, discounted_amount, tax_amount, line_total)
    values (line_id, p_document_id, (line->>'position')::integer, line->>'description', (line->>'quantity')::numeric, (line->>'unitPrice')::numeric, (line->>'discountType')::public.discount_type, (line->>'discountValue')::numeric, (line->>'taxPercent')::numeric, (line->>'subtotal')::numeric, (line->>'discountAmount')::numeric, (line->>'discountedAmount')::numeric, (line->>'taxAmount')::numeric, (line->>'lineTotal')::numeric);
  end loop;
  update public.documents set title=p_title, customer=p_customer, issue_date=p_issue_date, status=p_status, finalized_at=p_finalized_at, subtotal=p_subtotal, total_discount=p_total_discount, total_tax=p_total_tax, grand_total=p_grand_total, version=version+1 where id=p_document_id;
  return query select * from public.documents where id=p_document_id;
end; $$;
revoke all on function public.persist_document_snapshot(uuid, uuid, bigint, text, text, date, public.document_status, timestamptz, numeric, numeric, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.persist_document_snapshot(uuid, uuid, bigint, text, text, date, public.document_status, timestamptz, numeric, numeric, numeric, numeric, jsonb) to service_role;

create or replace function public.create_document_snapshot(
  p_user_id uuid, p_title text, p_customer text, p_issue_date date, p_sample_key text,
  p_subtotal numeric, p_total_discount numeric, p_total_tax numeric, p_grand_total numeric,
  p_lines jsonb
) returns setof public.documents language plpgsql security definer set search_path = public as $$
declare created_doc public.documents; line jsonb;
begin
  insert into public.documents(user_id, title, customer, issue_date, sample_key, subtotal, total_discount, total_tax, grand_total)
  values (p_user_id, p_title, p_customer, p_issue_date, p_sample_key, p_subtotal, p_total_discount, p_total_tax, p_grand_total)
  returning * into created_doc;
  for line in select * from jsonb_array_elements(p_lines) loop
    insert into public.line_items(document_id, position, description, quantity, unit_price, discount_type, discount_value, tax_percent, subtotal, discount_amount, discounted_amount, tax_amount, line_total)
    values (created_doc.id, (line->>'position')::integer, line->>'description', (line->>'quantity')::numeric, (line->>'unitPrice')::numeric, (line->>'discountType')::public.discount_type, (line->>'discountValue')::numeric, (line->>'taxPercent')::numeric, (line->>'subtotal')::numeric, (line->>'discountAmount')::numeric, (line->>'discountedAmount')::numeric, (line->>'taxAmount')::numeric, (line->>'lineTotal')::numeric);
  end loop;
  return query select * from public.documents where id = created_doc.id;
end; $$;
revoke all on function public.create_document_snapshot(uuid, text, text, date, text, numeric, numeric, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.create_document_snapshot(uuid, text, text, date, text, numeric, numeric, numeric, numeric, jsonb) to service_role;
