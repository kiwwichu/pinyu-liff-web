create table public.sitter_access_profiles (
  sitter_id bigint primary key references public.sitters(sitter_id) on update cascade on delete cascade,
  binding_status text not null default 'not_invited' check (binding_status in ('not_invited', 'invited', 'bound', 'suspended')),
  line_user_id text unique,
  access_level smallint not null default 1 check (access_level between 1 and 5),
  performance_score numeric(5,2) not null default 0 check (performance_score between 0 and 100),
  can_view_assigned_family_basics boolean not null default true,
  can_view_assigned_address boolean not null default false,
  can_view_assigned_phone boolean not null default false,
  can_view_contract_summary boolean not null default false,
  can_view_reviews boolean not null default false,
  updated_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sitter_access_profiles is
  'Owner-managed sitter trust score and backend-enforced access flags. Family codes are never accepted as sitter credentials.';

create table public.sitter_binding_invites (
  invite_id uuid primary key default gen_random_uuid(),
  sitter_id bigint not null references public.sitters(sitter_id) on update cascade on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(token_hash) between 43 and 128)
);

comment on table public.sitter_binding_invites is
  'Single-use, short-lived sitter invitations. Only a hash is stored; the raw token must never be persisted.';

create index sitter_binding_invites_active_idx
  on public.sitter_binding_invites (sitter_id, expires_at desc)
  where used_at is null;

create table public.sitter_availability (
  availability_id bigint generated always as identity primary key,
  sitter_id bigint not null references public.sitters(sitter_id) on update cascade on delete cascade,
  available_date date not null,
  starts_at time,
  ends_at time,
  availability_status text not null default 'available' check (availability_status in ('available', 'limited', 'unavailable')),
  public_note text,
  created_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and starts_at < ends_at)),
  check (char_length(coalesce(public_note, '')) <= 300)
);

create unique index sitter_availability_unique_slot_idx
  on public.sitter_availability (sitter_id, available_date, coalesce(starts_at, time '00:00'), coalesce(ends_at, time '23:59:59'));

create index sitter_availability_public_lookup_idx
  on public.sitter_availability (available_date, availability_status, sitter_id);

create table public.public_site_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(setting_key) between 1 and 100)
);

insert into public.public_site_settings (setting_key, setting_value)
values
  ('service_area', '{"centerLabel":"中正紀念堂","radiusKm":7,"notice":"測試設定，可由管理端調整"}'::jsonb),
  ('booking_flow', '{"lineBindingRequiredAt":"submit","requiresAdminReview":true,"publicBrowsingRequiresLogin":false}'::jsonb)
on conflict (setting_key) do nothing;

insert into public.sitter_access_profiles (sitter_id)
select sitter_id from public.sitters
on conflict (sitter_id) do nothing;

alter table public.sitter_access_profiles enable row level security;
alter table public.sitter_binding_invites enable row level security;
alter table public.sitter_availability enable row level security;
alter table public.public_site_settings enable row level security;

revoke all on table public.sitter_access_profiles from public, anon, authenticated;
revoke all on table public.sitter_binding_invites from public, anon, authenticated;
revoke all on table public.sitter_availability from public, anon, authenticated;
revoke all on table public.public_site_settings from public, anon, authenticated;

grant select, insert, update on table public.sitter_access_profiles to service_role;
grant select, insert, update on table public.sitter_binding_invites to service_role;
grant select, insert, update, delete on table public.sitter_availability to service_role;
grant select, insert, update on table public.public_site_settings to service_role;
grant usage, select on sequence public.sitter_availability_availability_id_seq to service_role;

create trigger set_sitter_access_profiles_updated_at
before update on public.sitter_access_profiles
for each row execute function public.set_updated_at();

create trigger set_sitter_availability_updated_at
before update on public.sitter_availability
for each row execute function public.set_updated_at();

create trigger set_public_site_settings_updated_at
before update on public.public_site_settings
for each row execute function public.set_updated_at();
