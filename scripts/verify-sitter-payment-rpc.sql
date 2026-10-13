-- Dev-only verification; all synthetic business fixtures MUST roll back.
-- Already executed against pet-sitter-dev. Never execute against Production.
begin;
create temporary table sitter_test_results(test text, passed boolean) on commit drop;
do $test$
declare
 u uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); it uuid:=gen_random_uuid();
 oid text:='synthetic-313b-'||gen_random_uuid()::text;
 t timestamptz:='2026-09-12T00:00:00.123456Z';
 e jsonb; r jsonb; rejected boolean; amount_text text; field text;
 baseline text; after_hash text; old_snapshot jsonb; sitter_one bigint; sitter_two bigint;
begin
 select md5(coalesce(string_agg(to_jsonb(o)::text,'' order by order_id),'')) into baseline from public.orders o;
 insert into public.app_users(user_id,display_name,role,google_email,can_view_money,can_edit_orders)
 values(u,'Synthetic owner','OWNER',u::text||'@example.invalid',true,true),
       (bad,'Synthetic sitter','SITTER',bad::text||'@example.invalid',true,true);
 insert into public.sitters(display_name) values('Synthetic sitter one') returning sitter_id into sitter_one;
 insert into public.sitters(display_name) values('Synthetic sitter two') returning sitter_id into sitter_two;
 insert into public.orders(order_id,legacy_order_id,order_status,order_model_version,customer_total,sitter_earnings_total,company_earnings_before_platform,owner_earnings_total,calculation_version,updated_at)
 values(oid,oid,'completed',2,1000,800,200,0,'synthetic-v1',t);
 insert into public.order_items(order_item_id,order_id,item_type,item_name_snapshot,charged_unit_price,line_amount,service_date,assigned_sitter_id,provider_type_snapshot,commission_rate_snapshot,commission_base_amount,company_share_amount,sitter_earnings_amount,updated_at)
 values(it,oid,'service','Synthetic service',1000,1000,'2026-09-12',sitter_one,'sitter',0.2,1000,200,800,t);
 e:=jsonb_build_object('requestId',gen_random_uuid(),'orderId',oid,'orderItemId',it,'amount','300','paidAt','2026-09-12T09:00:00+08:00','method','synthetic transfer','differenceReason','partial payment');
 perform set_config('role','service_role',true);
 r:=public.append_sitter_payment_v2(e,u,t,t);
 perform set_config('role','postgres',true);
 if r->>'recorded'<>'true' then raise exception 'append failed'; end if;
 insert into sitter_test_results values('real append',true);
 r:=public.append_sitter_payment_v2(e,u,t-interval '1 day',t-interval '1 day');
 if r->>'replayed'<>'true' or (select count(*) from public.sitter_payment_entries where order_id=oid)<>1 then raise exception 'retry failed'; end if;
 insert into sitter_test_results values('same key stale CAS retry single row',true);
 foreach field in array array['amount','method','differenceReason','paidAt','orderItemId'] loop
  rejected:=false;
  begin
   r:=public.append_sitter_payment_v2(e||jsonb_build_object(field,case field when 'amount' then '301' when 'paidAt' then '2026-09-13T09:00:00Z' when 'orderItemId' then gen_random_uuid()::text else 'different' end),u,t,t);
  exception when others then
   if sqlerrm not like 'idempotency key reused%' then raise; end if; rejected:=true;
  end;
  if not rejected then raise exception 'payload mismatch accepted'; end if;
 end loop;
 insert into sitter_test_results values('five same-key payload changes denied',true);
 rejected:=false;
 begin r:=public.append_sitter_payment_v2(e,bad,t,t);
 exception when others then if sqlerrm<>'sitter payment write denied' then raise; end if; rejected:=true; end;
 if not rejected then raise exception 'sitter accepted'; end if;
 insert into sitter_test_results values('sitter actor denied',true);
 rejected:=false;
 begin r:=public.append_sitter_payment_v2(e||jsonb_build_object('requestId',gen_random_uuid()),u,t-interval '1 day',t);
 exception when others then if sqlerrm not like 'payment source changed%' then raise; end if; rejected:=true; end;
 if not rejected then raise exception 'stale CAS accepted'; end if;
 insert into sitter_test_results values('stale order CAS denied',true);
 rejected:=false;
 begin r:=public.append_sitter_payment_v2(e||jsonb_build_object('requestId',gen_random_uuid()),u,t,t-interval '1 day');
 exception when others then if sqlerrm not like 'payment source changed%' then raise; end if; rejected:=true; end;
 if not rejected then raise exception 'stale item CAS accepted'; end if;
 insert into sitter_test_results values('stale item CAS denied',true);
 foreach amount_text in array array['0','-1','NaN','1.00001'] loop
  rejected:=false;
  begin r:=public.append_sitter_payment_v2(e||jsonb_build_object('requestId',gen_random_uuid(),'amount',amount_text),u,t,t);
  exception when others then if sqlerrm<>'invalid sitter payment' then raise; end if; rejected:=true; end;
  if not rejected then raise exception 'invalid amount accepted'; end if;
 end loop;
 insert into sitter_test_results values('zero negative NaN precision denied',true);
 rejected:=false;
 begin r:=public.append_sitter_payment_v2(e||jsonb_build_object('requestId',gen_random_uuid(),'differenceReason',''),u,t,t);
 exception when others then if sqlerrm not like 'difference reason required%' then raise; end if; rejected:=true; end;
 if not rejected then raise exception 'missing reason accepted'; end if;
 insert into sitter_test_results values('partial difference reason required',true);
 r:=public.append_sitter_payment_v2(e||jsonb_build_object('requestId',gen_random_uuid(),'amount','500','paidAt','2026-10-01T00:00:00+08:00','differenceReason',''),u,t,t);
 if (select sum(amount) from public.sitter_payment_entries where order_id=oid)<>800 or (select count(*) from public.sitter_payment_entries where order_id=oid)<>2 then raise exception 'split failed'; end if;
 if (select count(distinct to_char(paid_at at time zone 'Asia/Taipei','YYYY-MM')) from public.sitter_payment_entries where order_id=oid)<>2 then raise exception 'paid month lost'; end if;
 insert into sitter_test_results values('split 300+500 distinct paid months preserved',true);
 select remuneration_snapshot into old_snapshot from public.sitter_payment_entries where request_id=(e->>'requestId')::uuid;
 if old_snapshot->>'sitterEarningsAmount'<>'800.0000' or old_snapshot ? 'item_name_snapshot' or old_snapshot ? 'owner_name_snapshot' then raise exception 'snapshot mismatch'; end if;
 if (select customer_total from public.orders where order_id=oid)<>1000 or (select sitter_earnings_amount from public.order_items where order_item_id=it)<>800 then raise exception 'repriced'; end if;
 insert into sitter_test_results values('snapshot due preserved and PII whitelist',true);
 rejected:=false;
 begin update public.sitter_payment_entries set amount=1 where order_id=oid;
 exception when others then if sqlerrm<>'sitter payments are append-only' then raise; end if; rejected:=true; end;
 if not rejected then raise exception 'mutable ledger'; end if;
 rejected:=false;
 begin delete from public.sitter_payment_entries where order_id=oid;
 exception when others then if sqlerrm<>'sitter payments are append-only' then raise; end if; rejected:=true; end;
 if not rejected then raise exception 'deletable ledger'; end if;
 insert into sitter_test_results values('update delete trigger rejects',true);
 update public.order_items set assigned_sitter_id=sitter_two where order_item_id=it;
 select updated_at into t from public.order_items where order_item_id=it;
 rejected:=false;
 begin r:=public.append_sitter_payment_v2(e||jsonb_build_object('requestId',gen_random_uuid()),u,(select updated_at from public.orders where order_id=oid),t);
 exception when others then if sqlerrm not like 'historical payment source changed%' then raise; end if; rejected:=true; end;
 if not rejected then raise exception 'reassigned append accepted'; end if;
 if exists(select 1 from public.sitter_payment_entries where order_id=oid and sitter_id_snapshot<>sitter_one) then raise exception 'history reassigned'; end if;
 insert into sitter_test_results values('synthetic reassignment preserves original payee and blocks new append',true);
 select md5(coalesce(string_agg(to_jsonb(o)::text,'' order by order_id),'')) into after_hash from public.orders o where order_id<>oid;
 if baseline<>after_hash or (select count(*) from public.order_financial_entries)<>0 then raise exception 'old data changed'; end if;
 insert into sitter_test_results values('old orders hash and customer ledger unchanged',true);
end $test$;
select test,passed from sitter_test_results;
rollback;
