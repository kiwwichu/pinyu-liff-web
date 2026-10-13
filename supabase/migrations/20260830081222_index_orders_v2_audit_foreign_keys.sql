-- Cover the audit-user foreign keys added by the orders V2 core migration.
-- These indexes keep app-user updates/deletes and audit lookups predictable.
create index orders_created_by_v2_idx
  on public.orders (created_by)
  where created_by is not null;

create index orders_updated_by_v2_idx
  on public.orders (updated_by)
  where updated_by is not null;

create index order_items_created_by_idx
  on public.order_items (created_by)
  where created_by is not null;

create index order_items_updated_by_idx
  on public.order_items (updated_by)
  where updated_by is not null;
