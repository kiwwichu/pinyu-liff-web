-- Dev-only verification; all synthetic business fixtures MUST roll back.
-- Already executed against pet-sitter-dev. Never execute against Production.
begin;
create temporary table sitter_security_checks(label text, passed boolean) on commit drop;
grant select,insert on sitter_security_checks to anon,authenticated,service_role;
set local role anon;
do $ begin
 begin perform 1 from public.sitter_payment_entries; raise exception 'unexpected read';
 exception when insufficient_privilege then insert into sitter_security_checks values('anon table denied',true); end;
 begin perform public.append_sitter_payment_v2('{}',gen_random_uuid(),now(),now()); raise exception 'unexpected execute';
 exception when insufficient_privilege then insert into sitter_security_checks values('anon RPC denied',true); end;
end $;
reset role;
set local role authenticated;
do $ begin
 begin perform 1 from public.sitter_payment_entries; raise exception 'unexpected read';
 exception when insufficient_privilege then insert into sitter_security_checks values('authenticated table denied',true); end;
 begin perform public.append_sitter_payment_v2('{}',gen_random_uuid(),now(),now()); raise exception 'unexpected execute';
 exception when insufficient_privilege then insert into sitter_security_checks values('authenticated RPC denied',true); end;
end $;
reset role;
set local role service_role;
do $ begin
 begin update public.sitter_payment_entries set amount=1 where false; raise exception 'unexpected update';
 exception when insufficient_privilege then insert into sitter_security_checks values('service update denied',true); end;
 begin delete from public.sitter_payment_entries where false; raise exception 'unexpected delete';
 exception when insufficient_privilege then insert into sitter_security_checks values('service delete denied',true); end;
 begin perform public.append_sitter_payment_v2('{}',gen_random_uuid(),now(),now()); raise exception 'unknown actor accepted';
 exception when raise_exception then if sqlerrm<>'sitter payment write denied' then raise; end if;
 insert into sitter_security_checks values('service RPC validates missing actor',true); end;
end $;
reset role;
select * from sitter_security_checks;
rollback;
