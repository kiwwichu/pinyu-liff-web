-- Step 3.13A DRAFT ONLY. Not applied. Requires explicit migration authorization.
-- Additive: no legacy backfill, no order/item repricing, no automatic status changes.
-- Customer payments and platform settlements are separate streams in one append-only table.
begin;

create table public.order_financial_entries (
  request_id uuid primary key,
  order_id text not null references public.orders(order_id) on delete restrict,
  ledger text not null check (ledger in ('payments', 'platform_settlements')),
  kind text not null check (kind in ('receipt', 'refund', 'adjustment')),
  amount numeric(14,4) not null check (amount <> 0 and amount <> 'NaN'::numeric),
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  channel text not null check (channel in ('direct', 'platform')),
  platform_name_snapshot text,
  method text not null check (length(btrim(method)) between 1 and 80),
  note text not null default '' check (length(note) <= 1000),
  recorded_by uuid not null references public.app_users(user_id) on delete restrict,
  recorded_at timestamptz not null default now(),
  check (kind = 'adjustment' or amount > 0),
  check (ledger <> 'payments' or kind <> 'adjustment'),
  check (ledger <> 'platform_settlements' or channel = 'platform'),
  check (kind = 'receipt' or length(btrim(note)) > 0)
);
create index order_financial_entries_order_idx
  on public.order_financial_entries(order_id, recorded_at, request_id);
create index order_financial_entries_actor_idx on public.order_financial_entries(recorded_by);
alter table public.order_financial_entries enable row level security;
revoke all on public.order_financial_entries from public, anon, authenticated, service_role;
grant select, insert on public.order_financial_entries to service_role;

create function public.reject_order_ledger_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception 'financial entries are append-only; record a separate event';
end;
$$;
create trigger order_financial_entries_immutable
before update or delete on public.order_financial_entries
for each row execute function public.reject_order_ledger_mutation();
revoke all on function public.reject_order_ledger_mutation() from public, anon, authenticated;

-- Atomic statement snapshot of current pricing + separately recorded actual events.
-- No names, addresses, LINE identifiers, or order notes are selected.
create function public.get_order_ledger_v2(p_order_id text, p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.app_users u
    where u.user_id = p_actor_id and upper(u.role) in ('OWNER', 'ADMIN')
      and lower(btrim(u.status)) in ('active', '啟用') and u.can_view_money
  ) then raise exception 'ledger access denied'; end if;

  select jsonb_build_object(
    'order', jsonb_build_object(
      'orderId', o.order_id, 'orderModelVersion', o.order_model_version,
      'updatedAt', o.updated_at,
      'customerTotal', o.customer_total::text,
      'ownerEarningsTotal', o.owner_earnings_total::text,
      'sitterEarningsTotal', o.sitter_earnings_total::text,
      'companyEarningsBeforePlatform', o.company_earnings_before_platform::text,
      'platformName', o.platform_name
    ),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'requestId', e.request_id, 'orderId', e.order_id, 'ledger', e.ledger,
        'kind', e.kind, 'amount', e.amount::text,
        'occurredAt', to_char(e.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'channel', e.channel, 'method', e.method, 'note', e.note
      ) order by e.recorded_at, e.request_id)
      from public.order_financial_entries e where e.order_id = o.order_id
    ), '[]'::jsonb)
  ) into v_result
  from public.orders o where o.order_id = p_order_id and o.order_model_version = 2;
  if v_result is null then raise exception 'V2 order not found'; end if;
  return v_result;
end;
$$;
revoke all on function public.get_order_ledger_v2(text, uuid) from public, anon, authenticated;
grant execute on function public.get_order_ledger_v2(text, uuid) to service_role;

create function public.append_order_ledger_v2(
  p_entry jsonb, p_actor_id uuid, p_expected_updated_at timestamptz
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_previous public.order_financial_entries%rowtype;
  v_request uuid := (p_entry ->> 'requestId')::uuid;
  v_order_id text := p_entry ->> 'orderId';
  v_ledger text := p_entry ->> 'ledger';
  v_kind text := p_entry ->> 'kind';
  v_amount numeric(14,4);
  v_occurred timestamptz := (p_entry ->> 'occurredAt')::timestamptz;
  v_channel text := p_entry ->> 'channel';
  v_method text := btrim(p_entry ->> 'method');
  v_note text := coalesce(btrim(p_entry ->> 'note'), '');
begin
  if jsonb_typeof(p_entry) is distinct from 'object' or v_request is null
    or v_order_id is null or v_ledger is null or v_kind is null or v_channel is null
    or v_method is null or v_occurred is null then
    raise exception 'invalid financial entry';
  end if;
  if (p_entry ->> 'amount') is null
    or (p_entry ->> 'amount') !~ '^-?[0-9]{1,10}([.][0-9]{1,4})?$' then
    raise exception 'invalid financial amount';
  end if;
  v_amount := (p_entry ->> 'amount')::numeric(14,4);
  if not exists (
    select 1 from public.app_users u where u.user_id = p_actor_id
      and upper(u.role) in ('OWNER', 'ADMIN')
      and lower(btrim(u.status)) in ('active', '啟用')
      and u.can_view_money and u.can_edit_orders
  ) then raise exception 'ledger write denied'; end if;

  -- Shares the order row lock used by save_order_v2. Never updates order snapshots.
  select * into v_order from public.orders where order_id = v_order_id for update;
  if not found or v_order.order_model_version is distinct from 2 then
    raise exception 'V2 order not found';
  end if;
  -- Retry the same event even if a later edit changed the order timestamp.
  select * into v_previous from public.order_financial_entries where request_id = v_request;
  if found then
    if v_previous.order_id is distinct from v_order_id
      or v_previous.ledger is distinct from v_ledger
      or v_previous.kind is distinct from v_kind
      or v_previous.amount is distinct from v_amount
      or v_previous.occurred_at is distinct from v_occurred
      or v_previous.channel is distinct from v_channel
      or v_previous.method is distinct from v_method
      or v_previous.note is distinct from v_note
      or v_previous.recorded_by is distinct from p_actor_id then
      raise exception 'idempotency key reused with different event';
    end if;
    return public.get_order_ledger_v2(v_order_id, p_actor_id);
  end if;
  if p_expected_updated_at is null or v_order.updated_at is distinct from p_expected_updated_at then
    raise exception 'order changed; reload before recording';
  end if;
  if v_channel = 'platform' and nullif(btrim(v_order.platform_name), '') is null then
    raise exception 'platform entry requires a platform order';
  end if;
  if v_order.customer_total is null or v_order.sitter_earnings_total is null
    or v_order.company_earnings_before_platform is null
    or v_order.customer_total <> v_order.sitter_earnings_total + v_order.company_earnings_before_platform then
    raise exception 'order snapshot does not reconcile';
  end if;

  insert into public.order_financial_entries(
    request_id, order_id, ledger, kind, amount, occurred_at, channel, method, note, recorded_by, platform_name_snapshot
  ) values (
    v_request, v_order_id, v_ledger, v_kind, v_amount, v_occurred,
    v_channel, v_method, v_note, p_actor_id, v_order.platform_name
  );
  return public.get_order_ledger_v2(v_order_id, p_actor_id);
end;
$$;
revoke all on function public.append_order_ledger_v2(jsonb, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.append_order_ledger_v2(jsonb, uuid, timestamptz) to service_role;

-- Intentionally no automatic order/payment status transition, repricing, notification,
-- or platform_actual_payout overwrite. Ledger summaries are projected on read.
commit;
