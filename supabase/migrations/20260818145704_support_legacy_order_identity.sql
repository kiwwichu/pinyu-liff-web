-- Preserve legacy identifiers even when the spreadsheet generated duplicate or
-- missing order IDs. New application code uses order_id as the unique internal
-- identifier and legacy_order_id only for backwards-compatible lookup.
alter table public.orders add column legacy_order_id text;
update public.orders set legacy_order_id = order_id where legacy_order_id is null;
alter table public.orders alter column legacy_order_id set not null;
create index orders_legacy_order_id_idx on public.orders(legacy_order_id);

alter table public.visits add column legacy_order_id text;
update public.visits set legacy_order_id = order_id where legacy_order_id is null;
alter table public.visits alter column legacy_order_id set not null;
alter table public.visits alter column order_id drop not null;
alter table public.visits alter column service_date drop not null;
create index visits_legacy_order_id_idx on public.visits(legacy_order_id);

alter table public.service_reviews add column legacy_order_id text;
update public.service_reviews set legacy_order_id = order_id where legacy_order_id is null;
alter table public.service_reviews alter column legacy_order_id set not null;
alter table public.service_reviews alter column order_id drop not null;
create index service_reviews_legacy_order_id_idx on public.service_reviews(legacy_order_id);

alter table public.reminder_logs add column legacy_order_id text;
alter table public.reminder_logs add column legacy_family_id text;
update public.reminder_logs
set
  legacy_order_id = order_id,
  legacy_family_id = family_id
where legacy_order_id is null or legacy_family_id is null;
alter table public.reminder_logs alter column logged_at drop not null;
create index reminder_logs_legacy_order_id_idx on public.reminder_logs(legacy_order_id);
create index reminder_logs_legacy_family_id_idx on public.reminder_logs(legacy_family_id);

drop view public.orders_export;
create view public.orders_export
with (security_invoker = true)
as
select
  o.order_id,
  o.legacy_order_id,
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

revoke all on public.orders_export from public, anon, authenticated;
grant all on public.orders_export to service_role;
