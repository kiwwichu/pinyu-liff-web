import { financeOperationalBasis, type OperationalFinanceSource } from './finance-export-basis';
import { cashMonth, moneyText, moneyUnits, normalizeLedgerTime } from './order-ledger';

export type MoneyItem = OperationalFinanceSource['items'][number] & {
  providerType: string; lineAmount: string; sitterEarnings: string; companyShare: string; discountAbsorbed: string;
};
export type ReportSource = Omit<OperationalFinanceSource, 'items'> & { items: readonly MoneyItem[] };
export type ActualSitterPayment = { requestId: string; orderId: string; orderItemId: string; sitterId: number; amount: string; paidAt: string };
function monthOf(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T00:00:00Z')) || new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)
    throw new Error('費用缺少正確獨立日期，不能推定歸月或回填');
  return date.slice(0,7);
}
type Amounts = { serviceAmount: bigint; feeAmount: bigint; sitterEarnings: bigint; ownerEarnings: bigint; companyIncome: bigint; actualSitterPaid: bigint };
const zero = (): Amounts => ({serviceAmount:0n,feeAmount:0n,sitterEarnings:0n,ownerEarnings:0n,companyIncome:0n,actualSitterPaid:0n});
const serial = (v: Amounts) => ({serviceAmount:moneyText(v.serviceAmount),feeAmount:moneyText(v.feeAmount),sitterEarnings:moneyText(v.sitterEarnings),ownerEarnings:moneyText(v.ownerEarnings),companyIncome:moneyText(v.companyIncome),actualSitterPaid:moneyText(v.actualSitterPaid)});
/** Existing calculation snapshots only: never reprice, infer allocations, or mix the three clocks. */
export function financeReport(sources: readonly ReportSource[], payments: readonly ActualSitterPayment[]) {
  const operational = financeOperationalBasis(sources);
  const buckets = new Map<string, {sitterId:number|null;month:string;amounts:Amounts}>();
  const bucket = (sitterId:number|null, month:string) => {
    const key = `${sitterId??'unassigned'}/${month}`;
    let b=buckets.get(key); if(!b) {b={sitterId,month,amounts:zero()};buckets.set(key,b);} return b.amounts;
  };
  const itemDetails: {orderId:string;orderItemId:string;sitterId:number|null;itemType:string;month:string;lineAmount:string;sitterEarnings:string;ownerEarnings:string;companyIncome:string}[]=[];
  const allItems = new Map<string,string>();
  for (const source of sources) {
    const last = new Map<number,string>();
    for (const item of source.items) {
      allItems.set(item.id, source.order.orderId);
      if(source.orderStatus!=='cancelled' && item.itemStatus==='active' && item.itemType==='service' && item.assignedSitterId!==null)
        last.set(item.assignedSitterId, [last.get(item.assignedSitterId)??'',item.serviceDate!].sort().at(-1)!);
    }
    let sitter=0n, owner=0n, company=0n, receivable=0n;
    for (const item of source.items) {
      if(source.orderStatus==='cancelled'||item.itemStatus==='cancelled') continue;
      if(!['owner','sitter','unassigned'].includes(item.providerType)) throw new Error('未知報酬歸屬');
      if(item.assignedSitterId!==null && (!Number.isSafeInteger(item.assignedSitterId)||item.assignedSitterId<=0)) throw new Error('保母識別碼無效');
      if(item.providerType!=='unassigned' && item.assignedSitterId===null) throw new Error('報酬缺少執行者，不能推定歸屬');
      const gross=moneyUnits(item.lineAmount), earned=moneyUnits(item.sitterEarnings), share=moneyUnits(item.companyShare), discount=moneyUnits(item.discountAbsorbed);
      if(gross<0n||earned<0n||share<0n||discount<0n||gross!==earned+share || (item.itemType!=='service'&&discount!==0n) || (item.providerType==='unassigned'&&earned!==0n)) throw new Error('項目金額快照不一致');
      const own = item.providerType==='owner'?earned:0n, partner=item.providerType==='sitter'?earned:0n, income=share-discount+own;
      const month = monthOf(item.itemType==='home_visit_fee' ? item.serviceDate : (item.assignedSitterId!==null?last.get(item.assignedSitterId):null) ?? item.serviceDate);
      const b=bucket(item.assignedSitterId,month);
      if(item.itemType==='service') b.serviceAmount+=gross; else b.feeAmount+=gross;
      b.sitterEarnings+=partner;b.ownerEarnings+=own;b.companyIncome+=income;
      sitter+=partner;owner+=own;company+=income;receivable+=gross-discount;
      itemDetails.push({orderId:source.order.orderId,orderItemId:item.id,sitterId:item.assignedSitterId,itemType:item.itemType,month,lineAmount:moneyText(gross),sitterEarnings:moneyText(partner),ownerEarnings:moneyText(own),companyIncome:moneyText(income)});
    }
    if(sitter!==moneyUnits(source.order.sitterEarningsTotal)||owner!==moneyUnits(source.order.ownerEarningsTotal)||company!==moneyUnits(source.order.companyEarningsBeforePlatform)||receivable!==moneyUnits(source.order.customerTotal)) throw new Error('訂單與項目快照不一致，需核對來源');
  }
  const seen = new Set<string>();
  for(const p of payments) {
    if(!p.requestId||seen.has(p.requestId)||allItems.get(p.orderItemId)!==p.orderId||!Number.isSafeInteger(p.sitterId)||p.sitterId<=0) throw new Error('實付來源不完整或重複');
    seen.add(p.requestId); const amount=moneyUnits(p.amount); if(amount<=0n) throw new Error('實付金額無效');
    bucket(p.sitterId,cashMonth(normalizeLedgerTime(p.paidAt))).actualSitterPaid+=amount;
  }
  for(const count of operational.sitterMonths) bucket(count.sitterId,count.month);
  const cumulative = new Map<number|null,Amounts>();
  const counts=new Map(operational.sitterMonths.map(r=>[`${r.sitterId}/${r.month}`,r.serviceCount]));
  const sitterMonths=[...buckets.values()].sort((a,b)=>a.month.localeCompare(b.month)||(a.sitterId??0)-(b.sitterId??0)).map(b=>{
    const total=cumulative.get(b.sitterId)??zero();for(const key of Object.keys(total) as (keyof Amounts)[]) total[key]+=b.amounts[key];cumulative.set(b.sitterId,total);
    return {sitterId:b.sitterId,month:b.month,serviceCount:counts.get(`${b.sitterId}/${b.month}`)??0,...serial(b.amounts)};
  });
  return {...operational,sitterMonths,sitters:[...cumulative].sort(([a],[b])=>(a??0)-(b??0)).map(([sitterId,amounts])=>({sitterId,serviceCount:operational.sitters.find(s=>s.sitterId===sitterId)?.serviceCount??0,...serial(amounts)})),itemDetails,
    actualSitterPayments:payments.map(p=>({...p,amount:moneyText(moneyUnits(p.amount))})),
    basis:{...operational.basis,availability:'V2 report; legacy orders excluded, not whole-business historical totals',
      earningsMonth:'2026-09-16: own last active service per order; home visits always own independent date; independent fees require actual date',
      actualSitterPaid:'payment date and historical payee snapshot; never current assignment or automatic payable balance',
      companyIncome:'owner included exactly once; before platform fees, not actual cash less sitter payments'}};
}
