create extension if not exists pgcrypto;

create type public.document_status as enum ('draft', 'finalized');
create type public.discount_type as enum ('none', 'percentage', 'fixed');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  customer text not null default '',
  issue_date date not null default current_date,
  status public.document_status not null default 'draft',
  subtotal numeric(19,2) not null default 0 check (subtotal >= 0),
  total_discount numeric(19,2) not null default 0 check (total_discount >= 0),
  total_tax numeric(19,2) not null default 0 check (total_tax >= 0),
  grand_total numeric(19,2) not null default 0 check (grand_total >= 0),
  version bigint not null default 1 check (version > 0),
  sample_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint finalized_timestamp_consistency check ((status = 'draft' and finalized_at is null) or (status = 'finalized' and finalized_at is not null))
);

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  position integer not null check (position >= 1),
  description text not null default '',
  quantity numeric(13,4) not null check (quantity >= 1 and quantity <= 999999999),
  unit_price numeric(19,4) not null check (unit_price >= 0 and unit_price <= 999999999999),
  discount_type public.discount_type not null default 'none',
  discount_value numeric(19,4) not null default 0 check (discount_value >= 0),
  tax_percent numeric(7,4) not null default 0 check (tax_percent >= 0 and tax_percent <= 100),
  subtotal numeric(19,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(19,2) not null default 0 check (discount_amount >= 0),
  discounted_amount numeric(19,2) not null default 0 check (discounted_amount >= 0),
  tax_amount numeric(19,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(19,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint none_discount_is_zero check (discount_type <> 'none' or discount_value = 0),
  constraint percentage_discount_is_bounded check (discount_type <> 'percentage' or discount_value <= 100),
  unique (document_id, position)
);

create unique index documents_one_sample_per_user on public.documents(user_id, sample_key) where sample_key is not null;
create index documents_user_updated_idx on public.documents(user_id, updated_at desc);
create index documents_user_issue_idx on public.documents(user_id, issue_date);
create index documents_user_status_idx on public.documents(user_id, status);
create index line_items_document_position_idx on public.line_items(document_id, position);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger documents_touch_updated_at before update on public.documents for each row execute function public.touch_updated_at();
create trigger line_items_touch_updated_at before update on public.line_items for each row execute function public.touch_updated_at();

create or replace function public.prevent_finalized_document_mutation() returns trigger language plpgsql as $$
begin
  if old.status = 'finalized' then raise exception 'DOCUMENT_FINALIZED' using errcode = 'P0001'; end if;
  if tg_op = 'UPDATE' and new.status = 'finalized' then
    if new.finalized_at is null then raise exception 'FINALIZED_TIMESTAMP_REQUIRED' using errcode = 'P0001'; end if;
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    raise exception 'INVALID_DOCUMENT_TRANSITION' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end; $$;
create trigger documents_lifecycle before update or delete on public.documents for each row execute function public.prevent_finalized_document_mutation();

create or replace function public.prevent_finalized_line_mutation() returns trigger language plpgsql as $$
declare parent_status public.document_status;
begin
  select status into parent_status from public.documents where id = coalesce(new.document_id, old.document_id);
  if parent_status = 'finalized' then raise exception 'DOCUMENT_FINALIZED' using errcode = 'P0001'; end if;
  return coalesce(new, old);
end; $$;
create trigger line_items_lifecycle before insert or update or delete on public.line_items for each row execute function public.prevent_finalized_line_mutation();

alter table public.documents enable row level security;
alter table public.documents force row level security;
alter table public.line_items enable row level security;
alter table public.line_items force row level security;

create policy documents_select_own on public.documents for select using (auth.uid() = user_id);
create policy documents_insert_own on public.documents for insert with check (auth.uid() = user_id);
create policy documents_update_draft on public.documents for update using (auth.uid() = user_id and status = 'draft') with check (auth.uid() = user_id);
create policy documents_delete_draft on public.documents for delete using (auth.uid() = user_id and status = 'draft');

create policy lines_select_own on public.line_items for select using (exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid()));
create policy lines_insert_draft on public.line_items for insert with check (exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid() and d.status = 'draft'));
create policy lines_update_draft on public.line_items for update using (exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid() and d.status = 'draft')) with check (exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid() and d.status = 'draft'));
create policy lines_delete_draft on public.line_items for delete using (exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid() and d.status = 'draft'));

create or replace function public.persist_document_snapshot(
  p_user_id uuid, p_document_id uuid, p_expected_version bigint, p_title text, p_customer text,
  p_issue_date date, p_status public.document_status, p_finalized_at timestamptz,
  p_subtotal numeric, p_total_discount numeric, p_total_tax numeric, p_grand_total numeric,
  p_lines jsonb
) returns setof public.documents language plpgsql security definer set search_path = public as $$
declare current_doc public.documents; line jsonb; kept_ids uuid[] := '{}'; line_id uuid;
begin
  select * into current_doc from public.documents where id = p_document_id and user_id = p_user_id for update;
  if not found then raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if current_doc.version <> p_expected_version then raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode = 'P0001'; end if;
  if current_doc.status = 'finalized' then raise exception 'DOCUMENT_FINALIZED' using errcode = 'P0001'; end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    line_id := coalesce((line->>'id')::uuid, gen_random_uuid()); kept_ids := array_append(kept_ids, line_id);
    insert into public.line_items(id, document_id, position, description, quantity, unit_price, discount_type, discount_value, tax_percent, subtotal, discount_amount, discounted_amount, tax_amount, line_total)
    values (line_id, p_document_id, (line->>'position')::integer, line->>'description', (line->>'quantity')::numeric, (line->>'unitPrice')::numeric, (line->>'discountType')::public.discount_type, (line->>'discountValue')::numeric, (line->>'taxPercent')::numeric, (line->>'subtotal')::numeric, (line->>'discountAmount')::numeric, (line->>'discountedAmount')::numeric, (line->>'taxAmount')::numeric, (line->>'lineTotal')::numeric)
    on conflict (id) do update set position=excluded.position, description=excluded.description, quantity=excluded.quantity, unit_price=excluded.unit_price, discount_type=excluded.discount_type, discount_value=excluded.discount_value, tax_percent=excluded.tax_percent, subtotal=excluded.subtotal, discount_amount=excluded.discount_amount, discounted_amount=excluded.discounted_amount, tax_amount=excluded.tax_amount, line_total=excluded.line_total;
  end loop;
  delete from public.line_items where document_id = p_document_id and not (id = any(kept_ids));
  update public.documents set title=p_title, customer=p_customer, issue_date=p_issue_date, status=p_status, finalized_at=p_finalized_at, subtotal=p_subtotal, total_discount=p_total_discount, total_tax=p_total_tax, grand_total=p_grand_total, version=version+1 where id=p_document_id;
  return query select * from public.documents where id=p_document_id;
end; $$;
revoke all on function public.persist_document_snapshot(uuid, uuid, bigint, text, text, date, public.document_status, timestamptz, numeric, numeric, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.persist_document_snapshot(uuid, uuid, bigint, text, text, date, public.document_status, timestamptz, numeric, numeric, numeric, numeric, jsonb) to service_role;
