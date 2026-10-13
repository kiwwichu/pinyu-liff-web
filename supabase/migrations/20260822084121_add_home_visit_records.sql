create table public.home_visit_records (
  home_visit_id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(family_id) on update cascade on delete restrict,
  assigned_sitter_id uuid references public.app_users(user_id) on update cascade on delete set null,
  visit_type text not null default 'first',
  visit_status text not null default 'draft',
  scheduled_at timestamptz,
  completed_at timestamptz,
  access_notes text,
  environment_notes text,
  general_notes text,
  follow_up_notes text,
  fee_decision text not null default 'pending_discussion',
  proposed_fee numeric(12, 2),
  fee_reason text,
  confirmed_fee numeric(12, 2),
  created_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_visit_records_type_check check (visit_type in ('first', 'revisit')),
  constraint home_visit_records_status_check check (visit_status in ('draft', 'scheduled', 'completed', 'cancelled')),
  constraint home_visit_records_fee_decision_check check (fee_decision in ('pending_discussion', 'confirmed', 'waived')),
  constraint home_visit_records_fee_check check (
    (proposed_fee is null or proposed_fee >= 0) and
    (confirmed_fee is null or confirmed_fee >= 0)
  ),
  constraint home_visit_records_text_length check (
    char_length(coalesce(access_notes, '')) <= 3000 and
    char_length(coalesce(environment_notes, '')) <= 5000 and
    char_length(coalesce(general_notes, '')) <= 5000 and
    char_length(coalesce(follow_up_notes, '')) <= 5000 and
    char_length(coalesce(fee_reason, '')) <= 2000
  )
);

create index home_visit_records_family_scheduled_idx
  on public.home_visit_records(family_id, scheduled_at desc);
create index home_visit_records_sitter_status_idx
  on public.home_visit_records(assigned_sitter_id, visit_status, scheduled_at)
  where assigned_sitter_id is not null;

comment on table public.home_visit_records is
  'One home-visit workflow per family. Fees remain a sitter proposal and owner confirmation, never an automatic fixed rule.';

alter table public.home_visit_records enable row level security;
revoke all on table public.home_visit_records from public, anon, authenticated;
grant select, insert, update on table public.home_visit_records to service_role;

create table public.home_visit_pet_records (
  home_visit_id uuid not null references public.home_visit_records(home_visit_id) on update cascade on delete cascade,
  pet_id text not null references public.pets(pet_id) on update cascade on delete restrict,
  health_notes text,
  medication_notes text,
  feeding_notes text,
  behavior_notes text,
  touch_restrictions text,
  walk_and_toilet_notes text,
  care_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (home_visit_id, pet_id),
  constraint home_visit_pet_records_text_length check (
    char_length(coalesce(health_notes, '')) <= 5000 and
    char_length(coalesce(medication_notes, '')) <= 5000 and
    char_length(coalesce(feeding_notes, '')) <= 5000 and
    char_length(coalesce(behavior_notes, '')) <= 5000 and
    char_length(coalesce(touch_restrictions, '')) <= 5000 and
    char_length(coalesce(walk_and_toilet_notes, '')) <= 5000
  )
);

create index home_visit_pet_records_pet_id_idx on public.home_visit_pet_records(pet_id);

comment on table public.home_visit_pet_records is
  'Per-pet observations for a family home visit. A family can have any number of pet rows.';

alter table public.home_visit_pet_records enable row level security;
revoke all on table public.home_visit_pet_records from public, anon, authenticated;
grant select, insert, update, delete on table public.home_visit_pet_records to service_role;
