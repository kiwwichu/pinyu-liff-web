// Dev ledger panel; never derives receipts from editable order/payment snapshots.
export function mountOrderLedger(host, { orderId, canEdit, requestApi, escapeHtml }) {
  const esc = escapeHtml;
  host.innerHTML = '<h3>實際收款／平台流水（Dev）</h3><p>報價、人工付款狀態與平台快照不代表實際入帳。公司端收入已含 Pinyu 本人服務所得，不再加總一次。</p><button type="button" class="secondary-btn" data-load-ledger>讀取流水</button>';
  host.querySelector("[data-load-ledger]").addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    try { render(await requestApi("getOrderLedgerV2", { orderId })); }
    catch {
      host.innerHTML = '<p role="status">流水讀取失敗或無存取權。不能把未取得流水當成已收 0 元。</p><button type="button" data-reload-ledger>重新讀取</button>';
      host.querySelector('[data-reload-ledger]').addEventListener('click', () => {
        mountOrderLedger(host, { orderId, canEdit, requestApi, escapeHtml });
        host.querySelector('[data-load-ledger]').click();
      });
    }
  });
  function render(data) {
    const s = data.summary;
    const rows = [
      ["客戶應收（計價快照）", s.customerReceivable],
      ["合作保母應得（非已支付）", s.sitterEarningsSnapshot],
      ["本人／公司端收入（平台前，已含本人）", s.companyIncomeBeforePlatform],
      ["客戶收款累計（含付給平台）", s.customerReceipts],
      ["客戶退款累計", s.customerRefunds],
      ["客戶付款淨額（含付給平台）", s.customerNetPaid],
      ["應收減已記錄淨付款差額", s.receivableLessNetPaid],
      ["平台撥款淨額", s.platformSettlementNet],
      ["Pinyu 實際現金流入淨額", s.actualCashNet],
    ];
    host.innerHTML = '<h3>實際流水（與計價快照分開）</h3><div class="formula-rows">' +
      rows.map(([label, amount]) => '<div><span>' + esc(label) + '</span><strong>' + esc(amount) + '</strong></div>').join("") +
      '</div><p>上述差額不是自動退款授權；取消訂單不會自動建立退款。此面板不改訂單／付款狀態。</p>' +
      s.warnings.map(w => '<p role="status">' + esc(w) + '</p>').join("") +
      '<details><summary>已記錄 ' + data.entries.length + ' 筆流水</summary>' +
      data.entries.map(e => '<p>' + esc(e.occurredAt) + ' ｜ ' + esc(e.ledger) + ' ｜ ' + esc(e.kind) + ' ｜ ' +
        esc(e.amount) + ' ｜ ' + esc(e.method) + '<br>原因：' + esc(e.note) + '<br>識別碼：' + esc(e.requestId) + '</p>').join("") + '</details>' +
      (canEdit ? '<form data-ledger-form class="form-grid two">' +
        '<label>流水<select name="ledger"><option value="payments">客戶付款／退款</option><option value="platform_settlements">平台撥款／退款／調整</option></select></label>' +
        '<label>事件<select name="kind"><option value="receipt">收款</option><option value="refund">退款（填正金額）</option><option value="adjustment">平台調整（可正負）</option></select></label>' +
        '<label>收款途徑<select name="channel"><option value="direct">直接收款</option><option value="platform">經由平台</option></select></label>' +
        '<label>金額<input name="amount" type="number" step="0.0001" required /></label>' +
        '<label>實際發生時間（含時區）<input name="occurredAt" placeholder="2026-09-10T10:30:00+08:00" maxlength="40" required /></label>' +
        '<label>方式<input name="method" maxlength="80" required /></label>' +
        '<label>退款／調整原因（勿填銀行帳號或客戶個資）<input name="note" maxlength="1000" /></label>' +
        '<label><input name="confirmed" type="checkbox" required />已人工核對實際收付款</label>' +
        '<button class="primary-btn" type="submit">記錄流水</button><button type="button" data-check-pending hidden>核對此筆是否已入帳</button><p data-ledger-result role="status"></p></form>' : "");
    const form = host.querySelector("[data-ledger-form]");
    if (!form) return;
    let pendingRequest = null;
    let permanentlyBlocked = false;
    const check = form.querySelector('[data-check-pending]');
    check.addEventListener('click', async () => {
      if (!pendingRequest) return;
      check.disabled = true;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const status = form.querySelector('[data-ledger-result]');
      try {
        const fresh = await requestApi('getOrderLedgerV2', { orderId });
        const recorded = fresh.entries.find(entry => entry.requestId === pendingRequest.requestId);
        if (recorded) {
          const same = ['orderId', 'ledger', 'kind', 'channel'].every(key => recorded[key] === pendingRequest[key])
            && Number(recorded.amount) === Number(pendingRequest.amount)
            && Date.parse(recorded.occurredAt) === Date.parse(pendingRequest.occurredAt)
            && recorded.method === String(pendingRequest.method).trim()
            && recorded.note === String(pendingRequest.note).trim();
          if (same) { render(fresh); return; }
          status.textContent = '識別碼對應內容不同，請交管理者核對；不可當作本筆已成功。識別碼：' + pendingRequest.requestId;
          // Do not permit a conflicting key to be retried or changed silently.
          return;
        }
        status.textContent = '目前讀取未找到此筆，不代表請求一定失敗；仍只能用原識別碼重試。識別碼：' + pendingRequest.requestId;
      } catch {
        status.textContent = '核對失敗，結果仍未確認。請保留原識別碼：' + pendingRequest.requestId;
      }
      check.disabled = false;
      submit.disabled = permanentlyBlocked;
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      if (!pendingRequest) {
        const fields = new FormData(form);
        pendingRequest = {
          orderId, expectedUpdatedAt: data.order.updatedAt, requestId: crypto.randomUUID(),
          ledger: fields.get("ledger"), kind: fields.get("kind"), channel: fields.get("channel"),
          amount: fields.get("amount"), occurredAt: fields.get("occurredAt"),
          method: fields.get("method"), note: fields.get("note"),
        };
      }
      form.querySelectorAll("input, select, button").forEach(el => { el.disabled = true; });
      const status = form.querySelector("[data-ledger-result]");
      status.textContent = "核對並記錄中…";
      try { render(await requestApi("appendOrderLedgerV2", pendingRequest)); }
      catch (error) {
        if (error?.code === "LEDGER_REJECTED") {
          pendingRequest = null;
          form.querySelectorAll("input, select, button").forEach(el => { el.disabled = false; });
          check.hidden = true;
          button.textContent = "記錄流水";
          status.textContent = error.message;
          return;
        }
        if (["LEDGER_SOURCE_CHANGED", "LEDGER_REVIEW_REQUIRED", "LEDGER_DENIED", "LEDGER_KEY_CONFLICT"].includes(error?.code)) {
          permanentlyBlocked = true;
          // A known rejection is not a cash receipt. Keep payload/key visible for review.
          check.hidden = false;
          check.disabled = false;
          status.textContent = error.message + "；識別碼：" + pendingRequest.requestId;
          if (error.code === "LEDGER_SOURCE_CHANGED") {
            const reload = document.createElement("button");
            reload.type = "button"; reload.textContent = "核對最新訂單並重新填寫";
            reload.onclick = async () => {
              reload.disabled = true;
              try { render(await requestApi("getOrderLedgerV2", { orderId })); }
              catch { reload.disabled = false; status.textContent = "最新資料讀取失敗；本次未寫入，請稍後再讀取。"; }
            };
            status.after(reload);
          }
          return;
        }
        // A lost response may hide a successful write: retry ONLY the exact same event/key.
        button.disabled = false;
        button.textContent = "以相同識別碼重試";
        check.hidden = false;
        check.disabled = false;
        status.textContent = "結果未確認。請核對流水，不要重新建同筆事件。識別碼：" + pendingRequest.requestId;
      }
    });
  }
}
