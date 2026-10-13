import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const profile = await mkdtemp(resolve(tmpdir(), "pinyu-ledger-smoke-"));
const server = createServer(async (req, res) => {
  if (req.url === "/") return res.writeHead(200, { "Content-Type": "text/html" }).end('<section id="ledger"></section>');
  if (!["/admin/order-ledger-ui.js", "/admin/sitter-finance-ui.js", "/admin/finance-report-ui.js", "/admin/order-v2-ui.js"].includes(req.url)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
  res.end(await readFile(resolve(root, req.url.slice(1))));
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--no-sandbox", "--in-process-gpu", "--disable-gpu",
  "--disable-gpu-sandbox", "--use-angle=swiftshader", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank",
], { stdio: "ignore", windowsHide: true });
const delay = ms => new Promise(done => setTimeout(done, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; }
    catch { await delay(100); }
  }
  assert.ok(port, "headless Chrome started");
  const target = await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", { method: "PUT" }).then(r => r.json());
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const result = JSON.parse(event.data);
    const task = pending.get(result.id);
    if (!task) return;
    pending.delete(result.id); clearTimeout(task.timer);
    if (result.error) task.reject(new Error(result.error.message)); else task.done(result.result);
  });
  const send = (method, params = {}) => new Promise((done, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error("CDP timeout: " + method)); }, 15000);
    pending.set(requestId, { done, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  await send("Page.navigate", { url: "http://127.0.0.1:" + server.address().port + "/" });
  await delay(300);
  for (const width of [1440, 390]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
  const result = await send("Runtime.evaluate", {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const { mountOrderLedger } = await import('/admin/order-ledger-ui.js');
      const host = document.getElementById('ledger');
      const escapeHtml = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
      const tick = () => new Promise(r => setTimeout(r, 0));
      const calls = [];
      const data = {
        order: { updatedAt: '2026-09-10T00:00:00.123456Z' },
        entries: [],
        summary: { customerReceivable: '1000.0000', sitterEarningsSnapshot: '800.0000',
          companyIncomeBeforePlatform: '200.0000', customerReceipts: '0.0000', customerRefunds: '0.0000', customerNetPaid: '0.0000',
          receivableLessNetPaid: '1000.0000', platformSettlementNet: '0.0000',
          actualCashNet: '0.0000', warnings: [] },
      };
      let failOnce = true;
      const requestApi = async (operation, payload) => {
        calls.push({ operation, payload: structuredClone(payload) });
        if (operation === 'getOrderLedgerV2') return data;
        if (failOnce) { failOnce = false; throw new Error('Synthetic lost response'); }
        data.entries = [payload];
        data.summary.customerNetPaid = '100.0000'; data.summary.actualCashNet = '100.0000';
        data.summary.receivableLessNetPaid = '900.0000';
        return data;
      };
      mountOrderLedger(host, { orderId: 'V2-synthetic', canEdit: true, requestApi, escapeHtml });
      host.querySelector('[data-load-ledger]').click(); await tick();
      const form = host.querySelector('form');
      form.elements.amount.value = '100';
      form.elements.occurredAt.value = '2026-09-10T10:00:00+08:00';
      form.elements.method.value = 'synthetic';
      form.elements.confirmed.checked = true;
      form.requestSubmit(); await tick();
      const fieldsLocked = form.elements.amount.disabled;
      const retryVisible = form.querySelector('button').textContent.includes('相同識別碼');
      form.requestSubmit(); await tick();
      const writes = calls.filter(x => x.operation === 'appendOrderLedgerV2');
      const retryIdentical = JSON.stringify(writes[0]?.payload) === JSON.stringify(writes[1]?.payload);
      const summaryUpdated = host.textContent.includes('900.0000') && host.textContent.includes('已記錄 1 筆');
      mountOrderLedger(host, { orderId: 'V2-synthetic', canEdit: false, requestApi, escapeHtml });
      host.querySelector('[data-load-ledger]').click(); await tick();
      const readOnly = !host.querySelector('form');
      data.summary.warnings = ['<img src=x onerror=alert(1)>'];
      mountOrderLedger(host, { orderId: 'V2-synthetic', canEdit: false, requestApi, escapeHtml });
      host.querySelector('[data-load-ledger]').click(); await tick();
      const escaped = !host.querySelector('img') && host.textContent.includes('<img');
      mountOrderLedger(host, { orderId: 'V2-synthetic', canEdit: true, escapeHtml,
        requestApi: async () => { throw new Error('Synthetic missing migration'); } });
      host.querySelector('[data-load-ledger]').click(); await tick();
      const notReady = host.textContent.includes('不能把未取得流水當成已收 0 元') && !host.querySelector('form');
      const reloadAvailable = !!host.querySelector('[data-reload-ledger]');
      const recovery = async mode => {
        let saved = null;
        const response = structuredClone(data); response.entries = [];
        mountOrderLedger(host, { orderId: 'V2-synthetic', canEdit: true, escapeHtml,
          requestApi: async (operation, payload) => {
            if (operation === 'getOrderLedgerV2') return response;
            saved = { ...payload, amount: mode === 'conflict' ? '999.0000' : '100.0000', occurredAt: '2026-09-10T02:00:00.000Z' };
            if (mode !== 'missing') response.entries = [saved];
            throw new Error('synthetic unknown response');
          } });
        host.querySelector('[data-load-ledger]').click(); await tick();
        const form = host.querySelector('form');
        form.elements.amount.value = '100'; form.elements.occurredAt.value = '2026-09-10T10:00:00+08:00';
        form.elements.method.value = 'synthetic'; form.elements.confirmed.checked = true;
        form.requestSubmit(); await tick();
        host.querySelector('[data-check-pending]').click(); await tick();
        if (mode === 'recorded') return host.textContent.includes('已記錄 1 筆') && !host.querySelector('[type=submit]').disabled;
        if (mode === 'missing') return host.textContent.includes('不代表請求一定失敗') && form.elements.amount.disabled && !form.querySelector('[type=submit]').disabled;
        return host.textContent.includes('識別碼對應內容不同') && form.querySelector('[type=submit]').disabled;
      };
      const recordedRecovery = await recovery('recorded');
      const missingStaysLocked = await recovery('missing');
      const conflictingKeyBlocked = await recovery('conflict');
      const { mountSitterFinance } = await import('/admin/sitter-finance-ui.js');
      const sitterFlow = async (failureCode = null) => {
        let first = true, captured = null; const requests = [];
        const paymentData = { source: { orderId:'V2-synthetic', orderItemId:'00000000-0000-4000-8000-000000000003',
            expectedOrderUpdatedAt:'2026-09-12T00:00:00Z', expectedItemUpdatedAt:'2026-09-12T00:00:00Z' },
          summary: {currentDueSnapshot:'800.0000',actualPaidHistory:'0.0000',dueLessPaid:'800.0000',requiresReview:false},
          entries:[], boundary:'synthetic boundary' };
        mountSitterFinance(host, {orders:[{orderId:'V2-synthetic'}],canView:true,canEdit:true,escapeHtml,
          requestApi:async(op,p)=>{
            if(op==='getOrderV2')return {items:[{orderItemId:paymentData.source.orderItemId,serviceDate:'2026-09-12',itemType:'service',assignedSitterId:2}]};
            if(op==='getSitterPaymentV2')return structuredClone(paymentData);
            requests.push(structuredClone(p));captured=p;
            if(first){first=false;throw Object.assign(new Error('Synthetic rejected/unknown'),{code:failureCode});}
            paymentData.entries=[{...p,sitterIdSnapshot:2,dueAmountSnapshot:'800.0000'}];
            paymentData.summary.actualPaidHistory='300.0000';paymentData.summary.dueLessPaid='500.0000';
            return {recorded:true,requestId:p.requestId,replayed:false};
          }});
        const order=host.querySelector('[data-finance-order]');order.value='V2-synthetic';order.dispatchEvent(new Event('change'));await tick();
        const item=host.querySelector('[data-finance-item]');item.value=paymentData.source.orderItemId;item.dispatchEvent(new Event('change'));await tick();
        const f=host.querySelector('form');f.elements.amount.value='300';f.elements.paidAt.value='2026-09-12T10:00:00+08:00';
        f.elements.method.value='synthetic';f.elements.differenceReason.value='partial';f.elements.confirmed.checked=true;
        f.requestSubmit();await tick();
        if(failureCode==='LEDGER_REJECTED')return !f.elements.amount.disabled && !order.disabled && requests.length===1;
        if(failureCode==='LEDGER_SOURCE_CHANGED'){
          if(!f.querySelector('[type=submit]').disabled)return false;
          f.querySelector('[data-check]').click();await tick();
          return f.querySelector('[type=submit]').disabled && host.textContent.includes('核對最新報酬');
        }
        const locked=order.disabled && item.disabled && f.elements.amount.disabled;
        f.requestSubmit();await tick();await tick();
        return locked && requests.length===2 && JSON.stringify(requests[0])===JSON.stringify(requests[1])
          && host.textContent.includes('500.0000') && host.textContent.includes('已記錄 1 筆付款') && !order.disabled;
      };
      const sitterRetry = await sitterFlow();
      const sitterValidationEditable = await sitterFlow('LEDGER_REJECTED');
      const sitterCasStaysBlocked = await sitterFlow('LEDGER_SOURCE_CHANGED');
      mountSitterFinance(host,{orders:[],canView:false,canEdit:true,requestApi,escapeHtml});
      const sitterNoPermission = !host.querySelector('form') && host.textContent.includes('沒有財務');
      const {mountFinanceReport}=await import('/admin/finance-report-ui.js');
      let reportError=false,downloaded=false;
      mountFinanceReport(host,{escapeHtml,canDryRun:true,requestApi:async op=>{
        if(op==='notificationSyntheticDryRun')return {first:{status:'partial',sentToLine:false},retry:{status:'accepted',durable:false},boundary:'synthetic only'};
        if(reportError)throw new Error('Synthetic incomplete source');
        if(op==='downloadFinanceXlsxV2')return {blob:new Blob(['synthetic'])};
        return {report:{orders:[{orderId:'<img src=x>',customerReceivable:'1000.0000'}],monthly:[{month:'2026-09',actualCashNet:'777.0000',serviceCount:2}],families:[],sitterMonths:[],sitters:[]},read:{finishedAt:'2026-09-21T00:00:00Z'}};
      }});
      host.querySelector('[data-report-read]').click();await tick();
      const reportVisible=host.textContent.includes('777.0000')&&!host.querySelector('img');
      reportError=true;host.querySelector('[data-report-read]').click();await tick();
      const reportFailedClosed=host.textContent.includes('Synthetic incomplete')&&!host.querySelector('table');
      reportError=false;const originalClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){downloaded=this.download==='pinyu-dev-v2-finance.xlsx'&&this.href.startsWith('blob:');};
      host.querySelector('[data-report-download]').click();await tick();HTMLAnchorElement.prototype.click=originalClick;
      host.querySelector('[data-notify-synthetic]').click();await tick();
      const notificationVisible=host.textContent.includes('partial')&&host.textContent.includes('accepted')&&host.textContent.includes('synthetic only');
      const {createOrderV2Ui}=await import('/admin/order-v2-ui.js');
      const state={sitters:[],families:[],pets:[],servicePlans:[],homeVisitSummaries:[],permissions:{canViewMoney:true}};
      const ui=createOrderV2Ui({state,app:host,escapeHtml,requestApi,showToast:()=>{},formatMoney:String});
      ui.renderForm();let type=host.querySelector('[data-field=itemType]'),date=host.querySelector('[data-field=serviceDate]');
      date.value='2026-09-01';type.value='home_visit_fee';type.dispatchEvent(new Event('change',{bubbles:true}));
      const homeDateIndependent=date.required&&date.value===''&&host.textContent.includes('獨立家訪日期');
      ui.renderForm({order:{orderId:'synthetic-order'},items:[{orderItemId:'synthetic-item',itemType:'home_visit_fee',serviceDate:'2026-07-01'}]});
      const homeDateEditPreserved=host.querySelector('[data-field=serviceDate]').value==='2026-07-01';
      return { reportVisible,reportFailedClosed,downloaded,notificationVisible,homeDateIndependent,homeDateEditPreserved,fieldsLocked, retryVisible, retryIdentical, writeCount: writes.length, summaryUpdated, readOnly, escaped, notReady,
        reloadAvailable, recordedRecovery, missingStaysLocked, conflictingKeyBlocked, sitterRetry, sitterValidationEditable, sitterCasStaysBlocked, sitterNoPermission };
    })()`,
  });
  if (result.exceptionDetails) throw new Error("Browser evaluation failed: " + result.exceptionDetails.text);
  const checks = result.result.value;
  assert.equal(checks.writeCount, 2);
  for (const [key, value] of Object.entries(checks)) if (key !== "writeCount") assert.equal(value, true, key);
  console.log(JSON.stringify({ browserPanelSmoke: "PASS", width, ...checks }));
  }
} finally {
  if (socket) socket.close();
  const stopped = new Promise(done => { if (chrome.exitCode !== null) done(); else chrome.once("exit", done); });
  chrome.kill();
  await Promise.race([stopped, delay(3000)]);
  server.close();
  // Exact temporary profile only; never delete repository or broad tmp directory.
  const target = resolve(profile), tempRoot = resolve(tmpdir()) + sep;
  if (!target.startsWith(tempRoot) || !target.slice(tempRoot.length).startsWith("pinyu-ledger-smoke-")) {
    throw new Error("Unsafe temporary profile cleanup target");
  }
  await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
