-- OWNER is also an active sitter. Keep a normal sitter row so the same
-- availability model and admin UI can be used for 品伃 and collaborators.
insert into public.sitters (display_name, status, notes, created_by)
select
  '品伃',
  'active',
  'OWNER 本人服務與排班',
  owner_user.user_id
from (
  select user_id
  from public.app_users
  where upper(role) = 'OWNER'
  order by created_at
  limit 1
) as owner_user
where not exists (
  select 1
  from public.sitters
  where lower(trim(display_name)) = lower('品伃')
);

-- An imported not-yet-bound sitter profile once inherited the OWNER LINE ID.
-- Release only that inconsistent placeholder; never touch a genuinely bound sitter.
update public.sitter_access_profiles as profile
set line_user_id = null
where profile.binding_status <> 'bound'
  and profile.line_user_id is not null
  and exists (
    select 1
    from public.app_users as owner_user
    where upper(owner_user.role) = 'OWNER'
      and owner_user.line_user_id = profile.line_user_id
  );

insert into public.sitter_access_profiles (
  sitter_id,
  binding_status,
  line_user_id,
  can_view_assigned_family_basics,
  can_view_assigned_address,
  can_view_assigned_phone,
  can_view_contract_summary,
  can_view_reviews,
  updated_by
)
select
  sitter.sitter_id,
  'bound',
  owner_user.line_user_id,
  true,
  true,
  true,
  true,
  true,
  owner_user.user_id
from public.sitters as sitter
cross join lateral (
  select user_id, line_user_id
  from public.app_users
  where upper(role) = 'OWNER'
  order by created_at
  limit 1
) as owner_user
where lower(trim(sitter.display_name)) = lower('品伃')
on conflict (sitter_id) do update
set
  binding_status = 'bound',
  line_user_id = excluded.line_user_id,
  can_view_assigned_family_basics = true,
  can_view_assigned_address = true,
  can_view_assigned_phone = true,
  can_view_contract_summary = true,
  can_view_reviews = true,
  updated_by = excluded.updated_by;
