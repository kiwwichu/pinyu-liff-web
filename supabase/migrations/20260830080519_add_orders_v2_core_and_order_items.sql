-- Step 3.10: additive orders V2 core.
--
-- Safety boundary:
-- - no legacy row is updated or backfilled;
-- - no existing column is renamed, dropped, or made stricter;
-- - legacy readers may continue using the existing orders columns;
-- - V2 writers explicitly set order_model_version = 2.

alter table public.orders
  add column order_model_version smallint,
  add column order_number text,
  add column booking_request_id uuid references public.booking_requests(request_id)
    on update cascade on delete set null,
  add column order_source text,
  add column payment_status text,
  add column confirmed_at timestamptz,
  add column completed_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancellation_reason text,
  add column service_subtotal numeric(14,4),
  add column travel_fee_total numeric(14,4),
  add column tip_total numeric(14,4),
  add column home_visit_fee_total numeric(14,4),
  add column discount_type text,
  add column discount_value numeric(14,6),
  add column discount_amount numeric(14,4),
  add column customer_total numeric(14,4),
  add column deposit_rule_type text,
  add column deposit_rate_snapshot numeric(8,6),
  add column custom_deposit_amount numeric(14,4),
  add column deposit_amount_due numeric(14,4),
  add column balance_amount_due numeric(14,4),
  add column owner_earnings_total numeric(14,4),
  add column sitter_earnings_total numeric(14,4),
  add column company_service_share_total numeric(14,4),
  add column company_discount_absorbed numeric(14,4),
  add column company_earnings_before_platform numeric(14,4),
  add column platform_name text,
  add column platform_order_ref text,
  add column platform_payout_status text,
  add column platform_actual_payout numeric(14,4),
  add column calculation_version text,
  add column calculated_at timestamptz,
  add column created_by uuid references public.app_users(user_id)
    on update cascade on delete set null,
  add column updated_by uuid references public.app_users(user_id)
    on update cascade on delete set null;

alter table public.orders
  add constraint orders_model_version_v2_check
    check (order_model_version is null or order_model_version in (1, 2)),
  add constraint orders_payment_status_v2_check
    check (
      payment_status is null
      or payment_status in ('unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded')
    ),
  add constraint orders_discount_type_v2_check
    check (discount_type is null or discount_type in ('none', 'rate', 'fixed')),
  add constraint orders_discount_value_v2_check
    check (
      discount_value is null
      or (
        discount_value >= 0
        and (discount_type <> 'rate' or discount_value <= 1)
      )
    ),
  add constraint orders_deposit_rule_v2_check
    check (
      deposit_rule_type is null
      or deposit_rule_type in ('default_rate', 'custom_rate', 'custom_amount', 'waived')
    ),
  add constraint orders_deposit_rate_v2_check
    check (deposit_rate_snapshot is null or deposit_rate_snapshot between 0 and 1),
  add constraint orders_platform_payout_status_v2_check
    check (
      platform_payout_status is null
      or platform_payout_status in ('not_applicable', 'pending', 'received')
    ),
  add constraint orders_v2_nonnegative_amounts_check
    check (
      (service_subtotal is null or service_subtotal >= 0)
      and (travel_fee_total is null or travel_fee_total >= 0)
      and (tip_total is null or tip_total >= 0)
      and (home_visit_fee_total is null or home_visit_fee_total >= 0)
      and (discount_amount is null or discount_amount >= 0)
      and (customer_total is null or customer_total >= 0)
      and (custom_deposit_amount is null or custom_deposit_amount >= 0)
      and (deposit_amount_due is null or deposit_amount_due >= 0)
      and (balance_amount_due is null or balance_amount_due >= 0)
      and (owner_earnings_total is null or owner_earnings_total >= 0)
      and (sitter_earnings_total is null or sitter_earnings_total >= 0)
      and (company_service_share_total is null or company_service_share_total >= 0)
      and (company_discount_absorbed is null or company_discount_absorbed >= 0)
      and (platform_actual_payout is null or platform_actual_payout >= 0)
    ),
  add constraint orders_v2_text_lengths_check
    check (
      char_length(coalesce(order_number, '')) <= 100
      and char_length(coalesce(order_source, '')) <= 80
      and char_length(coalesce(cancellation_reason, '')) <= 2000
      and char_length(coalesce(platform_name, '')) <= 100
      and char_length(coalesce(platform_order_ref, '')) <= 200
      and char_length(coalesce(calculation_version, '')) <= 50
    );

