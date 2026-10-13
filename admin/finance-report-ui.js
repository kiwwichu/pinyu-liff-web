export function mountFinanceReport(host,{requestApi,escapeHtml,canDryRun}) {
  const esc=escapeHtml;
  host.innerHTML='<h2>V2 財務報表（Dev）</h2><p>僅包含新版訂單，不含歷史舊單，不能當成全公司歷史總額。實收、應得、公司收入與實付分開；非資料庫交易快照。</p><button data-report-read>讀取報表</button> <button data-report-download>下載 XLSX</button><p data-report-status role="status"></p><div data-report-result></div>'+
    (canDryRun?'<h3>通知隔離模擬</h3><p>只使用內建虛構家庭，不會發送 LINE，也不保存正式通知紀錄。</p><button data-notify-synthetic>執行部分失敗 → 重試模擬</button><pre data-notify-result></pre>':'');
  const status=host.querySelector('[data-report-status]'),result=host.querySelector('[data-report-result]');
  for(const button of host.querySelectorAll('[data-report-read],[data-report-download]')) button.onclick=async()=>{
    host.querySelectorAll('[data-report-read],[data-report-download]').forEach(b=>b.disabled=true);status.textContent='完整讀取及核對中…';result.replaceChildren();
    try {
      if(button.hasAttribute('data-report-download')) {
        const data=await requestApi('downloadFinanceXlsxV2');
        if(!(data.blob instanceof Blob)) throw new Error('未取得 XLSX，沒有下載檔案');
        const url=URL.createObjectURL(data.blob),a=document.createElement('a');a.href=url;a.download='pinyu-dev-v2-finance.xlsx';host.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        status.textContent='XLSX 已產生並交給瀏覽器下載（V2 範圍）。';
      } else {
        const {report,read}=await requestApi('getFinanceReportV2');
        const table=(title,rows,keys)=>'<h3>'+esc(title)+'</h3><div style="overflow:auto"><table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+keys.map(k=>'<td>'+esc(r[k]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
        result.innerHTML=table('月實收與服務次數',report.monthly,['month','actualCashNet','serviceCount'])+table('逐單',report.orders,['orderId','customerReceivable','customerNetPaid','sitterEarningsSnapshot','companyIncomeBeforePlatform','platformSettlementNet'])+table('家庭累计',report.families,['familyId','customerNetPaid','serviceCount'])+table('保母歸月',report.sitterMonths,['sitterId','month','serviceCount','serviceAmount','feeAmount','sitterEarnings','ownerEarnings','companyIncome','actualSitterPaid'])+table('保母累計',report.sitters,['sitterId','serviceCount','sitterEarnings','companyIncome','actualSitterPaid']);
        status.textContent=report.orders.length?'來源完整性檢查通過；讀取完成：'+read.finishedAt:'完整來源為空：沒有新版訂單，非讀取失敗。';
      }
    } catch(error) {status.textContent=error.message||'未完整取得報表，沒有產生部分總額。';}
    finally {host.querySelectorAll('[data-report-read],[data-report-download]').forEach(b=>b.disabled=false);}
  };
  const dry=host.querySelector('[data-notify-synthetic]');if(dry)dry.onclick=async()=>{
    dry.disabled=true;const output=host.querySelector('[data-notify-result]');output.textContent='模擬中…';
    try {const data=await requestApi('notificationSyntheticDryRun');output.textContent=JSON.stringify({first:data.first,retry:data.retry,boundary:data.boundary},null,2);}
    catch(error){output.textContent=error.message||'模擬失敗';}finally{dry.disabled=false;}
  };
}
