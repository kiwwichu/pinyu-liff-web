import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
registerHooks({resolve(s,c,n){return n(c.parentURL?.startsWith(new URL('../src/',import.meta.url).href)&&s.startsWith(".")&&!/\.[a-z]+$/i.test(s)?s+".ts":s,c);}});
const {handleAdmin}=await import("../src/admin.ts");
test("real Admin sitter read/write adapter: auth, redaction, completeness, source change and errors (mock HTTP)",async()=>{
 const original=globalThis.fetch, originalError=console.error;
 const logs=[];console.error=e=>logs.push(String(e));
 const dev="https://zzkdmenxlucgxirwxayb.supabase.co",id="00000000-0000-4000-8000-000000000003",key="00000000-0000-4000-8000-000000000002";
 const stamp="2026-09-12T00:00:00.123456Z";
 let role="OWNER",canView=true,canEdit=true,payee=2,complete=true,rpcError=null,calls=0;
 const history=[{request_id:key,order_id:"synthetic-order",order_item_id:id,sitter_id_snapshot:2,item_updated_at_snapshot:stamp,
 due_amount_snapshot:800,amount:300,paid_at:"2026-09-12T02:00:00Z",method:"synthetic",difference_reason:"partial",recorded_at:stamp,recorded_by:"must-not-expose",address:"synthetic-private"}];
 globalThis.fetch=async(input,init)=>{
  const u=new URL(input instanceof Request?input.url:String(input));
  if(u.hostname==="api.line.me") return Response.json(u.pathname.includes("verify")?{client_id:"synthetic-channel",expires_in:60}:{userId:"synthetic-line"});
  assert.equal(u.origin,dev);
  if(u.pathname.endsWith("/app_users")) return Response.json({user_id:"00000000-0000-4000-8000-000000000001",display_name:"Synthetic",status:"active",role,can_view_money:canView,can_edit_orders:canEdit});
  calls++;
  if(u.pathname.endsWith("/order_items")){
   assert.equal(u.searchParams.get("order_id"),"eq.synthetic-order"); assert.equal(u.searchParams.get("order_item_id"),"eq."+id);
   assert.ok(!/owner_name|address|phone|line_user_id/.test(u.searchParams.get("select")));
   return Response.json({order_item_id:id,order_id:"synthetic-order",item_type:"service",item_status:"active",service_date:"2026-09-12",
    assigned_sitter_id:payee,provider_type_snapshot:"sitter",sitter_earnings_amount:800,updated_at:stamp,
    orders:{order_model_version:2,order_status:"completed",updated_at:stamp}});
  }
  if(u.pathname.endsWith("/sitter_payment_entries")){
   assert.equal(u.searchParams.get("order_id"),"eq.synthetic-order"); assert.equal(u.searchParams.get("order_item_id"),"eq."+id);
   return Response.json(history,{headers:{"content-range":"0-0/"+(complete?1:2)}});
  }
  if(u.pathname.endsWith("/append_sitter_payment_v2")){
   const body=JSON.parse(init.body);
   assert.equal(body.p_actor_id,"00000000-0000-4000-8000-000000000001"); assert.equal(body.p_entry.sitterId,undefined);
   assert.equal(body.p_expected_item_updated_at,stamp);
   if(rpcError)return Response.json({code:"P0001",message:rpcError},{status:400});
   return Response.json({requestId:key,recorded:true,replayed:false});
  }
  throw Error("Unexpected endpoint");
 };
 const payload={orderId:"synthetic-order",orderItemId:id};
 const env={APP_ENV:"development",SUPABASE_URL:dev,SUPABASE_SECRET_KEY:"synthetic-only",LINE_LIFF_CHANNEL_ID:"synthetic-channel"};
 const request=(operation,p=payload)=>handleAdmin(new Request("https://example.invalid/api/admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation,payload:p,accessToken:"synthetic-token"})}),env);
 try {
  let response=await request("getSitterPaymentV2");assert.equal(response.status,200);
  let body=await response.json();assert.equal(body.summary.actualPaidHistory,"300.0000");assert.equal(body.summary.dueLessPaid,"500.0000");
  assert.ok(!JSON.stringify(body).includes("must-not-expose"));assert.ok(!JSON.stringify(body).includes("synthetic-private"));
  payee=3;body=await(await request("getSitterPaymentV2")).json();assert.equal(body.summary.dueLessPaid,null);assert.equal(body.entries[0].sitterIdSnapshot,2);
  complete=false;response=await request("getSitterPaymentV2");assert.equal(response.status,503);assert.equal((await response.json()).summary,undefined);complete=true;
  const payment={...payload,requestId:key,amount:"300",paidAt:"2026-09-12T10:00:00+08:00",method:"synthetic",differenceReason:"partial",expectedOrderUpdatedAt:stamp,expectedItemUpdatedAt:stamp,sitterId:999};
  assert.equal((await request("appendSitterPaymentV2",payment)).status,200);
  rpcError="payment source changed; reload before recording";response=await request("appendSitterPaymentV2",payment);
  assert.equal(response.status,409);assert.equal((await response.json()).code,"LEDGER_SOURCE_CHANGED");
  for(const restricted of ["SITTER","MEMBER","PUBLIC"]){role=restricted;const before=calls;assert.equal((await request("getSitterPaymentV2")).status,403);assert.equal((await request("appendSitterPaymentV2",payment)).status,403);assert.equal(calls,before);}
  role="ADMIN";canView=false;const before=calls;assert.equal((await request("getSitterPaymentV2")).status,400);assert.equal(calls,before);
  canView=true;canEdit=false;assert.equal((await request("appendSitterPaymentV2",payment)).status,400);assert.equal(calls,before);
  assert.ok(!logs.join("").includes("synthetic-private"));
 }finally{globalThis.fetch=original;console.error=originalError;}
});
