import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import ExcelJS from 'exceljs';
// Actual Worker runtime, synthetic upstream only. Never load .env or make remote requests.
const bundle=await build({entryPoints:['src/worker.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2023',conditions:['workerd'],external:['node:*']});
let calls=0;
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-08-19',compatibilityFlags:['nodejs_compat'],
 bindings:{APP_ENV:'development',SUPABASE_URL:'https://zzkdmenxlucgxirwxayb.supabase.co',SUPABASE_SECRET_KEY:'synthetic-only',LINE_LIFF_CHANNEL_ID:'synthetic-channel'},
 outboundService:async request=>{
  const u=new URL(request.url);calls++;
  if(u.hostname==='api.line.me')return Response.json(u.pathname.includes('verify')?{client_id:'synthetic-channel',expires_in:60}:{userId:'synthetic-line'});
  assert.equal(u.hostname,'zzkdmenxlucgxirwxayb.supabase.co');assert.equal(request.method,'GET');
  if(u.pathname.endsWith('/app_users'))return Response.json({user_id:'00000000-0000-4000-8000-000000000001',display_name:'Synthetic',role:'OWNER',status:'active',can_view_money:true,can_edit_orders:true,can_send_notifications:true});
  assert.ok(['/rest/v1/orders','/rest/v1/order_items','/rest/v1/order_financial_entries','/rest/v1/sitter_payment_entries'].includes(u.pathname));
  return Response.json([],{headers:{'content-range':'*/0'}});
 }}));
try {
 const request=op=>mf.dispatchFetch('http://example.invalid/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accessToken:'synthetic-token',operation:op,payload:{}})});
 let response=await request('getFinanceReportV2');assert.equal(response.status,200);assert.deepEqual((await response.json()).report.orders,[]);
 response=await request('downloadFinanceXlsxV2');assert.equal(response.status,200);const book=new ExcelJS.Workbook();await book.xlsx.load(await response.arrayBuffer());assert.equal(book.getWorksheet('Orders').rowCount,1);assert.equal(book.getWorksheet('Totals').getCell('B2').value,0);
 response=await request('notificationSyntheticDryRun');const notify=await response.json();assert.equal(notify.first.status,'partial');assert.equal(notify.retry.sentToLine,false);
 console.log(JSON.stringify({workerRuntime:'PASS',xlsxReadback:'PASS',bundleBytes:bundle.outputFiles[0].contents.length,syntheticUpstreamCalls:calls,realNetworkCalls:0}));
} finally {await mf.dispose();}
