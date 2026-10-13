import ExcelJS from 'exceljs';
import { moneyUnits } from './order-ledger';
import type { financeReport } from './finance-report';
type Report=ReturnType<typeof financeReport>;
type Cell=string|number|null;
/** Explicit numeric columns; identifier text never becomes a formula/hyperlink. */
export async function writeFinanceXlsx(report:Report) {
  const book=new ExcelJS.Workbook();book.creator='Pinyu Dev';
  const totals=book.addWorksheet('Totals');
  totals.addRow(['metric','amount (TWD)','basis']);
  const sum=(values:readonly string[])=>{
    const units=values.reduce((n,v)=>n+moneyUnits(v),0n);
    if(units>999999999999999n||units< -999999999999999n)throw new Error('合計超過 XLSX 安全精度');
    return Number(units)/10000;
  };
  totals.addRow(['customerReceivable',sum(report.orders.map(r=>r.customerReceivable)),'新版訂單應收快照，非實收']);
  totals.addRow(['customerNetPaid',sum(report.orders.map(r=>r.customerNetPaid)),'飼主實際支付減退款，含支付給平台']);
  totals.addRow(['actualCashNet',sum(report.orders.map(r=>r.actualCashNet)),'直接收款加平台實際撥款減實際退款／調整，不重複計平台客戶付款']);
  totals.addRow(['companyIncomeBeforePlatform',sum(report.orders.map(r=>r.companyIncomeBeforePlatform)),'扣合作保母應得後的公司快照，Pinyu 本人只含一次；非平台扣費後最終淨收入']);
  totals.addRow(['sitterEarningsSnapshot',sum(report.orders.map(r=>r.sitterEarningsSnapshot)),'合作保母應得快照，非實付']);
  totals.addRow(['actualSitterPaid',sum(report.actualSitterPayments.map(r=>r.amount)),'歷史實付，按原收款保母及付款日，非目前應付差額']);
  totals.getColumn(1).width=36;totals.getColumn(2).width=24;totals.getColumn(2).numFmt='#,##0.0000;[Red]-#,##0.0000';totals.getColumn(3).width=90;totals.getColumn(3).alignment={wrapText:true};totals.getRow(1).font={bold:true};
  function sheet(name:string, rows:readonly Record<string,Cell>[], columns:readonly string[], money:readonly string[]=[]) {
    const s=book.addWorksheet(name);s.addRow([...columns]);s.getRow(1).font={bold:true};s.getRow(1).alignment={wrapText:true};s.getRow(1).height=36;s.views=[{state:'frozen',ySplit:1}];
    for(const row of rows) s.addRow(columns.map(key=>{
      const value=row[key];
      if(value && key==='lastServiceDate') return new Date(String(value)+'T00:00:00Z');
      if(value && (key==='month'||key==='serviceMonth')) return new Date(String(value)+'-01T00:00:00Z');
      if(!money.includes(key)||value===null) return value??null;
      const units=moneyUnits(value);if(units>999999999999999n||units< -999999999999999n) throw new Error('金額超過 XLSX 安全精度，不能四捨五入輸出');
      return Number(units)/10000;
    }));
    columns.forEach((key,index)=>{s.getColumn(index+1).width=key.endsWith('Id')?40:24;if(money.includes(key))s.getColumn(index+1).numFmt='#,##0.0000;[Red]-#,##0.0000';if(key==='lastServiceDate')s.getColumn(index+1).numFmt='yyyy-mm-dd';if(key==='month'||key==='serviceMonth')s.getColumn(index+1).numFmt='yyyy-mm';});
  }
  sheet('Monthly',report.monthly,['month','actualCashNet','serviceCount'],['actualCashNet']);
  const om=['customerReceivable','customerReceipts','customerRefunds','customerNetPaid','sitterEarningsSnapshot','companyIncomeBeforePlatform','actualCashNet','platformSettlementNet'];
  sheet('Orders',report.orders,['orderId','familyId','serviceCount','lastServiceDate','serviceMonth','unassignedServiceCount',...om,'platformName'],om);
  sheet('Families',report.families,['familyId','customerNetPaid','serviceCount'],['customerNetPaid']);
  const sm=['serviceAmount','feeAmount','sitterEarnings','ownerEarnings','companyIncome','actualSitterPaid'];
  sheet('SitterMonths',report.sitterMonths,['sitterId','month','serviceCount',...sm],sm);
  sheet('Sitters',report.sitters,['sitterId','serviceCount',...sm],sm);
  sheet('Items',report.itemDetails,['orderId','orderItemId','sitterId','itemType','month','lineAmount','sitterEarnings','ownerEarnings','companyIncome'],['lineAmount','sitterEarnings','ownerEarnings','companyIncome']);
  sheet('ActualSitterPayments',report.actualSitterPayments,['requestId','orderId','orderItemId','sitterId','amount','paidAt'],['amount']);
  const basis=book.addWorksheet('Basis');for(const [key,value] of Object.entries(report.basis)) basis.addRow([key,typeof value==='string'?value:JSON.stringify(value)]);
  basis.getColumn(1).width=28;basis.getColumn(2).width=100;basis.getColumn(2).alignment={wrapText:true};
  const buffer=await book.xlsx.writeBuffer();return new Uint8Array(buffer);
}
