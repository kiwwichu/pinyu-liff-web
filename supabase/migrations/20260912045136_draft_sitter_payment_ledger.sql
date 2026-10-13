-- REVIEW DRAFT ONLY: Step 3.13B. No authorization to apply, including to Dev.
-- Generated with supabase migration new. Remove the guard ONLY after explicit approval.
-- Positive actual payments only; reversal/recovery/reassignment settlement is NOT designed here.
begin;

create table public.sitter_payment_entries (
  request_id uuid primary key,
  order_id text not null references public.orders(order_id) on delete restrict,
  order_item_id uuid not null references public.order_items(order_item_id) on delete restrict,
  sitter_id_snapshot bigint not null references public.sitters(sitter_id) on delete restrict,
  order_updated_at_snapshot timestamptz not null,
  item_updated_at_snapshot timestamptz not null,
  -- Explicit financial fields only. Never copy the entire order/item (PII/free text).
  remuneration_snapshot jsonb not null check (jsonb_typeof(remuneration_snapshot) = 'object'),
  due_amount_snapshot numeric(14,4) not null check (due_amount_snapshot >= 0 and due_amount_snapshot <> 'NaN'::numeric),
  amount numeric(14,4) not null check (amount > 0 and amount <> 'NaN'::numeric),
  paid_at timestamptz not null check (isfinite(paid_at)),
  method text not null check (length(btrim(method)) between 1 and 80),
  difference_reason text not null default '' check (length(difference_reason) <= 1000),
  recorded_by uuid not null references public.app_users(user_id) on delete restrict,
  recorded_at timestamptz not null default now()
);
create index sitter_payment_entries_order_idx on public.sitter_payment_entries(order_id);
create index sitter_payment_entries_item_idx on public.sitter_payment_entries(order_item_id, recorded_at, request_id);
create index sitter_payment_entries_sitter_idx on public.sitter_payment_entries(sitter_id_snapshot, paid_at, request_id);
create index sitter_payment_entries_actor_idx on public.sitter_payment_entries(recorded_by);
alter table public.sitter_payment_entries enable row level security;
revoke all on public.sitter_payment_entries from public, anon, authenticated, service_role;
grant select, insert on public.sitter_payment_entries to service_role;

create function public.reject_sitter_payment_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin raise exception 'sitter payments are append-only'; end;
$$;
create trigger sitter_payment_entries_immutable before update or delete on public.sitter_payment_entries
for each row execute function public.reject_sitter_payment_mutation();
revoke all on function public.reject_sitter_payment_mutation() from public, anon, authenticated;

