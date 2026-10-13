import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import ExcelJS from 'exceljs';
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes('/src/')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);}});
const {financeReport}=await import('../src/finance-report.ts');
const {writeFinanceXlsx}=await import('../src/finance-xlsx.ts');
const item=(id,date,extra={})=>({id,itemType:'service',itemStatus:'active',serviceDate:date,assignedSitterId:2,providerType:'sitter',lineAmount:'1000',sitterEarnings:'800',companyShare:'200',discountAbsorbed:'0',...extra});
const source=(items,extra={})=>({order:{orderId:'synthetic-order',updatedAt:'2026-09-19T00:00:00Z',customerTotal:'2000',ownerEarningsTotal:'0',sitterEarningsTotal:'1600',companyEarningsBeforePlatform:'400',platformName:null},familyId:'synthetic-family',orderStatus:'completed',entries:[],items,...extra});
test('own last service month, home visit exception, fees and separate actual pay month/payee',()=>{
 const s=source([item('a','2026-08-31'),item('b','2026-09-01'),item('h','2026-07-01',{itemType:'home_visit_fee',lineAmount:'100',sitterEarnings:'30',companyShare:'70'}),item('t','2026-08-31',{itemType:'travel_fee',lineAmount:'100',sitterEarnings:'100',companyShare:'0'})]);
 Object.assign(s.order,{customerTotal:'2200',sitterEarningsTotal:'1730',companyEarningsBeforePlatform:'470'});
 const p={requestId:'synthetic-paid',orderId:s.order.orderId,orderItemId:'a',sitterId:3,amount:'500',paidAt:'2026-09-30T16:00:00Z'};
 const before=structuredClone(s),r=financeReport([s],[p]);
 assert.deepEqual(r.sitterMonths.map(x=>[x.sitterId,x.month,x.serviceCount,x.sitterEarnings,x.actualSitterPaid]),[[2,'2026-07',0,'30.0000','0.0000'],[2,'2026-09',2,'1700.0000','0.0000'],[3,'2026-10',0,'0.0000','500.0000']]);
 assert.equal(r.sitters[0].serviceAmount,'2000.0000');assert.equal(r.sitters[0].feeAmount,'200.0000');assert.deepEqual(s,before);
});
test('discount absorbed by company only, owner once, unassigned separate, independent fee date required',()=>{
 const s=source([item('a','2026-09-01',{providerType:'owner',sitterEarnings:'1000',companyShare:'0',discountAbsorbed:'100'}),item('b','2026-09-02',{assignedSitterId:null,providerType:'unassigned',sitterEarnings:'0',companyShare:'1000'})]);
 Object.assign(s.order,{customerTotal:'1900',ownerEarningsTotal:'1000',sitterEarningsTotal:'0',companyEarningsBeforePlatform:'1900'});
 const r=financeReport([s],[]);assert.equal(r.sitters.find(x=>x.sitterId===2).companyIncome,'900.0000');assert.equal(r.sitters.find(x=>x.sitterId===2).sitterEarnings,'0.0000');
 assert.equal(r.sitters.find(x=>x.sitterId===null).companyIncome,'1000.0000');
 const fee=source([item('f',null,{itemType:'tip'})]);assert.throws(()=>financeReport([fee],[]),/日期/);
 const home=source([item('a','2026-09-01'),item('h',null,{itemType:'home_visit_fee'})]);assert.throws(()=>financeReport([home],[]),/日期/);
 assert.throws(()=>financeReport([source([item('a','2026-02-30'),item('b','2026-09-01')])],[]),/日期/);
});
test('whole cancellation retains cash but no earned/count; rejects incomplete money/duplicates',()=>{
 const s=source([item('a','2026-09-01')],{orderStatus:'cancelled'});Object.assign(s.order,{customerTotal:'0',sitterEarningsTotal:'0',companyEarningsBeforePlatform:'0'});
 s.entries=[{requestId:'00000000-0000-4000-8000-000000000001',orderId:s.order.orderId,ledger:'payments',kind:'receipt',amount:'1000',occurredAt:'2026-09-01T00:00:00Z',channel:'direct',method:'synthetic',note:''}];
 const r=financeReport([s],[]);assert.equal(r.orders[0].actualCashNet,'1000.0000');assert.equal(r.orders[0].serviceCount,0);assert.deepEqual(r.sitterMonths,[]);
 const invalid=source([item('a','2026-09-01')]);assert.throws(()=>financeReport([invalid],[]),/快照/);
 assert.throws(()=>financeReport([s,s],[]));assert.deepEqual(financeReport([],[]).monthly,[]);
});
test('XLSX readback: numeric money/count, literal malicious IDs, no formulas, totals and empty sheets',async()=>{
 const s=source([item('a','2026-08-01'),item('b','2026-09-01')]);s.order.orderId='=1+1';s.familyId='@SUM(A1)';
 const report=financeReport([s],[]),bytes=await writeFinanceXlsx(report),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
 assert.equal(book.worksheets.length,9);assert.equal(book.getWorksheet('Orders').getCell('A2').value,'=1+1');assert.equal(book.getWorksheet('Orders').getCell('B2').value,'@SUM(A1)');
 assert.equal(book.getWorksheet('Totals').getCell('B2').value,2000);assert.equal(book.getWorksheet('Totals').getCell('B6').value,1600);
 assert.equal(book.getWorksheet('SitterMonths').getCell('B2').type,ExcelJS.ValueType.Date);
 const sheet=book.getWorksheet('SitterMonths'),headers=sheet.getRow(1).values;
 assert.equal(sheet.getRow(2).getCell(headers.indexOf('sitterEarnings')).value,1600);
 assert.equal(sheet.getRow(2).getCell(headers.indexOf('serviceCount')).value,2);
 for(const ws of book.worksheets)ws.eachRow(row=>row.eachCell(cell=>assert.notEqual(cell.type,ExcelJS.ValueType.Formula)));
 const empty=new ExcelJS.Workbook();await empty.xlsx.load(await writeFinanceXlsx(financeReport([],[])));assert.equal(empty.getWorksheet('Orders').rowCount,1);
});
