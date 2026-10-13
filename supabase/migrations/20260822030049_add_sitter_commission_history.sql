create table public.sitters (
  sitter_id bigint generated always as identity primary key,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(display_name) <> '')
);

create unique index sitters_display_name_unique_idx
  on public.sitters (lower(btrim(display_name)));

create index sitters_created_by_idx
  on public.sitters (created_by);

create table public.sitter_commission_rates (
  rate_id bigint generated always as identity primary key,
  sitter_id bigint not null references public.sitters(sitter_id) on delete cascade,
  rate_percent numeric(5,2) not null check (rate_percent >= 0 and rate_percent <= 100),
  effective_from date not null,
  effective_until date,
  change_note text,
  created_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  unique (sitter_id, effective_from)
);

create index sitter_commission_rates_lookup_idx
  on public.sitter_commission_rates (sitter_id, effective_from desc);

create index sitter_commission_rates_created_by_idx
  on public.sitter_commission_rates (created_by);

alter table public.sitters enable row level security;
alter table public.sitter_commission_rates enable row level security;

revoke all on public.sitters from public, anon, authenticated;
revoke all on public.sitter_commission_rates from public, anon, authenticated;
grant select, insert, update on public.sitters to service_role;
grant select, insert, update on public.sitter_commission_rates to service_role;
grant usage, select on sequence public.sitters_sitter_id_seq to service_role;
grant usage, select on sequence public.sitter_commission_rates_rate_id_seq to service_role;

create function public.create_sitter_with_rate(
  p_display_name text,
  p_rate_percent numeric,
  p_effective_from date,
  p_change_note text,
  p_created_by uuid
)
returns table (created_sitter_id bigint, created_rate_id bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sitter_id bigint;
  v_rate_id bigint;
begin
  if btrim(coalesce(p_display_name, '')) = '' then
    raise exception '保姆姓名不可空白';
  end if;

  if p_rate_percent is null or p_rate_percent < 0 or p_rate_percent > 100 then
    raise exception '抽成比例必須介於 0 到 100';
  end if;

  if p_effective_from is null then
    raise exception '生效日期不可空白';
  end if;

  insert into public.sitters (display_name, created_by)
  values (btrim(p_display_name), p_created_by)
  returning sitter_id into v_sitter_id;

  insert into public.sitter_commission_rates (
    sitter_id,
    rate_percent,
    effective_from,
    change_note,
    created_by
  ) values (
    v_sitter_id,
    p_rate_percent,
    p_effective_from,
    nullif(btrim(coalesce(p_change_note, '')), ''),
    p_created_by
  ) returning rate_id into v_rate_id;

  return query select v_sitter_id, v_rate_id;
end;
$$;

create function public.set_sitter_commission_rate(
  p_sitter_id bigint,
  p_rate_percent numeric,
  p_effective_from date,
  p_change_note text,
  p_created_by uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_latest public.sitter_commission_rates%rowtype;
  v_rate_id bigint;
begin
  if p_rate_percent is null or p_rate_percent < 0 or p_rate_percent > 100 then
    raise exception '抽成比例必須介於 0 到 100';
  end if;

  if p_effective_from is null then
    raise exception '生效日期不可空白';
  end if;

  perform sitter_id
  from public.sitters
  where sitter_id = p_sitter_id
  for update;

  if not found then
    raise exception '找不到指定保姆';
  end if;

  select * into v_latest
  from public.sitter_commission_rates
  where sitter_id = p_sitter_id
  order by effective_from desc, rate_id desc
  limit 1
  for update;

  if found and p_effective_from <= v_latest.effective_from then
    raise exception '新比例的生效日必須晚於上一筆生效日 %', v_latest.effective_from;
  end if;

  if found then
    update public.sitter_commission_rates
    set effective_until = p_effective_from - 1
    where rate_id = v_latest.rate_id;
  end if;

  insert into public.sitter_commission_rates (
    sitter_id,
    rate_percent,
    effective_from,
    change_note,
    created_by
  ) values (
    p_sitter_id,
    p_rate_percent,
    p_effective_from,
    nullif(btrim(coalesce(p_change_note, '')), ''),
    p_created_by
  ) returning rate_id into v_rate_id;

  return v_rate_id;
end;
$$;

revoke all on function public.create_sitter_with_rate(text, numeric, date, text, uuid) from public, anon, authenticated;
revoke all on function public.set_sitter_commission_rate(bigint, numeric, date, text, uuid) from public, anon, authenticated;
grant execute on function public.create_sitter_with_rate(text, numeric, date, text, uuid) to service_role;
grant execute on function public.set_sitter_commission_rate(bigint, numeric, date, text, uuid) to service_role;

insert into public.sitters (display_name, notes)
select distinct btrim(caregiver), '由既有訂單自動建立；抽成比例待管理員設定'
from public.orders
where btrim(coalesce(caregiver, '')) <> ''
  and lower(btrim(caregiver)) not in ('品伃', 'pinyu')
on conflict do nothing;
