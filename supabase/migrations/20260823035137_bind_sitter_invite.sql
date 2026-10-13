create function public.bind_sitter_invite(
  p_token_hash text,
  p_line_user_id text
)
returns table (bound_sitter_id bigint, bound_display_name text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.sitter_binding_invites%rowtype;
  v_display_name text;
begin
  if char_length(coalesce(p_token_hash, '')) < 43 or char_length(coalesce(p_line_user_id, '')) < 10 then
    raise exception 'invalid_invite';
  end if;

  select * into v_invite
  from public.sitter_binding_invites
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  if exists (
    select 1 from public.sitter_access_profiles
    where line_user_id = p_line_user_id
      and sitter_id <> v_invite.sitter_id
  ) then
    raise exception 'line_account_already_bound';
  end if;

  update public.sitter_access_profiles
  set line_user_id = p_line_user_id,
      binding_status = 'bound',
      updated_at = now()
  where sitter_id = v_invite.sitter_id;

  update public.sitter_binding_invites
  set used_at = now()
  where invite_id = v_invite.invite_id;

  select display_name into v_display_name
  from public.sitters
  where sitter_id = v_invite.sitter_id;

  return query select v_invite.sitter_id, v_display_name;
end;
$$;

revoke all on function public.bind_sitter_invite(text, text) from public, anon, authenticated;
grant execute on function public.bind_sitter_invite(text, text) to service_role;

comment on function public.bind_sitter_invite(text, text) is
  'Atomically consumes a hashed one-time invite and binds a verified LINE user ID. Called only by the Worker service role.';
