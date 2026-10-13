-- Step 3.11: atomic V2 order update path for the Dev Admin.
--
-- This migration is additive. It does not update, backfill, rename, or delete
-- legacy order rows. Existing V2 service occurrences may be cancelled but may
-- not be omitted from an update payload, preserving partial-cancellation history.

alter table public.orders
  add constraint orders_order_status_v2_check
  check (
    order_model_version is distinct from 2
    or order_status in ('draft', 'awaiting_deposit', 'confirmed', 'in_service', 'completed', 'cancelled')
  ) not valid;

alter table public.orders validate constraint orders_order_status_v2_check;

create function public.save_order_v2(
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
  v_order_id text := nullif(btrim(p_order ->> 'order_id'), '');
  v_existing public.orders%rowtype;
  v_exists boolean := false;
  v_next_status text := nullif(btrim(p_order ->> 'order_status'), '');
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
  v_service_date_raw text;
  v_caregiver text;
  v_single_sitter_id bigint;
begin
  if v_order_id is null then
    raise exception 'order_id is required';
  end if;

  if coalesce((p_order ->> 'order_model_version')::smallint, 0) <> 2 then
    raise exception 'order_model_version must be 2';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty JSON array';
  end if;

  if v_next_status not in ('draft', 'awaiting_deposit', 'confirmed', 'in_service', 'completed', 'cancelled') then
    raise exception 'unsupported V2 order status';
  end if;

  select *
  into v_existing
  from public.orders
  where order_id = v_order_id
  for update;
  v_exists := found;

  if not v_exists then
    return public.create_order_v2(p_order, p_items);
  end if;

  if v_existing.order_model_version is distinct from 2 then
    raise exception 'legacy orders are read-only through save_order_v2';
  end if;

  if p_expected_updated_at is null or v_existing.updated_at <> p_expected_updated_at then
    raise exception 'order was updated by another request; reload before saving';
  end if;

  if not (case v_existing.order_status
    when 'draft' then v_next_status in ('draft', 'awaiting_deposit', 'confirmed', 'cancelled')
    when 'awaiting_deposit' then v_next_status in ('awaiting_deposit', 'draft', 'confirmed', 'cancelled')
    when 'confirmed' then v_next_status in ('confirmed', 'in_service', 'completed', 'cancelled')
    when 'in_service' then v_next_status in ('in_service', 'confirmed', 'completed', 'cancelled')
    when 'completed' then v_next_status = 'completed'
    when 'cancelled' then v_next_status = 'cancelled'
    else false
  end) then
    raise exception 'invalid V2 order status transition from % to %', v_existing.order_status, v_next_status;
  end if;

  if exists (
    select 1
    from public.order_items existing_item
    where existing_item.order_id = v_order_id
      and not exists (
        select 1
        from jsonb_array_elements(p_items) payload_item
        where nullif(payload_item ->> 'order_item_id', '')::uuid = existing_item.order_item_id
      )
  ) then
    raise exception 'existing order items cannot be deleted; cancel the occurrence instead';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) payload_item
    where nullif(payload_item ->> 'order_item_id', '') is null
  ) then
    raise exception 'every saved order item requires order_item_id';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) payload_item
    join public.order_items existing_item
      on existing_item.order_item_id = (payload_item ->> 'order_item_id')::uuid
    where existing_item.order_id <> v_order_id
  ) then
    raise exception 'an order item belongs to another order';
  end if;

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
    item.order_item_id,
    v_order_id,
    item.item_type,
    item.item_status,
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
  )
  on conflict (order_item_id) do update set
    item_type = excluded.item_type,
    item_status = excluded.item_status,
    display_order = excluded.display_order,
    service_plan_id = excluded.service_plan_id,
    item_name_snapshot = excluded.item_name_snapshot,
    duration_minutes_snapshot = excluded.duration_minutes_snapshot,
    standard_unit_price_snapshot = excluded.standard_unit_price_snapshot,
    custom_unit_price = excluded.custom_unit_price,
    charged_unit_price = excluded.charged_unit_price,
    quantity = excluded.quantity,
    line_amount = excluded.line_amount,
    service_date = excluded.service_date,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    specified_time_note = excluded.specified_time_note,
    assigned_sitter_id = excluded.assigned_sitter_id,
    provider_type_snapshot = excluded.provider_type_snapshot,
    commission_rate_snapshot = excluded.commission_rate_snapshot,
    commission_base_amount = excluded.commission_base_amount,
    company_share_amount = excluded.company_share_amount,
    sitter_earnings_amount = excluded.sitter_earnings_amount,
    company_discount_absorbed_amount = excluded.company_discount_absorbed_amount,
    home_visit_execution_mode = excluded.home_visit_execution_mode,
    allocation_note = excluded.allocation_note,
    cancelled_at = excluded.cancelled_at,
    cancellation_reason = excluded.cancellation_reason,
    updated_by = excluded.updated_by;

  get diagnostics v_item_count = row_count;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'not all order items were saved';
  end if;

  if v_next_status = 'cancelled' and exists (
    select 1 from public.order_items
    where order_id = v_order_id and item_status = 'active'
  ) then
    raise exception 'a cancelled order cannot retain active items';
  end if;

  if v_next_status <> 'cancelled' and not exists (
    select 1 from public.order_items
    where order_id = v_order_id and item_status = 'active' and item_type in ('service', 'home_visit_fee')
  ) then
    raise exception 'a non-cancelled order requires an active service occurrence';
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
    coalesce(sum(company_share_amount) filter (where item_status = 'active'), 0)
      + coalesce(sum(sitter_earnings_amount) filter (where item_status = 'active' and provider_type_snapshot = 'owner'), 0)
      - coalesce(sum(company_discount_absorbed_amount) filter (where item_status = 'active'), 0),
    case
      when min(service_date) filter (where item_status = 'active' and service_date is not null)
        = max(service_date) filter (where item_status = 'active' and service_date is not null)
      then min(service_date) filter (where item_status = 'active' and service_date is not null)::text
      else concat(
        min(service_date) filter (where item_status = 'active' and service_date is not null)::text,
        '～',
        max(service_date) filter (where item_status = 'active' and service_date is not null)::text
      )
    end,
    case
      when count(distinct assigned_sitter_id) filter (where item_status = 'active' and assigned_sitter_id is not null) > 1
      then '多位保姆'
      else max(sitter.display_name) filter (where item.item_status = 'active')
    end,
    case
      when count(distinct assigned_sitter_id) filter (where item_status = 'active' and assigned_sitter_id is not null) = 1
      then max(assigned_sitter_id) filter (where item_status = 'active')
      else null
    end
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
    v_company_earnings,
    v_service_date_raw,
    v_caregiver,
    v_single_sitter_id
  from public.order_items item
  left join public.sitters sitter on sitter.sitter_id = item.assigned_sitter_id
  where item.order_id = v_order_id;

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

  update public.orders set
    order_status = v_next_status,
    caregiver = v_caregiver,
    sitter_id = v_single_sitter_id,
    service_date_raw = v_service_date_raw,
    family_id = nullif(btrim(p_order ->> 'family_id'), ''),
    owner_name_snapshot = nullif(btrim(p_order ->> 'owner_name_snapshot'), ''),
    pet_name_snapshot = nullif(btrim(p_order ->> 'pet_name_snapshot'), ''),
    travel_fee = v_travel_total,
    tip = v_tip_total,
    order_platform = coalesce(nullif(btrim(p_order ->> 'platform_name'), ''), nullif(btrim(p_order ->> 'order_source'), '')),
    standard_deposit = (p_order ->> 'deposit_amount_due')::numeric,
    custom_deposit = null,
    home_visit_fee = v_home_visit_total,
    remaining_payment = (p_order ->> 'balance_amount_due')::numeric,
    total = v_customer_total,
    unpaid_balance = v_customer_total,
    total_before_discount = v_total_before_discount,
    net_income = null,
    notes = nullif(btrim(p_order ->> 'notes'), ''),
    legacy_data = coalesce(legacy_data, '{}'::jsonb)
      || coalesce(p_order -> 'legacy_data', '{}'::jsonb)
      || jsonb_build_object('order_model_version', 2, 'updated_via', 'save_order_v2'),
    order_source = nullif(btrim(p_order ->> 'order_source'), ''),
    payment_status = p_order ->> 'payment_status',
    confirmed_at = case
      when v_next_status in ('confirmed', 'in_service', 'completed') then coalesce(confirmed_at, now())
      else confirmed_at
    end,
    completed_at = case when v_next_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
    cancelled_at = case when v_next_status = 'cancelled' then coalesce(cancelled_at, now()) else null end,
    cancellation_reason = case when v_next_status = 'cancelled' then nullif(btrim(p_order ->> 'cancellation_reason'), '') else null end,
    service_subtotal = v_service_subtotal,
    travel_fee_total = v_travel_total,
    tip_total = v_tip_total,
    home_visit_fee_total = v_home_visit_total,
    discount_type = p_order ->> 'discount_type',
    discount_value = (p_order ->> 'discount_value')::numeric,
    discount_amount = v_discount_amount,
    customer_total = v_customer_total,
    deposit_rule_type = p_order ->> 'deposit_rule_type',
    deposit_rate_snapshot = nullif(p_order ->> 'deposit_rate_snapshot', '')::numeric,
    custom_deposit_amount = nullif(p_order ->> 'custom_deposit_amount', '')::numeric,
    deposit_amount_due = (p_order ->> 'deposit_amount_due')::numeric,
    balance_amount_due = (p_order ->> 'balance_amount_due')::numeric,
    owner_earnings_total = v_owner_earnings,
    sitter_earnings_total = v_sitter_earnings,
    company_service_share_total = v_company_service_share,
    company_discount_absorbed = v_company_discount_absorbed,
    company_earnings_before_platform = v_company_earnings,
    platform_name = nullif(btrim(p_order ->> 'platform_name'), ''),
    platform_order_ref = nullif(btrim(p_order ->> 'platform_order_ref'), ''),
    platform_payout_status = p_order ->> 'platform_payout_status',
    platform_actual_payout = nullif(p_order ->> 'platform_actual_payout', '')::numeric,
    calculation_version = p_order ->> 'calculation_version',
    calculated_at = coalesce(nullif(p_order ->> 'calculated_at', '')::timestamptz, now()),
    updated_by = nullif(p_order ->> 'updated_by', '')::uuid
  where order_id = v_order_id;

  return v_order_id;
end;
$$;

comment on function public.save_order_v2(jsonb, jsonb, timestamptz) is
  'Service-role-only atomic create/update for orders V2. Existing occurrences cannot be deleted; cancelling them preserves history. Uses optimistic concurrency and validates status transitions and calculated totals.';

revoke all on function public.save_order_v2(jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.save_order_v2(jsonb, jsonb, timestamptz) to service_role;
