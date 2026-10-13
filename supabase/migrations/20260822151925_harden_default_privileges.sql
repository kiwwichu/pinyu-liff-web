-- New objects created by migrations must stay private until a migration grants
-- the exact privileges the Worker needs. This prevents an omitted REVOKE from
-- accidentally exposing a future table, sequence, or function through the
-- Data API.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
