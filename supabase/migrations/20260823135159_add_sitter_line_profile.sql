alter table public.sitter_access_profiles
  add column if not exists line_display_name text;

alter table public.sitter_access_profiles
  drop constraint if exists sitter_access_profiles_line_display_name_length;

alter table public.sitter_access_profiles
  add constraint sitter_access_profiles_line_display_name_length
  check (char_length(coalesce(line_display_name, '')) <= 100);

comment on column public.sitter_access_profiles.line_display_name is
  'Latest LINE display name captured only after the sitter completes verified LINE Login. Owner-only admin data; never exposed by public or sitter APIs.';