-- Private service-role RPC. Actor MUST come from verified server auth, never client payload.
-- This contract is a review candidate, not a newly approved operational payout policy.
create function public.append_sitter_payment_v2(
  p_entry jsonb, p_actor_id uuid,
  p_expected_order_updated_at timestamptz, p_expected_item_updated_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_previous public.sitter_payment_entries%rowtype;
  v_request uuid;
  v_order_id text;
  v_item_id uuid;
  v_amount numeric(14,4);
  v_paid_at timestamptz;
  v_method text;
  v_reason text;
  v_snapshot jsonb;
  v_paid numeric;
begin
  if not exists (
    select 1 from public.app_users u where u.user_id = p_actor_id
      and upper(u.role) in ('OWNER', 'ADMIN') and lower(btrim(u.status)) in ('active', '啟用')
      and u.can_view_money and u.can_edit_orders
  ) then raise exception 'sitter payment write denied'; end if;
  if jsonb_typeof(p_entry) is distinct from 'object'
    or (p_entry ->> 'amount') is null
    or (p_entry ->> 'amount') !~ '^[0-9]{1,10}([.][0-9]{1,4})?$' then
    raise exception 'invalid sitter payment';
  end if;
  v_request := (p_entry ->> 'requestId')::uuid;
  v_order_id := nullif(btrim(p_entry ->> 'orderId'), '');
  v_item_id := (p_entry ->> 'orderItemId')::uuid;
  v_amount := (p_entry ->> 'amount')::numeric(14,4);
  v_paid_at := (p_entry ->> 'paidAt')::timestamptz;
  v_method := btrim(p_entry ->> 'method');
  v_reason := coalesce(btrim(p_entry ->> 'differenceReason'), '');
  if v_request is null or v_order_id is null or v_item_id is null or v_amount <= 0
    or v_paid_at is null or not isfinite(v_paid_at) or v_method is null
    or length(v_method) not between 1 and 80 or length(v_reason) > 1000
    or (p_entry ->> 'paidAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d{1,3})?(Z|[+-]\d{2}:\d{2})$' then
    raise exception 'invalid sitter payment';
  end if;
  -- Shared ordering with save_order_v2: order first, then item. No UPDATE of either.
  -- Global key lock also serializes identical request IDs across different orders.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request::text, 313));
  select * into v_order from public.orders where order_id = v_order_id for update;
  if not found or v_order.order_model_version is distinct from 2 then
    raise exception 'V2 order not found';
  end if;
  select * into v_previous from public.sitter_payment_entries where request_id = v_request;
  if found then
    if v_previous.order_id is distinct from v_order_id or v_previous.order_item_id is distinct from v_item_id
      or v_previous.amount is distinct from v_amount or v_previous.paid_at is distinct from v_paid_at
      or v_previous.method is distinct from v_method or v_previous.difference_reason is distinct from v_reason
      or v_previous.recorded_by is distinct from p_actor_id then
      raise exception 'idempotency key reused with different sitter payment';
    end if;
    -- Retry does not resnapshot, reassign, or require a current CAS token.
    return jsonb_build_object('requestId', v_previous.request_id, 'recorded', true, 'replayed', true);
  end if;
  select * into v_item from public.order_items where order_item_id = v_item_id and order_id = v_order_id for update;
  if not found then raise exception 'item does not belong to order'; end if;
  if p_expected_order_updated_at is null or p_expected_item_updated_at is null
    or v_order.updated_at is distinct from p_expected_order_updated_at
    or v_item.updated_at is distinct from p_expected_item_updated_at then
    raise exception 'payment source changed; reload before recording';
  end if;
  -- Owner execution is company income, not a payment to a cooperative sitter.
  -- Cancelled/reassigned/changed-remuneration settlement is deferred for explicit review.
  if v_item.provider_type_snapshot <> 'sitter' or v_item.assigned_sitter_id is null
    or v_item.item_status <> 'active' or v_order.order_status = 'cancelled' then
    raise exception 'payment source requires settlement review';
  end if;
  v_snapshot := jsonb_build_object(
    'itemType', v_item.item_type, 'serviceDate', v_item.service_date,
    'providerType', v_item.provider_type_snapshot, 'sitterId', v_item.assigned_sitter_id,
    'chargedUnitPrice', v_item.charged_unit_price::text, 'quantity', v_item.quantity::text,
    'lineAmount', v_item.line_amount::text, 'commissionRate', v_item.commission_rate_snapshot::text,
    'commissionBaseAmount', v_item.commission_base_amount::text,
    'sitterEarningsAmount', v_item.sitter_earnings_amount::text,
    'companyShareAmount', v_item.company_share_amount::text,
    'companyDiscountAbsorbedAmount', v_item.company_discount_absorbed_amount::text,
    'homeVisitExecutionMode', v_item.home_visit_execution_mode,
    'calculationVersion', v_order.calculation_version
  );
  if exists (select 1 from public.sitter_payment_entries e where e.order_item_id = v_item_id
    and (e.sitter_id_snapshot is distinct from v_item.assigned_sitter_id
      or e.remuneration_snapshot is distinct from v_snapshot)) then
    raise exception 'historical payment source changed; settlement review required';
  end if;
  select coalesce(sum(e.amount), 0) into v_paid from public.sitter_payment_entries e where e.order_item_id = v_item_id;
  if v_paid + v_amount <> v_item.sitter_earnings_amount and v_reason = '' then
    raise exception 'difference reason required (including partial payment)';
  end if;
  insert into public.sitter_payment_entries (
    request_id, order_id, order_item_id, sitter_id_snapshot, order_updated_at_snapshot, item_updated_at_snapshot,
    remuneration_snapshot, due_amount_snapshot, amount, paid_at, method, difference_reason, recorded_by
  ) values (
    v_request, v_order_id, v_item_id, v_item.assigned_sitter_id, v_order.updated_at, v_item.updated_at,
    v_snapshot, v_item.sitter_earnings_amount, v_amount, v_paid_at, v_method, v_reason, p_actor_id
  );
  return jsonb_build_object('requestId', v_request, 'recorded', true, 'replayed', false);
end;
$$;
revoke all on function public.append_sitter_payment_v2(jsonb, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.append_sitter_payment_v2(jsonb, uuid, timestamptz, timestamptz) to service_role;

-- No public/sitter read RPC yet: an assigned-only, redacted projection must be reviewed.
-- Never reuse customer ledger, alter order states, modify save_order_v2, or backfill old data.
commit;
