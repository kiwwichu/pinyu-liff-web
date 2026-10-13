import assert from "node:assert/strict";
import {test} from "node:test";
import {registerHooks} from "node:module";
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes("/src/")&&s.startsWith(".")&&!/\.[a-z]+$/i.test(s)?s+".ts":s,c);}});
const {financeExportBasis,financeOperationalBasis}=await import("../src/finance-export-basis.ts");
const order=(id,platformName=null)=>({orderId:id,updatedAt:"2026-09-12T00:00:00Z",customerTotal:"1000",sitterEarningsTotal:"800",ownerEarningsTotal:"0",companyEarningsBeforePlatform:"200",platformName});
const event=(orderId,n,extra={})=>({orderId,requestId:"00000000-0000-4000-8000-"+String(n).padStart(12,"0"),ledger:"payments",kind:"receipt",amount:"1000",occurredAt:"2026-08-31T15:59:59Z",channel:"direct",method:"synthetic",note:"",...extra});
test("financial export basis: multi-family, monthly cash, cross-month refund and no platform double count",()=>{
 const sources=[{order:order("synthetic-a"),familyId:"synthetic-f1",entries:[event("synthetic-a",1),event("synthetic-a",2,{kind:"refund",amount:"100",note:"refund",occurredAt:"2026-08-31T16:00:00Z"})]},
 {order:order("synthetic-b","PetBacker"),familyId:"synthetic-f2",entries:[event("synthetic-b",3,{channel:"platform"}),event("synthetic-b",4,{ledger:"platform_settlements",channel:"platform",amount:"600"}),event("synthetic-b",5,{ledger:"platform_settlements",channel:"platform",amount:"177",occurredAt:"2026-09-12T00:00:00Z"})]}];
 const before=structuredClone(sources),r=financeExportBasis(sources);
 assert.deepEqual(r.monthlyCash,[{month:"2026-08",actualCashNet:"1600.0000"},{month:"2026-09",actualCashNet:"77.0000"}]);
 assert.deepEqual(r.familySpending,[{familyId:"synthetic-f1",customerNetPaid:"900.0000"},{familyId:"synthetic-f2",customerNetPaid:"1000.0000"}]);
 assert.equal(r.orders[1].sitterEarningsSnapshot,"800.0000");assert.equal(r.orders[1].companyIncomeBeforePlatform,"200.0000");
 assert.deepEqual(sources,before);assert.equal(r.orders[1].actualCashNet,"777.0000");
});
test('operational basis separates service month from cash and retains cancelled-order refunds',()=>{
 const item=(id,serviceDate,sitter)=>({id,serviceDate,assignedSitterId:sitter,itemType:'service',itemStatus:'active'});
 const sources=[{order:order('synthetic-a'),familyId:'synthetic-f1',orderStatus:'confirmed',items:[item('a','2026-09-01',1),item('b','2026-10-01',2)],entries:[event('synthetic-a',1)]},
 {order:order('synthetic-b'),familyId:'synthetic-f1',orderStatus:'cancelled',items:[item('c','2026-11-01',2)],entries:[event('synthetic-b',2),event('synthetic-b',3,{kind:'refund',amount:'1000',note:'synthetic refund',occurredAt:'2026-09-30T16:00:00Z'})]}];
 const before=structuredClone(sources),r=financeOperationalBasis(sources);
 assert.deepEqual(r.monthly,[{month:'2026-08',actualCashNet:'2000.0000',serviceCount:0},{month:'2026-10',actualCashNet:'-1000.0000',serviceCount:2}]);
 assert.deepEqual(r.families,[{familyId:'synthetic-f1',customerNetPaid:'1000.0000',serviceCount:2}]);
 assert.deepEqual(r.sitterMonths,[{sitterId:1,month:'2026-09',serviceCount:1},{sitterId:2,month:'2026-10',serviceCount:1}]);
 assert.equal(r.orders[1].serviceMonth,null);assert.equal(r.orders[1].customerRefunds,'1000.0000');assert.deepEqual(sources,before);
 assert.deepEqual(financeOperationalBasis([]).monthly,[]);
 assert.throws(()=>financeOperationalBasis([{...sources[0],orderStatus:'unknown'}]));
});
test("empty, missing, duplicates, formula-like IDs remain literal and owner not double-counted",()=>{
 assert.deepEqual(financeExportBasis([]).orders,[]);
 const source={order:{...order("=synthetic"),sitterEarningsTotal:"0",ownerEarningsTotal:"1000",companyEarningsBeforePlatform:"1000"},familyId:"@synthetic",entries:[]};
 const r=financeExportBasis([source]);assert.equal(r.orders[0].orderId,"=synthetic");assert.equal(r.orders[0].companyIncomeBeforePlatform,"1000.0000");assert.equal(r.orders[0].actualCashNet,"0.0000");
 assert.throws(()=>financeExportBasis([source,source]));
 assert.throws(()=>financeExportBasis([{...source,order:{...source.order,customerTotal:null}}]));
 assert.ok(!("monthlyOrderCount" in r));assert.ok(!("actualSitterPaid" in r.orders[0]));
});
