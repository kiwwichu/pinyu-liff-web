create table public.sitter_recurring_block_exceptions (
  recurring_block_id bigint not null
    references public.sitter_recurring_blocks(recurring_block_id)
    on update cascade
    on delete cascade,
  exception_date date not null,
  created_by uuid
    references public.app_users(user_id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default now(),
  primary key (recurring_block_id, exception_date)
);

comment on table public.sitter_recurring_block_exceptions is
  'Date-specific suppression of one recurring schedule rule. The recurring rule remains unchanged for every other matching date.';

create index sitter_recurring_block_exceptions_date_idx
  on public.sitter_recurring_block_exceptions (exception_date, recurring_block_id);

create index sitter_recurring_block_exceptions_created_by_idx
  on public.sitter_recurring_block_exceptions (created_by)
  where created_by is not null;

alter table public.sitter_recurring_block_exceptions enable row level security;

revoke all on table public.sitter_recurring_block_exceptions
  from public, anon, authenticated;

grant select, insert, update, delete on table public.sitter_recurring_block_exceptions
  to service_role;
