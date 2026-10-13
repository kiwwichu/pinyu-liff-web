import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import ExcelJS from 'exceljs';
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes('/src/')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);}});
const {handleAdmin}=await import('../src/admin.ts');
test('Admin report HTTP: complete reads, cutoff, source change, XLSX, permissions and no writes',async()=>{
 const original=fetch,log=console.error;console.error=()=>{};
 const dev='https://zzkdmenxlucgxirwxayb.supabase.co';let role='OWNER',canView=true,canNotify=true,incomplete=false,change=false,round=0,empty=false;
 const calls=[];const stamp='2026-09-19T00:00:00Z';
 globalThis.fetch=async(input,init)=>{
  const u=new URL(input instanceof Request?input.url:String(input));
  if(u.hostname==='api.line.me')return Response.json(u.pathname.includes('verify')?{client_id:'synthetic-channel',expires_in:60}:{userId:'synthetic-line'});
  assert.equal(u.origin,dev);assert.ok(!init?.method||init.method==='GET');
  if(u.pathname.endsWith('/app_users'))return Response.json({user_id:'00000000-0000-4000-8000-000000000001',display_name:'Synthetic',role,status:'active',can_view_money:canView,can_edit_orders:true,can_send_notifications:canNotify});
  calls.push(u.pathname);assert.equal(u.searchParams.get('limit'),'1000');assert.ok(!/owner_name|address|phone|line_user|note|method|legacy_data/.test(u.searchParams.get('select')));
  let rows=[];
  if(u.pathname.endsWith('/orders')){round++;assert.equal(u.searchParams.get('order_model_version'),'eq.2');rows=[{order_id:'synthetic-order',family_id:'synthetic-family',order_status:'completed',updated_at:change&&round%2===0?'2026-09-20T00:00:00Z':stamp,customer_total:1000,owner_earnings_total:0,sitter_earnings_total:800,company_earnings_before_platform:200,platform_name:null}];}
  else {assert.equal(u.searchParams.get('orders.order_model_version'),'eq.2');
   if(u.pathname.endsWith('/order_items'))rows=[{order_item_id:'synthetic-item',order_id:'synthetic-order',item_type:'service',item_status:'active',service_date:'2026-09-19',assigned_sitter_id:2,provider_type_snapshot:'sitter',line_amount:1000,sitter_earnings_amount:800,company_share_amount:200,company_discount_absorbed_amount:0,updated_at:stamp,orders:{order_model_version:2}}];
   else assert.ok(['/rest/v1/order_financial_entries','/rest/v1/sitter_payment_entries'].includes(u.pathname));
  }
  if(empty)rows=[];
  return Response.json(rows,{headers:{'content-range':rows.length?`0-${rows.length-1}/${incomplete?1001:rows.length}`:'*/0'}});
 };
 const env={APP_ENV:'development',SUPABASE_URL:dev,SUPABASE_SECRET_KEY:'synthetic-only',LINE_LIFF_CHANNEL_ID:'synthetic-channel'};
 const request=(operation,extra={})=>handleAdmin(new Request('https://example.invalid/api/admin',{method:'POST',body:JSON.stringify({operation,payload:{injectedOrder:'ignored'},accessToken:'synthetic-token'})}),{...env,...extra});
 try {
  let response=await request('getFinanceReportV2');assert.equal(response.status,200);let data=await response.json();assert.equal(data.report.sitters[0].sitterEarnings,'800.0000');assert.equal(calls.length,8);
  response=await request('downloadFinanceXlsxV2');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const book=new ExcelJS.Workbook();await book.xlsx.load(await response.arrayBuffer());assert.equal(book.getWorksheet('Orders').getCell('A2').value,'synthetic-order');
  incomplete=true;response=await request('getFinanceReportV2');assert.equal(response.status,503);assert.equal((await response.json()).report,undefined);incomplete=false;
  round=0;change=true;response=await request('getFinanceReportV2');assert.equal(response.status,409);change=false;
  empty=true;response=await request('getFinanceReportV2');assert.deepEqual((await response.json()).report.orders,[]);empty=false;
  for(const denied of ['SITTER','MEMBER','PUBLIC']){role=denied;const n=calls.length;for(const op of ['getFinanceReportV2','downloadFinanceXlsxV2','notificationSyntheticDryRun'])assert.equal((await request(op)).status,403);assert.equal(calls.length,n);}
  role='ADMIN';canView=false;let n=calls.length;assert.equal((await request('getFinanceReportV2')).status,400);assert.equal(calls.length,n);canView=true;
  assert.equal((await request('getFinanceReportV2',{APP_ENV:'production'})).status,400);assert.equal(calls.length,n);
  data=await(await request('notificationSyntheticDryRun')).json();assert.equal(data.first.status,'partial');assert.equal(data.retry.status,'accepted');assert.deepEqual(data.retry.results.map(r=>r.attempts),[1,2]);assert.equal(data.retry.sentToLine,false);assert.equal(calls.length,n);
  canNotify=false;assert.equal((await request('notificationSyntheticDryRun')).status,400);assert.equal(calls.length,n);
 } finally {globalThis.fetch=original;console.error=log;}
});
