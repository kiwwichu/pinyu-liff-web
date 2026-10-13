import { createSupabaseAdmin } from './supabase';
import { assertLedgerAccess, type LedgerActor } from './order-ledger-service';
import { financeReport, type ReportSource } from './finance-report';
import { moneyText, moneyUnits, parseLedgerEntry } from './order-ledger';
import { LedgerFailure } from './ledger-failure';

function complete<T>(result:{data:T[]|null;error:unknown;count:number|null}):T[] {
  if(result.error||!result.data||result.count===null||result.count!==result.data.length||result.count>1000)
    throw new LedgerFailure('REPORT_INCOMPLETE','報表來源未完整取得或超過 1000 筆安全上限；未產生部分總額',503);
  return result.data;
}
/** Bounded PII-minimal reads. Two matching collections detect concurrent change, not a transaction snapshot. */
export async function getFinanceReport(actor:LedgerActor,env:Env) {
  assertLedgerAccess(actor,env.APP_ENV,env.SUPABASE_URL,false);
  const db=createSupabaseAdmin(env);
  const collect=async()=>{
    const orders=complete(await db.from('orders').select('order_id,family_id,order_status,updated_at,customer_total,owner_earnings_total,sitter_earnings_total,company_earnings_before_platform,platform_name',{count:'exact'}).eq('order_model_version',2).order('order_id').limit(1000));
    const items=complete(await db.from('order_items').select('order_item_id,order_id,item_type,item_status,service_date,assigned_sitter_id,provider_type_snapshot,line_amount,sitter_earnings_amount,company_share_amount,company_discount_absorbed_amount,updated_at,orders!inner(order_model_version)',{count:'exact'}).eq('orders.order_model_version',2).order('order_item_id').limit(1000));
    const entries=complete(await db.from('order_financial_entries').select('request_id,order_id,ledger,kind,amount,occurred_at,channel,orders!inner(order_model_version)',{count:'exact'}).eq('orders.order_model_version',2).order('request_id').limit(1000));
    const payments=complete(await db.from('sitter_payment_entries').select('request_id,order_id,order_item_id,sitter_id_snapshot,amount,paid_at,orders!inner(order_model_version)',{count:'exact'}).eq('orders.order_model_version',2).order('request_id').limit(1000));
    return {orders,items,entries,payments};
  };
  const startedAt=new Date().toISOString(), first=await collect(), second=await collect();
  if(JSON.stringify(first)!==JSON.stringify(second)) throw new LedgerFailure('REPORT_SOURCE_CHANGED','讀取期間財務來源已變更；請重新產生報表',409);
  const ids=new Set(first.orders.map(o=>o.order_id));
  if([...first.items,...first.entries,...first.payments].some(r=>!ids.has(r.order_id))) throw new LedgerFailure('REPORT_SOURCE_CHANGED','報表關聯已變更，請重新讀取',409);
  const money=(value:unknown)=>moneyText(moneyUnits(value));
  const sources:ReportSource[]=first.orders.map(o=>({
    familyId:o.family_id??'',orderStatus:o.order_status,
    order:{orderId:o.order_id,updatedAt:o.updated_at,customerTotal:money(o.customer_total),ownerEarningsTotal:money(o.owner_earnings_total),sitterEarningsTotal:money(o.sitter_earnings_total),companyEarningsBeforePlatform:money(o.company_earnings_before_platform),platformName:o.platform_name},
    items:first.items.filter(i=>i.order_id===o.order_id).map(i=>({id:i.order_item_id,itemType:i.item_type,itemStatus:i.item_status,serviceDate:i.service_date,assignedSitterId:i.assigned_sitter_id,providerType:i.provider_type_snapshot,lineAmount:money(i.line_amount),sitterEarnings:money(i.sitter_earnings_amount),companyShare:money(i.company_share_amount),discountAbsorbed:money(i.company_discount_absorbed_amount)})),
    // Free-text payment notes/methods are deliberately not selected or exported.
    entries:first.entries.filter(e=>e.order_id===o.order_id).map(e=>parseLedgerEntry({requestId:e.request_id,orderId:e.order_id,ledger:e.ledger,kind:e.kind,amount:money(e.amount),occurredAt:e.occurred_at,channel:e.channel,method:'redacted',note:'redacted'})),
  }));
  return {report:financeReport(sources,first.payments.map(p=>({requestId:p.request_id,orderId:p.order_id,orderItemId:p.order_item_id,sitterId:p.sitter_id_snapshot,amount:money(p.amount),paidAt:p.paid_at}))),
    read:{startedAt,finishedAt:new Date().toISOString(),consistency:'two matching bounded reads; not a database transaction snapshot',scope:'V2 only; excludes legacy orders',rowLimitPerTable:1000}};
}
