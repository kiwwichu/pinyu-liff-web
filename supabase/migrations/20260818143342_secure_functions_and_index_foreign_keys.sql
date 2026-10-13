-- Fix the mutable search_path warning on the trigger helper.
alter function public.set_updated_at() set search_path = pg_catalog;

-- Supabase created this event-trigger helper when automatic RLS was enabled.
-- Keep the event trigger, but prevent API roles from invoking its SECURITY
-- DEFINER function directly through the Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Cover the remaining foreign keys reported by the database advisor.
create index reminder_logs_order_id_idx on public.reminder_logs(order_id);
create index wallet_transactions_order_id_idx on public.wallet_transactions(order_id);