create unique index orders_order_number_v2_unique_idx
  on public.orders (order_number)
  where order_number is not null;

create index orders_model_status_v2_idx
  on public.orders (order_model_version, order_status, created_at desc)
  where order_model_version is not null;

create index orders_family_created_v2_idx
  on public.orders (family_id, created_at desc)
  where order_model_version = 2;

create index orders_booking_request_v2_idx
  on public.orders (booking_request_id)
  where booking_request_id is not null;

create table public.order_items (
  order_item_id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(order_id)
    on update cascade on delete cascade,
  item_type text not null
    check (item_type in ('service', 'travel_fee', 'home_visit_fee', 'tip')),
  item_status text not null default 'active'
    check (item_status in ('active', 'cancelled')),
  display_order integer not null default 0 check (display_order >= 0),
  service_plan_id uuid references public.service_plans(plan_id)
    on update cascade on delete set null,
  item_name_snapshot text not null,
  duration_minutes_snapshot integer,
  standard_unit_price_snapshot numeric(14,4) not null default 0,
  custom_unit_price numeric(14,4),
  charged_unit_price numeric(14,4) not null,
  quantity numeric(12,4) not null default 1,
  line_amount numeric(14,4) not null,
  service_date date,
  start_time time,
  end_time time,
  specified_time_note text,
  assigned_sitter_id bigint references public.sitters(sitter_id)
    on update cascade on delete set null,
  provider_type_snapshot text not null default 'unassigned'
    check (provider_type_snapshot in ('owner', 'sitter', 'unassigned')),
  commission_rate_snapshot numeric(8,6),
  commission_base_amount numeric(14,4) not null default 0,
  company_share_amount numeric(14,4) not null default 0,
  sitter_earnings_amount numeric(14,4) not null default 0,
  company_discount_absorbed_amount numeric(14,4) not null default 0,
  home_visit_execution_mode text,
  allocation_note text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references public.app_users(user_id)
    on update cascade on delete set null,
  updated_by uuid references public.app_users(user_id)
    on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(item_name_snapshot) <> ''),
  check (duration_minutes_snapshot is null or duration_minutes_snapshot >= 0),
  check (standard_unit_price_snapshot >= 0),
  check (custom_unit_price is null or custom_unit_price >= 0),
  check (charged_unit_price >= 0),
  check (quantity > 0),
  check (line_amount >= 0),
  check ((start_time is null and end_time is null) or (start_time is not null and end_time is not null and start_time < end_time)),
  check (item_type <> 'service' or service_date is not null),
  check (commission_rate_snapshot is null or commission_rate_snapshot between 0 and 1),
  check (commission_base_amount >= 0),
  check (company_share_amount >= 0),
  check (sitter_earnings_amount >= 0),
  check (company_discount_absorbed_amount >= 0),
  check (
    home_visit_execution_mode is null
    or home_visit_execution_mode in ('pinyu_self', 'sitter_independent', 'training', 'custom')
  ),
  check (
    (item_status = 'active' and cancelled_at is null)
    or item_status = 'cancelled'
  ),
  check (char_length(item_name_snapshot) <= 200),
  check (char_length(coalesce(specified_time_note, '')) <= 500),
  check (char_length(coalesce(allocation_note, '')) <= 2000),
  check (char_length(coalesce(cancellation_reason, '')) <= 2000)
);

comment on table public.order_items is
  'Orders V2 item snapshots. One service item represents one actual service occurrence; fee items are generated by the backend and are not manually managed by customers.';

comment on column public.order_items.provider_type_snapshot is
  'owner = Pinyu personally executes; sitter = collaborating sitter; unassigned = draft-only provisional allocation.';

comment on column public.order_items.company_discount_absorbed_amount is
  'The item share of the customer discount. It reduces company earnings only and never reduces sitter earnings.';

create unique index order_items_order_display_unique_idx
  on public.order_items (order_id, display_order);

create index order_items_order_status_idx
  on public.order_items (order_id, item_status, display_order);

create index order_items_sitter_service_date_idx
  on public.order_items (assigned_sitter_id, service_date, start_time)
  where item_status = 'active' and assigned_sitter_id is not null;

create index order_items_service_plan_idx
  on public.order_items (service_plan_id)
  where service_plan_id is not null;

