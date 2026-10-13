import { mountFinanceReport } from './finance-report-ui.js';
// Owner/Admin finance entry. Recording confirms a past payment; it never transfers money.
export function mountSitterFinance(host, { orders, canView, canEdit, canDryRun, requestApi, escapeHtml }) {
  const esc = escapeHtml;
  if (!canView) { host.innerHTML = '<p>沒有財務檢視權限</p>'; return; }
  host.innerHTML = '<section class="panel"><h2>財務 → 保母結算／合作報酬（Dev）</h2>' +
    '<p>應付與實付分開。此處只記錄人工核對過的付款，不執行轉帳、批次付款或報酬重算。</p>' +
    '<label>新版訂單<select data-finance-order><option value="">請選擇</option>' +
    orders.map(o => '<option value="' + esc(o.orderId) + '">' + esc(o.orderNumber || o.orderId) + '</option>').join('') +
    '</select></label><label>報酬項目<select data-finance-item disabled><option value="">請先選訂單</option></select></label>' +
    '<div data-sitter-payment></div></section><section data-finance-report class="panel"></section>';
  mountFinanceReport(host.querySelector('[data-finance-report]'),{requestApi,escapeHtml,canDryRun});
  const orderSelect = host.querySelector('[data-finance-order]');
  const itemSelect = host.querySelector('[data-finance-item]');
  const panel = host.querySelector('[data-sitter-payment]');
  let sequence = 0;
  orderSelect.addEventListener('change', async () => {
    const token = ++sequence;
    itemSelect.disabled = true; itemSelect.innerHTML = '<option value="">請選項目</option>'; panel.textContent = '';
    if (!orderSelect.value) return;
    try {
      const data = await requestApi('getOrderV2', { orderId: orderSelect.value });
      if (token !== sequence) return;
      itemSelect.innerHTML += data.items.map(i => '<option value="' + esc(i.orderItemId) + '">' +
        esc(i.serviceDate || '獨立費用') + ' ｜ ' + esc(i.itemType) + ' ｜ 保母 #' + esc(i.assignedSitterId ?? '未指派') + '</option>').join('');
      itemSelect.disabled = false;
      if (!data.items.length) panel.textContent = '這張訂單沒有報酬項目；不能推定已支付。';
    } catch { if (token === sequence) panel.textContent = '項目讀取失敗，請重新選取；不能當成實付 0 元。'; }
  });
  itemSelect.addEventListener('change', () => load());
  async function load() {
    const token = ++sequence;
    panel.textContent = '讀取付款歷程…';
    if (!itemSelect.value) { panel.textContent = ''; return; }
    try {
      const data = await requestApi('getSitterPaymentV2', { orderId: orderSelect.value, orderItemId: itemSelect.value });
      if (token === sequence) render(data);
    } catch {
      if (token !== sequence) return;
      panel.innerHTML = '<p>未完整取得付款歷程；不能當成實付 0 元。</p><button data-reload>重新讀取</button>';
      panel.querySelector('[data-reload]').onclick = load;
    }
  }
  function render(data) {
    const s = data.summary;
    orderSelect.disabled = false; itemSelect.disabled = false;
    panel.innerHTML = '<p>目前應付快照：' + esc(s.currentDueSnapshot) + '；歷史實付：' + esc(s.actualPaidHistory) +
      '；差額：' + esc(s.dueLessPaid ?? '需要核對') + '</p><p>' + esc(data.boundary) + '</p>' +
      (s.requiresReview ? '<p role="status">來源已變更／取消或非合作保母報酬，請人工核對；此處不可新增付款。</p>' : '') +
      '<details><summary>已記錄 ' + data.entries.length + ' 筆付款</summary>' +
      data.entries.map(e => '<p>保母 #' + esc(e.sitterIdSnapshot) + ' ｜ ' + esc(e.paidAt) + ' ｜ ' + esc(e.amount) +
        ' ｜ ' + esc(e.method) + '<br>原應付：' + esc(e.dueAmountSnapshot) + '；差異原因：' + esc(e.differenceReason) +
        '<br>識別碼：' + esc(e.requestId) + '</p>').join('') + '</details>' +
      (canEdit && !s.requiresReview ? '<form class="form-grid two" data-payment-form>' +
        '<label>實付金額<input name="amount" type="number" min="0.0001" step="0.0001" required></label>' +
        '<label>實際付款時間（含時區）<input name="paidAt" maxlength="40" placeholder="2026-09-12T10:00:00+08:00" required></label>' +
        '<label>方式<input name="method" maxlength="80" required></label>' +
        '<label>差異原因（部分付款也必填，勿填帳號個資）<input name="differenceReason" maxlength="1000"></label>' +
        '<label><input name="confirmed" type="checkbox" required>我已核對實際支付</label>' +
        '<button type="submit">記錄已支付</button><button type="button" data-check hidden>核對此筆付款</button>' +
        '<p data-result role="status"></p></form>' : '');
    const form = panel.querySelector('form');
    if (!form) return;
    let pending = null, permanentlyBlocked = false;
    const submit = form.querySelector('[type=submit]'), check = form.querySelector('[data-check]'), status = form.querySelector('[data-result]');
    check.onclick = async () => {
      check.disabled = true; submit.disabled = true;
      try {
        const fresh = await requestApi('getSitterPaymentV2', data.source);
        const found = fresh.entries.find(e => e.requestId === pending.requestId);
        if (found) {
          const same = ['orderId','orderItemId','method','differenceReason'].every(k => found[k] === String(pending[k]).trim())
            && Number(found.amount) === Number(pending.amount) && Date.parse(found.paidAt) === Date.parse(pending.paidAt);
          if (same) { render(fresh); return; }
          permanentlyBlocked = true;
          status.textContent = '識別碼內容不同，請交管理者核對；不可另建同筆付款。';
        } else status.textContent = '尚未找到，不代表請求一定失敗；保留原識別碼，不可另建同筆付款。';
      } catch { status.textContent = '付款結果仍未確認，請保留原識別碼。'; }
      check.disabled = false; submit.disabled = permanentlyBlocked;
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (submit.disabled || permanentlyBlocked) return;
      if (!pending) {
        const fields = new FormData(form);
        pending = { ...data.source, requestId: crypto.randomUUID(), amount: fields.get('amount'), paidAt: fields.get('paidAt'),
          method: fields.get('method'), differenceReason: fields.get('differenceReason') };
      }
      orderSelect.disabled = true; itemSelect.disabled = true;
      form.querySelectorAll('input,button').forEach(e => { e.disabled = true; });
      status.textContent = '核對中；識別碼：' + pending.requestId;
      try {
        await requestApi('appendSitterPaymentV2', pending);
        // Even a success response must be read back to show actual history.
        check.hidden = false; await check.onclick();
      } catch (error) {
        if (error?.code === 'LEDGER_REJECTED') {
          pending = null; orderSelect.disabled = false; itemSelect.disabled = false;
          form.querySelectorAll('input,button').forEach(e => { e.disabled = false; });
          check.hidden = true; status.textContent = error.message; return;
        }
        permanentlyBlocked = ['LEDGER_SOURCE_CHANGED','LEDGER_REVIEW_REQUIRED','LEDGER_DENIED','LEDGER_KEY_CONFLICT'].includes(error?.code);
        status.textContent = (error.message || '结果未確認') + '；識別碼：' + pending.requestId;
        submit.disabled = permanentlyBlocked; submit.textContent = '用原識別碼重試';
        check.hidden = false; check.disabled = false;
        if (error?.code === 'LEDGER_SOURCE_CHANGED') {
          const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = '核對最新報酬並重新填寫';
          reload.onclick = () => { orderSelect.disabled = false; itemSelect.disabled = false; load(); };
          status.after(reload);
        }
      }
    };
  }
}
