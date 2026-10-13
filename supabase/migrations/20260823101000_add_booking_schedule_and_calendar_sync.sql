create table public.booking_requests (
  request_id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  request_status text not null default 'new'
    check (request_status in ('new', 'reviewing', 'approved', 'rejected', 'converted')),
  customer_type text not null default 'new'
    check (customer_type in ('new', 'returning')),
  cat_count smallint not null default 0 check (cat_count between 0 and 20),
  dog_count smallint not null default 0 check (dog_count between 0 and 20),
  other_pets text,
  care_needs text not null,
  service_start_date date not null,
  service_end_date date not null,
  service_periods jsonb not null default '[]'::jsonb,
  district text not null,
  distance_km numeric(6,2) not null check (distance_km between 0 and 100),
  nearest_mrt text not null,
  near_mrt boolean not null,
  location_note text,
  source text not null default 'client_web',
  source_ip_hash text,
  submitted_by_line_user_id text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.app_users(user_id) on update cascade on delete set null,
  converted_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (service_end_date >= service_start_date),
  check (jsonb_typeof(service_periods) = 'array'),
  check (cat_count + dog_count > 0 or char_length(coalesce(other_pets, '')) > 0),
  check (char_length(coalesce(other_pets, '')) <= 60),
  check (char_length(care_needs) between 1 and 800),
  check (char_length(district) between 1 and 50),
  check (char_length(nearest_mrt) between 1 and 60),
  check (char_length(coalesce(location_note, '')) <= 400)
);

comment on table public.booking_requests is
  'Public booking enquiries. Browsers never access this table directly; the Worker validates and inserts using the server-only service role.';

create index booking_requests_status_created_idx
  on public.booking_requests (request_status, created_at desc);

create index booking_requests_line_user_idx
  on public.booking_requests (submitted_by_line_user_id, created_at desc)
  where submitted_by_line_user_id is not null;

create table public.sitter_schedule_settings (
  sitter_id bigint primary key references public.sitters(sitter_id) on update cascade on delete cascade,
  morning_start time not null default time '09:00',
  morning_end time not null default time '12:00',
  afternoon_start time not null default time '13:00',
  afternoon_end time not null default time '18:00',
  evening_start time not null default time '18:00',
  evening_end time not null default time '22:00',
  monthly_order_limit smallint check (monthly_order_limit is null or monthly_order_limit between 1 and 200),
  buffer_minutes smallint not null default 0 check (buffer_minutes between 0 and 240),
  updated_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (morning_start < morning_end),
  check (afternoon_start < afternoon_end),
  check (evening_start < evening_end)
);

comment on table public.sitter_schedule_settings is
  'Owner-managed time shortcuts and monthly demand-order capacity for each sitter.';

create table public.sitter_recurring_blocks (
  recurring_block_id bigint generated always as identity primary key,
  sitter_id bigint not null references public.sitters(sitter_id) on update cascade on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  label text not null,
  effective_from date not null default current_date,
  effective_until date,
  is_enabled boolean not null default true,
  created_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  check (effective_until is null or effective_until >= effective_from),
  check (char_length(label) between 1 and 100)
);

comment on table public.sitter_recurring_blocks is
  'Private recurring busy-time rules. They affect capacity but are never exposed to customers with their private label.';

create index sitter_recurring_blocks_lookup_idx
  on public.sitter_recurring_blocks (sitter_id, weekday, effective_from, effective_until)
  where is_enabled;

alter table public.sitter_availability
  add column internal_note text,
  add column buffer_minutes smallint not null default 0;

alter table public.sitter_availability
  add constraint sitter_availability_internal_note_length_check
    check (char_length(coalesce(internal_note, '')) <= 500),
  add constraint sitter_availability_buffer_minutes_check
    check (buffer_minutes between 0 and 240);

alter table public.orders
  add column sitter_id bigint references public.sitters(sitter_id) on update cascade on delete set null;

update public.orders o
set sitter_id = s.sitter_id
from public.sitters s
where o.sitter_id is null
  and (
    case
      when coalesce(o.legacy_data ->> 'sitter_id', '') ~ '^\d+$'
        then (o.legacy_data ->> 'sitter_id')::bigint = s.sitter_id
      else false
    end
    or lower(trim(o.caregiver)) = lower(trim(s.display_name))
  );

create index orders_sitter_status_idx
  on public.orders (sitter_id, order_status)
  where sitter_id is not null;

create table public.google_calendar_sync_jobs (
  sync_job_id bigint generated always as identity primary key,
  order_id text not null references public.orders(order_id) on update cascade on delete cascade,
  sync_action text not null default 'upsert' check (sync_action in ('upsert', 'cancel')),
  sync_status text not null default 'pending' check (sync_status in ('pending', 'processing', 'synced', 'failed')),
  google_event_id text,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 100),
  last_error text,
  next_attempt_at timestamptz not null default now(),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.google_calendar_sync_jobs is
  'Durable outbox for Google Calendar. Confirmed orders enqueue an upsert; cancelled orders enqueue a cancellation.';

create unique index google_calendar_sync_jobs_active_order_idx
  on public.google_calendar_sync_jobs (order_id)
  where sync_status in ('pending', 'processing', 'failed');

create index google_calendar_sync_jobs_pending_idx
  on public.google_calendar_sync_jobs (sync_status, next_attempt_at)
  where sync_status in ('pending', 'failed');

insert into public.sitter_schedule_settings (sitter_id)
select sitter_id from public.sitters
on conflict (sitter_id) do nothing;

insert into public.sitter_recurring_blocks (sitter_id, weekday, starts_at, ends_at, label)
select s.sitter_id, days.weekday, time '09:00', time '18:00', '平日固定工作'
from public.sitters s
cross join generate_series(1, 5) as days(weekday)
where s.display_name = '品伃'
  and not exists (
    select 1 from public.sitter_recurring_blocks existing
    where existing.sitter_id = s.sitter_id
      and existing.weekday = days.weekday
      and existing.starts_at = time '09:00'
      and existing.ends_at = time '18:00'
      and existing.label = '平日固定工作'
  );

alter table public.booking_requests enable row level security;
alter table public.sitter_schedule_settings enable row level security;
alter table public.sitter_recurring_blocks enable row level security;
alter table public.google_calendar_sync_jobs enable row level security;

revoke all on table public.booking_requests from public, anon, authenticated;
revoke all on table public.sitter_schedule_settings from public, anon, authenticated;
revoke all on table public.sitter_recurring_blocks from public, anon, authenticated;
revoke all on table public.google_calendar_sync_jobs from public, anon, authenticated;

grant select, insert, update on table public.booking_requests to service_role;
grant select, insert, update on table public.sitter_schedule_settings to service_role;
grant select, insert, update, delete on table public.sitter_recurring_blocks to service_role;
grant select, insert, update, delete on table public.google_calendar_sync_jobs to service_role;
grant usage, select on sequence public.sitter_recurring_blocks_recurring_block_id_seq to service_role;
grant usage, select on sequence public.google_calendar_sync_jobs_sync_job_id_seq to service_role;

create trigger set_booking_requests_updated_at
before update on public.booking_requests
for each row execute function public.set_updated_at();

create trigger set_sitter_schedule_settings_updated_at
before update on public.sitter_schedule_settings
for each row execute function public.set_updated_at();

create trigger set_sitter_recurring_blocks_updated_at
before update on public.sitter_recurring_blocks
for each row execute function public.set_updated_at();

create trigger set_google_calendar_sync_jobs_updated_at
before update on public.google_calendar_sync_jobs
for each row execute function public.set_updated_at();
