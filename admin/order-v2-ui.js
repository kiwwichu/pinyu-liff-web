import { mountOrderLedger } from "./order-ledger-ui.js";

const STATUS_LABELS = {
  draft: "草稿",
  awaiting_deposit: "未付訂金",
  confirmed: "待執行",
  in_service: "服務中",
  completed: "完成",
  cancelled: "已取消"
};

const PAYMENT_LABELS = {
  unpaid: "未付款",
  partially_paid: "部分付款",
  paid: "已付款",
  partially_refunded: "部分退款",
  refunded: "已退款"
};

const ITEM_LABELS = {
  service: "服務",
  travel_fee: "車馬費",
  home_visit_fee: "家訪費",
  tip: "小費"
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function datesBetween(start, end) {
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end || start}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) throw new Error("日期區間不正確");
  const count = Math.round((last - first) / 86400000) + 1;
  if (count > 366) throw new Error("單張訂單最多可批次加入 366 天");
  return Array.from({ length: count }, (_, index) => new Date(first + index * 86400000).toISOString().slice(0, 10));
}

export function createOrderV2Ui({ state, app, dialog, dialogContent, requestApi, loadBootstrap, navigate, escapeHtml, formatMoney, showToast, openHomeVisit }) {
  const sitterName = id => state.sitters.find(item => Number(item.sitter_id) === Number(id))?.display_name || "未指派";
  const familyName = id => state.families.find(item => item.family_id === id)?.owner_name || id || "未指定家庭";
  const petName = id => state.pets.find(item => item.pet_id === id)?.pet_name || id;

  function orderSort(left, right) {
    const today = isoToday();
    const leftDate = String(left.serviceDate || "9999-12-31").slice(0, 10);
    const rightDate = String(right.serviceDate || "9999-12-31").slice(0, 10);
    const leftClosed = ["completed", "cancelled"].includes(left.orderStatus);
    const rightClosed = ["completed", "cancelled"].includes(right.orderStatus);
    const leftUpcoming = !leftClosed && leftDate >= today;
    const rightUpcoming = !rightClosed && rightDate >= today;
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    if (leftUpcoming && rightUpcoming) return leftDate.localeCompare(rightDate);
    if (leftClosed !== rightClosed) return leftClosed ? 1 : -1;
    return rightDate.localeCompare(leftDate) || String(right.updatedAt).localeCompare(String(left.updatedAt));
  }

  function renderList(renderLegacyOrders) {
    const rows = state.ordersV2
      .filter(order => order.orderStatus !== "completed")
      .sort(orderSort);
    app.innerHTML = `
      <section class="notice-card form-notice"><strong>Step 3.12｜Dev-only</strong><span>新版訂單以家庭為核心關聯，已串毛孩、保姆時段與家訪；不解析 LINE 通知收件人，也不寫入單一 LINE userId。</span></section>
      <section class="panel">
        <div class="section-head order-toolbar-head">
          <div><h2>新版訂單</h2><p>顯示所有未完成訂單（包含取消）；金額由 Worker Calculation Engine 重新計算</p></div>
          <div class="inline-actions"><button class="secondary-btn compact" id="showLegacyOrders" type="button">舊訂單唯讀</button><button class="primary-btn compact" id="createOrderV2" type="button">＋ 新增訂單</button></div>
        </div>
        <div class="toolbar">
          <label class="search-box"><span>⌕</span><input id="orderV2Search" type="search" placeholder="搜尋訂單、家庭、毛孩、保姆" /></label>
          <select id="orderV2Status"><option value="">全部未完成狀態</option>${Object.entries(STATUS_LABELS).filter(([value]) => value !== "completed").map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
          <select id="orderV2Payment"><option value="">全部付款狀態</option>${Object.entries(PAYMENT_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
        </div>
        <div class="result-meta" id="orderV2Meta"></div>
        <div class="order-grid" id="orderV2Results"></div>
      </section>`;
    document.getElementById("createOrderV2").addEventListener("click", () => navigate("create"));
    document.getElementById("showLegacyOrders").addEventListener("click", renderLegacyOrders);
    const search = document.getElementById("orderV2Search");
    const status = document.getElementById("orderV2Status");
    const payment = document.getElementById("orderV2Payment");
    const results = document.getElementById("orderV2Results");
    const meta = document.getElementById("orderV2Meta");
    const refresh = () => {
      const keyword = String(search.value || "").trim().toLocaleLowerCase("zh-TW");
      const filtered = rows.filter(order => {
        const haystack = [order.orderNumber, order.orderId, order.ownerName, order.petName, order.caregiver, order.familyId].join(" ").toLocaleLowerCase("zh-TW");
        return (!keyword || haystack.includes(keyword)) && (!status.value || order.orderStatus === status.value) && (!payment.value || order.paymentStatus === payment.value);
      });
      meta.textContent = `顯示 ${filtered.length} 張，共 ${rows.length} 張未完成新版訂單`;
      results.innerHTML = filtered.length ? filtered.map(order => `
        <article class="order-card demo">
          <button class="card-hit" data-order-v2-id="${escapeHtml(order.orderId)}" type="button" aria-label="查看訂單 ${escapeHtml(order.orderNumber)}"></button>
          <div class="card-top"><div><span class="eyebrow">${escapeHtml(order.orderNumber)}</span><h3>${escapeHtml(order.ownerName || familyName(order.familyId))}｜${escapeHtml(order.petName || "未填毛孩")}</h3></div><div class="tag-stack"><span class="tag demo-tag">V2 DEV</span><span class="tag">${escapeHtml(STATUS_LABELS[order.orderStatus] || order.orderStatus)}</span><span class="tag">${escapeHtml(PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus || "未付款")}</span></div></div>
          <div class="order-facts"><div class="order-fact date-fact"><span>服務日期</span><strong>${escapeHtml(order.serviceDate || "—")}</strong></div><div class="order-fact"><span>保姆</span><strong>${escapeHtml(order.caregiver || "未指派")}</strong></div><div class="order-fact"><span>來源</span><strong>${escapeHtml(order.orderSource || "—")}</strong></div><div class="order-fact"><span>家庭編號</span><strong>${escapeHtml(order.familyId || "—")}</strong></div></div>
          ${state.permissions.canViewMoney ? `<div class="money-row"><div><span>訂金</span><strong>${formatMoney(order.depositAmountDue)}</strong></div><div class="order-money-summary"><span>訂單總額</span><strong>${formatMoney(order.customerTotal)}</strong></div></div>` : ""}
        </article>`).join("") : '<div class="empty">目前沒有符合條件的新版訂單</div>';
      results.querySelectorAll("[data-order-v2-id]").forEach(button => button.addEventListener("click", () => open(button.dataset.orderV2Id)));
    };
    search.addEventListener("input", refresh);
    status.addEventListener("change", refresh);
    payment.addEventListener("change", refresh);
    refresh();
  }

  async function open(orderId) {
    try {
      const data = await requestApi("getOrderV2", { orderId });
      const order = data.order;
      dialogContent.innerHTML = `
        <div class="dialog-heading"><div class="dialog-title-block"><span class="eyebrow">${escapeHtml(order.orderNumber)}</span><h2>${escapeHtml(order.ownerName)}｜${escapeHtml(order.petName)}</h2><div class="dialog-status-line"><span class="tag">${escapeHtml(STATUS_LABELS[order.orderStatus] || order.orderStatus)}</span><span class="tag">${escapeHtml(PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus)}</span></div></div><div class="family-identity"><span>家庭編號</span><strong>${escapeHtml(order.familyId)}</strong><b class="tag demo-tag">V2 DEV</b></div></div>
        <div class="order-detail-layout"><div class="detail-primary"><div class="detail-grid compact-detail-grid"><div><span>服務日期</span><strong>${escapeHtml(order.serviceDate || "—")}</strong></div><div><span>保姆</span><strong>${escapeHtml(order.caregiver || "未指派")}</strong></div><div><span>來源</span><strong>${escapeHtml(order.orderSource || "—")}</strong></div><div><span>計算版本</span><strong>${escapeHtml(order.calculationVersion || "—")}</strong></div></div><section class="service-lines"><h3>服務與費用項目</h3>${data.items.map(item => `<article><div class="service-line-main"><strong>${escapeHtml(ITEM_LABELS[item.itemType] || item.itemType)}｜${escapeHtml(item.itemName)}</strong><span>${escapeHtml(item.serviceDate || "無日期")}｜${escapeHtml(sitterName(item.assignedSitterId))}｜${escapeHtml((item.petIds || []).map(petName).join("、") || "未關聯毛孩")}｜${escapeHtml(item.itemStatus === "cancelled" ? "已取消" : "有效")}</span></div>${state.permissions.canViewMoney ? `<div class="service-line-price"><span>${formatMoney(item.chargedUnitPrice)} × ${item.quantity}</span><b>${formatMoney(item.lineAmount)}</b></div>` : ""}</article>`).join("")}</section>${data.homeVisitIds?.length ? `<section class="service-lines"><h3>相關家訪</h3>${data.homeVisitIds.map(id => `<button class="secondary-btn compact" type="button" data-open-v2-home-visit="${escapeHtml(id)}">開啟家訪 ${escapeHtml(id.slice(0, 8))}…</button>`).join(" ")}</section>` : ""}${order.notes ? `<div class="note-box"><strong>備註</strong><p>${escapeHtml(order.notes)}</p></div>` : ""}</div>
        ${state.permissions.canViewMoney ? `<aside class="detail-sidebar"><section class="calculation-card compact-calculation"><h3>Calculation Engine 快照</h3><div class="formula-rows"><div><span>服務費</span><strong>${formatMoney(order.serviceSubtotal)}</strong></div><div><span>車馬費</span><strong>${formatMoney(order.travelFeeTotal)}</strong></div><div><span>家訪費</span><strong>${formatMoney(order.homeVisitFeeTotal)}</strong></div><div><span>小費</span><strong>${formatMoney(order.tipTotal)}</strong></div><div><span>折扣</span><strong>－${formatMoney(order.discountAmount)}</strong></div><div class="formula-result"><span>客戶總額</span><strong>${formatMoney(order.customerTotal)}</strong></div><div><span>訂金</span><strong>${formatMoney(order.depositAmountDue)}</strong></div><div><span>訂金後尾款</span><strong>${formatMoney(order.balanceAmountDue)}</strong></div><div><span>保姆應得</span><strong>${formatMoney(order.sitterEarningsTotal)}</strong></div><div><span>Pinyu 親自服務</span><strong>${formatMoney(order.ownerEarningsTotal)}</strong></div><div><span>公司收入（平台前）</span><strong>${formatMoney(order.companyEarningsBeforePlatform)}</strong></div></div></section></aside>` : ""}</div>
        ${state.permissions.canEditOrders ? '<div class="dialog-actions"><button class="primary-btn" id="editOrderV2" type="button">編輯新版訂單</button></div>' : ""}`;
      if (state.permissions.canEditOrders) document.getElementById("editOrderV2").addEventListener("click", () => { dialog.close(); state.editingOrderV2 = data; navigate("create"); });
      // Keep internal earnings available without making them the first mobile screen.
      const mobileDetail = matchMedia("(max-width: 900px)").matches;
      const calculation = dialogContent.querySelector(".compact-calculation");
      if (calculation) {
        const internal = document.createElement("details");
        internal.className = "internal-finance-details";
        internal.open = !mobileDetail;
        const summary = document.createElement("summary");
        summary.textContent = "分潤／內部財務";
        internal.append(summary);
        const rows = document.createElement("div");
        rows.className = "formula-rows";
        [...calculation.querySelectorAll(".formula-rows > div")].slice(-3).forEach(row => rows.append(row));
        internal.append(rows);
        calculation.append(internal);
      }
      if (mobileDetail) {
        const layout = dialogContent.querySelector(".order-detail-layout");
        const secondary = [...dialogContent.querySelectorAll(".detail-primary > .service-lines, .detail-primary > .note-box")].slice(1);
        for (const section of secondary.reverse()) layout.after(section);
      }
      dialogContent.querySelectorAll("[data-open-v2-home-visit]").forEach(button => button.addEventListener("click", () => openHomeVisit(button.dataset.openV2HomeVisit)));
      if (!dialog.open) dialog.showModal();
      if (state.permissions.canViewMoney) {
        const ledgerHost = document.createElement("section");
        ledgerHost.className = "calculation-card";
        dialogContent.querySelector(".order-detail-layout").after(ledgerHost);
        mountOrderLedger(ledgerHost, { orderId, canEdit: state.permissions.canEditOrders, requestApi, escapeHtml });
      }
    } catch (error) {
      showToast(error.message || String(error), true);
    }
  }

  function familyOptions(selected) {
    return state.families.map(family => `<option value="${escapeHtml(family.family_id)}" ${family.family_id === selected ? "selected" : ""}>${escapeHtml(family.owner_name)}（${escapeHtml(family.family_id)}）</option>`).join("");
  }

  function petCheckboxes(familyId, selected = []) {
    return state.pets.filter(pet => pet.family_id === familyId).map(pet => `<label><input type="checkbox" name="petIds" value="${escapeHtml(pet.pet_id)}" ${selected.includes(pet.pet_id) ? "checked" : ""} />${escapeHtml(pet.pet_name)}</label>`).join("") || '<span class="privacy-note">此家庭尚無已啟用毛孩</span>';
  }

  function homeVisitCheckboxes(familyId, selected = []) {
    return state.homeVisitSummaries.filter(visit => visit.family_id === familyId).map(visit => {
      const date = visit.scheduled_at ? String(visit.scheduled_at).slice(0, 10) : "日期未定";
      return `<label><input type="checkbox" name="homeVisitIds" value="${escapeHtml(visit.home_visit_id)}" ${selected.includes(visit.home_visit_id) ? "checked" : ""} />${escapeHtml(date)}・${escapeHtml(visit.visit_type === "revisit" ? "再次家訪" : "首次家訪")}</label>`;
    }).join("") || '<span class="privacy-note">此家庭尚無家訪紀錄</span>';
  }

  function sitterOptions(selected) {
    return `<option value="">未指派</option>${state.sitters.filter(sitter => String(sitter.status).toLowerCase() === "active").map(sitter => `<option value="${sitter.sitter_id}" ${Number(sitter.sitter_id) === Number(selected) ? "selected" : ""}>${escapeHtml(sitter.display_name)}</option>`).join("")}`;
  }

  function planOptions(selected) {
    return `<option value="">自訂項目</option>${state.servicePlans.map(plan => `<option value="${escapeHtml(plan.plan_id)}" ${plan.plan_id === selected ? "selected" : ""} data-name="${escapeHtml(plan.plan_name)}" data-duration="${Number(plan.duration_minutes || 0)}" data-price="${Number(plan.price || 0)}">${escapeHtml(plan.service_type)}｜${escapeHtml(plan.plan_name)}</option>`).join("")}`;
  }

  function rowMarkup(item = {}) {
    const itemType = item.itemType || "service";
    const existing = Boolean(item.orderItemId);
    return `<article class="v2-item-row" data-existing="${existing}">
      <input type="hidden" data-field="orderItemId" value="${escapeHtml(item.orderItemId || "")}" />
      <div class="v2-item-head"><strong>${escapeHtml(ITEM_LABELS[itemType] || itemType)}項目</strong><button class="secondary-btn compact" data-remove-v2-item type="button">${existing ? "取消此項" : "移除"}</button></div>
      <div class="form-grid two">
        <label>項目類型<select data-field="itemType"><option value="service" ${itemType === "service" ? "selected" : ""}>服務</option><option value="travel_fee" ${itemType === "travel_fee" ? "selected" : ""}>車馬費</option><option value="home_visit_fee" ${itemType === "home_visit_fee" ? "selected" : ""}>家訪費</option><option value="tip" ${itemType === "tip" ? "selected" : ""}>小費</option></select></label>
        <label>項目狀態<select data-field="itemStatus"><option value="active" ${item.itemStatus !== "cancelled" ? "selected" : ""}>有效</option><option value="cancelled" ${item.itemStatus === "cancelled" ? "selected" : ""}>已取消</option></select></label>
        <label>服務方案<select data-field="servicePlanId">${planOptions(item.servicePlanId)}</select></label>
        <label>項目名稱<input data-field="itemName" required maxlength="200" value="${escapeHtml(item.itemName || ITEM_LABELS[itemType] || "服務")}" /></label>
        <label><span data-date-label>${itemType === "home_visit_fee" ? "獨立家訪日期（必填）" : "服務／費用發生日期"}</span><input data-field="serviceDate" type="date" ${["service", "home_visit_fee"].includes(itemType) ? "required" : ""} value="${escapeHtml(item.serviceDate || (itemType === "service" && !existing ? isoToday() : ""))}" /></label>
        <label>分鐘<input data-field="durationMinutes" type="number" min="0" step="1" value="${Number(item.durationMinutes ?? 30)}" /></label>
        <label>開始時間<input data-field="startTime" type="time" value="${escapeHtml(String(item.startTime || "").slice(0, 5))}" /></label>
        <label>結束時間<input data-field="endTime" type="time" value="${escapeHtml(String(item.endTime || "").slice(0, 5))}" /></label>
        <label>標準單價<input data-field="standardUnitPrice" type="number" min="0" step="0.01" value="${Number(item.standardUnitPrice ?? item.chargedUnitPrice ?? 0)}" /></label>
        <label>實收單價<input data-field="chargedUnitPrice" type="number" min="0" step="0.01" required value="${Number(item.chargedUnitPrice ?? 0)}" /></label>
        <label>數量<input data-field="quantity" type="number" min="0.0001" step="0.0001" required value="${Number(item.quantity ?? 1)}" /></label>
        <label>承接類型<select data-field="providerType"><option value="unassigned" ${!item.providerType || item.providerType === "unassigned" ? "selected" : ""}>未指派</option><option value="owner" ${item.providerType === "owner" ? "selected" : ""}>Pinyu 親自服務</option><option value="sitter" ${item.providerType === "sitter" ? "selected" : ""}>合作保姆</option></select></label>
        <label>指派保姆<select data-field="assignedSitterId">${sitterOptions(item.assignedSitterId)}</select></label>
        <label>保姆分配額<input data-field="sitterAllocationAmount" type="number" min="0" step="0.01" value="${Number(item.sitterAllocationAmount ?? 0)}" /></label>
        <label>公司分配額<input data-field="companyAllocationAmount" type="number" min="0" step="0.01" value="${Number(item.companyAllocationAmount ?? (itemType === "travel_fee" || itemType === "home_visit_fee" ? item.lineAmount || 0 : 0))}" /></label>
        <label>家訪執行模式<select data-field="homeVisitExecutionMode"><option value="">不適用</option><option value="pinyu_self" ${item.homeVisitExecutionMode === "pinyu_self" ? "selected" : ""}>Pinyu 親自</option><option value="sitter_independent" ${item.homeVisitExecutionMode === "sitter_independent" ? "selected" : ""}>保姆獨立</option><option value="training" ${item.homeVisitExecutionMode === "training" ? "selected" : ""}>帶訓</option><option value="custom" ${item.homeVisitExecutionMode === "custom" ? "selected" : ""}>自訂</option></select></label>
        <label>取消原因<input data-field="cancellationReason" maxlength="2000" value="${escapeHtml(item.cancellationReason || "")}" /></label>
        <label class="wide">時間／分配備註<textarea data-field="allocationNote" rows="2">${escapeHtml(item.allocationNote || item.specifiedTimeNote || "")}</textarea></label>
      </div>
    </article>`;
  }

  function renderForm(editing) {
    const order = editing?.order || {};
    const items = editing?.items?.length ? editing.items : [{}];
    const selectedFamily = order.familyId || "";
    const selectedPetIds = order.petIds?.length ? order.petIds : [...new Set(items.flatMap(item => item.petIds || []))];
    const selectedHomeVisitIds = editing?.homeVisitIds || [];
    app.innerHTML = `
      <section class="notice-card form-notice"><strong>Step 3.12｜Dev-only</strong><span>訂單以家庭為核心，服務項目可關聯多隻毛孩、保姆時段與既有家訪；不執行通知、不寫入 LINE userId。</span></section>
      <form id="orderV2Form" class="panel form-panel" data-order-id="${escapeHtml(order.orderId || "")}" data-updated-at="${escapeHtml(order.updatedAt || "")}">
        <div class="section-head"><div><h2>${order.orderId ? `編輯 ${escapeHtml(order.orderNumber)}` : "新增新版訂單"}</h2><p>一個服務日期一個 service item；可用日期區間批次展開。</p></div></div>
        <div class="form-grid two">
          <label>家庭<select name="familyId" required><option value="">請選擇家庭</option>${familyOptions(selectedFamily)}</select></label>
          <fieldset class="wide relation-picker"><legend>本次服務毛孩（可複選）</legend><div id="v2PetChoices">${petCheckboxes(selectedFamily, selectedPetIds)}</div></fieldset>
          <fieldset class="wide relation-picker"><legend>相關家訪（可複選）</legend><div id="v2HomeVisitChoices">${homeVisitCheckboxes(selectedFamily, selectedHomeVisitIds)}</div></fieldset>
          <label>客戶類型<select name="customerType"><option value="new" ${order.customerType !== "returning" ? "selected" : ""}>新客</option><option value="returning" ${order.customerType === "returning" ? "selected" : ""}>常客</option></select></label>
          <label>訂單來源<input name="orderSource" required maxlength="80" value="${escapeHtml(order.orderSource || "LINE")}" /></label>
          <label>訂單狀態<select name="orderStatus">${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${order.orderStatus === value || (!order.orderStatus && value === "draft") ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <label>付款狀態<select name="paymentStatus">${Object.entries(PAYMENT_LABELS).map(([value, label]) => `<option value="${value}" ${order.paymentStatus === value || (!order.paymentStatus && value === "unpaid") ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <label>折扣方式<select name="discountType"><option value="none" ${!order.discountType || order.discountType === "none" ? "selected" : ""}>無折扣</option><option value="rate" ${order.discountType === "rate" ? "selected" : ""}>折扣係數（九折填 0.9）</option><option value="fixed" ${order.discountType === "fixed" ? "selected" : ""}>固定折抵</option></select></label>
          <label>折扣值<input name="discountValue" type="number" min="0" step="0.0001" value="${Number(order.discountValue ?? 0)}" /></label>
          <label>訂金規則<select name="depositRuleType"><option value="default_rate" ${!order.depositRuleType || order.depositRuleType === "default_rate" ? "selected" : ""}>標準 50%</option><option value="custom_rate" ${order.depositRuleType === "custom_rate" ? "selected" : ""}>自訂比例</option><option value="custom_amount" ${order.depositRuleType === "custom_amount" ? "selected" : ""}>自訂金額</option><option value="waived" ${order.depositRuleType === "waived" ? "selected" : ""}>免訂金</option></select></label>
          <label>訂金比例<input name="depositRate" type="number" min="0" max="1" step="0.0001" value="${Number(order.depositRate ?? 0.5)}" /></label>
          <label>自訂訂金<input name="customDepositAmount" type="number" min="0" step="0.01" value="${Number(order.customDepositAmount ?? 0)}" /></label>
          <label>鎖定訂金（留空代表重算）<input name="lockedDepositAmount" type="number" min="0" step="0.01" value="${order.lockedDepositAmount == null ? "" : Number(order.lockedDepositAmount)}" /></label>
          <label>外部平台<input name="platformName" maxlength="100" value="${escapeHtml(order.platformName || "")}" /></label>
          <label>平台單號<input name="platformOrderRef" maxlength="200" value="${escapeHtml(order.platformOrderRef || "")}" /></label>
          <label>平台撥款<select name="platformPayoutStatus"><option value="not_applicable">不適用</option><option value="pending" ${order.platformPayoutStatus === "pending" ? "selected" : ""}>待撥</option><option value="received" ${order.platformPayoutStatus === "received" ? "selected" : ""}>已撥</option></select></label>
          <label>平台實收<input name="platformActualPayout" type="number" min="0" step="0.01" value="${order.platformActualPayout == null ? "" : Number(order.platformActualPayout)}" /></label>
          <label class="wide">整單取消原因<textarea name="cancellationReason" rows="2">${escapeHtml(order.cancellationReason || "")}</textarea></label>
          <label class="wide">內部備註<textarea name="notes" rows="3">${escapeHtml(order.notes || "")}</textarea></label>
        </div>
        <section class="v2-batch-panel"><h3>多日期服務項目</h3><div class="form-grid two"><label>開始日期<input id="v2BatchStart" type="date" value="${isoToday()}" /></label><label>結束日期<input id="v2BatchEnd" type="date" value="${isoToday()}" /></label></div><button class="secondary-btn" id="v2ExpandDates" type="button">依目前最後一個服務項目批次加入</button></section>
        <div class="section-head"><div><h3>服務與費用項目</h3><p>車馬費／家訪費需明確填寫保姆與公司分配；小費 100% 給實際收件保姆。</p></div><div class="inline-actions"><button class="secondary-btn compact" data-add-v2-item="service" type="button">＋服務</button><button class="secondary-btn compact" data-add-v2-item="travel_fee" type="button">＋車馬費</button><button class="secondary-btn compact" data-add-v2-item="home_visit_fee" type="button">＋家訪費</button><button class="secondary-btn compact" data-add-v2-item="tip" type="button">＋小費</button></div></div>
        <div id="orderV2Items" class="v2-items">${items.map(rowMarkup).join("")}</div>
        <section id="orderV2Preview" class="calculation-card"><h3>尚未預覽</h3><p>預覽與儲存都會由 Worker Calculation Engine 重算。</p></section>
        <div class="form-actions"><button class="secondary-btn" id="previewOrderV2" type="button">重新計算預覽</button><button class="primary-btn" type="submit">${order.orderId ? "儲存新版訂單" : "建立新版訂單"}</button></div>
      </form>`;
    const form = document.getElementById("orderV2Form");
    const itemsHost = document.getElementById("orderV2Items");
    form.elements.familyId.addEventListener("change", () => {
      document.getElementById("v2PetChoices").innerHTML = petCheckboxes(form.elements.familyId.value, []);
      document.getElementById("v2HomeVisitChoices").innerHTML = homeVisitCheckboxes(form.elements.familyId.value, []);
    });
    form.querySelectorAll("[data-add-v2-item]").forEach(button => button.addEventListener("click", () => { itemsHost.insertAdjacentHTML("beforeend", rowMarkup({ itemType: button.dataset.addV2Item, itemName: ITEM_LABELS[button.dataset.addV2Item] })); }));
    itemsHost.addEventListener("change", event => {
      const row = event.target.closest(".v2-item-row");
      if (!row) return;
      if (event.target.matches('[data-field="servicePlanId"]')) {
        const option = event.target.selectedOptions[0];
        if (option?.value) {
          row.querySelector('[data-field="itemName"]').value = option.dataset.name || "";
          row.querySelector('[data-field="durationMinutes"]').value = option.dataset.duration || "0";
          row.querySelector('[data-field="standardUnitPrice"]').value = option.dataset.price || "0";
          row.querySelector('[data-field="chargedUnitPrice"]').value = option.dataset.price || "0";
        }
      }
      if (event.target.matches('[data-field="itemType"]')) {
        row.querySelector(".v2-item-head strong").textContent = `${ITEM_LABELS[event.target.value]}項目`;
        const date = row.querySelector('[data-field="serviceDate"]');
        date.required = ["service", "home_visit_fee"].includes(event.target.value);
        row.querySelector('[data-date-label]').textContent = event.target.value === "home_visit_fee" ? "獨立家訪日期（必填）" : "服務／費用發生日期";
        if (event.target.value === "home_visit_fee") date.value = "";
      }
    });
    itemsHost.addEventListener("click", event => {
      const button = event.target.closest("[data-remove-v2-item]");
      if (!button) return;
      const row = button.closest(".v2-item-row");
      if (row.dataset.existing === "true") {
        row.querySelector('[data-field="itemStatus"]').value = "cancelled";
        row.querySelector('[data-field="cancellationReason"]').focus();
        showToast("既有項目不刪除；請填寫取消原因後儲存");
      } else row.remove();
    });
    document.getElementById("v2ExpandDates").addEventListener("click", () => {
      try {
        const sourceRows = [...itemsHost.querySelectorAll(".v2-item-row")].filter(row => row.querySelector('[data-field="itemType"]').value === "service");
        const source = sourceRows.at(-1);
        if (!source) throw new Error("請先新增一個服務項目作為範本");
        const template = readRow(source, 0);
        const dates = datesBetween(document.getElementById("v2BatchStart").value, document.getElementById("v2BatchEnd").value);
        dates.forEach(date => itemsHost.insertAdjacentHTML("beforeend", rowMarkup({ ...template, orderItemId: null, serviceDate: date })));
        showToast(`已加入 ${dates.length} 個逐日服務項目`);
      } catch (error) { showToast(error.message || String(error), true); }
    });
    document.getElementById("previewOrderV2").addEventListener("click", () => preview(form));
    form.addEventListener("submit", submit);
  }

  function rowValue(row, field) {
    return row.querySelector(`[data-field="${field}"]`)?.value ?? "";
  }

  function nullableNumber(value) {
    return String(value).trim() === "" ? null : Number(value);
  }

  function readRow(row, index) {
    const itemType = rowValue(row, "itemType");
    if (itemType === "home_visit_fee" && !rowValue(row, "serviceDate")) throw new Error("請獨立選填家訪日期，不能借用訂單服務日期");
    const unit = Number(rowValue(row, "chargedUnitPrice") || 0);
    const quantity = Number(rowValue(row, "quantity") || 1);
    const assignedSitterId = nullableNumber(rowValue(row, "assignedSitterId"));
    const sitterAllocation = nullableNumber(rowValue(row, "sitterAllocationAmount"));
    const companyAllocation = nullableNumber(rowValue(row, "companyAllocationAmount"));
    return {
      orderItemId: rowValue(row, "orderItemId") || null,
      key: rowValue(row, "orderItemId") || `admin-${Date.now()}-${index}`,
      itemType,
      itemStatus: rowValue(row, "itemStatus"),
      displayOrder: index,
      servicePlanId: rowValue(row, "servicePlanId") || null,
      itemName: rowValue(row, "itemName"),
      durationMinutes: nullableNumber(rowValue(row, "durationMinutes")),
      standardUnitPrice: Number(rowValue(row, "standardUnitPrice") || unit),
      customUnitPrice: null,
      chargedUnitPrice: unit,
      quantity,
      serviceDate: rowValue(row, "serviceDate") || null,
      startTime: rowValue(row, "startTime") || null,
      endTime: rowValue(row, "endTime") || null,
      specifiedTimeNote: rowValue(row, "allocationNote") || null,
      assignedSitterId,
      providerType: rowValue(row, "providerType"),
      commissionRate: null,
      sitterAllocationAmount: itemType === "tip" ? unit * quantity : sitterAllocation,
      companyAllocationAmount: itemType === "tip" ? 0 : companyAllocation,
      homeVisitExecutionMode: rowValue(row, "homeVisitExecutionMode") || null,
      allocationNote: rowValue(row, "allocationNote") || null,
      cancelledAt: null,
      cancellationReason: rowValue(row, "cancellationReason") || null
    };
  }

  function payload(form) {
    const data = new FormData(form);
    const value = key => String(data.get(key) || "").trim();
    const nullable = key => value(key) === "" ? null : Number(value(key));
    const petIds = [...form.querySelectorAll('[name="petIds"]:checked')].map(input => input.value);
    const homeVisitIds = [...form.querySelectorAll('[name="homeVisitIds"]:checked')].map(input => input.value);
    if (!petIds.length) throw new Error("至少選擇一隻本次服務毛孩");
    const items = [...form.querySelectorAll(".v2-item-row")].map(readRow).map(item => ({
      ...item,
      petIds: ["service", "home_visit_fee"].includes(item.itemType) ? petIds : []
    }));
    if (!items.length) throw new Error("至少需要一個服務或費用項目");
    return {
      orderId: form.dataset.orderId || null,
      expectedUpdatedAt: form.dataset.updatedAt || null,
      familyId: value("familyId"),
      petIds,
      homeVisitIds,
      customerType: value("customerType"),
      orderSource: value("orderSource"),
      orderStatus: value("orderStatus"),
      paymentStatus: value("paymentStatus"),
      cancellationReason: value("cancellationReason") || null,
      notes: value("notes") || null,
      discountType: value("discountType"),
      discountValue: Number(value("discountValue") || 0),
      depositRuleType: value("depositRuleType"),
      depositRate: Number(value("depositRate") || 0.5),
      customDepositAmount: Number(value("customDepositAmount") || 0),
      lockedDepositAmount: nullable("lockedDepositAmount"),
      platformName: value("platformName"),
      platformOrderRef: value("platformOrderRef"),
      platformPayoutStatus: value("platformPayoutStatus"),
      platformActualPayout: nullable("platformActualPayout"),
      items
    };
  }

  function showCalculation(calculation) {
    document.getElementById("orderV2Preview").innerHTML = `<h3>Calculation Engine｜${escapeHtml(calculation.calculationVersion)}</h3><div class="formula-rows"><div><span>服務費</span><strong>${formatMoney(calculation.serviceSubtotal)}</strong></div><div><span>車馬費</span><strong>${formatMoney(calculation.travelFeeTotal)}</strong></div><div><span>家訪費</span><strong>${formatMoney(calculation.homeVisitFeeTotal)}</strong></div><div><span>小費</span><strong>${formatMoney(calculation.tipTotal)}</strong></div><div><span>折扣</span><strong>－${formatMoney(calculation.discountAmount)}</strong></div><div class="formula-result"><span>客戶總額</span><strong>${formatMoney(calculation.customerTotal)}</strong></div><div><span>訂金</span><strong>${formatMoney(calculation.depositAmountDue)}</strong></div><div><span>訂金後尾款</span><strong>${formatMoney(calculation.balanceAmountDue)}</strong></div><div><span>合作保姆應得</span><strong>${formatMoney(calculation.sitterEarningsTotal)}</strong></div><div><span>Pinyu 親自服務</span><strong>${formatMoney(calculation.ownerEarningsTotal)}</strong></div><div><span>公司收入（平台前）</span><strong>${formatMoney(calculation.companyEarningsBeforePlatform)}</strong></div></div>${calculation.warnings.length ? `<div class="note-box"><strong>提醒</strong><p>${calculation.warnings.map(escapeHtml).join("<br>")}</p></div>` : ""}`;
  }

  async function preview(form) {
    try {
      const data = await requestApi("previewOrderV2", payload(form));
      showCalculation(data.calculation);
      return data.calculation;
    } catch (error) {
      showToast(error.message || String(error), true);
      throw error;
    }
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    try {
      button.disabled = true;
      button.textContent = "正在驗證並儲存…";
      const request = payload(form);
      const result = await requestApi("saveOrderV2", request);
      showCalculation(result.calculation);
      await loadBootstrap(false);
      state.editingOrderV2 = null;
      state.page = "orders";
      navigate("orders");
      showToast(request.orderId ? "新版訂單已更新" : "新版訂單已建立");
      window.setTimeout(() => open(result.orderId), 100);
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = form.dataset.orderId ? "儲存新版訂單" : "建立新版訂單";
    }
  }

  return { renderList, renderForm, open };
}
