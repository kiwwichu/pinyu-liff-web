-- Step 3.12: additive operational relations for orders V2 (Dev migration 20260902135025).
--
-- Safety boundary:
-- - no legacy order is updated or backfilled;
-- - no existing column/table/function is removed;
-- - family LINE bindings and notification rules remain out of scope;
-- - service-role-only writes preserve the existing Worker trust boundary.

create table public.order_item_pets (
  order_item_id uuid not null references public.order_items(order_item_id)
    on update cascade on delete cascade,
  pet_id text not null references public.pets(pet_id)
    on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  primary key (order_item_id, pet_id)
);

comment on table public.order_item_pets is
  'Many-to-many pets served by one V2 service occurrence. Order-level pets are the distinct union across its items.';

create index order_item_pets_pet_id_idx on public.order_item_pets(pet_id);

alter table public.order_item_pets enable row level security;
revoke all on table public.order_item_pets from public, anon, authenticated;
grant select, insert, delete on table public.order_item_pets to service_role;

create table public.order_home_visits (
  order_id text not null references public.orders(order_id)
    on update cascade on delete cascade,
  home_visit_id uuid not null references public.home_visit_records(home_visit_id)
    on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  primary key (order_id, home_visit_id)
);

comment on table public.order_home_visits is
  'Explicit order-to-home-visit links. A family visit can remain useful to more than one order without duplicating the visit record.';

create index order_home_visits_home_visit_id_idx on public.order_home_visits(home_visit_id);

alter table public.order_home_visits enable row level security;
revoke all on table public.order_home_visits from public, anon, authenticated;
grant select, insert, delete on table public.order_home_visits to service_role;

create function public.save_order_v2_with_relations(
  p_order jsonb,
  p_items jsonb,
  p_expected_updated_at timestamptz default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id text;
  v_family_id text := nullif(btrim(p_order ->> 'family_id'), '');
  v_sitter_id bigint;
begin
  if v_family_id is null then
    raise exception 'family_id is required';
  end if;

  if jsonb_typeof(coalesce(p_order -> 'pet_ids', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_order -> 'pet_ids', '[]'::jsonb)) = 0
  then
    raise exception 'at least one order pet is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_order -> 'pet_ids', '[]'::jsonb)) requested(pet_id)
    left join public.pets pet on pet.pet_id = requested.pet_id
    where pet.pet_id is null or pet.family_id <> v_family_id or not pet.is_enabled
  ) then
    raise exception 'every order pet must be an enabled pet in the selected family';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where item ->> 'item_type' in ('service', 'home_visit_fee')
      and item ->> 'item_status' = 'active'
      and (
        jsonb_typeof(coalesce(item -> 'pet_ids', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(item -> 'pet_ids', '[]'::jsonb)) = 0
      )
  ) then
    raise exception 'every active service occurrence requires at least one pet';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    cross join lateral jsonb_array_elements_text(coalesce(item -> 'pet_ids', '[]'::jsonb)) requested(pet_id)
    left join public.pets pet on pet.pet_id = requested.pet_id
    where pet.pet_id is null or pet.family_id <> v_family_id or not pet.is_enabled
  ) then
    raise exception 'every item pet must be an enabled pet in the selected family';
  end if;

  if jsonb_typeof(coalesce(p_order -> 'home_visit_ids', '[]'::jsonb)) <> 'array' then
    raise exception 'home_visit_ids must be an array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_order -> 'home_visit_ids', '[]'::jsonb)) requested(home_visit_id)
    left join public.home_visit_records visit
      on visit.home_visit_id = requested.home_visit_id::uuid
    where visit.home_visit_id is null or visit.family_id <> v_family_id
  ) then
    raise exception 'every linked home visit must belong to the selected family';
  end if;

  -- Serialize scheduling writes per sitter so concurrent orders cannot both pass
  -- the overlap check below.
  for v_sitter_id in
    select distinct nullif(item ->> 'assigned_sitter_id', '')::bigint
    from jsonb_array_elements(p_items) item
    where nullif(item ->> 'assigned_sitter_id', '') is not null
    order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(v_sitter_id);
  end loop;

  v_order_id := public.save_order_v2(p_order, p_items, p_expected_updated_at);

  delete from public.order_item_pets relation
  using public.order_items item
  where item.order_item_id = relation.order_item_id
    and item.order_id = v_order_id;

  insert into public.order_item_pets (order_item_id, pet_id)
  select
    (item ->> 'order_item_id')::uuid,
    pet_id
  from jsonb_array_elements(p_items) item
  cross join lateral jsonb_array_elements_text(coalesce(item -> 'pet_ids', '[]'::jsonb)) as requested_pet(pet_id)
  on conflict do nothing;

  delete from public.order_home_visits where order_id = v_order_id;
  insert into public.order_home_visits (order_id, home_visit_id)
  select v_order_id, home_visit_id::uuid
  from jsonb_array_elements_text(coalesce(p_order -> 'home_visit_ids', '[]'::jsonb)) as requested_visit(home_visit_id)
  on conflict do nothing;

  if exists (
    select 1
    from public.order_items candidate
    join public.order_items occupied
      on occupied.assigned_sitter_id = candidate.assigned_sitter_id
      and occupied.service_date = candidate.service_date
      and occupied.order_item_id <> candidate.order_item_id
      and occupied.item_status = 'active'
      and occupied.item_type = 'service'
      and occupied.start_time is not null
      and occupied.end_time is not null
      and candidate.start_time < occupied.end_time
      and candidate.end_time > occupied.start_time
    where candidate.order_id = v_order_id
      and candidate.item_status = 'active'
      and candidate.item_type = 'service'
      and candidate.assigned_sitter_id is not null
      and candidate.start_time is not null
      and candidate.end_time is not null
  ) then
    raise exception 'assigned sitter has an overlapping active service occurrence';
  end if;

  return v_order_id;
end;
$$;

comment on function public.save_order_v2_with_relations(jsonb, jsonb, timestamptz) is
  'Step 3.12 atomic wrapper: saves V2 order/items, item-pet and order-home-visit relations, then rejects active sitter time overlaps.';

revoke all on function public.save_order_v2_with_relations(jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.save_order_v2_with_relations(jsonb, jsonb, timestamptz) to service_role;
