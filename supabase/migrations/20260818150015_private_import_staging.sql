create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.migration_import_payloads (
  batch_id text not null,
  table_name text not null,
  chunk_index integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (batch_id, table_name, chunk_index),
  check (jsonb_typeof(payload) = 'array')
);

revoke all on private.migration_import_payloads from public, anon, authenticated;
