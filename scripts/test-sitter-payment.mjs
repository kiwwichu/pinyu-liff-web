import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
registerHooks({ resolve(s,c,n) { return n(c.parentURL?.includes("/src/") && s.startsWith(".") && !/\.[a-z]+$/i.test(s) ? s+".ts" : s,c); } });
const { appendSitterPayment } = await import("../src/sitter-payment-service.ts");
const { ledgerRpcFailure } = await import("../src/ledger-failure.ts");
const actor = { userId:"00000000-0000-4000-8000-000000000001", role:"OWNER", canViewMoney:true, canEditOrders:true };
const url = "https://zzkdmenxlucgxirwxayb.supabase.co";
const input = { requestId:"00000000-0000-4000-8000-000000000002", orderId:"synthetic-order",
 orderItemId:"00000000-0000-4000-8000-000000000003", amount:"300", paidAt:"2026-09-12T10:00:00+08:00",
 method:"synthetic", differenceReason:"partial", expectedOrderUpdatedAt:"2026-09-12T00:00:00.123456Z", expectedItemUpdatedAt:"2026-09-12T00:00:00.654321Z" };
test("sitter append whitelists input and retains actor/CAS; no repricing", async () => {
 let saved;
 const store={append:async(e,a,o,i)=>{saved=e;assert.equal(a,actor.userId);assert.equal(o,input.expectedOrderUpdatedAt);assert.equal(i,input.expectedItemUpdatedAt);return {requestId:e.requestId,recorded:true,replayed:false};}};
 await appendSitterPayment({...input,sitterId:999,recorded_by:"spoof",dueAmount:1,remunerationSnapshot:{address:"synthetic secret"}},actor,"development",url,store);
 assert.equal(saved.amount,"300.0000"); assert.equal(saved.paidAt,"2026-09-12T02:00:00.000Z");
 assert.deepEqual(Object.keys(saved).sort(),["requestId","orderId","orderItemId","amount","paidAt","method","differenceReason"].sort());
});
test("sitter write denies roles, flags, wrong environment before IO",async()=>{
 let calls=0;const store={append:async()=>{calls++;}};
 for(const role of ["SITTER","MEMBER","PUBLIC"]) await assert.rejects(appendSitterPayment(input,{...actor,role},"development",url,store));
 for(const flags of [{canViewMoney:false},{canEditOrders:false}]) await assert.rejects(appendSitterPayment(input,{...actor,...flags},"development",url,store));
 await assert.rejects(appendSitterPayment(input,actor,"production",url,store));
 await assert.rejects(appendSitterPayment(input,actor,"development","https://other.invalid",store));
 assert.equal(calls,0);
});
test("sitter invalid actual payment rejected before IO",async()=>{
 let calls=0;const store={append:async()=>{calls++;}};
 for(const amount of ["0","-1","NaN","#REF!","1.00001",null]) await assert.rejects(appendSitterPayment({...input,amount},actor,"development",url,store),e=>e.code==="LEDGER_REJECTED");
 await assert.rejects(appendSitterPayment({...input,paidAt:"2026-02-31T00:00:00Z"},actor,"development",url,store));
 assert.equal(calls,0);
});
test("mismatched success response is unknown, not confirmed",async()=>{
 for(const raw of [{requestId:input.requestId,recorded:false,replayed:false},{requestId:"other",recorded:true,replayed:false}]){
  await assert.rejects(appendSitterPayment(input,actor,"development",url,{append:async()=>raw}),e=>e.code==="LEDGER_OUTCOME_UNKNOWN");
 }
});
test("exact RPC errors mapped without raw database text",()=>{
 const cases=[
 ["order changed; reload before recording","LEDGER_SOURCE_CHANGED",409],
 ["payment source changed; reload before recording","LEDGER_SOURCE_CHANGED",409],
 ["idempotency key reused with different event","LEDGER_KEY_CONFLICT",409],
 ["difference reason required (including partial payment)","LEDGER_REJECTED",422],
 ["sitter payment write denied","LEDGER_DENIED",403],
 ["historical payment source changed; settlement review required","LEDGER_REVIEW_REQUIRED",409],
 ];
 for(const [message,code,status] of cases) {const e=ledgerRpcFailure({code:"P0001",message});assert.equal(e.code,code);assert.equal(e.status,status);}
 for(const code of ["PGRST202","57014","40001",undefined]) {
  const e=ledgerRpcFailure({code,message:"synthetic-private-data"});assert.equal(e.code,"LEDGER_OUTCOME_UNKNOWN");assert.ok(!e.message.includes("synthetic-private"));
 }
 assert.equal(ledgerRpcFailure({code:"P0001",message:"unrecognized"}).code,"LEDGER_OUTCOME_UNKNOWN");
});