alter table public.order_items enable row level security;

revoke all on table public.order_items from public, anon, authenticated;
grant select, insert, update, delete on table public.order_items to service_role;

create trigger set_order_items_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

create function public.create_order_v2(
  p_order jsonb,
  p_items jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id text := nullif(btrim(p_order ->> 'order_id'), '');
  v_order_number text := nullif(btrim(p_order ->> 'order_number'), '');
  v_item_count integer;
  v_service_subtotal numeric(14,4);
  v_travel_total numeric(14,4);
  v_home_visit_total numeric(14,4);
  v_tip_total numeric(14,4);
  v_total_before_discount numeric(14,4);
  v_discount_amount numeric(14,4);
  v_customer_total numeric(14,4);
  v_owner_earnings numeric(14,4);
  v_sitter_earnings numeric(14,4);
  v_company_service_share numeric(14,4);
  v_company_discount_absorbed numeric(14,4);
  v_company_earnings numeric(14,4);
begin
  if v_order_id is null or v_order_number is null then
    raise exception 'order_id and order_number are required';
  end if;

  if coalesce((p_order ->> 'order_model_version')::smallint, 0) <> 2 then
    raise exception 'order_model_version must be 2';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty JSON array';
  end if;

  insert into public.orders (
    order_id,
    legacy_order_id,
    order_status,
    caregiver,
    sitter_id,
    confirmation_result,
    established_at,
    service_date_raw,
    booking_segment,
    specified_time,
    family_id,
    owner_name_snapshot,
    pet_name_snapshot,
    service_type,
    plan_name,
    travel_fee,
    tip,
    order_platform,
    standard_deposit,
    home_visit_fee,
    remaining_payment,
    total,
    unpaid_balance,
    total_before_discount,
    net_income,
    notes,
    notification_state,
    legacy_data,
    order_model_version,
    order_number,
    booking_request_id,
    order_source,
    payment_status,
    confirmed_at,
    completed_at,
    cancelled_at,
    cancellation_reason,
    service_subtotal,
    travel_fee_total,
    tip_total,
    home_visit_fee_total,
    discount_type,
    discount_value,
    discount_amount,
    customer_total,
    deposit_rule_type,
    deposit_rate_snapshot,
    custom_deposit_amount,
    deposit_amount_due,
    balance_amount_due,
    owner_earnings_total,
    sitter_earnings_total,
    company_service_share_total,
    company_discount_absorbed,
    company_earnings_before_platform,
    platform_name,
    platform_order_ref,
    platform_payout_status,
    platform_actual_payout,
    calculation_version,
    calculated_at,
    created_by,
    updated_by
  ) values (
    v_order_id,
    coalesce(nullif(btrim(p_order ->> 'legacy_order_id'), ''), v_order_number),
    p_order ->> 'order_status',
    nullif(btrim(p_order ->> 'caregiver'), ''),
    nullif(p_order ->> 'sitter_id', '')::bigint,
    coalesce(nullif(btrim(p_order ->> 'confirmation_result'), ''), 'V2'),
    coalesce(nullif(p_order ->> 'established_at', '')::timestamptz, now()),
    nullif(btrim(p_order ->> 'service_date_raw'), ''),
    nullif(btrim(p_order ->> 'booking_segment'), ''),
    nullif(btrim(p_order ->> 'specified_time'), ''),
    nullif(btrim(p_order ->> 'family_id'), ''),
    nullif(btrim(p_order ->> 'owner_name_snapshot'), ''),
    nullif(btrim(p_order ->> 'pet_name_snapshot'), ''),
    nullif(btrim(p_order ->> 'service_type'), ''),
    nullif(btrim(p_order ->> 'plan_name'), ''),
    coalesce((p_order ->> 'travel_fee_total')::numeric, 0),
    coalesce((p_order ->> 'tip_total')::numeric, 0),
    coalesce(nullif(btrim(p_order ->> 'platform_name'), ''), nullif(btrim(p_order ->> 'order_source'), '')),
    (p_order ->> 'deposit_amount_due')::numeric,
    coalesce((p_order ->> 'home_visit_fee_total')::numeric, 0),
    (p_order ->> 'balance_amount_due')::numeric,
    (p_order ->> 'customer_total')::numeric,
    (p_order ->> 'customer_total')::numeric,
    (p_order ->> 'total_before_discount')::numeric,
    null,
    nullif(btrim(p_order ->> 'notes'), ''),
    'V2－不自動發送通知',
    coalesce(p_order -> 'legacy_data', '{}'::jsonb)
      || jsonb_build_object('order_model_version', 2, 'created_via', 'create_order_v2'),
    2,
    v_order_number,
    nullif(p_order ->> 'booking_request_id', '')::uuid,
    nullif(btrim(p_order ->> 'order_source'), ''),
    p_order ->> 'payment_status',
    nullif(p_order ->> 'confirmed_at', '')::timestamptz,
    nullif(p_order ->> 'completed_at', '')::timestamptz,
    nullif(p_order ->> 'cancelled_at', '')::timestamptz,
    nullif(btrim(p_order ->> 'cancellation_reason'), ''),
    (p_order ->> 'service_subtotal')::numeric,
    (p_order ->> 'travel_fee_total')::numeric,
    (p_order ->> 'tip_total')::numeric,
    (p_order ->> 'home_visit_fee_total')::numeric,
    p_order ->> 'discount_type',
    (p_order ->> 'discount_value')::numeric,
    (p_order ->> 'discount_amount')::numeric,
    (p_order ->> 'customer_total')::numeric,
    p_order ->> 'deposit_rule_type',
    (p_order ->> 'deposit_rate_snapshot')::numeric,
    nullif(p_order ->> 'custom_deposit_amount', '')::numeric,
    (p_order ->> 'deposit_amount_due')::numeric,
    (p_order ->> 'balance_amount_due')::numeric,
    (p_order ->> 'owner_earnings_total')::numeric,
    (p_order ->> 'sitter_earnings_total')::numeric,
    (p_order ->> 'company_service_share_total')::numeric,
    (p_order ->> 'company_discount_absorbed')::numeric,
    (p_order ->> 'company_earnings_before_platform')::numeric,
    nullif(btrim(p_order ->> 'platform_name'), ''),
    nullif(btrim(p_order ->> 'platform_order_ref'), ''),
    p_order ->> 'platform_payout_status',
    nullif(p_order ->> 'platform_actual_payout', '')::numeric,
    p_order ->> 'calculation_version',
    coalesce(nullif(p_order ->> 'calculated_at', '')::timestamptz, now()),
    nullif(p_order ->> 'created_by', '')::uuid,
    nullif(p_order ->> 'updated_by', '')::uuid
  );

  insert into public.order_items (
    order_item_id,
    order_id,
    item_type,
    item_status,
    display_order,
    service_plan_id,
    item_name_snapshot,
    duration_minutes_snapshot,
    standard_unit_price_snapshot,
    custom_unit_price,
    charged_unit_price,
    quantity,
    line_amount,
    service_date,
    start_time,
    end_time,
    specified_time_note,
    assigned_sitter_id,
    provider_type_snapshot,
    commission_rate_snapshot,
    commission_base_amount,
    company_share_amount,
    sitter_earnings_amount,
    company_discount_absorbed_amount,
    home_visit_execution_mode,
    allocation_note,
    cancelled_at,
    cancellation_reason,
    created_by,
    updated_by
  )
  select
    coalesce(item.order_item_id, gen_random_uuid()),
    v_order_id,
    item.item_type,
    coalesce(item.item_status, 'active'),
    item.display_order,
    item.service_plan_id,
    item.item_name_snapshot,
    item.duration_minutes_snapshot,
    item.standard_unit_price_snapshot,
    item.custom_unit_price,
    item.charged_unit_price,
    item.quantity,
    item.line_amount,
    item.service_date,
    item.start_time,
    item.end_time,
    item.specified_time_note,
    item.assigned_sitter_id,
    item.provider_type_snapshot,
    item.commission_rate_snapshot,
    item.commission_base_amount,
    item.company_share_amount,
    item.sitter_earnings_amount,
    item.company_discount_absorbed_amount,
    item.home_visit_execution_mode,
    item.allocation_note,
    item.cancelled_at,
    item.cancellation_reason,
    nullif(p_order ->> 'created_by', '')::uuid,
    nullif(p_order ->> 'updated_by', '')::uuid
  from jsonb_to_recordset(p_items) as item (
    order_item_id uuid,
    item_type text,
    item_status text,
    display_order integer,
    service_plan_id uuid,
    item_name_snapshot text,
    duration_minutes_snapshot integer,
    standard_unit_price_snapshot numeric,
    custom_unit_price numeric,
    charged_unit_price numeric,
    quantity numeric,
    line_amount numeric,
    service_date date,
    start_time time,
    end_time time,
    specified_time_note text,
    assigned_sitter_id bigint,
    provider_type_snapshot text,
    commission_rate_snapshot numeric,
    commission_base_amount numeric,
    company_share_amount numeric,
    sitter_earnings_amount numeric,
    company_discount_absorbed_amount numeric,
    home_visit_execution_mode text,
    allocation_note text,
    cancelled_at timestamptz,
    cancellation_reason text
  );

  get diagnostics v_item_count = row_count;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'not all order items were inserted';
  end if;

  select
    coalesce(sum(line_amount) filter (where item_status = 'active' and item_type = 'service'), 0),
    coalesce(sum(line_amount) filter (where item_status = 'active' and item_type = 'travel_fee'), 0),
    coalesce(sum(line_amount) filter (where item_status = 'active' and item_type = 'home_visit_fee'), 0),
    coalesce(sum(line_amount) filter (where item_status = 'active' and item_type = 'tip'), 0),
    coalesce(sum(line_amount) filter (where item_status = 'active'), 0),
    coalesce(sum(company_discount_absorbed_amount) filter (where item_status = 'active'), 0),
    coalesce(sum(sitter_earnings_amount) filter (where item_status = 'active' and provider_type_snapshot = 'owner'), 0),
    coalesce(sum(sitter_earnings_amount) filter (where item_status = 'active' and provider_type_snapshot = 'sitter'), 0),
    coalesce(sum(company_share_amount) filter (where item_status = 'active' and item_type = 'service'), 0),
    coalesce(
      sum(company_share_amount) filter (where item_status = 'active'), 0
    ) + coalesce(
      sum(sitter_earnings_amount) filter (where item_status = 'active' and provider_type_snapshot = 'owner'), 0
    ) - coalesce(
      sum(company_discount_absorbed_amount) filter (where item_status = 'active'), 0
    )
  into
    v_service_subtotal,
    v_travel_total,
    v_home_visit_total,
    v_tip_total,
    v_total_before_discount,
    v_company_discount_absorbed,
    v_owner_earnings,
    v_sitter_earnings,
    v_company_service_share,
    v_company_earnings
  from public.order_items
  where order_id = v_order_id;

  v_discount_amount := (p_order ->> 'discount_amount')::numeric;
  v_customer_total := v_total_before_discount - v_discount_amount;

  if abs(v_service_subtotal - (p_order ->> 'service_subtotal')::numeric) > 0.0001
    or abs(v_travel_total - (p_order ->> 'travel_fee_total')::numeric) > 0.0001
    or abs(v_home_visit_total - (p_order ->> 'home_visit_fee_total')::numeric) > 0.0001
    or abs(v_tip_total - (p_order ->> 'tip_total')::numeric) > 0.0001
    or abs(v_total_before_discount - (p_order ->> 'total_before_discount')::numeric) > 0.0001
    or abs(v_customer_total - (p_order ->> 'customer_total')::numeric) > 0.0001
    or abs(v_company_discount_absorbed - (p_order ->> 'company_discount_absorbed')::numeric) > 0.0001
    or abs(v_owner_earnings - (p_order ->> 'owner_earnings_total')::numeric) > 0.0001
    or abs(v_sitter_earnings - (p_order ->> 'sitter_earnings_total')::numeric) > 0.0001
    or abs(v_company_service_share - (p_order ->> 'company_service_share_total')::numeric) > 0.0001
    or abs(v_company_earnings - (p_order ->> 'company_earnings_before_platform')::numeric) > 0.0001
  then
    raise exception 'order totals do not reconcile with order items';
  end if;

  if exists (
    select 1
    from public.order_items
    where order_id = v_order_id
      and item_status = 'active'
      and abs(line_amount - sitter_earnings_amount - company_share_amount) > 0.0001
  ) then
    raise exception 'order item allocations do not reconcile';
  end if;

  return v_order_id;
end;
$$;

comment on function public.create_order_v2(jsonb, jsonb) is
  'Service-role-only atomic insert for one orders V2 header and all item snapshots. Calculation remains in the Worker; the function rejects non-reconciling snapshots.';

revoke all on function public.create_order_v2(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_v2(jsonb, jsonb) to service_role;
