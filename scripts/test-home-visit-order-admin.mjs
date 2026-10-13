import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return n(c.parentURL?.startsWith(new URL('../src/',import.meta.url).href)&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);}});
const {saveOrderV2,getOrderV2}=await import('../src/order-v2-service.ts');
test('home date create/read/edit stays separate from service range (mock DB adapter)',async()=>{
 const original=fetch;let stored=null,items=[],writes=0;
 const env={APP_ENV:'development',SUPABASE_URL:'https://zzkdmenxlucgxirwxayb.supabase.co',SUPABASE_SECRET_KEY:'synthetic-only'};
 globalThis.fetch=async(input,init)=>{
  const u=new URL(input instanceof Request?input.url:String(input));assert.equal(u.origin,env.SUPABASE_URL);
  if(u.pathname.endsWith('/families'))return Response.json({family_id:'synthetic-family',owner_name:'Synthetic'});
  if(u.pathname.endsWith('/pets'))return Response.json([{pet_id:'synthetic-pet',family_id:'synthetic-family',pet_name:'Synthetic',is_enabled:true}]);
  if(u.pathname.endsWith('/orders'))return Response.json(stored);
  if(u.pathname.endsWith('/order_items'))return Response.json(items);
  if(u.pathname.endsWith('/order_home_visits'))return Response.json([]);
  if(u.pathname.endsWith('/order_item_pets'))return Response.json(items.map(i=>({order_item_id:i.order_item_id,pet_id:'synthetic-pet'})));
  if(u.pathname.endsWith('/save_order_v2_with_relations')){const p=JSON.parse(init.body);writes++;stored={...p.p_order,updated_at:'2026-09-21T00:00:00Z'};items=p.p_items.map(i=>({...i,order_id:stored.order_id}));return Response.json(stored.order_id);}
  throw new Error('Unexpected synthetic endpoint: '+u.pathname);
 };
 const actor={userId:'00000000-0000-4000-8000-000000000001',canCreateOrders:true,canEditOrders:true,canViewMoney:true};
 const payload={familyId:'synthetic-family',petIds:['synthetic-pet'],homeVisitIds:[],customerType:'new',orderSource:'synthetic',orderStatus:'draft',paymentStatus:'unpaid',items:[
  {key:'synthetic-service',itemType:'service',itemName:'Synthetic service',petIds:['synthetic-pet'],serviceDate:'2026-09-20',quantity:1,chargedUnitPrice:1000,providerType:'unassigned'},
  {key:'synthetic-home',itemType:'home_visit_fee',itemName:'Synthetic home',petIds:['synthetic-pet'],serviceDate:'2026-08-01',quantity:1,chargedUnitPrice:100,providerType:'unassigned',sitterAllocationAmount:0,companyAllocationAmount:100,homeVisitExecutionMode:'custom'},
 ]};
 try{
  const result=await saveOrderV2(payload,actor,env);assert.equal(stored.service_date_raw,'2026-09-20');assert.equal(items[1].service_date,'2026-08-01');
  let read=await getOrderV2({orderId:result.orderId},env,true);assert.equal(read.items[1].serviceDate,'2026-08-01');assert.equal(read.order.serviceDate,'2026-09-20');
  const next={...payload,orderId:result.orderId,expectedUpdatedAt:stored.updated_at,items:payload.items.map((i,k)=>({...i,orderItemId:items[k].order_item_id,serviceDate:k?'2026-08-02':'2026-09-21'}))};
  await saveOrderV2(next,actor,env);read=await getOrderV2({orderId:result.orderId},env,true);assert.equal(read.items[1].serviceDate,'2026-08-02');assert.equal(read.order.serviceDate,'2026-09-21');
  await assert.rejects(saveOrderV2({...next,items:[{...next.items[1],serviceDate:null}]},actor,env),/家訪日期/);assert.equal(writes,2);
 }finally{globalThis.fetch=original;}
});
