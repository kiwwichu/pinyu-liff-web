create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.families (
  family_id text primary key,
  district text,
  owner_name text not null,
  travel_fee numeric(12, 2),
  distance_km numeric(10, 2),
  customer_category text,
  notes text,
  established_at timestamptz,
  notification_channel text,
  home_visit_at timestamptz,
  contract_status text,
  instagram_permission text,
  legacy_unique_key text unique,
  marketing_channel text,
  first_inquiry_date date,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  pet_id text primary key,
  family_id text not null references public.families(family_id) on update cascade,
  pet_name text not null,
  species text,
  breed text,
  weight_kg numeric(8, 2),
  sex text,
  age_text text,
  neuter_status text,
  medical_notes text,
  behavior_notes text,
  feeding_notes text,
  established_on date,
  is_enabled boolean not null default true,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.line_bindings (
  line_user_id text primary key,
  family_id text not null references public.families(family_id) on update cascade,
  binding_status text not null default 'bound',
  bound_at timestamptz,
  last_interaction_at timestamptz,
  is_enabled boolean not null default true,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_plans (
  plan_id uuid primary key default gen_random_uuid(),
  service_type text not null,
  plan_name text not null,
  duration_minutes integer,
  price numeric(12, 2) not null default 0,
  legacy_key text unique,
  is_enabled boolean not null default true,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_type, plan_name)
);

create table public.orders (
  order_id text primary key,
  order_status text not null,
  caregiver text,
  notification_command text,
  visits_command text,
  notification_state text,
  last_notified_at timestamptz,
  legacy_notification_status text,
  confirmation_result text,
  established_at timestamptz,
  service_date_raw text,
  booking_segment text,
  specified_time text,
  family_id text references public.families(family_id) on update cascade,
  owner_name_snapshot text,
  pet_name_snapshot text,
  line_user_id_snapshot text,
  service_type text,
  plan_name text,
  hours numeric(10, 2),
  quantity integer,
  standard_price numeric(12, 2),
  custom_price numeric(12, 2),
  travel_fee numeric(12, 2),
  tip numeric(12, 2),
  order_platform text,
  standard_deposit numeric(12, 2),
  custom_deposit numeric(12, 2),
  home_visit_fee numeric(12, 2),
  remaining_payment numeric(12, 2),
  discount numeric(12, 2),
  total numeric(12, 2),
  net_income numeric(12, 2),
  unpaid_balance numeric(12, 2),
  total_before_discount numeric(12, 2),
  uses_wallet boolean not null default false,
  notes text,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visits (
  visit_id text primary key,
  order_id text not null references public.orders(order_id) on update cascade on delete cascade,
  family_id text references public.families(family_id) on update cascade,
  established_at timestamptz,
  owner_name_snapshot text,
  pet_name_snapshot text,
  service_date date not null,
  slot_code text,
  slot_text text,
  specified_time text,
  is_slot_locked boolean not null default false,
  hours numeric(10, 2),
  service_type text,
  plan_name text,
  source_order_row integer,
  order_status_snapshot text,
  sync_status text,
  notes text,
  inventory_sync_status text,
  inventory_synced_at timestamptz,
  inventory_sync_key text,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_reviews (
  review_id text primary key,
  order_id text not null references public.orders(order_id) on update cascade on delete cascade,
  family_id text not null references public.families(family_id) on update cascade,
  line_user_id text,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  report_clarity smallint check (report_clarity between 1 and 5),
  care_quality smallint check (care_quality between 1 and 5),
  pet_comfort smallint check (pet_comfort between 1 and 5),
  punctuality smallint check (punctuality between 1 and 5),
  communication smallint check (communication between 1 and 5),
  feedback text,
  allow_anonymous_publication boolean not null default false,
  public_name text,
  submitted_at timestamptz,
  last_modified_at timestamptz,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create table public.app_users (
  user_id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  google_email text unique,
  display_name text not null,
  role text not null,
  visible_families text,
  can_create_orders boolean not null default false,
  can_edit_orders boolean not null default false,
  can_send_notifications boolean not null default false,
  can_view_money boolean not null default false,
  status text not null default 'active',
  legacy_created_at timestamptz,
  last_login_at timestamptz,
  notes text,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (line_user_id is not null or google_email is not null)
);

create table public.reminder_logs (
  reminder_key text primary key,
  reminder_type text not null,
  family_id text references public.families(family_id) on update cascade,
  order_id text references public.orders(order_id) on update cascade on delete set null,
  target_date date,
  result text,
  logged_at timestamptz not null default now(),
  details text,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb
);

create table public.wallet_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  legacy_transaction_id text,
  occurred_on date not null,
  family_id text not null references public.families(family_id) on update cascade,
  transaction_type text not null,
  amount numeric(12, 2) not null,
  order_id text references public.orders(order_id) on update cascade on delete set null,
  uses_wallet boolean not null default false,
  notes text,
  source_sheet text not null,
  source_row integer,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (transaction_type in ('儲值', '贈送', '扣款')),
  unique (source_sheet, legacy_transaction_id)
);

create table public.postal_codes (
  city text not null,
  district text not null,
  postal_code text not null,
  source_row integer,
  primary key (city, district, postal_code)
);

create table public.app_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.rate_limits (
  rate_limit_key text primary key,
  last_seen_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index pets_family_id_idx on public.pets(family_id);
create index line_bindings_family_id_idx on public.line_bindings(family_id);
create index orders_family_id_idx on public.orders(family_id);
create index orders_status_idx on public.orders(order_status);
create index visits_order_id_idx on public.visits(order_id);
create index visits_family_date_idx on public.visits(family_id, service_date);
create index reviews_family_id_idx on public.service_reviews(family_id);
create index reminder_logs_family_id_idx on public.reminder_logs(family_id);
create index wallet_transactions_family_date_idx on public.wallet_transactions(family_id, occurred_on);
create index rate_limits_expires_at_idx on public.rate_limits(expires_at);

create trigger families_set_updated_at before update on public.families
for each row execute function public.set_updated_at();
create trigger pets_set_updated_at before update on public.pets
for each row execute function public.set_updated_at();
create trigger line_bindings_set_updated_at before update on public.line_bindings
for each row execute function public.set_updated_at();
create trigger service_plans_set_updated_at before update on public.service_plans
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger visits_set_updated_at before update on public.visits
for each row execute function public.set_updated_at();
create trigger service_reviews_set_updated_at before update on public.service_reviews
for each row execute function public.set_updated_at();
create trigger app_users_set_updated_at before update on public.app_users
for each row execute function public.set_updated_at();

create view public.wallet_balances
with (security_invoker = true)
as
select
  family_id,
  coalesce(sum(
    case
      when transaction_type in ('儲值', '贈送') then abs(amount)
      when transaction_type = '扣款' then -abs(amount)
      else 0
    end
  ), 0)::numeric(12, 2) as balance,
  max(occurred_on) as last_activity_on
from public.wallet_transactions
group by family_id;

create view public.wallet_activity
with (security_invoker = true)
as
select
  wt.occurred_on,
  wt.transaction_type,
  wt.legacy_transaction_id,
  wt.family_id,
  wt.amount,
  wt.uses_wallet,
  wt.notes,
  sum(
    case
      when wt.transaction_type in ('儲值', '贈送') then abs(wt.amount)
      when wt.transaction_type = '扣款' then -abs(wt.amount)
      else 0
    end
  ) over (
    partition by wt.family_id
    order by wt.occurred_on, wt.created_at, wt.transaction_id
  )::numeric(12, 2) as balance_after_transaction
from public.wallet_transactions wt;

create view public.orders_export
with (security_invoker = true)
as
select
  o.order_id,
  o.order_status,
  o.caregiver,
  o.notification_command,
  o.visits_command,
  coalesce(o.legacy_notification_status, o.notification_state) as notification_status,
  o.confirmation_result,
  o.established_at,
  o.service_date_raw,
  o.booking_segment,
  o.specified_time,
  o.owner_name_snapshot,
  o.pet_name_snapshot,
  o.family_id,
  o.line_user_id_snapshot,
  o.service_type,
  o.plan_name,
  o.hours,
  o.quantity,
  o.standard_price,
  o.custom_price,
  o.travel_fee,
  o.tip,
  o.order_platform,
  o.standard_deposit,
  o.custom_deposit,
  o.home_visit_fee,
  o.remaining_payment,
  o.discount,
  o.total,
  o.net_income,
  o.unpaid_balance,
  o.total_before_discount,
  o.uses_wallet,
  o.notes
from public.orders o;

alter table public.families enable row level security;
alter table public.pets enable row level security;
alter table public.line_bindings enable row level security;
alter table public.service_plans enable row level security;
alter table public.orders enable row level security;
alter table public.visits enable row level security;
alter table public.service_reviews enable row level security;
alter table public.app_users enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.postal_codes enable row level security;
alter table public.app_settings enable row level security;
alter table public.rate_limits enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.set_updated_at() to service_role;
