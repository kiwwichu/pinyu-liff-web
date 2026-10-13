import {
  CALENDAR_SUMMARY_PERIODS,
  calculateAvailability,
  minutesToTime,
  timeToMinutes
} from "./availability-core.js";
import { createOrderV2Ui } from "./order-v2-ui.js";
import { mountSitterFinance } from "./sitter-finance-ui.js";
import { setupMobileNavigation } from "./mobile-navigation.js";

(() => {
  "use strict";

  const config = window.ADMIN_CONFIG || {};
  const state = {
    page: "dashboard",
    user: null,
    permissions: {},
    summary: {},
    orders: [],
    ordersV2: [],
    orderItemsScheduleV2: [],
    homeVisitSummaries: [],
    families: [],
    pets: [],
    servicePlans: [],
    servicePresets: [],
    reviews: [],
    sitters: [],
    sitterCommissionRates: [],
    sitterAccessProfiles: [],
    sitterAvailability: [],
    bookingRequests: [],
    sitterScheduleSettings: [],
    sitterRecurringBlocks: [],
    sitterRecurringBlockExceptions: [],
    calendarSyncJobs: [],
    scheduleSitterId: null,
    scheduleMonth: "",
    selectedScheduleDate: "",
    editingRecurringBlockId: null,
    orderCategory: "all",
    editingOrder: null,
    editingOrderV2: null,
    editingServiceSettings: false,
    accessToken: ""
  };

  const CONTRACT_DISCLOSURE_GROUPS = [
    {
      title: "健康與安全告知",
      items: [
        { key: "health_information_truth", text: "我已確認上述健康資訊填寫完整且真實，並了解未如實告知可能產生之風險與責任。" },
        { key: "health_risk_disclosure", text: "飼主須如實提供毛孩健康狀況、年齡、行為特性及其他相關資訊。若毛孩屬於高齡、重大疾病、具傳染性疾病、寄生蟲感染或其他高風險狀況，保姆得要求飼主於服務前完成必要處置（如就醫、隔離、驅蟲等），或視情況婉拒提供服務。若飼主未如實告知，或服務期間發現與原告知不符之高風險情形，保姆得即時中止或調整服務，相關費用不予退還，衍生風險與責任由飼主承擔。" },
        { key: "carrier_ready", text: "飼主須於服務當日提供外出籠或外出包，以備緊急狀況時使用。若飼主未備妥導致延誤送醫，相關後果由飼主承擔。" },
        { key: "nails_trimmed", text: "建議服務前修剪指甲，以降低抓傷風險。若未修剪導致保姆受傷，相關責任由飼主負擔。" },
        { key: "other_animals_disclosed", text: "若住所內另有其他寵物或動物，飼主須事前告知；未列入服務範圍之動物不在照顧義務中。" }
      ]
    },
    {
      title: "回報與餵藥協助",
      items: [
        { key: "private_line_reporting", text: "保姆將使用私人 LINE 作為回報管道，於每次服務後提供毛孩照片、影片及文字紀錄，內容包含餵食與飲水、排泄、行為與情緒，以及異常或突發狀況。如需臨時聯繫、補充資訊或詢問毛孩狀況，請直接使用私人 LINE 與保姆聯繫，以避免訊息延遲或漏接；官方 LINE 不進行照片或影片回傳。" },
        { key: "medicine_scope_and_fee", text: "若需協助餵藥，將酌收＋50 元／次。餵藥服務僅限依醫囑進行之口服餵藥等非醫療性照護行為，不提供皮下注射、肌肉注射、清創等醫療行為。飼主須提供獸醫開立之藥物及完整用藥資訊；保姆僅依飼主及獸醫指示協助，不負藥物療效、適應症或副作用責任。" },
        { key: "medicine_supplies", text: "飼主須於服務前準備餵藥器及毛孩可接受的輔助品（罐頭、肉泥或零食）。若家中未備餵藥器，可由保姆提供一支全新、該毛孩專用的正版 KRUUSE 丹麥 KRUUSE 一體式安全餵藥器，費用為 NT$150／支；如有疑慮可提供生產批號及防偽 QR Code 查證。" },
        { key: "medicine_method", text: "保姆將依毛孩狀況選擇最安全方式（如使用餵藥器、搭配肉泥等）；除非有特殊醫囑，原則上不依飼主個人習慣強制操作。" }
      ]
    },
    {
      title: "付款、取消與變更",
      items: [
        { key: "deposit_policy", text: "訂金為服務總額之 50%，需於下訂時完成付款，以保留服務時段。未完成付款者，視同尚未正式預約，時段將不予保留。" },
        { key: "balance_policy", text: "尾款須於服務結束後 48 小時內完成支付。逾期未付款時，保姆將以訊息提醒；經通知後仍未於 3 日內完成付款者，保姆得依法申請支付命令或採取其他法律途徑追討，衍生之行政、催收及法律程序費用由飼主負擔。" },
        { key: "cancellation_policy", text: "14 天前取消，全額退訂金；5 至 13 天前取消，退回 50% 訂金；5 天內或當天取消，不退訂金。若需更改服務日期，請於原服務日前 5 天前提出，保姆視行程協助調整一次；5 天內提出改期視同取消，改期後再次取消亦依取消規定辦理。" },
        { key: "force_majeure", text: "颱風假期間原則上服務照常進行；如遇保姆突發身體不適、意外或其他不可抗力因素而無法安全出勤，將第一時間聯繫飼主，並協助安排信任的支援保姆，或與飼主討論最合適的調整方式，以確保毛孩照顧不中斷。" }
      ]
    },
    {
      title: "緊急送醫與費用",
      items: [
        { key: "emergency_definition", text: "緊急情況包含但不限於：呼吸困難、呼吸急促或異常喘鳴；意識不清、癱軟、抽搐或癲癇發作；嚴重外傷、持續性出血或明顯疼痛；無法站立或突然失去行動能力；明顯中毒反應、誤食異物且有立即危險；以及其他經保姆合理判斷需立即送醫的狀況。" },
        { key: "emergency_decision_process", text: "送醫後或情況允許時，保姆將儘速聯繫飼主或緊急聯絡人，並依本合約勾選的方式，由緊急聯絡人決定、由保姆依當下情況判斷並即刻安排必要醫療處置，或依雙方事前書面協議處理。" },
        { key: "emergency_authorization", text: "若毛孩於服務期間發生緊急狀況，保姆得基於專業判斷於第一時間先行送醫，不須事前取得飼主或他人同意；保姆得依當下情況選擇適當醫療院所，不以飼主慣用醫院為限；緊急醫療以毛孩生命安全為優先，不以最低費用或既定醫療方式為唯一考量。" },
        { key: "emergency_costs", text: "緊急送醫的醫療費與交通費均採實報實銷。緊急出勤費為 NT$400／30 分鐘，每次至少計收一次；後續陪同候診、等待檢查、領藥或其他等待時間，另收陪伴等待費 NT$200／30 分鐘。晚間或臨時看診可能須前往急診動物醫院，掛號與基本醫療費通常較高，實際依醫院規定；所有必要醫療、交通及支出由飼主負擔，並同意保姆先行墊付或即時處理。" }
      ]
    },
    {
      title: "居家隱私、專業判斷與個資",
      items: [
        { key: "home_privacy", text: "保姆僅於飼主允許的空間進行照護，未經允許不得進入與照顧無關的私人區域；不得觸碰與照顧無關的物品、抽屜、文件、郵件、藥物、錢包或其他私人貴重物品；不得攜帶第三人進入住所，亦不得將服務地址提供給未經授權者。住所如設有監視器，飼主須於家訪時事先告知位置與錄影範圍，浴室、廁所等私密空間不得錄影。" },
        { key: "professional_judgment", text: "保姆將依據每隻毛孩之個性、當下身心狀況及居家環境，提供合適照顧方式與相關建議，包含但不限於飲食安排、互動方式及環境調整；所有建議以毛孩安全與福祉為優先，並於服務過程中進行必要溝通與說明。" },
        { key: "personal_data_use", text: "為履行服務、聯繫、付款處理及必要法律程序，飼主同意提供姓名、聯絡方式、地址、出生年月日及身分證字號等個人資料。資料僅於本服務範圍內使用，不任意提供第三人；但經飼主同意、依法令規定、為完成服務所必要，或為主張及保護法律權利時不在此限。資料於服務關係終止後合理期間保存，無保存必要時刪除或銷毀。" }
      ]
    }
  ];

  const app = document.getElementById("app");
  const dialog = document.getElementById("orderDialog");
  const dialogContent = document.getElementById("dialogContent");
  const pageTitle = document.getElementById("pageTitle");
  const userName = document.getElementById("userName");
  const userAvatar = document.getElementById("userAvatar");
  const toast = document.getElementById("toast");
  const bookingBellCount = document.getElementById("bookingBellCount");
  const mobileNavigation = setupMobileNavigation({ navigate });
  const orderV2Ui = createOrderV2Ui({
    state,
    app,
    dialog,
    dialogContent,
    requestApi,
    loadBootstrap,
    navigate,
    escapeHtml,
    formatMoney,
    showToast,
    openHomeVisit: openHomeVisitEditor
  });

  document.addEventListener("DOMContentLoaded", init);
  document.getElementById("btnRefresh").addEventListener("click", () => loadBootstrap(true));
  document.getElementById("quickCreateOrder").addEventListener("click", () => navigate("create"));
  document.getElementById("bookingBell").addEventListener("click", () => navigate("requests"));
  document.getElementById("userProfileButton").addEventListener("click", () => navigate("profile"));
  document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialogContent.replaceChildren());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.page));
  });

  async function init() {
    try {
      if (!config.LIFF_ID || !config.API_URL) throw new Error("測試後台尚未設定完成");
      await liff.init({ liffId: config.LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      state.accessToken = liff.getAccessToken() || "";
      if (!state.accessToken) throw new Error("無法取得 LINE 登入憑證");
      const portalRequest = () => fetch(config.PORTAL_API || "/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: state.accessToken })
      });
      let portalResponse;
      try {
        portalResponse = await portalRequest();
      } catch {
        await waitFor(450);
        portalResponse = await portalRequest();
      }
      if (!portalResponse.ok && portalResponse.status >= 500) {
        await waitFor(450);
        portalResponse = await portalRequest();
      }
      const portal = await portalResponse.json().catch(() => null);
      if (!portalResponse.ok || !portal?.success) throw new Error(portal?.message || "無法判斷登入身分");
      if (!['OWNER', 'ADMIN'].includes(portal.role)) {
        window.location.replace(portal.redirectTo || "/client-preview/");
        return;
      }
      await loadBootstrap(false);
    } catch (error) {
      showError(error);
    }
  }

  async function requestApi(operation, payload = {}, canRetry = true) {
    try {
      const response = await fetch(config.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: state.accessToken, operation, payload })
      });
      if (response.ok && operation === 'downloadFinanceXlsxV2' && response.headers.get('content-type')?.includes('spreadsheetml.sheet')) return {success:true,blob:await response.blob()};
      const data = await response.json().catch(() => ({ success: false, message: "伺服器回應格式錯誤" }));
      if (!response.ok || !data.success) {
        if (canRetry && operation === "bootstrap" && response.status >= 500) {
          await waitFor(500);
          return requestApi(operation, payload, false);
        }
        const failure = new Error(data.message || `操作失敗（HTTP ${response.status}）`);
        failure.code = data.code;
        throw failure;
      }
      return data;
    } catch (error) {
      if (canRetry && operation === "bootstrap") {
        await waitFor(500);
        return requestApi(operation, payload, false);
      }
      throw error;
    }
  }

  function waitFor(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  let bootstrapSequence = 0;

  async function loadBootstrap(showLoading) {
    const sequence = ++bootstrapSequence;
    if (showLoading) showState("正在重新整理 Supabase 資料…");
    const data = await requestApi("bootstrap");
    if (sequence !== bootstrapSequence) return;
    state.user = data.user;
    state.permissions = data.permissions || {};
    mobileNavigation.update(state.user, state.permissions);
    state.summary = data.summary || {};
    state.orders = data.orders || [];
    state.ordersV2 = data.ordersV2 || [];
    state.orderItemsScheduleV2 = data.orderItemsScheduleV2 || [];
    state.homeVisitSummaries = data.homeVisitSummaries || [];
    state.families = data.families || [];
    state.pets = data.pets || [];
    state.servicePlans = data.servicePlans || [];
    state.servicePresets = data.servicePresets || [];
    state.reviews = data.reviews || [];
    state.sitters = data.sitters || [];
    state.sitterCommissionRates = data.sitterCommissionRates || [];
    state.sitterAccessProfiles = data.sitterAccessProfiles || [];
    state.sitterAvailability = data.sitterAvailability || [];
    state.bookingRequests = data.bookingRequests || [];
    state.sitterScheduleSettings = data.sitterScheduleSettings || [];
    state.sitterRecurringBlocks = data.sitterRecurringBlocks || [];
    state.sitterRecurringBlockExceptions = data.sitterRecurringBlockExceptions || [];
    state.calendarSyncJobs = data.calendarSyncJobs || [];
    const newRequestCount = state.bookingRequests.filter(request => request.request_status === "new").length;
    bookingBellCount.textContent = String(newRequestCount);
    bookingBellCount.hidden = newRequestCount === 0;
    userName.textContent = state.user ? `${state.user.displayName}｜${state.user.role}` : "";
    userAvatar.textContent = state.user?.displayName?.slice(0, 1).toUpperCase() || "P";
    renderCurrentPage();
  }

  function navigate(page) {
    document.body.classList.remove("review-capture-mode");
    state.page = page;
    if (page !== "create") state.editingOrder = null;
    if (page !== "create") state.editingOrderV2 = null;
    if (page !== "services") state.editingServiceSettings = false;
    document.querySelectorAll("[data-page]").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });
    renderCurrentPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCurrentPage() {
    const titles = {
      dashboard: "概覽",
      orders: "訂單",
      create: state.editingOrderV2 ? "編輯新版訂單" : "新增新版訂單",
      families: "家庭與毛孩",
      sitters: "保姆與排班",
      reviews: "服務評價",
      finance: "財務",
      profile: "我的資料",
      services: "服務選單設定",
      requests: "預約需求"
    };
    pageTitle.textContent = titles[state.page] || "管理後台";
    if (state.page === "dashboard") renderDashboard();
    else if (state.page === "orders") orderV2Ui.renderList(renderLegacyOrders);
    else if (state.page === "create") orderV2Ui.renderForm(state.editingOrderV2);
    else if (state.page === "families") renderFamilyManager();
    else if (state.page === "sitters") renderSitterManagement();
    else if (state.page === "reviews") renderReviews();
    else if (state.page === "finance") mountSitterFinance(app, { orders: state.ordersV2, canView: state.permissions.canViewMoney, canEdit: state.permissions.canEditOrders, canDryRun: state.permissions.canDryRunNotifications, requestApi, escapeHtml });
    else if (state.page === "profile") renderProfile();
    else if (state.page === "requests") renderBookingRequests();
    else renderServiceSettings();
  }

  function renderBookingRequests() {
    const statusLabels = { new: "新需求", reviewing: "評估中", approved: "可承接", rejected: "暫不承接", converted: "已轉訂單" };
    const rows = [...state.bookingRequests].sort((left, right) => {
      const priority = { new: 0, reviewing: 1, approved: 2, converted: 3, rejected: 4 };
      const difference = (priority[left.request_status] ?? 9) - (priority[right.request_status] ?? 9);
      return difference || new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
    app.innerHTML = `
      <section class="notice-card request-notice"><strong>預約頁送出的需求都在這裡</strong><span>鈴鐺數字只計算「尚未查看」的新需求。這些是承接評估，還不是正式訂單；確認後再建立家庭與訂單。</span></section>
      <section class="panel">
        <div class="section-head"><div><h2>預約需求</h2><p>最新、尚未處理的排最前面</p></div><span>${rows.length} 筆</span></div>
        <div class="booking-request-list">
          ${rows.length ? rows.map(request => {
            const periods = Array.isArray(request.service_periods) ? request.service_periods : [];
            const petSummary = [Number(request.cat_count) ? `貓 ${request.cat_count}` : "", Number(request.dog_count) ? `狗 ${request.dog_count}` : "", request.other_pets || ""].filter(Boolean).join("・");
            return `<article class="booking-request-card ${escapeHtml(request.request_status)}">
              <header><div><span>${escapeHtml(statusLabels[request.request_status] || request.request_status)}</span><h3>${escapeHtml(request.request_number)}</h3></div><time>${escapeHtml(formatDateTime(request.created_at))}</time></header>
              <div class="request-facts"><span><b>服務日期</b>${escapeHtml(request.service_start_date)}${request.service_end_date !== request.service_start_date ? ` ～ ${escapeHtml(request.service_end_date)}` : ""}</span><span><b>毛孩</b>${escapeHtml(petSummary || "未填")}</span><span><b>地區</b>${escapeHtml(request.district)}・約 ${escapeHtml(request.distance_km)} km</span><span><b>捷運</b>${escapeHtml(request.nearest_mrt)}・10 分鐘內${request.near_mrt ? "可到" : "不可到"}</span></div>
              <div class="request-service-tags">${periods.map(period => `<span>${escapeHtml(period.serviceType)}・${escapeHtml(period.duration === "custom" ? "自訂時間" : `${period.duration} 分鐘`)} × ${escapeHtml(period.quantity)}</span>`).join("")}</div>
              <p class="request-care-needs">${escapeHtml(request.care_needs)}</p>
              ${request.location_note ? `<p class="request-location-note">交通補充：${escapeHtml(request.location_note)}</p>` : ""}
              <footer>
                ${request.request_status === "new" ? `<button type="button" data-request-status="reviewing" data-request-id="${escapeHtml(request.request_id)}">開始評估</button>` : ""}
                ${["new", "reviewing"].includes(request.request_status) ? `<button class="approve" type="button" data-request-status="approved" data-request-id="${escapeHtml(request.request_id)}">可承接</button><button type="button" data-request-status="rejected" data-request-id="${escapeHtml(request.request_id)}">暫不承接</button>` : ""}
                ${request.request_status === "approved" ? `<button class="approve" type="button" data-open-create-from-request="${escapeHtml(request.request_id)}">建立正式訂單</button>` : ""}
              </footer>
            </article>`;
          }).join("") : '<div class="empty">目前還沒有從預約頁送出的需求</div>'}
        </div>
      </section>`;
    app.querySelectorAll("[data-request-status]").forEach(button => button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await requestApi("updateBookingRequestStatus", { requestId: button.dataset.requestId, requestStatus: button.dataset.requestStatus });
        await loadBootstrap(false);
        showToast("預約需求狀態已更新");
      } catch (error) {
        button.disabled = false;
        showToast(error.message || String(error), true);
      }
    }));
    app.querySelectorAll("[data-open-create-from-request]").forEach(button => button.addEventListener("click", () => {
      showToast("這筆需求已通過承接評估；請選擇或新增家庭後建立訂單");
      navigate("create");
    }));
  }

  function renderDashboard() {
    const recent = getDemandOrders().filter(isWithinRecentServiceRange).slice(0, 6);
    const notificationReminders = getDueNotificationReminders();
    app.innerHTML = `
      <section class="notice-card">
        <strong>這是安全測試版</strong>
        <span>可查看已搬到 Supabase 的資料；新增內容會標示為 DEMO，不會通知客戶。</span>
      </section>
      ${notificationReminders.length ? `<section class="notification-reminder"><div><strong>今天有 ${notificationReminders.length} 張需求單的通知尚未處理</strong><span>${notificationReminders.map(item => `${escapeHtml(item.demandId)}：${escapeHtml(item.label)}`).join("　")}</span></div><button id="reviewNotificationOrders" type="button">查看訂單</button></section>` : ""}
      <section class="summary-grid">
        ${summaryCard(state.summary.newBookingRequests || 0, "新預約需求", "requests")}
        ${summaryCard(state.summary.currentOrders || 0, "進行中需求單", "orders")}
        ${summaryCard(state.summary.demoOrders || 0, "測試訂單", "orders")}
        ${summaryCard(state.summary.serviceReviews || 0, "服務評價", "reviews")}
        ${summaryCard(notificationReminders.length, "今天待處理通知")}
        ${state.permissions.canViewMoney ? summaryCard(formatMoney(state.summary.monthlyNetIncome || 0), "本月淨收入", "profile", "income") : ""}
      </section>
      <section class="panel">
        <div class="section-head">
        <div><h2>近期服務需求單</h2><p>同一個需求單號的不同服務會合併顯示</p></div>
          <button class="text-btn" id="viewAllOrders" type="button">查看全部</button>
        </div>
        <div class="order-grid" id="recentOrders"></div>
      </section>
    `;
    document.getElementById("viewAllOrders").addEventListener("click", () => navigate("orders"));
    document.getElementById("reviewNotificationOrders")?.addEventListener("click", () => navigate("orders"));
    app.querySelectorAll("[data-open-page]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.openPage));
    });
    renderDemandCards(document.getElementById("recentOrders"), recent);
  }

  function getDueNotificationReminders() {
    const today = startOfToday();
    const yesterday = today - 24 * 60 * 60 * 1000;
    return getDemandOrders().flatMap(demand => {
      const pendingLine = demand.lines.find(line => {
        if (line.isDemo) return false;
        const serviceTimestamps = extractServiceTimestamps(line.serviceDate).sort((left, right) => left - right);
        const isExplicitDate = serviceTimestamps.some(timestamp => timestamp === today || timestamp === yesterday);
        const isDateRange = String(line.serviceDate || "").includes("～") && serviceTimestamps.length >= 2;
        const isInsideRange = isDateRange && [today, yesterday].some(timestamp =>
          timestamp >= serviceTimestamps[0] && timestamp <= serviceTimestamps[serviceTimestamps.length - 1]
        );
        const isDueDate = isExplicitDate || isInsideRange;
        const command = String(line.notificationCommand || "").trim();
        const stateLabel = String(line.notificationState || "").trim();
        return isDueDate && (Boolean(command) || stateLabel.startsWith("⚠️"));
      });
      if (!pendingLine) return [];
      const label = String(pendingLine.notificationCommand || pendingLine.notificationState || "服務通知待確認")
        .replace(/^⚠️\s*/, "")
        .trim();
      return [{ demandId: demand.demandId, label: label || "服務通知待確認" }];
    });
  }

  function summaryCard(value, label, page, className = "") {
    if (page) return `<button class="summary-card ${className}" data-open-page="${page}" type="button"><strong>${value}</strong><span>${label}</span></button>`;
    return `<article class="summary-card ${className}"><strong>${value}</strong><span>${label}</span></article>`;
  }

  function renderProfile() {
    const displayName = state.user?.displayName || "Pinyu";
    const role = state.user?.role || "管理員";
    app.innerHTML = `
      <section class="profile-hero panel">
        ${state.permissions.canViewMoney ? '<button id="openFinance" type="button" class="secondary-btn">財務／保母結算</button>' : ''}
        <div class="profile-avatar">${escapeHtml(displayName.slice(0, 1).toUpperCase())}</div>
        <div><span class="eyebrow">登入中的管理員</span><h2>${escapeHtml(displayName)}</h2><p>${escapeHtml(role)}｜收入依服務開始日期歸入本月</p></div>
      </section>
      ${state.permissions.canViewMoney ? `
        <section class="income-grid">
          <button class="income-card completed active" data-income-scope="completed" type="button">
            <span>目前淨收入</span><strong>${formatMoney(state.summary.monthlyCompletedNetIncome || 0)}</strong><small>這個月已完成的需求單</small>
          </button>
          <button class="income-card primary" data-income-scope="month" type="button">
            <span>本月淨收入</span><strong>${formatMoney(state.summary.monthlyNetIncome || 0)}</strong><small>這個月全部需求單，包含尚未完成</small>
          </button>
        </section>
        <section class="panel income-details-panel" id="incomeDetails"></section>
        <section class="panel calculation-policy">
          <div class="section-head"><div><h2>淨收入算法</h2><p>每筆訂單都會留下來源、承接者與抽成比例，日後可追查，不用靠記憶。</p></div></div>
          <div class="policy-grid">
            <article><strong>你本人服務</strong><span>淨收入＝折扣後總額－毛小愛／Petbacker 等外部平台費</span></article>
            <article><strong>其他保姆＋有抽成</strong><span>淨收入＝服務費抽成－給客人的折扣</span></article>
            <article><strong>其他保姆＋不抽成</strong><span>平台淨收入＝0；車馬費與小費歸保姆</span></article>
          </div>
        </section>
      ` : '<section class="panel empty">此帳號沒有查看收入的權限</section>'}
    `;
    document.getElementById("openFinance")?.addEventListener("click", () => navigate("finance"));
    if (state.permissions.canViewMoney) {
      const renderScope = scope => {
        app.querySelectorAll("[data-income-scope]").forEach(button => {
          button.classList.toggle("active", button.dataset.incomeScope === scope);
        });
        renderIncomeDetails(document.getElementById("incomeDetails"), scope);
      };
      app.querySelectorAll("[data-income-scope]").forEach(button => {
        button.addEventListener("click", () => {
          renderScope(button.dataset.incomeScope);
          document.getElementById("incomeDetails").scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      renderScope("completed");
    }
  }

  function renderIncomeDetails(container, scope) {
    const entries = getMonthlyIncomeEntries(scope);
    const ownEntries = entries.filter(entry => entry.category === "self");
    const scopedCommissionEntries = entries.filter(entry => entry.category !== "self");
    const commissionEntries = scope === "completed"
      ? getMonthlyIncomeEntries("month").filter(entry => entry.category !== "self")
      : scopedCommissionEntries;
    const includedCommissionDemandIds = new Set(scopedCommissionEntries.map(entry => entry.demand.demandId));
    const displayedCommissionEntries = commissionEntries.map(entry => ({
      ...entry,
      excludedFromScope: scope === "completed" && !includedCommissionDemandIds.has(entry.demand.demandId)
    }));
    const scopeLabel = scope === "completed" ? "目前淨收入明細" : "本月淨收入明細";
    container.innerHTML = `
      <div class="section-head income-detail-heading">
        <div><span class="eyebrow">${escapeHtml(scopeLabel)}</span><h2>收入分成兩大類</h2><p>${scope === "completed" ? "只列出本月已完成的服務。" : "列出服務開始日在本月的全部需求單。"}</p></div>
        ${state.summary.unconfiguredCommissionDemandCount > 0 ? `<span class="income-warning">${state.summary.unconfiguredCommissionDemandCount} 筆抽成比例待設定</span>` : ""}
      </div>
      <div class="income-detail-grid">
        ${incomeGroup("我自己服務", "你本人下去照顧毛孩所得的收入", ownEntries, "self")}
        ${incomeGroup(
          "其他保姆抽成",
          scope === "completed" ? "顯示本月所有保姆訂單；未完成的暫不計入目前淨收入" : "你轉交給其他保姆後的抽成收入",
          displayedCommissionEntries,
          "commission",
          scopedCommissionEntries
        )}
      </div>
    `;
    container.querySelectorAll("[data-income-demand]").forEach(button => {
      button.addEventListener("click", () => openDemand(button.dataset.incomeDemand));
    });
  }

  function incomeGroup(title, description, entries, type, totalEntries = entries) {
    const calculatedTotal = totalEntries.reduce((sum, entry) => entry.pending ? sum : sum + entry.netIncome, 0);
    return `
      <section class="income-group ${type}">
        <header><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div><strong>${formatMoney(calculatedTotal)}</strong></header>
        <div class="income-order-list">
          ${entries.length ? entries.map(incomeOrderCard).join("") : '<div class="empty compact-empty">這個範圍目前沒有資料</div>'}
        </div>
      </section>
    `;
  }

  function incomeOrderCard(entry) {
    const demand = entry.demand;
    const isCommission = entry.category === "commission";
    if (!isCommission) return selfIncomeOrderCard(entry);
    return `
      <button class="income-order-card self-income-order-card commission-income-order-card" data-income-demand="${escapeHtml(demand.demandId)}" type="button">
        <div class="income-order-main">
          <span class="eyebrow">需求單 ${escapeHtml(demand.demandId)}</span>
          <strong>${escapeHtml(entry.caregivers.join("、") || "未指派保姆")}｜${escapeHtml(demand.owner || "未填飼主")}・${escapeHtml(demand.pets.join("、") || "未填毛孩")}</strong>
          <small>${escapeHtml(entry.serviceDates.join("、") || "未填服務日期")}｜${escapeHtml(entry.orderSources.join("、") || "來源未設定")}</small>
          <div class="compact-income-tags">${entry.statuses.length ? entry.statuses.map(statusTag).join("") : statusTag("未填狀態")}</div>
          ${entry.excludedFromScope ? '<small class="excluded-income-text">尚未完成，暫不計入目前淨收入</small>' : ""}
        </div>
        <div class="income-order-meta commission-order-meta simple-commission-meta">
          <div><span>訂單總額</span><b>${formatMoney(entry.orderTotal)}</b></div>
          <div><span>本單淨收入</span><b class="${entry.pending ? "pending-income" : ""}">${entry.pending ? "待設定" : formatMoney(entry.netIncome)}</b></div>
        </div>
      </button>
    `;
  }

  function selfIncomeOrderCard(entry) {
    const demand = entry.demand;
    return `
      <button class="income-order-card self-income-order-card" data-income-demand="${escapeHtml(demand.demandId)}" type="button">
        <div class="income-order-main">
          <span class="eyebrow">需求單 ${escapeHtml(demand.demandId)}</span>
          <strong>${escapeHtml(demand.owner || "未填飼主")}・${escapeHtml(demand.pets.join("、") || "未填毛孩")}</strong>
          <small>${escapeHtml(entry.serviceDates.join("、") || "未填服務日期")}｜${escapeHtml(entry.orderSources.join("、") || "來源未設定")}</small>
        </div>
        <div class="income-order-meta">
          <span>本單淨收入</span>
          <b class="${entry.pending ? "pending-income" : ""}">${entry.pending ? "待計算" : formatMoney(entry.netIncome)}</b>
          <small>點擊查看需求單</small>
        </div>
      </button>
    `;
  }

  function renderReviews() {
    const average = state.reviews.length
      ? state.reviews.reduce((sum, review) => sum + Number(review.overall_rating || 0), 0) / state.reviews.length
      : 0;
    app.innerHTML = `
      <section class="panel">
        <div class="section-head review-heading">
          <div><h2>服務評價</h2><p>唯讀檢視，不會公開或修改客戶填寫的內容</p></div>
          <div class="review-average"><strong>${average ? average.toFixed(1) : "—"}</strong><span>${ratingStars(average)}｜${state.reviews.length} 則</span></div>
        </div>
        <div class="review-mode-tabs" role="tablist" aria-label="評價顯示方式">
          <button class="active" data-review-mode="private" type="button">完整後台</button>
          <button data-review-mode="share" type="button">截圖分享版</button>
        </div>
        <div id="privateReviewView">
          <div class="toolbar review-toolbar">
            <label class="search-box"><span>⌕</span><input id="reviewSearch" type="search" placeholder="搜尋家庭、飼主、訂單或評語" /></label>
            <select id="ratingFilter" aria-label="評分篩選"><option value="">全部星等</option>${[5,4,3,2,1].map(value => `<option value="${value}">${value} 星</option>`).join("")}</select>
          </div>
          <div class="result-meta" id="reviewMeta"></div>
          <div class="review-list" id="reviewList"></div>
        </div>
        <div id="shareReviewView" hidden>
          <div class="share-review-tools">
            <label>選擇要截圖的匿名評價<select id="shareReviewSelect"></select></label>
            <button class="primary-btn compact" id="captureReviewButton" type="button">進入乾淨截圖模式</button>
          </div>
          <p class="privacy-note">分享版不顯示飼主、家庭編號、訂單編號、LINE、聯絡方式、日期或行程，只列出已同意匿名公開的評價。</p>
          <div id="shareReviewPreview"></div>
        </div>
      </section>
    `;
    const search = document.getElementById("reviewSearch");
    const rating = document.getElementById("ratingFilter");
    const list = document.getElementById("reviewList");
    const meta = document.getElementById("reviewMeta");
    const privateView = document.getElementById("privateReviewView");
    const shareView = document.getElementById("shareReviewView");
    const shareSelect = document.getElementById("shareReviewSelect");
    const sharePreview = document.getElementById("shareReviewPreview");
    const shareableReviews = state.reviews.filter(review => review.allow_anonymous_publication === true);
    shareSelect.innerHTML = shareableReviews.length
      ? shareableReviews.map((review, index) => `<option value="${escapeHtml(review.review_id)}">匿名評價 ${index + 1}｜${Number(review.overall_rating || 0).toFixed(1)} 星</option>`).join("")
      : '<option value="">目前沒有已同意匿名公開的評價</option>';
    const refresh = () => {
      const keyword = normalize(search.value);
      const rows = state.reviews.filter(review => {
        const family = state.families.find(item => item.family_id === review.family_id);
        const haystack = normalize([review.family_id, family?.owner_name, review.legacy_order_id, review.public_name, review.feedback].join(" "));
        return (!keyword || haystack.includes(keyword)) && (!rating.value || Math.round(Number(review.overall_rating)) === Number(rating.value));
      });
      meta.textContent = `顯示 ${rows.length} 則評價`;
      if (!rows.length) {
        list.innerHTML = '<div class="empty">目前沒有符合條件的評價</div>';
        return;
      }
      list.innerHTML = rows.map(review => {
        const family = state.families.find(item => item.family_id === review.family_id);
        const owner = family?.owner_name || review.public_name || "未填飼主";
        return `<article class="review-card">
          <div class="review-card-head"><div><span class="eyebrow">${escapeHtml(review.legacy_order_id || "未連結訂單")}</span><h3>${escapeHtml(owner)}｜${escapeHtml(review.family_id || "未填家庭")}</h3></div><div class="review-score"><strong>${Number(review.overall_rating || 0).toFixed(1)}</strong><span>${ratingStars(review.overall_rating)}</span></div></div>
          <p class="review-feedback">${escapeHtml(review.feedback || "客戶未留下文字評語")}</p>
          <div class="review-metrics">${reviewMetric("回報清楚", review.report_clarity)}${reviewMetric("照顧品質", review.care_quality)}${reviewMetric("毛孩自在", review.pet_comfort)}${reviewMetric("準時", review.punctuality)}${reviewMetric("溝通", review.communication)}</div>
          <footer><span>${escapeHtml(formatReviewDate(review.submitted_at || review.last_modified_at))}</span><span>${review.allow_anonymous_publication ? "允許匿名公開" : "僅後台查看"}</span></footer>
        </article>`;
      }).join("");
    };
    search.addEventListener("input", refresh);
    rating.addEventListener("change", refresh);
    const renderSharePreview = () => {
      const review = shareableReviews.find(item => String(item.review_id) === shareSelect.value);
      if (!review) {
        sharePreview.innerHTML = '<div class="empty">沒有可以製作分享圖的評價</div>';
        return;
      }
      sharePreview.innerHTML = `<article class="share-review-card">
        <header><div class="share-brand-mark">P</div><div><strong>Pinyu 寵物保姆</strong><span>家長匿名服務評價</span></div></header>
        <div class="share-rating"><strong>${Number(review.overall_rating || 0).toFixed(1)}</strong>${ratingStars(review.overall_rating)}</div>
        <blockquote>${escapeHtml(review.feedback || "家長留下了星等評價")}</blockquote>
        <div class="review-metrics">${reviewMetric("回報清楚", review.report_clarity)}${reviewMetric("照顧品質", review.care_quality)}${reviewMetric("毛孩自在", review.pet_comfort)}${reviewMetric("準時", review.punctuality)}${reviewMetric("溝通", review.communication)}</div>
        <footer><span>真實服務評價・匿名顯示</span><b>pinyupets.com</b></footer>
      </article>`;
    };
    document.querySelectorAll("[data-review-mode]").forEach(button => {
      button.addEventListener("click", () => {
        const isShare = button.dataset.reviewMode === "share";
        document.querySelectorAll("[data-review-mode]").forEach(item => item.classList.toggle("active", item === button));
        privateView.hidden = isShare;
        shareView.hidden = !isShare;
        if (isShare) renderSharePreview();
      });
    });
    shareSelect.addEventListener("change", renderSharePreview);
    document.getElementById("captureReviewButton").addEventListener("click", event => {
      const active = document.body.classList.toggle("review-capture-mode");
      event.currentTarget.textContent = active ? "離開截圖模式" : "進入乾淨截圖模式";
      if (active) sharePreview.scrollIntoView({ block: "start" });
    });
    refresh();
  }

  function reviewMetric(label, value) {
    if (value == null || String(value).trim() === "") return "";
    const normalized = normalize(value);
    if (["false", "否", "未勾選", "0"].includes(normalized)) return "";
    if (["true", "是", "已勾選"].includes(normalized)) {
      return `<span><b>${escapeHtml(label)}</b>已勾選</span>`;
    }
    const score = Number(value);
    if (!Number.isFinite(score) || score <= 0) return "";
    return `<span><b>${escapeHtml(label)}</b>${score.toFixed(0)} / 5</span>`;
  }

  function ratingStars(value) {
    const rounded = Math.max(0, Math.min(5, Math.round(Number(value || 0))));
    return `<span class="stars" aria-label="${rounded} 星">${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}</span>`;
  }

  function formatReviewDate(value) {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) ? new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp)) : "未填日期";
  }

  function renderLegacyOrders() {
    const demands = getDemandOrders();
    const categoryMatch = (demand, category) => {
      if (demand.lines.every(line => isCompletedStatus(line.status))) return false;
      if (category === "unpaid") {
        const isStillOpen = demand.lines.some(line => !isClosedStatus(line.status));
        const hasPaymentGap = Number(demand.unpaidBalance || 0) > 0.01;
        return isStillOpen && hasPaymentGap;
      }
      if (category === "notification") {
        return demand.lines.some(line => Boolean(String(line.notificationCommand || "").trim()) || String(line.notificationState || "").trim().startsWith("⚠️"));
      }
      if (category === "execution") return demand.lines.some(line => !isClosedStatus(line.status));
      if (category === "cancelled") return demand.lines.every(line => normalize(line.status).includes("取消"));
      return true;
    };
    const categoryCount = category => demands.filter(demand => categoryMatch(demand, category)).length;
    app.innerHTML = `
      <section class="panel">
        <div class="section-head order-toolbar-head">
          <div><h2>舊版訂單資料</h2><p>顯示所有未完成需求單（包含取消）；本區唯讀</p></div>
          <button class="primary-btn compact" id="createFromOrders" type="button">＋ 新增新版訂單</button>
        </div>
        <div class="order-category-tabs" role="tablist" aria-label="訂單快速分類">
          <button class="active" data-order-category="all" type="button">全部未完成 <span>（${categoryCount("all")}）</span></button>
          <button data-order-category="execution" type="button">待執行 <span>（${categoryCount("execution")}）</span></button>
          <button data-order-category="notification" type="button">待發送通知 <span>（${categoryCount("notification")}）</span></button>
          <button data-order-category="unpaid" type="button">未付錢 <span>（${categoryCount("unpaid")}）</span></button>
          <button data-order-category="cancelled" type="button">取消 <span>（${categoryCount("cancelled")}）</span></button>
        </div>
        <div class="toolbar">
          <label class="search-box"><span>⌕</span><input id="orderSearch" type="search" placeholder="搜尋訂單編號、飼主、毛孩、服務" /></label>
          <select id="statusFilter" aria-label="訂單狀態">
            <option value="">全部狀態</option>
            ${[...new Set(state.orders.map(order => order.status).filter(status => status && !isCompletedStatus(status)))].map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("")}
          </select>
          <select id="dateFilter" aria-label="服務日期範圍">
            <option value="recent">服務日期前後三個月</option>
            <option value="all">全部歷史資料</option>
          </select>
          <label class="checkbox"><input id="demoOnly" type="checkbox" />只看測試訂單</label>
        </div>
        <div class="result-meta" id="resultMeta"></div>
        <div class="order-grid" id="orderResults"></div>
      </section>
    `;

    document.getElementById("createFromOrders").addEventListener("click", () => navigate("create"));
    const search = document.getElementById("orderSearch");
    const status = document.getElementById("statusFilter");
    const dateFilter = document.getElementById("dateFilter");
    const demoOnly = document.getElementById("demoOnly");
    const results = document.getElementById("orderResults");
    const resultMeta = document.getElementById("resultMeta");

    const matchesCategory = demand => categoryMatch(demand, state.orderCategory);

    const refresh = () => {
      const keyword = normalize(search.value);
      const filtered = demands.filter(demand => {
        const haystack = normalize([
          demand.demandId,
          demand.owner,
          demand.pets.join(" "),
          demand.lines.flatMap(line => [line.serviceType, line.planName, line.caregiver, line.serviceDate]).join(" ")
        ].join(" "));
        return (!keyword || haystack.includes(keyword)) &&
          (!status.value || demand.statuses.includes(status.value)) &&
          (dateFilter.value === "all" || isWithinRecentServiceRange(demand)) &&
          (!demoOnly.checked || demand.isDemo) &&
          matchesCategory(demand);
      });
      resultMeta.textContent = `顯示 ${filtered.length} 張需求單，共 ${demands.length} 張`;
      renderDemandCards(results, filtered);
    };

    search.addEventListener("input", refresh);
    status.addEventListener("change", refresh);
    dateFilter.addEventListener("change", refresh);
    demoOnly.addEventListener("change", refresh);
    document.querySelectorAll("[data-order-category]").forEach(button => {
      button.classList.toggle("active", button.dataset.orderCategory === state.orderCategory);
      button.addEventListener("click", () => {
        state.orderCategory = button.dataset.orderCategory;
        document.querySelectorAll("[data-order-category]").forEach(item => item.classList.toggle("active", item === button));
        refresh();
      });
    });
    refresh();
  }

  function renderDemandCards(container, demands) {
    if (!demands.length) {
      container.innerHTML = '<div class="empty">目前沒有符合條件的資料</div>';
      return;
    }

    container.innerHTML = demands.map(demand => {
      const moneyBlock = state.permissions.canViewMoney
        ? `<div class="money-row"><div class="payment-summary"><div><span>未付尾款</span><strong class="${demand.unpaidBalance > 0 ? "unpaid" : "paid"}">${formatMoney(demand.unpaidBalance)}</strong></div>${demand.platformReceivable > 0 ? `<div><span>平台待撥</span><strong class="platform-pending">${formatMoney(demand.platformReceivable)}</strong></div>` : ""}</div><div class="order-money-summary"><div><span>本單淨收入</span>${demand.hasPendingCommission ? '<strong class="pending-income-text">抽成待設定</strong>' : `<strong>${formatMoney(demand.netIncome)}</strong>`}</div><div class="order-total-line"><span>訂單總額</span><strong>${formatMoney(demand.total)}</strong></div></div></div>`
        : "";
      return `
        <article class="order-card ${demand.isDemo ? "demo" : ""}">
          <button class="card-hit" data-demand-id="${escapeHtml(demand.demandId)}" type="button" aria-label="查看需求單 ${escapeHtml(demand.demandId)}"></button>
          <div class="card-top">
            <div><span class="eyebrow">${escapeHtml(demand.demandId)}</span><h3>${escapeHtml(demand.owner || "未填飼主")}｜${escapeHtml(demand.pets.join("、") || "未填毛孩")}</h3></div>
            <div class="tag-stack">${demand.isDemo ? '<span class="tag demo-tag">DEMO</span>' : '<span class="tag legacy-tag">匯入資料</span>'}${demand.statuses.length ? demand.statuses.map(statusTag).join("") : statusTag("未填狀態")}</div>
          </div>
          <div class="order-facts">
            <div class="order-fact date-fact"><span>服務日期</span><strong>${escapeHtml(demand.serviceDates.join("、") || "—")}</strong></div>
            <div class="order-fact"><span>保姆</span><strong>${escapeHtml(demand.caregivers.join("、") || "未指派")}</strong></div>
            <div class="order-fact"><span>訂單來源</span><strong>${escapeHtml(demand.orderSources.join("、") || "未設定")}</strong></div>
            <div class="order-fact"><span>服務項目</span><strong>${demand.lines.length} 項</strong></div>
          </div>
          <div class="order-services">${demand.lines.map(line => `<b class="service-chip">${escapeHtml(serviceLabel(line))}</b>`).join("")}</div>
          ${moneyBlock}
        </article>
      `;
    }).join("");

    container.querySelectorAll("[data-demand-id]").forEach(button => {
      button.addEventListener("click", () => openDemand(button.dataset.demandId));
    });
  }

  function openDemand(demandId) {
    const demand = getDemandOrders().find(item => item.demandId === demandId);
    if (!demand) return;
    const editableDemand = null;
    dialogContent.innerHTML = `
      <div class="dialog-heading">
        <div class="dialog-title-block">
          <span class="eyebrow">需求單 ${escapeHtml(demand.demandId)}</span>
          <h2>${escapeHtml(demand.owner || "未填飼主")}｜${escapeHtml(demand.pets.join("、") || "未填毛孩")}</h2>
          <div class="dialog-status-line">${statusTag(demand.statuses[0] || "未填狀態")}</div>
        </div>
        <div class="family-identity">
          <span>家庭編號</span>
          <strong>${escapeHtml(demand.familyId || "—")}</strong>
          ${demand.isDemo ? '<b class="tag demo-tag">DEMO 可編輯</b>' : '<b class="tag legacy-tag">匯入資料唯讀</b>'}
        </div>
      </div>
      <div class="order-detail-layout">
        <div class="detail-primary">
          <div class="detail-grid compact-detail-grid">
            ${detail("服務日期", demand.serviceDates.join("、"))}
            ${detail("保姆", demand.caregivers.join("、") || "未指派")}
            ${detail("訂單來源", demand.orderSources.join("、") || "未設定")}
            ${detail("服務承接", providerLabel(demand.providerTypes))}
            ${detail("服務項目", `${demand.lines.length} 項`)}
          </div>
          <section class="service-lines">
            <h3>服務內容</h3>
            ${demand.lines.map(line => {
              const actualUnitPrice = Number(line.customUnitPrice || line.standardUnitPrice || 0);
              return `<article><div class="service-line-main"><strong>${escapeHtml(serviceLabel(line))}</strong><span>${escapeHtml(line.serviceDate || "—")}｜${escapeHtml([line.bookingSegment, line.specifiedTime].filter(Boolean).join(" ") || "未指定時間")}</span></div>${state.permissions.canViewMoney ? `<div class="service-line-price"><span>${formatMoney(actualUnitPrice)} × ${line.quantity || 0}</span><b>${formatMoney(line.serviceSubtotal)}</b></div>` : ""}</article>`;
            }).join("")}
          </section>
          ${demand.notes.length ? `<div class="note-box"><strong>備註</strong><p>${escapeHtml(demand.notes.join("\n"))}</p></div>` : ""}
        </div>
        <aside class="detail-sidebar">
          ${state.permissions.canViewMoney ? `
            <section class="calculation-card compact-calculation formula-calculation">
              <h3>客戶款項</h3>
              <div class="formula-rows">
                <div><span>折扣前總價</span><strong>${formatMoney(demand.totalBeforeDiscount)}</strong></div>
                <div><span>－ 客戶折扣（${formatFactor(demand.discountRate)}）</span><strong>－${formatMoney(demand.discountAmount)}</strong></div>
                <div class="formula-result order-total-result"><span>＝ 需求單總額</span><strong>${formatMoney(demand.total)}</strong></div>
                <div><span>${demand.depositLocked ? "已鎖定訂金" : "目前應付訂金"}</span><strong>${formatMoney(demand.requiredDeposit)}</strong></div>
                ${demand.additionalDepositSuggested > 0 ? `<div class="deposit-supplement"><span>修改後若重新鎖定，建議補訂金</span><strong>${formatMoney(demand.additionalDepositSuggested)}</strong></div>` : ""}
                <div><span>－ 已付金額</span><strong>－${formatMoney(demand.paidAmount)}</strong></div>
                <div class="formula-result unpaid-result"><span>＝ 未付尾款</span><strong class="${demand.unpaidBalance > 0 ? "unpaid" : "paid"}">${formatMoney(demand.unpaidBalance)}</strong></div>
                ${demand.orderSources.includes("毛小愛") ? `<div class="platform-receivable-total"><span>${escapeHtml(payoutStatusLabel(demand.platformPayoutStatuses))}</span><strong>${formatMoney(demand.platformReceivable)}</strong></div>` : ""}
              </div>
              <h3 class="income-formula-heading">本單收入</h3>
              <div class="formula-rows income-formula-rows">
                <div class="formula-result net-income-total"><span>本單淨收入</span><strong>${demand.hasPendingCommission ? "抽成比例待設定" : formatMoney(demand.netIncome)}</strong></div>
              </div>
            </section>
          ` : ""}
        </aside>
      </div>
      <div class="dialog-actions">
        <button id="editOrderButton" class="secondary-btn" type="button" ${editableDemand && state.permissions.canEditOrders ? "" : "disabled"}>✎ 編輯訂單</button>
        <button id="sendNotificationButton" class="primary-btn" type="button">✉ 發送通知</button>
      </div>
      ${editableDemand && state.permissions.canEditOrders ? "" : '<p class="readonly-note">匯入的舊訂單在測試階段維持唯讀；DEMO 需求單可編輯及新增其他服務類別。</p>'}
    `;
    if (editableDemand && state.permissions.canEditOrders) {
      document.getElementById("editOrderButton").addEventListener("click", () => {
        dialog.close();
        state.editingOrder = editableDemand;
        state.page = "create";
        document.querySelectorAll("[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === "create"));
        renderCurrentPage();
      });
    }
    document.getElementById("sendNotificationButton").addEventListener("click", () => {
      showToast("測試版已保留發送通知流程，但不會真的傳送 LINE");
    });
    dialog.showModal();
  }

  function detail(label, value) {
    return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`;
  }

  function renderOrderForm(order) {
    if (!state.permissions.canCreateOrders && !order) {
      showError(new Error("目前帳號沒有新增訂單權限"));
      return;
    }

    app.innerHTML = `
      <section class="notice-card form-notice"><strong>${order ? "正在編輯 DEMO 需求單" : "只會建立測試資料"}</strong><span>同一張需求單可加入多個服務；不會寫回 Google Sheet、不會發 LINE 通知。</span></section>
      <form id="orderForm" class="panel form-panel">
        <div class="form-section-title"><span>1</span><div><h2>飼主與毛孩</h2><p>可搜尋家庭編號、飼主姓名或毛孩名字；未輸入時優先顯示近期服務家庭</p></div></div>
        <div class="form-grid two">
          <div class="family-picker" id="familyPicker">
            <label for="familySearch">搜尋家庭／飼主／毛孩 <span class="required-mark">必填</span></label>
            <div class="family-search-box">
              <span aria-hidden="true">⌕</span>
              <input id="familySearch" type="search" placeholder="輸入家庭編號、姓名或毛孩" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="familySearchResults" aria-autocomplete="list" />
            </div>
            <input name="familyId" type="hidden" />
            <small class="form-help" id="familySearchHint">輸入關鍵字後，點選正確的家庭</small>
            <div class="family-results" id="familySearchResults" role="listbox" hidden></div>
          </div>
          <label>毛孩 <span class="required-mark">必填</span><select name="petId" required><option value="">請先搜尋並選擇家庭</option></select></label>
        </div>

        <div class="form-section-title"><span>2</span><div><h2>服務內容與單價</h2><p>依照日期、狀態、新舊客與服務項目填寫，標準單價會自動帶入</p></div></div>
        <div class="form-grid two service-price-grid">
          <div class="calendar-field wide" id="serviceDatePicker">
            <label id="serviceDateLabel">服務日期 <span class="required-mark">必填</span></label>
            <button class="date-picker-trigger" id="datePickerTrigger" type="button" aria-labelledby="serviceDateLabel datePickerValue" aria-haspopup="dialog" aria-expanded="false">
              <span class="date-picker-icon" aria-hidden="true">📅</span>
              <span><strong id="datePickerValue">請選擇服務日期</strong><small>選一天為單日；再選一天就是日期區間</small></span>
              <b aria-hidden="true">⌄</b>
            </button>
            <div class="date-picker-popover" id="datePickerPopover" role="dialog" aria-label="選擇服務日期" hidden>
              <div class="calendar-toolbar">
                <button type="button" id="calendarPrevious" aria-label="上一個月">‹</button>
                <strong id="calendarMonth"></strong>
                <button type="button" id="calendarNext" aria-label="下一個月">›</button>
              </div>
              <div class="calendar-weekdays" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
              <div class="calendar-grid" id="calendarGrid"></div>
              <div class="calendar-actions"><button class="text-btn" id="calendarClear" type="button">清除</button><button class="primary-btn compact" id="calendarDone" type="button">完成</button></div>
            </div>
            <input name="serviceDateStart" type="hidden" />
            <input name="serviceDateEnd" type="hidden" />
          </div>
          <label>訂單狀態 <span class="required-mark">必填</span><select name="orderStatus" required><option>草稿</option><option>未付訂金</option><option value="待執行">待執行（已確認）</option><option>服務中</option><option>待付尾款</option><option>完成</option><option>已取消</option><option value="待服務" hidden>待服務（舊狀態）</option><option value="常客" hidden>常客（舊資料）</option></select></label>
          <label>新客／舊客 <span class="required-mark">必填</span><select name="customerType" required><option value="">請選擇</option><option value="returning">舊客</option><option value="new">新客</option></select><small>選擇家庭後會依現有資料自動帶入，仍可修改</small></label>
        </div>

        <div class="service-items" id="serviceItems"></div>
        <button class="add-service-button" id="addServiceItem" type="button">＋ 新增其他服務類別</button>

        <div class="form-section-title"><span>3</span><div><h2>其他金額與收款</h2><p>家訪直接在上方新增為服務類別；這裡只放整張需求單共用的金額</p></div></div>
        <div class="pricing-layout">
          <div class="form-grid two">
            <label>訂單來源 <span class="required-mark">必填</span><select name="orderSource" required><option value="LINE">LINE 官方帳號</option><option>Pinyu 自有客戶</option><option>毛小愛</option><option>Petbacker</option><option>保姆自行接案</option><option>朋友／客戶轉介</option><option>其他來源</option><option value="Supabase 測試後台" hidden>Supabase 測試後台（舊）</option></select><small>來源會顯示在需求單，方便核對淨收入</small></label>
            <label>本次由誰服務 <span class="required-mark">必填</span><select name="providerType" required><option value="self">我本人</option><option value="sitter">其他保姆</option></select></label>
            <label>是否有平台費／抽成<select name="applyPlatformCommission"><option value="false">沒有</option><option value="true">有</option></select><small>毛小愛、Petbacker 或轉給其他保姆時，依實際情況選擇</small></label>
            <label><span id="commissionRateLabel">平台費／抽成係數</span><input name="commissionRate" type="number" min="0" max="1" step="0.001" value="0" /><small id="commissionRateHint">本人服務遇到外部平台費時，例如 20% 填 0.2</small></label>
            <label>平台撥款狀態<select name="platformPayoutStatus"><option value="not_applicable">不適用</option><option value="pending">客戶已付／平台待撥</option><option value="received">平台已撥款</option></select><small>毛小愛代收時，客戶未付尾款會固定為 0</small></label>
            <label>每次車馬費<input name="travelFeePerVisit" type="number" min="0" step="1" value="0" /></label>
            <label>小費<input name="tip" type="number" min="0" step="1" value="0" /></label>
            <label>折扣係數<input name="discountRate" type="number" min="0" max="1" step="0.01" value="1" /><small>原價填 1；九折填 0.9；八五折填 0.85</small></label>
            <label>訂金係數<input name="depositRate" type="number" min="0" max="1" step="0.01" value="0.5" /><small>一般為折扣後總價的一半（0.5）；免訂金填 0</small></label>
            <label>客製應付訂金<input name="customRequiredDeposit" type="number" min="0" step="1" value="0" /><small>若大於 0，會取代上面的訂金係數試算</small></label>
            <label>目前已付金額<input name="paidAmount" type="number" min="0" step="1" value="0" /><small id="paidAmountHint">應付訂金會顯示在右側</small></label>
            ${order ? '<label class="wide deposit-relock-control"><span><input name="relockDeposit" type="checkbox" value="true" /> 依修改後金額重新鎖定訂金</span><small>預設不勾：保留原本已確認的訂金。勾選後若金額提高，可能需要請客戶補訂金差額。</small></label>' : ""}
          </div>
          <aside class="live-calculation" id="liveCalculation"></aside>
        </div>

        <div class="form-section-title"><span>4</span><div><h2>備註</h2><p>先記錄重要例外，之後再分類成正式欄位</p></div></div>
        <label>內部備註<textarea name="notes" rows="4" placeholder="不會傳送給客戶"></textarea></label>

        <div class="form-actions">
          ${order ? '<button id="cancelEdit" class="secondary-btn" type="button">取消編輯</button>' : ""}
          <button class="primary-btn" type="submit">${order ? "儲存測試訂單" : "建立測試訂單"}</button>
        </div>
      </form>
    `;

    const form = document.getElementById("orderForm");
    if (order) form.dataset.demandId = order.demandId;
    setupFamilyPicker(form, order);
    setupDatePicker(form);
    form.elements.customerType.addEventListener("change", () => applyAllServicePresets(form));
    form.elements.providerType.addEventListener("change", () => syncSitterCommissionRate(form));
    form.elements.orderSource.addEventListener("change", () => {
      if (form.elements.orderSource.value === "毛小愛" && form.elements.platformPayoutStatus.value === "not_applicable") {
        form.elements.platformPayoutStatus.value = "pending";
        form.elements.applyPlatformCommission.value = "true";
        if (readNumber(form, "commissionRate") === 0) form.elements.commissionRate.value = "0.2";
      }
      updateCalculation(form);
    });
    document.getElementById("addServiceItem").addEventListener("click", () => addServiceItem(form, null, false));

    form.addEventListener("input", () => updateCalculation(form));
    form.addEventListener("submit", submitOrderForm);
    if (order) {
      document.getElementById("cancelEdit").addEventListener("click", () => navigate("orders"));
      fillDemandForm(form, order);
    } else {
      setDatePickerValue(form, tomorrowDate(), "");
      addServiceItem(form, null, false);
      updateCalculation(form);
    }
  }

  function setupFamilyPicker(form, order) {
    const picker = document.getElementById("familyPicker");
    const search = document.getElementById("familySearch");
    const results = document.getElementById("familySearchResults");
    const hint = document.getElementById("familySearchHint");
    let activeIndex = -1;

    const closeResults = () => {
      results.hidden = true;
      search.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    };

    const chooseFamily = familyId => {
      selectFamily(form, familyId, !order);
      closeResults();
      search.focus();
    };

    const renderResults = () => {
      const keyword = normalize(search.value);
      const matches = state.families.filter(family => {
        const pets = state.pets.filter(pet => pet.family_id === family.family_id);
        const haystack = normalize([
          family.family_id,
          family.owner_name,
          family.customer_category,
          ...pets.flatMap(pet => [pet.pet_name, pet.species])
        ].join(" "));
        return !keyword || haystack.includes(keyword);
      }).map(family => ({ family, recent: getFamilyRecentService(family.family_id) }))
        .sort((left, right) => right.recent.timestamp - left.recent.timestamp || String(left.family.owner_name || "").localeCompare(String(right.family.owner_name || ""), "zh-TW"))
        .slice(0, 15);

      activeIndex = -1;
      results.innerHTML = matches.length
        ? matches.map(({ family, recent }) => {
            const pets = state.pets.filter(pet => pet.family_id === family.family_id);
            const petText = pets.length ? pets.map(pet => pet.pet_name).filter(Boolean).join("、") : "尚無毛孩資料";
            return `
              <button class="family-result" type="button" role="option" data-family-id="${escapeHtml(family.family_id)}">
                <span class="family-result-main"><strong>${escapeHtml(family.owner_name || "未填飼主")}</strong><b>${escapeHtml(family.family_id)}</b></span>
                <span class="family-result-meta">毛孩：${escapeHtml(petText)}｜${recent.timestamp ? `最近服務：${escapeHtml(formatDateOnly(recent.timestamp))}` : "尚無服務紀錄"}</span>
              </button>
            `;
          }).join("")
        : '<div class="family-no-result">找不到符合的家庭，請換個關鍵字</div>';

      results.hidden = false;
      search.setAttribute("aria-expanded", "true");
      results.querySelectorAll("[data-family-id]").forEach(button => {
        button.addEventListener("click", () => chooseFamily(button.dataset.familyId));
      });
    };

    search.addEventListener("focus", renderResults);
    search.addEventListener("input", () => {
      if (search.value !== search.dataset.selectedLabel) {
        form.elements.familyId.value = "";
        refreshPetOptions(form, "");
        hint.textContent = "請從搜尋結果中點選正確的家庭";
        hint.classList.remove("selected");
      }
      renderResults();
    });
    search.addEventListener("keydown", event => {
      const options = [...results.querySelectorAll("[data-family-id]")];
      if (!options.length || results.hidden) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = event.key === "ArrowDown"
          ? (activeIndex + 1) % options.length
          : (activeIndex - 1 + options.length) % options.length;
        options.forEach((option, index) => option.classList.toggle("active", index === activeIndex));
        options[activeIndex].scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        chooseFamily(options[activeIndex].dataset.familyId);
      } else if (event.key === "Escape") {
        closeResults();
      }
    });
    search.addEventListener("blur", () => window.setTimeout(closeResults, 140));
    picker.addEventListener("mousedown", event => {
      if (event.target.closest("[data-family-id]")) event.preventDefault();
    });
  }

  function selectFamily(form, familyId, setTravelFee) {
    const family = state.families.find(item => item.family_id === familyId);
    if (!family) return;

    const search = document.getElementById("familySearch");
    const hint = document.getElementById("familySearchHint");
    const label = `${family.owner_name || "未填飼主"}｜${family.family_id}`;
    form.elements.familyId.value = family.family_id;
    search.value = label;
    search.dataset.selectedLabel = label;
    hint.textContent = `已選擇：${label}`;
    hint.classList.add("selected");
    refreshPetOptions(form, "");
    if (setTravelFee) {
      form.elements.travelFeePerVisit.value = family.travel_fee || 0;
      const category = String(family.customer_category || "").toLocaleLowerCase("zh-TW");
      form.elements.customerType.value = category.includes("新") || category.includes("new") ? "new" : "returning";
      applyAllServicePresets(form);
    }
    updateCalculation(form);
  }

  function refreshPetOptions(form, selectedPetId) {
    const familyId = form.elements.familyId.value;
    const pets = state.pets.filter(pet => pet.family_id === familyId);
    const placeholder = familyId ? "請選擇毛孩" : "請先搜尋並選擇家庭";
    form.elements.petId.innerHTML = `<option value="">${placeholder}</option>${pets.map(pet => `<option value="${escapeHtml(pet.pet_id)}">${escapeHtml(pet.pet_name)}${pet.species ? `｜${escapeHtml(pet.species)}` : ""}</option>`).join("")}`;
    if (selectedPetId) form.elements.petId.value = selectedPetId;
    else if (pets.length === 1) form.elements.petId.value = pets[0].pet_id;
  }

  function setupDatePicker(form) {
    const picker = document.getElementById("serviceDatePicker");
    const trigger = document.getElementById("datePickerTrigger");
    const popover = document.getElementById("datePickerPopover");
    const render = () => renderCalendar(form);
    const close = () => {
      popover.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", () => {
      popover.hidden = !popover.hidden;
      trigger.setAttribute("aria-expanded", String(!popover.hidden));
      if (!popover.hidden) render();
    });
    document.getElementById("calendarPrevious").addEventListener("click", () => {
      const view = new Date(Number(picker.dataset.viewYear), Number(picker.dataset.viewMonth) - 1, 1);
      picker.dataset.viewYear = String(view.getFullYear());
      picker.dataset.viewMonth = String(view.getMonth());
      render();
    });
    document.getElementById("calendarNext").addEventListener("click", () => {
      const view = new Date(Number(picker.dataset.viewYear), Number(picker.dataset.viewMonth) + 1, 1);
      picker.dataset.viewYear = String(view.getFullYear());
      picker.dataset.viewMonth = String(view.getMonth());
      render();
    });
    document.getElementById("calendarClear").addEventListener("click", () => {
      setDatePickerValue(form, "", "");
      render();
    });
    document.getElementById("calendarDone").addEventListener("click", () => {
      if (!form.elements.serviceDateStart.value) {
        showToast("請先選擇服務日期", true);
        return;
      }
      close();
    });
    picker.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
    });
    picker.dataset.viewYear = String(new Date().getFullYear());
    picker.dataset.viewMonth = String(new Date().getMonth());
  }

  function renderCalendar(form) {
    const picker = document.getElementById("serviceDatePicker");
    const year = Number(picker.dataset.viewYear);
    const month = Number(picker.dataset.viewMonth);
    const first = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - first.getDay());
    const start = form.elements.serviceDateStart.value;
    const end = form.elements.serviceDateEnd.value;
    const today = localDateValue(new Date());
    document.getElementById("calendarMonth").textContent = `${year} 年 ${month + 1} 月`;
    document.getElementById("calendarGrid").innerHTML = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      const value = localDateValue(date);
      const classes = [
        date.getMonth() !== month ? "outside-month" : "",
        value === today ? "today" : "",
        value === start ? "range-start" : "",
        value === end ? "range-end" : "",
        start && end && value > start && value < end ? "in-range" : ""
      ].filter(Boolean).join(" ");
      return `<button type="button" class="${classes}" data-calendar-date="${value}" aria-label="${value}">${date.getDate()}</button>`;
    }).join("");
    document.querySelectorAll("[data-calendar-date]").forEach(button => {
      button.addEventListener("click", () => {
        const value = button.dataset.calendarDate;
        const currentStart = form.elements.serviceDateStart.value;
        const currentEnd = form.elements.serviceDateEnd.value;
        if (!currentStart || currentEnd) setDatePickerValue(form, value, "");
        else if (value < currentStart) setDatePickerValue(form, value, currentStart);
        else if (value === currentStart) setDatePickerValue(form, currentStart, "");
        else setDatePickerValue(form, currentStart, value);
        renderCalendar(form);
      });
    });
  }

  function setDatePickerValue(form, start, end) {
    form.elements.serviceDateStart.value = start || "";
    form.elements.serviceDateEnd.value = end && end !== start ? end : "";
    const picker = document.getElementById("serviceDatePicker");
    const viewDate = parseLocalDate(start) || new Date();
    picker.dataset.viewYear = String(viewDate.getFullYear());
    picker.dataset.viewMonth = String(viewDate.getMonth());
    const display = document.getElementById("datePickerValue");
    display.textContent = start
      ? `${start.replaceAll("-", "/")}${end && end !== start ? ` ～ ${end.replaceAll("-", "/")}` : ""}`
      : "請選擇服務日期";
    document.getElementById("datePickerTrigger").classList.toggle("has-value", Boolean(start));
    if (form.querySelector(".service-item")) syncSitterCommissionRate(form);
  }

  function localDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function parseLocalDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }

  function addServiceItem(form, service = null, existing = false) {
    const container = document.getElementById("serviceItems");
    if (container.children.length >= 12) {
      showToast("一張需求單最多 12 個服務項目", true);
      return;
    }
    const item = document.createElement("section");
    item.className = "service-item";
    item.dataset.existing = String(existing);
    const serviceNames = unique([...state.servicePresets.map(preset => preset.name), service?.serviceType]);
    const serviceOptions = serviceNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    const caregivers = unique([state.user?.displayName, ...state.sitters.filter(sitter => sitter.status === "active").map(sitter => sitter.display_name), ...state.orders.map(line => line.caregiver), service?.caregiver])
      .sort((left, right) => left.localeCompare(right, "zh-TW"));
    const caregiverOptions = caregivers.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    item.innerHTML = `
      <div class="service-item-heading">
        <div><span class="service-item-number"></span><h3>服務項目</h3></div>
        <button class="remove-service-button" type="button" ${existing ? "hidden" : ""}>移除</button>
      </div>
      <input data-field="orderId" type="hidden" value="${escapeHtml(service?.orderId || "")}" />
      <div class="form-grid two">
        <label>服務類別 <span class="required-mark">必填</span><select data-field="serviceTypePicker" required><option value="">請選擇服務</option>${serviceOptions}</select></label>
        <label>時間方案 <span class="required-mark">必填</span><select data-field="servicePresetId" required disabled><option value="">請先選擇服務類別</option></select></label>
        <input data-field="serviceType" type="hidden" />
        <input data-field="durationMinutes" type="hidden" value="0" />
        <label>標準單價 <span class="required-mark">自動帶入</span><input class="locked-field" data-field="standardUnitPrice" type="number" min="0" step="1" value="0" readonly required /><small data-role="standardPriceHint">請選擇服務類別與時間方案</small></label>
        <label>客製單價<input data-field="customUnitPrice" type="number" min="0" step="1" value="0" /><small>填 0 就使用標準單價</small></label>
        <label class="wide">客製價格原因<input data-field="customPriceReason" placeholder="例如：服務難度較高；使用客製價時必填" /></label>
        <label>服務次數 <span class="required-mark">必填</span><input data-field="quantity" type="number" min="1" max="100" step="1" value="1" required /></label>
        <label>保姆<select data-field="caregiver"><option value="">尚未指派</option>${caregiverOptions}</select></label>
        <label>服務時段<select data-field="bookingSegment"><option value="">未指定</option><option>上午</option><option>下午</option><option>晚上</option><option>指定時間</option></select></label>
        <label>指定時間<input data-field="specifiedTime" placeholder="例如：18:30；可填多個時間" /></label>
      </div>
    `;
    container.appendChild(item);
    const field = name => item.querySelector(`[data-field="${name}"]`);
    field("serviceTypePicker").addEventListener("change", () => populateServiceTimeOptions(form, item));
    field("servicePresetId").addEventListener("change", () => applyServicePreset(form, item));
    field("caregiver").addEventListener("change", () => syncSitterCommissionRate(form));
    item.querySelector(".remove-service-button").addEventListener("click", () => {
      if (container.children.length === 1) {
        showToast("至少要保留一個服務項目", true);
        return;
      }
      item.remove();
      renumberServiceItems();
      syncSitterCommissionRate(form);
    });

    if (service) {
      const matchingPreset = state.servicePresets.find(preset =>
        preset.name === service.serviceType && Number(preset.durationMinutes) === Number(service.durationMinutes)
      ) || state.servicePresets.find(preset => preset.name === service.serviceType);
      field("serviceTypePicker").value = service.serviceType || matchingPreset?.name || "";
      populateServiceTimeOptions(form, item, matchingPreset?.id || "");
      ["serviceType", "durationMinutes", "standardUnitPrice", "customUnitPrice", "customPriceReason", "quantity", "caregiver", "bookingSegment", "specifiedTime"].forEach(name => {
        if (service[name] !== null && service[name] !== undefined) field(name).value = service[name];
      });
      const hint = item.querySelector('[data-role="standardPriceHint"]');
      if (matchingPreset) hint.textContent = `${timePlanLabel(matchingPreset)}；保留此訂單建立時的標準單價`;
    }
    renumberServiceItems();
    syncSitterCommissionRate(form);
  }

  function renumberServiceItems() {
    document.querySelectorAll(".service-item").forEach((item, index) => {
      item.querySelector(".service-item-number").textContent = `服務 ${index + 1}`;
    });
  }

  function populateServiceTimeOptions(form, item, selectedPresetId = "") {
    const field = name => item.querySelector(`[data-field="${name}"]`);
    const serviceName = field("serviceTypePicker").value;
    field("serviceType").value = serviceName;
    const presets = state.servicePresets.filter(preset => preset.name === serviceName)
      .sort((left, right) => Number(left.durationMinutes) - Number(right.durationMinutes));
    const select = field("servicePresetId");
    select.disabled = !presets.length;
    select.innerHTML = presets.length
      ? `<option value="">請選擇時間方案</option>${presets.map(preset => `<option value="${escapeHtml(preset.id)}">${escapeHtml(timePlanLabel(preset))}</option>`).join("")}`
      : '<option value="">這個服務尚未設定時間方案</option>';
    if (selectedPresetId && presets.some(preset => preset.id === selectedPresetId)) select.value = selectedPresetId;
    applyServicePreset(form, item);
  }

  function applyServicePreset(form, item) {
    const field = name => item.querySelector(`[data-field="${name}"]`);
    const preset = state.servicePresets.find(candidate => candidate.id === field("servicePresetId").value);
    const hint = item.querySelector('[data-role="standardPriceHint"]');
    if (!preset || !form.elements.customerType.value) {
      field("standardUnitPrice").value = 0;
      field("durationMinutes").value = preset?.durationMinutes || 0;
      hint.textContent = !form.elements.customerType.value ? "請先選擇新客或舊客" : "請先選擇時間方案";
      updateCalculation(form);
      return;
    }
    field("serviceType").value = preset.name;
    field("durationMinutes").value = preset.durationMinutes;
    field("standardUnitPrice").value = form.elements.customerType.value === "new" ? preset.newCustomerPrice : preset.returningCustomerPrice;
    hint.textContent = `${form.elements.customerType.value === "new" ? "新客" : "舊客"}・${timePlanLabel(preset)}，由快速選單自動帶入`;
    updateCalculation(form);
  }

  function applyAllServicePresets(form) {
    document.querySelectorAll(".service-item").forEach(item => applyServicePreset(form, item));
  }

  function fillDemandForm(form, demand) {
    const lines = demand.lines || [];
    const first = lines[0] || {};
    selectFamily(form, demand.familyId || first.familyId || "", false);
    refreshPetOptions(form, state.pets.find(pet => pet.family_id === demand.familyId && pet.pet_name === first.pet)?.pet_id || "");
    const [dateStart, dateEnd] = splitServiceDate(first.serviceDate || demand.serviceDates?.[0]);
    setDatePickerValue(form, dateStart, dateEnd);
    form.elements.orderStatus.value = first.status || "草稿";
    form.elements.customerType.value = first.customerType || "returning";
    form.elements.travelFeePerVisit.value = Math.max(...lines.map(line => Number(line.travelFeePerVisit || 0)), 0);
    form.elements.tip.value = lines.reduce((sum, line) => sum + Number(line.tip || 0), 0);
    form.elements.discountRate.value = String(Math.max(0, 1 - Number(first.discountPercent || 0) / 100));
    form.elements.orderSource.value = first.orderSource || "LINE";
    form.elements.providerType.value = first.providerType || "self";
    form.elements.applyPlatformCommission.value = first.applyPlatformCommission ? "true" : "false";
    form.elements.commissionRate.value = first.commissionRate || 0;
    form.elements.platformPayoutStatus.value = first.platformPayoutStatus === "not_recorded" ? "not_applicable" : (first.platformPayoutStatus || "not_applicable");
    form.elements.depositRate.value = first.depositRate ?? 0.5;
    form.elements.customRequiredDeposit.value = demand.customRequiredDeposit || 0;
    form.elements.paidAmount.value = demand.paidAmount || 0;
    form.elements.notes.value = demand.notes?.join("\n") || "";
    lines.forEach(line => addServiceItem(form, line, true));
    updateCalculation(form);
  }

  function timePlanLabel(preset) {
    return Number(preset.durationMinutes) > 0 ? `${preset.durationMinutes} 分鐘` : "不分時間";
  }

  function splitServiceDate(value) {
    const dates = String(value || "").match(/\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/g) || [];
    const normalized = dates
      .map(date => date.replaceAll("/", "-"))
      .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
    return [normalized[0] || "", normalized.length > 1 ? normalized[normalized.length - 1] : ""];
  }

  function readNumber(form, name) {
    const value = Number(form.elements[name].value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function readServiceItems(form) {
    return [...form.querySelectorAll(".service-item")].map(item => {
      const field = name => item.querySelector(`[data-field="${name}"]`);
      const number = name => {
        const value = Number(field(name).value || 0);
        return Number.isFinite(value) ? value : 0;
      };
      const preset = state.servicePresets.find(candidate => candidate.id === field("servicePresetId").value);
      return {
        orderId: field("orderId").value,
        serviceType: field("serviceType").value || field("serviceTypePicker").value,
        planName: preset ? timePlanLabel(preset) : "",
        durationMinutes: number("durationMinutes"),
        standardUnitPrice: number("standardUnitPrice"),
        customUnitPrice: number("customUnitPrice"),
        customPriceReason: field("customPriceReason").value.trim(),
        quantity: number("quantity"),
        caregiver: field("caregiver").value,
        bookingSegment: field("bookingSegment").value,
        specifiedTime: field("specifiedTime").value
      };
    });
  }

  function syncSitterCommissionRate(form) {
    const providerType = form.elements.providerType.value;
    const rateInput = form.elements.commissionRate;
    const label = document.getElementById("commissionRateLabel");
    const hint = document.getElementById("commissionRateHint");
    if (!rateInput || !label || !hint) return;

    if (providerType !== "sitter") {
      rateInput.readOnly = false;
      rateInput.classList.remove("locked-field");
      label.textContent = "平台費／抽成係數";
      hint.textContent = "本人服務遇到外部平台費時，例如 20% 填 0.2";
      updateCalculation(form);
      return;
    }

    form.elements.applyPlatformCommission.value = "true";
    rateInput.readOnly = true;
    rateInput.classList.add("locked-field");
    label.textContent = "保姆抽成比例（自動）";
    const serviceDate = form.elements.serviceDateStart.value;
    const caregiverNames = unique(readServiceItems(form).map(service => service.caregiver).filter(Boolean));
    const resolved = caregiverNames.map(name => {
      const sitter = state.sitters.find(candidate => normalize(candidate.display_name) === normalize(name));
      const rate = sitter && serviceDate ? rateForDate(sitter.sitter_id, serviceDate) : null;
      return { name, sitter, rate };
    });
    const availableRates = resolved.filter(item => item.rate).map(item => Number(item.rate.rate_percent));
    const uniqueRates = unique(availableRates);
    rateInput.value = uniqueRates.length === 1 ? String(uniqueRates[0] / 100) : "0";
    if (!serviceDate) hint.textContent = "請先選擇服務日期";
    else if (!caregiverNames.length) hint.textContent = "請在服務項目選擇保姆";
    else if (resolved.some(item => !item.sitter)) hint.textContent = "有保姆尚未建立保姆資料";
    else if (resolved.some(item => !item.rate)) hint.textContent = `有保姆在 ${serviceDate} 尚未設定有效比例`;
    else if (uniqueRates.length > 1) hint.textContent = `此需求單含多個比例：${uniqueRates.map(formatPercent).join("、")}`;
    else hint.textContent = `${formatPercent(uniqueRates[0])}，依 ${serviceDate} 有效的歷史版本自動帶入`;
    updateCalculation(form);
  }

  function calculate(form) {
    const serviceDate = form.elements.serviceDateStart.value;
    const providerType = form.elements.providerType.value;
    const services = readServiceItems(form).map(service => {
      const unitPrice = service.customUnitPrice > 0 ? service.customUnitPrice : service.standardUnitPrice;
      const sitter = providerType === "sitter"
        ? state.sitters.find(candidate => normalize(candidate.display_name) === normalize(service.caregiver))
        : null;
      const sitterRate = sitter && serviceDate ? rateForDate(sitter.sitter_id, serviceDate) : null;
      return {
        ...service,
        unitPrice,
        subtotal: unitPrice * service.quantity,
        sitterRatePercent: sitterRate ? Number(sitterRate.rate_percent) : null
      };
    });
    const quantity = services.reduce((highest, service) => Math.max(highest, service.quantity), 0);
    const serviceSubtotal = services.reduce((sum, service) => sum + service.subtotal, 0);
    const travelSubtotal = readNumber(form, "travelFeePerVisit") * quantity;
    const tip = readNumber(form, "tip");
    const totalBeforeDiscount = serviceSubtotal + travelSubtotal + tip;
    const discountRate = Math.min(Math.max(readNumber(form, "discountRate"), 0), 1);
    const total = totalBeforeDiscount * discountRate;
    const orderSource = form.elements.orderSource.value;
    const customerPaidViaPlatform = orderSource === "毛小愛";
    const paid = customerPaidViaPlatform ? total : readNumber(form, "paidAmount");
    const depositRate = Math.min(Math.max(readNumber(form, "depositRate"), 0), 1);
    const customRequiredDeposit = readNumber(form, "customRequiredDeposit");
    const suggestedRequiredDeposit = customRequiredDeposit > 0 ? customRequiredDeposit : total * depositRate;
    const existingLockedDeposit = Number(state.editingOrder?.lockedRequiredDeposit || 0);
    const depositLocked = Boolean(state.editingOrder?.depositLocked);
    const relockDeposit = Boolean(form.elements.relockDeposit?.checked);
    const requiredDeposit = depositLocked && !relockDeposit ? existingLockedDeposit : suggestedRequiredDeposit;
    const additionalDepositSuggested = depositLocked ? Math.max(suggestedRequiredDeposit - existingLockedDeposit, 0) : 0;
    const applyPlatformCommission = form.elements.applyPlatformCommission.value === "true";
    const sitterRatePercents = unique(services.map(service => service.sitterRatePercent).filter(value => value !== null));
    const commissionRate = providerType === "sitter"
      ? (sitterRatePercents.length === 1 ? sitterRatePercents[0] / 100 : 0)
      : Math.min(Math.max(readNumber(form, "commissionRate"), 0), 1);
    const commissionAmount = applyPlatformCommission
      ? providerType === "sitter"
        ? services.reduce((sum, service) => sum + service.subtotal * Number(service.sitterRatePercent || 0) / 100, 0)
        : total * commissionRate
      : 0;
    const discountAmount = totalBeforeDiscount - total;
    const sitterPayout = providerType === "sitter" ? serviceSubtotal - commissionAmount + travelSubtotal + tip : 0;
    const netIncome = providerType === "self" ? total - commissionAmount : (applyPlatformCommission ? commissionAmount - discountAmount : 0);
    const platformPayoutStatus = form.elements.platformPayoutStatus.value;
    const platformReceivable = customerPaidViaPlatform && platformPayoutStatus === "pending" ? netIncome : 0;
    return {
      services, quantity, serviceSubtotal, travelSubtotal, tip, totalBeforeDiscount, discountRate,
      total, paid, unpaid: Math.max(total - paid, 0), depositRate, customRequiredDeposit,
      requiredDeposit, suggestedRequiredDeposit, depositLocked, relockDeposit, additionalDepositSuggested,
      depositShortfall: Math.max(requiredDeposit - paid, 0), providerType,
      applyPlatformCommission, commissionRate, sitterRatePercents, commissionAmount, sitterPayout, netIncome,
      orderSource, customerPaidViaPlatform, platformPayoutStatus, platformReceivable
    };
  }

  function updateCalculation(form) {
    const calculation = calculate(form);
    document.getElementById("liveCalculation").innerHTML = `
      <h3>即時試算</h3>
      ${calculation.services.map((service, index) => `<div><span>服務 ${index + 1}・${escapeHtml(service.serviceType || "尚未選擇")} ${formatMoney(service.unitPrice)} × ${service.quantity}</span><strong>${formatMoney(service.subtotal)}</strong></div>`).join("")}
      <div><span>服務費小計</span><strong>${formatMoney(calculation.serviceSubtotal)}</strong></div>
      <div><span>車馬費</span><strong>${formatMoney(calculation.travelSubtotal)}</strong></div>
      <div><span>小費</span><strong>${formatMoney(calculation.tip)}</strong></div>
      <div><span>折扣前總價</span><strong>${formatMoney(calculation.totalBeforeDiscount)}</strong></div>
      <div><span>客戶折扣（${formatFactor(calculation.discountRate)}）</span><strong>－${formatMoney(calculation.totalBeforeDiscount - calculation.total)}</strong></div>
      <div class="grand-total"><span>訂單總額</span><strong>${formatMoney(calculation.total)}</strong></div>
      <div><span>${calculation.depositLocked && !calculation.relockDeposit ? "已鎖定訂金" : "應付訂金"}${calculation.customRequiredDeposit > 0 ? "（客製）" : `（${formatPercent(calculation.depositRate * 100)}）`}</span><strong>${formatMoney(calculation.requiredDeposit)}</strong></div>
      ${calculation.depositLocked && calculation.suggestedRequiredDeposit !== calculation.requiredDeposit ? `<div><span>修改後 50% 試算</span><strong>${formatMoney(calculation.suggestedRequiredDeposit)}</strong></div>` : ""}
      ${calculation.additionalDepositSuggested > 0 && !calculation.relockDeposit ? `<div class="deposit-supplement"><span>若重新鎖定，建議補訂金</span><strong>${formatMoney(calculation.additionalDepositSuggested)}</strong></div>` : ""}
      <div><span>已付</span><strong>${formatMoney(calculation.paid)}</strong></div>
      ${calculation.customerPaidViaPlatform ? `<div><span>客戶付款狀態</span><strong>毛小愛已代收</strong></div>` : ""}
      <div><span>尚缺訂金</span><strong>${formatMoney(calculation.depositShortfall)}</strong></div>
      <div class="unpaid-total"><span>未付尾款</span><strong>${formatMoney(calculation.unpaid)}</strong></div>
      ${calculation.customerPaidViaPlatform ? `<div class="platform-receivable-total"><span>平台待撥款</span><strong>${formatMoney(calculation.platformReceivable)}</strong></div>` : ""}
      <div><span>${calculation.providerType === "sitter" ? "Pinyu 抽成收入" : "外部平台扣款"}${calculation.applyPlatformCommission ? `（${calculation.providerType === "sitter" ? (calculation.sitterRatePercents.length ? calculation.sitterRatePercents.map(formatPercent).join("、") : "待設定") : calculation.commissionRate}）` : "（無）"}</span><strong>${formatMoney(calculation.commissionAmount)}</strong></div>
      ${calculation.providerType === "sitter" ? `<div><span>保姆應得（不受客戶折扣影響）</span><strong>${formatMoney(calculation.sitterPayout)}</strong></div>` : ""}
      <div class="net-income-total"><span>本單淨收入</span><strong>${formatMoney(calculation.netIncome)}</strong></div>
    `;
    const paidHint = document.getElementById("paidAmountHint");
    if (paidHint) paidHint.textContent = `${calculation.depositLocked && !calculation.relockDeposit ? "已鎖定訂金" : "應付訂金"} ${formatMoney(calculation.requiredDeposit)}；尚缺 ${formatMoney(calculation.depositShortfall)}`;
  }

  async function submitOrderForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    try {
      submitButton.disabled = true;
      submitButton.textContent = "正在儲存…";
      const payload = Object.fromEntries(new FormData(form).entries());
      const serviceDateStart = String(payload.serviceDateStart || "");
      const serviceDateEnd = String(payload.serviceDateEnd || "");
      if (!serviceDateStart) throw new Error("請填寫服務開始日期");
      if (serviceDateEnd && serviceDateEnd < serviceDateStart) {
        throw new Error("服務結束日期不可早於開始日期");
      }
      payload.serviceDate = serviceDateEnd && serviceDateEnd !== serviceDateStart
        ? `${serviceDateStart}～${serviceDateEnd}`
        : serviceDateStart;
      delete payload.serviceDateStart;
      delete payload.serviceDateEnd;
      ["travelFeePerVisit", "tip", "paidAmount", "depositRate", "customRequiredDeposit", "commissionRate"].forEach(key => { payload[key] = Number(payload[key] || 0); });
      const discountRate = Number(payload.discountRate);
      if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 1) {
        throw new Error("折扣係數請填 0～1，例如九折填 0.9");
      }
      payload.discountPercent = Number(((1 - discountRate) * 100).toFixed(4));
      delete payload.discountRate;
      payload.applyPlatformCommission = payload.applyPlatformCommission === "true";
      const calculation = calculate(form);
      payload.paidAmount = calculation.paid;
      if (calculation.requiredDeposit > calculation.total) throw new Error("應付訂金不可高於訂單總額");

      if (!payload.familyId) throw new Error("請先搜尋並選擇家庭");
      if (!payload.petId) throw new Error("請選擇這次服務的毛孩");
      payload.services = readServiceItems(form).map((service, index) => {
        if (!service.serviceType) throw new Error(`請選擇服務 ${index + 1} 的服務類別`);
        if (service.quantity < 1) throw new Error(`服務 ${index + 1} 的服務次數至少為 1`);
        if (service.customUnitPrice > 0 && !service.customPriceReason) {
          throw new Error(`服務 ${index + 1} 使用客製單價時，請填寫調整原因`);
        }
        return { ...service, customerType: payload.customerType };
      });

      const operation = form.dataset.demandId ? "updateDemoOrder" : "createOrder";
      if (form.dataset.demandId) payload.demandId = form.dataset.demandId;
      const result = await requestApi(operation, payload);
      await loadBootstrap(false);
      state.editingOrder = null;
      state.page = "orders";
      document.querySelectorAll("[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === "orders"));
      renderCurrentPage();
      showToast(operation === "createOrder" ? "測試訂單建立完成" : "測試訂單已更新");
      setTimeout(() => openDemand(result.order.displayOrderId || result.order.orderId), 100);
    } catch (error) {
      showToast(error.message || String(error), true);
      submitButton.disabled = false;
      submitButton.textContent = form.dataset.demandId ? "儲存測試訂單" : "建立測試訂單";
    }
  }

  function renderFamilyManager() {
    const sortedFamilies = state.families
      .map(family => ({ family, recent: getFamilyRecentService(family.family_id) }))
      .sort((left, right) => right.recent.timestamp - left.recent.timestamp || String(left.family.owner_name || "").localeCompare(String(right.family.owner_name || ""), "zh-TW"));
    app.innerHTML = `
      <section class="notice-card form-notice"><strong>測試資料</strong><span>這裡新增的家庭與毛孩只會進入 Supabase，會標示 DEMO，不會寫回 Google Sheet。</span></section>
      <section class="manager-grid">
        <form id="familyForm" class="panel form-panel">
          <div class="section-head"><div><h2>新增家庭編號</h2><p>建立後再從家庭檔案填寫受保護的地址與電話。</p></div></div>
          <div class="form-grid two">
            <label>家庭編號<input name="familyId" required maxlength="80" placeholder="例如：F039" /></label>
            <label>飼主姓名<input name="ownerName" required maxlength="100" /></label>
            <label>客戶類型<select name="customerCategory"><option value="舊客">舊客</option><option value="新客">新客</option></select></label>
            <label>預設車馬費<input name="travelFee" type="number" min="0" step="1" value="0" /></label>
            <label class="wide">內部備註<textarea name="notes" rows="3"></textarea></label>
          </div>
          <button class="primary-btn" type="submit">建立測試家庭</button>
        </form>
        <form id="petForm" class="panel form-panel">
          <div class="section-head"><div><h2>新增毛孩</h2><p>先選家庭，再建立毛孩資料。</p></div></div>
          <label>所屬家庭<select name="familyId" required><option value="">請選擇家庭</option>${familySelectOptions()}</select></label>
          <div class="form-grid two">
            <label>毛孩名字<input name="petName" required maxlength="100" /></label>
            <label>種類<select name="species"><option value="">未指定</option><option>貓</option><option>狗</option><option>其他</option></select></label>
            <label>品種<input name="breed" maxlength="80" /></label>
            <label class="wide">照顧備註<textarea name="notes" rows="3"></textarea></label>
          </div>
          <button class="primary-btn" type="submit">建立測試毛孩</button>
        </form>
      </section>
      <section class="panel family-overview">
        <div class="section-head"><div><h2>近期服務家庭</h2><p>可搜尋並點開修改；地址與電話只在 OWNER 開啟家庭檔案時讀取。</p></div><span>${state.families.length} 個家庭</span></div>
        <div class="family-manager-toolbar">
          <label class="search-box"><span>⌕</span><input id="familyManagerSearch" type="search" placeholder="搜尋家庭編號、飼主、毛孩或電話末碼" autocomplete="off" /></label>
          <span id="familyManagerMeta" class="result-meta"></span>
        </div>
        <div class="compact-list family-manager-list" id="familyManagerList"></div>
      </section>
    `;

    document.getElementById("familyForm").addEventListener("submit", event => submitManagerForm(event, "createFamily", "測試家庭建立完成"));
    document.getElementById("petForm").addEventListener("submit", event => submitManagerForm(event, "createPet", "測試毛孩建立完成"));
    const search = document.getElementById("familyManagerSearch");
    const list = document.getElementById("familyManagerList");
    const meta = document.getElementById("familyManagerMeta");
    let searchVersion = 0;
    const refresh = async () => {
      const version = ++searchVersion;
      const keyword = normalize(search.value);
      const digits = String(search.value || "").replace(/\D/g, "");
      let phoneFamilyIds = [];
      if (digits.length >= 3 && state.permissions.canViewPrivateFamilyData) {
        try {
          const result = await requestApi("searchFamilyPhone", { digits });
          phoneFamilyIds = result.familyIds || [];
        } catch {
          phoneFamilyIds = [];
        }
      }
      if (version !== searchVersion) return;
      const matches = sortedFamilies.filter(({ family }) => {
        const pets = state.pets.filter(pet => pet.family_id === family.family_id).map(pet => pet.pet_name).join(" ");
        const haystack = normalize(`${family.family_id} ${family.owner_name || ""} ${pets}`);
        return !keyword || haystack.includes(keyword) || phoneFamilyIds.includes(family.family_id);
      });
      const visible = keyword ? matches : matches.slice(0, 8);
      meta.textContent = keyword ? `找到 ${visible.length} 個家庭` : `顯示最近 ${visible.length} 個家庭`;
      list.innerHTML = visible.length ? visible.map(familyManagerCard).join("") : '<div class="empty">找不到符合的家庭</div>';
      list.querySelectorAll("[data-family-file]").forEach(button => {
        button.addEventListener("click", () => openFamilyEditor(button.dataset.familyFile));
      });
    };
    search.addEventListener("input", refresh);
    refresh();
  }

  function familyManagerCard({ family, recent }) {
    const pets = state.pets.filter(pet => pet.family_id === family.family_id).map(pet => pet.pet_name).filter(Boolean);
    return `<button class="family-file-card" data-family-file="${escapeHtml(family.family_id)}" type="button"><div><strong>${escapeHtml(family.owner_name || "未填姓名")}</strong><span>${escapeHtml(family.family_id)}｜毛孩：${escapeHtml(pets.join("、") || "尚無")}</span></div><div><b>${recent.timestamp ? formatDateOnly(recent.timestamp) : "尚無服務"}</b><small>開啟家庭檔案 ›</small></div></button>`;
  }

  async function openFamilyEditor(familyId) {
    dialogContent.innerHTML = '<section class="state-card compact-state"><div class="spinner" aria-hidden="true"></div><p>正在讀取家庭檔案與權限資料…</p></section>';
    if (!dialog.open) dialog.showModal();
    try {
      const data = await requestApi("getFamilyDetails", { familyId });
      const family = data.family;
      const contact = data.privateContact || {};
      dialogContent.innerHTML = `
        <div class="dialog-heading"><div class="dialog-title-block"><span class="eyebrow">家庭檔案</span><h2>${escapeHtml(family.owner_name || "未填姓名")}</h2></div><div class="family-identity"><span>家庭編號</span><strong>${escapeHtml(family.family_id)}</strong></div></div>
        <form id="familyEditForm" class="family-file-form">
          <input name="familyId" type="hidden" value="${escapeHtml(family.family_id)}" />
          <section class="family-file-section"><div class="section-head"><div><h3>基本資料</h3><p>家庭編號保留為歷史主鍵，不在這裡直接改號。</p></div></div><div class="form-grid two">
            <label>飼主姓名 <span class="required-mark">必填</span><input name="ownerName" maxlength="100" required value="${escapeHtml(family.owner_name || "")}" /></label>
            <label>服務地區<input name="district" maxlength="100" value="${escapeHtml(family.district || "")}" /></label>
            <label>客戶類型<select name="customerCategory"><option value="舊客" ${family.customer_category === "舊客" ? "selected" : ""}>舊客</option><option value="新客" ${family.customer_category === "新客" ? "selected" : ""}>新客</option></select></label>
            <label>預設車馬費<input name="travelFee" type="number" min="0" step="1" value="${Number(family.travel_fee || 0)}" /></label>
            <label class="wide">內部備註<textarea name="notes" rows="3" maxlength="2000">${escapeHtml(family.notes || "")}</textarea></label>
          </div></section>
          ${data.privateAccess ? `<section class="family-file-section sensitive-section"><div class="section-head"><div><h3>地址與電話</h3><p>敏感資料｜只有 OWNER 點開此家庭時才由後端讀取。</p></div><span class="security-badge">受保護</span></div><div class="form-grid two"><label>客戶電話<input name="phone" type="tel" maxlength="100" autocomplete="off" value="${escapeHtml(contact.phone || "")}" /></label><label class="wide">服務地址<textarea name="address" rows="2" maxlength="1000" autocomplete="off">${escapeHtml(contact.address || "")}</textarea></label></div></section>` : '<section class="privacy-note">此帳號沒有查看地址與電話的權限。</section>'}
          <section class="family-file-section"><div class="section-head"><div><h3>毛孩資料</h3><p>一個家庭可以有多隻毛孩，每隻資料分開保存。</p></div><span>${data.pets.length} 隻</span></div><div class="family-pet-list">${data.pets.length ? data.pets.map(familyPetSummary).join("") : '<div class="empty compact-empty">尚未建立毛孩</div>'}</div></section>
          <section class="family-file-section"><div class="section-head"><div><h3>新版訂單</h3><p>依最近更新排序；可直接進入該家庭的 V2 訂單。</p></div><span>${data.ordersV2.length} 筆</span></div><div class="family-contract-list">${data.ordersV2.length ? data.ordersV2.map(familyOrderV2Card).join("") : '<div class="empty compact-empty">尚無新版訂單</div>'}</div></section>
          <section class="family-file-section"><div class="section-head"><div><h3>家訪紀錄</h3><p>一筆家訪屬於整個家庭，下面會為每隻毛孩各自保留照顧紀錄。</p></div><span>${data.homeVisits.length} 筆</span></div><div class="family-contract-list">${data.homeVisits.length ? data.homeVisits.map(homeVisitCard).join("") : '<div class="empty compact-empty">尚未建立家訪紀錄</div>'}</div>${state.permissions.canManageHomeVisits ? '<button class="secondary-btn" id="createHomeVisit" type="button">＋ 建立家訪紀錄</button>' : ""}</section>
          <section class="family-file-section"><div class="section-head"><div><h3>合約</h3><p>完整合約僅 OWNER 可看；保姆未來只取得指派服務必要的核准摘要。</p></div></div><div class="family-contract-list">${data.contracts.length ? data.contracts.map(familyContractCard).join("") : '<div class="empty compact-empty">尚未建立線上合約</div>'}</div>${state.permissions.canManageContracts ? '<button class="secondary-btn" id="createFamilyContract" type="button">＋ 建立 0821 合約草稿</button>' : ""}</section>
          <div class="form-actions"><button class="secondary-btn" type="button" id="cancelFamilyEdit">取消</button><button class="primary-btn" type="submit">儲存家庭資料</button></div>
        </form>
      `;
      document.getElementById("cancelFamilyEdit").addEventListener("click", () => dialog.close());
      document.getElementById("familyEditForm").addEventListener("submit", submitFamilyEdit);
      dialogContent.querySelectorAll("[data-contract-file]").forEach(button => button.addEventListener("click", () => openContractEditor(button.dataset.contractFile)));
      dialogContent.querySelectorAll("[data-home-visit-file]").forEach(button => button.addEventListener("click", () => openHomeVisitEditor(button.dataset.homeVisitFile)));
      dialogContent.querySelectorAll("[data-family-order-v2]").forEach(button => button.addEventListener("click", () => orderV2Ui.open(button.dataset.familyOrderV2)));
      document.getElementById("createHomeVisit")?.addEventListener("click", async () => {
        try {
          const result = await requestApi("createHomeVisitDraft", { familyId });
          await openHomeVisitEditor(result.homeVisitId);
          showToast("已建立家訪紀錄，每隻毛孩都有自己的欄位");
        } catch (error) {
          showToast(error.message || String(error), true);
        }
      });
      document.getElementById("createFamilyContract")?.addEventListener("click", async () => {
        try {
          const result = await requestApi("createContractDraft", { familyId });
          await openContractEditor(result.contractId);
          showToast(result.existed ? "已開啟既有合約草稿" : "合約草稿已建立");
        } catch (error) {
          showToast(error.message || String(error), true);
        }
      });
    } catch (error) {
      dialog.close();
      showToast(error.message || String(error), true);
    }
  }

  function familyPetSummary(pet) {
    return `<article><div><strong>${escapeHtml(pet.pet_name || "未填名字")}</strong><span>${escapeHtml([pet.species, pet.breed].filter(Boolean).join("／") || "未填種類")}</span></div><small>${escapeHtml([pet.age_text, pet.sex, pet.neuter_status].filter(Boolean).join("｜") || "基本資料待補")}</small></article>`;
  }

  function familyContractCard(contract) {
    const labels = { draft: "草稿", pending_signature: "待簽署", signed: "已簽署", void: "已作廢" };
    return `<button class="contract-file-card" data-contract-file="${escapeHtml(contract.contract_id)}" type="button"><div><strong>${escapeHtml(contract.template_name)}</strong><span>版本 ${escapeHtml(contract.template_version || "未標示")}｜${labels[contract.contract_status] || contract.contract_status}</span></div><b>開啟 ›</b></button>`;
  }

  function familyOrderV2Card(order) {
    const status = { draft: "草稿", awaiting_deposit: "待訂金", confirmed: "已確認", in_service: "服務中", completed: "已完成", cancelled: "已取消" }[order.orderStatus] || order.orderStatus;
    return `<button class="contract-file-card" data-family-order-v2="${escapeHtml(order.orderId)}" type="button"><div><strong>${escapeHtml(order.orderNumber || order.orderId)}</strong><span>${escapeHtml(order.serviceDate || "日期未定")}・${escapeHtml(order.petName || "毛孩未標示")}・${escapeHtml(status)}</span></div><b>開啟 ›</b></button>`;
  }

  function homeVisitCard(visit) {
    const status = { draft: "草稿", scheduled: "已排程", completed: "已完成", cancelled: "已取消" }[visit.visit_status] || visit.visit_status;
    const type = visit.visit_type === "revisit" ? "再次家訪" : "首次家訪";
    const date = visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" }) : "尚未排時間";
    return `<button class="contract-file-card" data-home-visit-file="${escapeHtml(visit.home_visit_id)}" type="button"><div><strong>${type}</strong><span>${escapeHtml(date)}・${escapeHtml(status)}</span></div><b>開啟 ›</b></button>`;
  }

  async function submitFamilyEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    try {
      button.disabled = true;
      button.textContent = "正在儲存…";
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.travelFee = Number(payload.travelFee || 0);
      await requestApi("updateFamily", payload);
      await loadBootstrap(false);
      dialog.close();
      navigate("families");
      showToast("家庭資料已更新");
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = "儲存家庭資料";
    }
  }

  async function openHomeVisitEditor(homeVisitId) {
    dialogContent.innerHTML = '<section class="state-card compact-state"><div class="spinner" aria-hidden="true"></div><p>正在讀取家訪與多隻毛孩資料…</p></section>';
    if (!dialog.open) dialog.showModal();
    try {
      const data = await requestApi("getHomeVisitDetails", { homeVisitId });
      const visit = data.visit;
      const localDateTime = visit.scheduled_at
        ? new Date(visit.scheduled_at).toLocaleString("sv-SE").replace(" ", "T").slice(0, 16)
        : "";
      dialogContent.innerHTML = `
        <div class="dialog-heading"><div class="dialog-title-block"><span class="eyebrow">家訪工作台</span><h2>${escapeHtml(data.family.owner_name || "未填姓名")}</h2></div><div class="family-identity"><span>家庭編號</span><strong>${escapeHtml(visit.family_id)}</strong></div></div>
        <form id="homeVisitForm" class="contract-draft-form">
          <input name="homeVisitId" type="hidden" value="${escapeHtml(visit.home_visit_id)}" />
          <section class="notice-card contract-source-note"><strong>一個家庭可以有很多隻毛孩</strong><span>下方會依這個家庭目前的毛孩數量，自動產生每隻毛孩自己的健康、用藥、餵食、行為與碰觸限制欄位。</span></section>
          <section class="family-file-section"><div class="section-head"><div><h3>家訪安排</h3><p>先排時間與狀態，再逐隻記錄現場資訊。</p></div></div><div class="form-grid two">
            <label>家訪類型<select name="visitType"><option value="first" ${visit.visit_type === "first" ? "selected" : ""}>首次家訪</option><option value="revisit" ${visit.visit_type === "revisit" ? "selected" : ""}>再次家訪</option></select></label>
            <label>家訪狀態<select name="visitStatus"><option value="draft" ${visit.visit_status === "draft" ? "selected" : ""}>草稿</option><option value="scheduled" ${visit.visit_status === "scheduled" ? "selected" : ""}>已排程</option><option value="completed" ${visit.visit_status === "completed" ? "selected" : ""}>已完成</option><option value="cancelled" ${visit.visit_status === "cancelled" ? "selected" : ""}>已取消</option></select></label>
            <label>家訪日期時間<input name="scheduledAt" type="datetime-local" value="${escapeHtml(localDateTime)}" /></label>
            <label class="wide">進門、鑰匙與門禁注意事項<textarea name="accessNotes" rows="3" maxlength="3000">${escapeHtml(visit.access_notes || "")}</textarea></label>
            <label class="wide">居家環境與用品位置<textarea name="environmentNotes" rows="3" maxlength="5000">${escapeHtml(visit.environment_notes || "")}</textarea></label>
            <label class="wide">家庭共用照顧說明<textarea name="generalNotes" rows="3" maxlength="5000">${escapeHtml(visit.general_notes || "")}</textarea></label>
          </div></section>
          <section class="family-file-section"><div class="section-head"><div><h3>逐隻毛孩紀錄</h3><p>共 ${data.pets.length} 隻；內容彼此獨立，不會互相覆蓋。</p></div><span>${data.pets.length} 隻</span></div><div class="home-visit-pet-forms">${data.pets.length ? data.pets.map(homeVisitPetForm).join("") : '<div class="empty compact-empty">此家庭尚未建立毛孩</div>'}</div></section>
          <section class="family-file-section"><div class="section-head"><div><h3>費用討論</h3><p>是否收再次家訪費由保姆依個案提出並和你討論，不自動套固定規則。</p></div></div><div class="form-grid two">
            <label>目前決定<select name="feeDecision"><option value="pending_discussion" ${visit.fee_decision === "pending_discussion" ? "selected" : ""}>待討論</option><option value="confirmed" ${visit.fee_decision === "confirmed" ? "selected" : ""}>已確認收費</option><option value="waived" ${visit.fee_decision === "waived" ? "selected" : ""}>不收費</option></select></label>
            <label>保姆建議金額<input name="proposedFee" type="number" min="0" step="1" value="${Number(visit.proposed_fee || 0)}" /></label>
            <label>最後確認金額<input name="confirmedFee" type="number" min="0" step="1" value="${Number(visit.confirmed_fee || 0)}" /></label>
            <label class="wide">提出原因／討論紀錄<textarea name="feeReason" rows="3" maxlength="2000">${escapeHtml(visit.fee_reason || "")}</textarea></label>
            <label class="wide">後續要處理的事情<textarea name="followUpNotes" rows="3" maxlength="5000">${escapeHtml(visit.follow_up_notes || "")}</textarea></label>
          </div></section>
          <div class="form-actions"><button class="secondary-btn" type="button" id="backToFamilyFromVisit">回家庭檔案</button><button class="primary-btn" type="submit">儲存家訪紀錄</button></div>
        </form>`;
      document.getElementById("backToFamilyFromVisit").addEventListener("click", () => openFamilyEditor(visit.family_id));
      document.getElementById("homeVisitForm").addEventListener("submit", submitHomeVisitDraft);
    } catch (error) {
      dialog.close();
      showToast(error.message || String(error), true);
    }
  }

  function homeVisitPetForm(pet) {
    const record = pet.record || {};
    const textarea = (field, label, value) => `<label>${label}<textarea data-field="${field}" rows="2" maxlength="5000">${escapeHtml(value || "")}</textarea></label>`;
    return `<article class="home-visit-pet-form" data-pet-visit="${escapeHtml(pet.pet_id)}"><div class="home-visit-pet-heading"><div><span>毛孩紀錄</span><h4>${escapeHtml(pet.pet_name || "未填名字")}</h4></div><small>${escapeHtml([pet.species, pet.breed].filter(Boolean).join("／") || "種類待補")}</small></div><div class="form-grid two">${textarea("healthNotes", "健康與疾病", record.health_notes)}${textarea("medicationNotes", "用藥方式", record.medication_notes)}${textarea("feedingNotes", "餵食與飲水", record.feeding_notes)}${textarea("behaviorNotes", "個性與行為", record.behavior_notes)}${textarea("touchRestrictions", "不可碰觸／敏感部位", record.touch_restrictions)}${textarea("walkAndToiletNotes", "散步與如廁", record.walk_and_toilet_notes)}</div></article>`;
  }

  async function submitHomeVisitDraft(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    try {
      button.disabled = true;
      button.textContent = "正在儲存…";
      const value = name => form.elements[name].value;
      const petRecords = [...form.querySelectorAll("[data-pet-visit]")].map(section => {
        const field = name => section.querySelector(`[data-field="${name}"]`).value;
        return {
          petId: section.dataset.petVisit,
          healthNotes: field("healthNotes"),
          medicationNotes: field("medicationNotes"),
          feedingNotes: field("feedingNotes"),
          behaviorNotes: field("behaviorNotes"),
          touchRestrictions: field("touchRestrictions"),
          walkAndToiletNotes: field("walkAndToiletNotes"),
        };
      });
      await requestApi("saveHomeVisitDraft", {
        homeVisitId: value("homeVisitId"),
        visitType: value("visitType"),
        visitStatus: value("visitStatus"),
        scheduledAt: value("scheduledAt"),
        accessNotes: value("accessNotes"),
        environmentNotes: value("environmentNotes"),
        generalNotes: value("generalNotes"),
        feeDecision: value("feeDecision"),
        proposedFee: Number(value("proposedFee") || 0),
        confirmedFee: Number(value("confirmedFee") || 0),
        feeReason: value("feeReason"),
        followUpNotes: value("followUpNotes"),
        petRecords,
      });
      showToast("家訪紀錄已儲存");
      button.disabled = false;
      button.textContent = "儲存家訪紀錄";
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = "儲存家訪紀錄";
    }
  }

  function contractDisclosureChecklist(savedDisclosures) {
    const values = savedDisclosures && typeof savedDisclosures === "object" ? savedDisclosures : {};
    return CONTRACT_DISCLOSURE_GROUPS.map((group, groupIndex) => {
      const completed = group.items.filter(item => values[item.key] === true).length;
      return `
        <details class="contract-disclosure-group" ${groupIndex === 0 ? "open" : ""}>
          <summary><span>${escapeHtml(group.title)}</span><b>${completed}／${group.items.length} 已告知</b></summary>
          <div class="contract-disclosure-list">
            ${group.items.map(item => `
              <label class="contract-disclosure-item">
                <input type="checkbox" data-contract-disclosure="${escapeHtml(item.key)}" ${values[item.key] === true ? "checked" : ""} />
                <span><strong>已向飼主完整告知</strong><em>${escapeHtml(item.text)}</em></span>
              </label>
            `).join("")}
          </div>
        </details>`;
    }).join("");
  }

  async function openContractEditor(contractId) {
    dialogContent.innerHTML = '<section class="state-card compact-state"><div class="spinner" aria-hidden="true"></div><p>正在讀取完整合約資料…</p></section>';
    if (!dialog.open) dialog.showModal();
    try {
      const data = await requestApi("getContractDetails", { contractId });
      const contract = data.contract;
      const typed = contract.typed_party_data && typeof contract.typed_party_data === "object" ? contract.typed_party_data : {};
      const summary = data.sitterSummary || {};
      const savedDisclosures = typed.disclosures && typeof typed.disclosures === "object" ? typed.disclosures : {};
      dialogContent.innerHTML = `
        <div class="dialog-heading"><div class="dialog-title-block"><span class="eyebrow">線上合約草稿</span><h2>${escapeHtml(contract.template_name)}</h2></div><div class="family-identity"><span>家庭編號</span><strong>${escapeHtml(contract.family_id)}</strong></div></div>
        <form id="contractDraftForm" class="contract-draft-form">
          <input name="contractId" type="hidden" value="${escapeHtml(contract.contract_id)}" />
          <section class="notice-card contract-source-note"><strong>原文版本 ${escapeHtml(contract.template_version || "未標示")}</strong><span>來源：0821快樂小狗 Pinyu 寵物保姆服務合約.docx。這一版先建立可打字資料與保姆摘要；正式手寫簽名及鎖版 PDF 尚未啟用。</span></section>
          <section class="family-file-section"><div class="section-head"><div><h3>可打字的基本資料</h3><p>從家庭資料帶入後仍可在簽署前修正。</p></div></div><div class="form-grid two">
            <label>家訪日期<input name="homeVisitDate" type="date" value="${escapeHtml(typed.homeVisitDate || "")}" /></label>
            <label>飼主姓名<input name="ownerName" maxlength="100" value="${escapeHtml(typed.ownerName || data.family.owner_name || "")}" /></label>
            <label>聯絡電話<input name="phone" type="tel" maxlength="100" autocomplete="off" value="${escapeHtml(typed.phone || "")}" /></label>
            <label class="wide">服務地址<textarea name="address" rows="2" maxlength="1000" autocomplete="off">${escapeHtml(typed.address || "")}</textarea></label>
            <label>首次服務日期<input name="firstServiceDate" type="date" value="${escapeHtml(typed.firstServiceDate || "")}" /></label>
            <label>服務時數／方案<input name="servicePlan" maxlength="500" value="${escapeHtml(typed.servicePlan || "")}" /></label>
            <label class="wide">合約備註<textarea name="notes" rows="3" maxlength="2000">${escapeHtml(typed.notes || "")}</textarea></label>
          </div></section>
          <section class="family-file-section"><div class="section-head"><div><h3>本家庭毛孩</h3><p>合約與家訪會為每隻毛孩建立獨立段落。</p></div><span>${data.pets.length} 隻</span></div><div class="family-pet-list">${data.pets.length ? data.pets.map(familyPetSummary).join("") : '<div class="empty compact-empty">尚未建立毛孩</div>'}</div></section>
          <section class="family-file-section sitter-summary-section"><div class="section-head"><div><h3>保姆可見的緊急摘要</h3><p>不由 AI 決定；只顯示飼主明確填寫並由 OWNER 核准的答案。</p></div><span class="security-badge">限制存取</span></div><div class="form-grid two">
            <label>後續醫療決策方式 <span class="required-mark">必填</span><select name="emergencyAuthorizer" required><option value="">請選擇</option><option value="緊急聯絡人決定" ${summary.emergency_authorizer === "緊急聯絡人決定" || summary.emergency_authorizer === "緊急聯絡人" ? "selected" : ""}>由緊急聯絡人決定後續處置</option><option value="保姆依當下情況處理" ${summary.emergency_authorizer === "保姆依當下情況處理" ? "selected" : ""}>由保姆依當下情況判斷並安排必要醫療處置</option><option value="其他事前書面協議" ${summary.emergency_authorizer === "其他事前書面協議" || summary.emergency_authorizer === "其他事前協議" ? "selected" : ""}>依雙方其他事前書面協議處理</option></select></label>
            <label>緊急聯絡人姓名／關係<input name="emergencyContactName" maxlength="200" value="${escapeHtml(summary.emergency_contact_name || "")}" /></label>
            <label>緊急聯絡電話<input name="emergencyContactPhone" type="tel" maxlength="100" autocomplete="off" value="${escapeHtml(summary.emergency_contact_phone || "")}" /></label>
            <label class="wide">平常預約的獸醫院（名稱與地址） <span class="required-mark">必填</span><textarea name="regularHospital" rows="2" maxlength="500" required>${escapeHtml(summary.preferred_hospital || "")}</textarea></label>
            <label class="wide">24 小時急診獸醫院（名稱與地址） <span class="required-mark">必填</span><textarea name="emergencyHospital" rows="2" maxlength="500" required>${escapeHtml(summary.emergency_hospital || "")}</textarea></label>
            <label class="wide contract-consent-check"><input name="emergencyTransportConsent" type="checkbox" ${summary.emergency_transport_consent ? "checked" : ""} /><span><strong>同意必要時先行送醫</strong><em>若毛孩於服務期間發生緊急狀況，保姆得基於專業判斷於第一時間先行送醫，不須事前取得飼主或他人同意；醫療院所不以慣用醫院為限，並以毛孩生命安全為優先。</em></span></label>
            <label class="wide">其他事前協議<textarea name="treatmentNotes" rows="3" maxlength="3000">${escapeHtml(summary.treatment_notes || "")}</textarea></label>
            <label class="wide contract-consent-check approval-check"><input name="approvedByOwner" type="checkbox" ${summary.approved_by_owner ? "checked" : ""} /><span><strong>OWNER 已核對可見摘要</strong><em>以上內容可提供給已受指派、且僅於服務期間具有相應權限的保姆；完整身分資料與未授權的合約內容不會因此開放。</em></span></label>
          </div></section>
          <section class="family-file-section contract-disclosure-section"><div class="section-head"><div><h3>合約逐項告知紀錄</h3><p>依原合約完整語意逐項確認。勾選只代表完成說明，不取代正式簽署，也不會由 AI 自行判斷。</p></div><span>${CONTRACT_DISCLOSURE_GROUPS.reduce((sum, group) => sum + group.items.length, 0)} 項</span></div>${contractDisclosureChecklist(savedDisclosures)}</section>
          <section class="family-file-section signature-coming-soon"><h3>完整原版合約 PDF 與手寫簽名</h3><p>正式簽署頁會保留原合約的全部條文與版面，在原本空白處提供打字欄位，簽名處用平板手寫；逐項告知紀錄只作為保姆講解時的輔助，不會取代完整合約。完成版會保存合約版本、原文雜湊、鎖版 PDF 與存取紀錄。現在這一區仍是流程 DEMO，不會產生具有法律效力的假簽名。</p></section>
          <div class="form-actions"><button class="secondary-btn" type="button" id="backToFamily">返回家庭檔案</button><button class="primary-btn" type="submit">儲存合約草稿與摘要</button></div>
        </form>`;
      document.getElementById("backToFamily").addEventListener("click", () => openFamilyEditor(contract.family_id));
      document.getElementById("contractDraftForm").addEventListener("submit", submitContractDraft);
    } catch (error) {
      dialog.close();
      showToast(error.message || String(error), true);
    }
  }

  async function submitContractDraft(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const field = name => form.elements[name];
    const disclosureAcknowledgements = Object.fromEntries(
      [...form.querySelectorAll("[data-contract-disclosure]")].map(input => [input.dataset.contractDisclosure, input.checked])
    );
    try {
      button.disabled = true;
      button.textContent = "正在儲存…";
      await requestApi("saveContractDraft", {
        contractId: field("contractId").value,
        typedPartyData: {
          homeVisitDate: field("homeVisitDate").value,
          ownerName: field("ownerName").value,
          phone: field("phone").value,
          address: field("address").value,
          firstServiceDate: field("firstServiceDate").value,
          servicePlan: field("servicePlan").value,
          notes: field("notes").value,
          disclosures: disclosureAcknowledgements,
        },
        sitterSummary: {
          emergencyAuthorizer: field("emergencyAuthorizer").value,
          emergencyContactName: field("emergencyContactName").value,
          emergencyContactPhone: field("emergencyContactPhone").value,
          regularHospital: field("regularHospital").value,
          emergencyHospital: field("emergencyHospital").value,
          emergencyTransportConsent: field("emergencyTransportConsent").checked,
          treatmentNotes: field("treatmentNotes").value,
          approvedByOwner: field("approvedByOwner").checked,
        }
      });
      showToast("合約草稿與保姆摘要已儲存");
      button.disabled = false;
      button.textContent = "儲存合約草稿與摘要";
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = "儲存合約草稿與摘要";
    }
  }

  async function submitManagerForm(event, operation, successMessage) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    try {
      button.disabled = true;
      button.textContent = "正在儲存…";
      const payload = Object.fromEntries(new FormData(form).entries());
      if (operation === "createFamily") payload.travelFee = Number(payload.travelFee || 0);
      await requestApi(operation, payload);
      await loadBootstrap(false);
      showToast(successMessage);
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = operation === "createFamily" ? "建立測試家庭" : "建立測試毛孩";
    }
  }

  function familySelectOptions() {
    return state.families
      .map(family => ({ family, recent: getFamilyRecentService(family.family_id) }))
      .sort((left, right) => right.recent.timestamp - left.recent.timestamp)
      .map(({ family }) => `<option value="${escapeHtml(family.family_id)}">${escapeHtml(family.owner_name || "未填姓名")}｜${escapeHtml(family.family_id)}</option>`)
      .join("");
  }

  function renderSitterManagement() {
    if (!state.permissions.canManageSitters) {
      app.innerHTML = '<section class="panel empty">此帳號沒有管理保姆與抽成比例的權限</section>';
      return;
    }

    const today = localDateValue(new Date());
    if (!state.scheduleMonth) state.scheduleMonth = today.slice(0, 7);
    if (!state.selectedScheduleDate) state.selectedScheduleDate = today;
    if (!state.scheduleSitterId || !state.sitters.some(sitter => Number(sitter.sitter_id) === Number(state.scheduleSitterId))) {
      state.scheduleSitterId = state.sitters[0]?.sitter_id || null;
    }
    const selectedSitter = state.sitters.find(sitter => Number(sitter.sitter_id) === Number(state.scheduleSitterId));
    app.innerHTML = `
      <section class="notice-card form-notice"><strong>你同時是 OWNER 與保姆</strong><span>這一頁直接管理品伃本人與合作保姆的排班、帳號權限、抽成和訂單紀錄，不必另外開排班 Demo。</span></section>
      <section class="panel availability-panel">
        <div class="section-head schedule-heading"><div><span class="eyebrow">參考時間排程試算表</span><h2>保姆月班表</h2><p>月曆會一起顯示早、午、晚開放狀態與已指派需求單；點日期後再修改，不必逐列尋找。</p></div></div>
        ${selectedSitter ? sitterScheduleCalendar(selectedSitter) : '<div class="empty compact-empty">尚未建立任何保姆</div>'}
      </section>
      <details class="panel management-collapsible sitter-create-panel">
        <summary><div><h2>新增保姆</h2><p>需要建立合作保姆時再展開，不占用平常查看班表的空間。</p></div><span>展開設定</span></summary>
        <form id="createSitterForm" class="sitter-rate-form create-sitter-form">
          <label>保姆姓名 <span class="required-mark">必填</span><input name="displayName" maxlength="100" required /></label>
          <label>初始抽成比例（%） <span class="required-mark">必填</span><input name="ratePercent" type="number" min="0" max="100" step="0.1" required placeholder="例如：20" /></label>
          <label>生效日期 <span class="required-mark">必填</span><input name="effectiveFrom" type="date" value="${today}" required /></label>
          <label>設定原因<input name="changeNote" maxlength="500" placeholder="例如：合作初始比例" /></label>
          <button class="primary-btn" type="submit">建立保姆與比例</button>
        </form>
      </details>
      <details class="panel management-collapsible sitter-management-list">
        <summary><div><h2>保姆帳號、抽成與訂單歷史</h2><p>抽成採歷史版本；帳號權限與各保姆訂單紀錄都收在這裡。</p></div><span>查看 ${state.sitters.length} 位保姆</span></summary>
        <section class="sitter-list">
          ${state.sitters.length ? state.sitters.map(sitterManagementCard).join("") : '<section class="empty">尚未建立任何保姆</section>'}
        </section>
      </details>
    `;

    document.getElementById("createSitterForm").addEventListener("submit", event => submitSitterForm(event, "createSitter"));
    app.querySelectorAll("[data-rate-form]").forEach(form => {
      form.addEventListener("submit", event => submitSitterForm(event, "setSitterCommissionRate"));
    });
    app.querySelectorAll("[data-availability-form]").forEach(form => {
      form.addEventListener("submit", submitAvailabilityForm);
    });
    document.getElementById("scheduleSettingsForm")?.addEventListener("submit", submitScheduleSettings);
    document.getElementById("recurringBlockForm")?.addEventListener("submit", submitRecurringBlock);
    document.getElementById("cancelRecurringBlockEdit")?.addEventListener("click", () => {
      state.editingRecurringBlockId = null;
      renderSitterManagement();
    });
    app.querySelectorAll("[data-edit-recurring-block]").forEach(button => {
      button.addEventListener("click", () => {
        state.editingRecurringBlockId = Number(button.dataset.editRecurringBlock);
        renderSitterManagement();
        const configPanel = document.querySelector(".schedule-config");
        if (configPanel) configPanel.open = true;
        document.getElementById("recurringBlockForm")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
    app.querySelectorAll("[data-delete-recurring-block]").forEach(button => {
      button.addEventListener("click", () => deleteRecurringBlock(button));
    });
    app.querySelectorAll("[data-suppress-recurring-block]").forEach(button => {
      button.addEventListener("click", () => suppressRecurringBlockForDate(button));
    });
    app.querySelectorAll("[data-restore-recurring-block]").forEach(button => {
      button.addEventListener("click", () => restoreRecurringBlockForDate(button));
    });
    document.getElementById("scheduleSitterSelect")?.addEventListener("change", event => {
      state.scheduleSitterId = Number(event.currentTarget.value);
      renderSitterManagement();
    });
    app.querySelectorAll("[data-schedule-month]").forEach(button => {
      button.addEventListener("click", () => {
        const current = new Date(`${state.scheduleMonth}-01T12:00:00`);
        current.setMonth(current.getMonth() + Number(button.dataset.scheduleMonth));
        state.scheduleMonth = localDateValue(current).slice(0, 7);
        state.selectedScheduleDate = `${state.scheduleMonth}-01`;
        renderSitterManagement();
      });
    });
    document.getElementById("scheduleToday")?.addEventListener("click", () => {
      state.scheduleMonth = today.slice(0, 7);
      state.selectedScheduleDate = today;
      renderSitterManagement();
    });
    app.querySelectorAll("[data-schedule-date]").forEach(button => {
      button.addEventListener("click", () => {
        state.selectedScheduleDate = button.dataset.scheduleDate;
        renderSitterManagement();
        document.getElementById("scheduleEditor")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
    app.querySelectorAll("[data-time-preset]").forEach(button => {
      button.addEventListener("click", () => applyScheduleTimePreset(button.dataset.timePreset));
    });
    app.querySelectorAll("[data-delete-availability]").forEach(button => {
      button.addEventListener("click", () => deleteAvailability(button));
    });
    app.querySelectorAll("[data-sitter-access-form]").forEach(form => {
      form.addEventListener("submit", submitSitterAccessForm);
    });
    app.querySelectorAll("[data-generate-sitter-invite]").forEach(button => {
      button.addEventListener("click", () => generateSitterInvite(button));
    });
    app.querySelectorAll("[data-income-demand]").forEach(button => {
      button.addEventListener("click", () => openDemand(button.dataset.incomeDemand));
    });
  }

  const DEFAULT_SCHEDULE_PERIODS = [
    { key: "morning", short: "早", label: "上午", startsAt: "10:00", endsAt: "12:00" },
    { key: "afternoon", short: "午", label: "下午", startsAt: "13:00", endsAt: "16:00" },
    { key: "evening", short: "晚", label: "晚上", startsAt: "19:30", endsAt: "22:30" }
  ];

  function sitterScheduleSetting(sitter) {
    return state.sitterScheduleSettings.find(setting => Number(setting.sitter_id) === Number(sitter.sitter_id)) || {
      sitter_id: sitter.sitter_id,
      morning_start: "09:00", morning_end: "12:00",
      afternoon_start: "13:00", afternoon_end: "18:00",
      evening_start: "18:00", evening_end: "22:00",
      monthly_order_limit: null, buffer_minutes: 0
    };
  }

  function schedulePeriods(sitter) {
    const setting = sitterScheduleSetting(sitter);
    return [
      { key: "morning", short: "早", label: "早班", startsAt: String(setting.morning_start).slice(0, 5), endsAt: String(setting.morning_end).slice(0, 5) },
      { key: "afternoon", short: "午", label: "午班", startsAt: String(setting.afternoon_start).slice(0, 5), endsAt: String(setting.afternoon_end).slice(0, 5) },
      { key: "evening", short: "晚", label: "晚班", startsAt: String(setting.evening_start).slice(0, 5), endsAt: String(setting.evening_end).slice(0, 5) }
    ];
  }

  function sitterMonthlyDemandCount(sitter) {
    return sitterMonthlyDemandCountForMonth(sitter, state.scheduleMonth);
  }

  function sitterMonthlyDemandCountForMonth(sitter, monthKey) {
    const sitterName = normalize(sitter.display_name);
    const demandIds = new Set(state.orders.filter(order => {
      const assigned = Number(order.sitterId) === Number(sitter.sitter_id) || normalize(order.caregiver) === sitterName;
      const active = ["待執行", "待服務", "服務中"].some(status => normalize(order.status).includes(status));
      return assigned && active && String(order.serviceDate || "").startsWith(monthKey);
    }).map(order => order.displayOrderId || order.orderId));
    state.orderItemsScheduleV2.filter(item => {
      const order = v2ScheduleOrder(item);
      return Number(item.assigned_sitter_id) === Number(sitter.sitter_id) && item.item_status === "active" &&
        !["completed", "cancelled"].includes(order?.order_status) && String(item.service_date || "").startsWith(monthKey);
    }).forEach(item => demandIds.add(item.order_id));
    return demandIds.size;
  }

  function scheduleSettingsPanel(sitter) {
    const setting = sitterScheduleSetting(sitter);
    const blocks = state.sitterRecurringBlocks.filter(block => Number(block.sitter_id) === Number(sitter.sitter_id));
    if (state.editingRecurringBlockId && !blocks.some(block => Number(block.recurring_block_id) === Number(state.editingRecurringBlockId))) {
      state.editingRecurringBlockId = null;
    }
    const editingBlock = blocks.find(block => Number(block.recurring_block_id) === Number(state.editingRecurringBlockId)) || null;
    const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
    const today = localDateValue(new Date());
    const recurringRules = `<section class="recurring-rules-overview">
      <div><strong>固定排班規則</strong><span>這些是每週預設；可直接編輯或用 X 刪除整條規則。單日調整請到右側日期面板操作。</span></div>
      <div class="recurring-block-list">${blocks.length ? blocks.map(block => `<span><b>週${weekdayLabels[Number(block.weekday)]} ${escapeHtml(String(block.starts_at).slice(0, 5))}–${escapeHtml(String(block.ends_at).slice(0, 5))}</b>${escapeHtml(block.label)}<span class="recurring-rule-actions"><button type="button" data-edit-recurring-block="${escapeHtml(block.recurring_block_id)}" aria-label="編輯這條固定排班規則">編輯</button><button type="button" data-delete-recurring-block="${escapeHtml(block.recurring_block_id)}" aria-label="刪除整條固定排班規則">×</button></span></span>`).join("") : '<small>尚未設定固定排班規則</small>'}</div>
    </section>`;
    return `${recurringRules}<details class="schedule-config">
      <summary><div><strong>新增規則、班別快捷鍵與接單上限</strong><span>需要新增固定排班或調整早／午／晚時間時再展開</span></div><b>展開設定</b></summary>
      <div class="schedule-config-body">
        <form id="scheduleSettingsForm" class="schedule-settings-form">
          <input name="sitterId" type="hidden" value="${escapeHtml(sitter.sitter_id)}" />
          <label>早班開始<input name="morningStart" type="time" value="${escapeHtml(String(setting.morning_start).slice(0, 5))}" required /></label><label>早班結束<input name="morningEnd" type="time" value="${escapeHtml(String(setting.morning_end).slice(0, 5))}" required /></label>
          <label>午班開始<input name="afternoonStart" type="time" value="${escapeHtml(String(setting.afternoon_start).slice(0, 5))}" required /></label><label>午班結束<input name="afternoonEnd" type="time" value="${escapeHtml(String(setting.afternoon_end).slice(0, 5))}" required /></label>
          <label>晚班開始<input name="eveningStart" type="time" value="${escapeHtml(String(setting.evening_start).slice(0, 5))}" required /></label><label>晚班結束<input name="eveningEnd" type="time" value="${escapeHtml(String(setting.evening_end).slice(0, 5))}" required /></label>
          <label>每月需求單上限<input name="monthlyOrderLimit" type="number" min="1" max="200" value="${escapeHtml(setting.monthly_order_limit || "")}" placeholder="留白＝不限" /></label><label>預設緩衝分鐘<input name="bufferMinutes" type="number" min="0" max="240" value="${escapeHtml(setting.buffer_minutes || 0)}" required /></label>
          <button class="primary-btn compact" type="submit">儲存快捷鍵與上限</button>
        </form>
        <section class="recurring-blocks-section"><div><h4>${editingBlock ? "修改固定排班" : "新增每週固定排班"}</h4><p>${editingBlock ? "修改只會更新這一條規則，生效期間內的月曆會立即重算。" : "例如週一至週五 09:00–18:00 固定忙碌；私人名稱只在管理端顯示。"}</p></div>
          <form id="recurringBlockForm" class="recurring-block-form">
            <input name="sitterId" type="hidden" value="${escapeHtml(sitter.sitter_id)}" />
            <input name="recurringBlockId" type="hidden" value="${escapeHtml(editingBlock?.recurring_block_id || "")}" />
            <fieldset><legend>星期</legend>${weekdayLabels.map((label, index) => `<label><input name="weekdays" type="checkbox" value="${index}" ${Number(editingBlock?.weekday) === index ? "checked" : ""} /><span>${label}</span></label>`).join("")}</fieldset>
            <label>開始<input name="startsAt" type="time" value="${escapeHtml(editingBlock ? String(editingBlock.starts_at).slice(0, 5) : "09:00")}" required /></label><label>結束<input name="endsAt" type="time" value="${escapeHtml(editingBlock ? String(editingBlock.ends_at).slice(0, 5) : "18:00")}" required /></label>
            <label>私人名稱<input name="label" maxlength="100" value="${escapeHtml(editingBlock?.label || "固定工作")}" required /></label><label>生效日<input name="effectiveFrom" type="date" value="${escapeHtml(editingBlock?.effective_from || today)}" required /></label><label>結束日（可留白）<input name="effectiveUntil" type="date" value="${escapeHtml(editingBlock?.effective_until || "")}" /></label>
            <div class="recurring-form-actions"><button class="secondary-btn compact" type="submit">${editingBlock ? "儲存固定排班" : "加入固定時段"}</button>${editingBlock ? '<button class="ghost-btn compact" id="cancelRecurringBlockEdit" type="button">取消修改</button>' : ""}</div>
          </form>
        </section>
      </div>
    </details>`;
  }

  function sitterScheduleCalendar(sitter) {
    const monthDate = new Date(`${state.scheduleMonth}-01T12:00:00`);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthLabel = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" }).format(monthDate);
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let index = 0; index < firstWeekday; index += 1) cells.push('<div class="schedule-day empty-day" aria-hidden="true"></div>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${state.scheduleMonth}-${String(day).padStart(2, "0")}`;
      cells.push(scheduleDayCell(sitter, date, day));
    }
    while (cells.length % 7) cells.push('<div class="schedule-day empty-day" aria-hidden="true"></div>');

    const monthDates = Array.from({ length: daysInMonth }, (_, index) => `${state.scheduleMonth}-${String(index + 1).padStart(2, "0")}`);
    const dayStates = monthDates.map(date => overallScheduleDayStatus(sitter, date));
    const openCount = dayStates.filter(status => status === "available").length;
    const limitedCount = dayStates.filter(status => status === "limited").length;
    const fullCount = dayStates.filter(status => status === "unavailable").length;
    const monthlyDemandCount = sitterMonthlyDemandCount(sitter);
    const setting = sitterScheduleSetting(sitter);

    return `
      <div class="schedule-toolbar">
        <label class="schedule-sitter-picker"><span>查看保姆</span><select id="scheduleSitterSelect">${state.sitters.map(option => `<option value="${escapeHtml(option.sitter_id)}" ${Number(option.sitter_id) === Number(sitter.sitter_id) ? "selected" : ""}>${escapeHtml(option.display_name)}${option.display_name === "品伃" ? "（OWNER）" : ""}</option>`).join("")}</select></label>
        <div class="schedule-month-nav" aria-label="切換月份">
          <button type="button" data-schedule-month="-1" aria-label="上個月">‹</button>
          <strong>${escapeHtml(monthLabel)}</strong>
          <button type="button" data-schedule-month="1" aria-label="下個月">›</button>
          <button class="schedule-today-button" id="scheduleToday" type="button">今天</button>
        </div>
        <div class="schedule-summary" aria-label="本月班表摘要">
          <span class="capacity"><b>${monthlyDemandCount}${setting.monthly_order_limit ? `／${setting.monthly_order_limit}` : ""}</b> 張需求單</span>
          <span class="available"><b>${openCount}</b> 天開放</span>
          <span class="limited"><b>${limitedCount}</b> 天少量</span>
          <span class="unavailable"><b>${fullCount}</b> 天額滿</span>
        </div>
      </div>
      ${scheduleSettingsPanel(sitter)}
      <div class="schedule-legend"><span><i class="available"></i>開放（無限制時的預設）</span><span><i class="limited"></i>部分開放／少量</span><span><i class="unavailable"></i>額滿／不開放</span><small>月曆是摘要；實際承接仍以精確時間區間計算。需求單只在管理端顯示。</small></div>
      <div class="schedule-layout">
        <div class="schedule-calendar-wrap">
          <div class="schedule-weekdays">${["日", "一", "二", "三", "四", "五", "六"].map(day => `<span>${day}</span>`).join("")}</div>
          <div class="schedule-calendar">${cells.join("")}</div>
        </div>
        ${scheduleDayEditor(sitter)}
      </div>
    `;
  }

  function scheduleDayCell(sitter, date, day) {
    const today = localDateValue(new Date());
    const availability = effectiveAvailabilityForDate(sitter, date);
    const demands = sitterOrdersForDate(sitter, date);
    const selected = date === state.selectedScheduleDate;
    return `
      <button class="schedule-day ${date === today ? "today" : ""} ${selected ? "selected" : ""}" type="button" data-schedule-date="${date}" aria-label="編輯 ${date} 排班">
        <span class="schedule-day-number">${day}</span>
        <span class="schedule-period-list">
          ${availability.periods.map(period => {
            const status = period.status;
            return `<span class="schedule-period ${status}"><b>${period.short}</b>${scheduleStatusLabel(status)}</span>`;
          }).join("")}
        </span>
        ${demands.length ? `<span class="schedule-demand-count">${demands.length} 筆需求單</span>` : ""}
      </button>
    `;
  }

  function scheduleDayEditor(sitter) {
    const date = state.selectedScheduleDate;
    const dateObject = new Date(`${date}T12:00:00`);
    const dateLabel = Number.isFinite(dateObject.getTime())
      ? new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" }).format(dateObject)
      : date;
    const records = sitterAvailabilityForDate(sitter, date);
    const recurring = recurringBlocksForDate(sitter, date);
    const suppressedRecurring = suppressedRecurringBlocksForDate(sitter, date);
    const demands = sitterOrdersForDate(sitter, date);
    const statusLabels = { available: "開放", limited: "少量", unavailable: "額滿／不開放" };
    const emptyMessage = suppressedRecurring.length
      ? "今天的固定安排已移除；請在下方重新設定今天的可預約時段。"
      : recurring.length
        ? "目前沿用固定排班預設；需要調整時，先按固定安排右側的 X。"
        : "今天沒有任何限制，依規則為預設開放。";
    return `
      <aside class="schedule-editor" id="scheduleEditor">
        <div class="schedule-editor-head"><div><span>${escapeHtml(sitter.display_name)}</span><h3>${escapeHtml(dateLabel)}</h3></div><b>${demands.length ? `${demands.length} 筆需求單` : "尚無需求單"}</b></div>
        ${demands.length ? `<div class="schedule-demand-list">${demands.map(order => `<div><strong>${escapeHtml(order.displayOrderId || order.orderId)}</strong><span>${escapeHtml(order.owner || order.familyId || "家庭")}・${escapeHtml(order.specifiedTime || order.bookingSegment || "時間未指定")}</span></div>`).join("")}</div>` : ""}
        <div class="schedule-existing">
          <h4>當日設定</h4>
          ${recurring.length ? `<div class="recurring-day-note"><strong>今天套用的固定排班</strong>${recurring.map(block => `<span class="recurring-day-rule"><span>${escapeHtml(String(block.starts_at).slice(0, 5))}–${escapeHtml(String(block.ends_at).slice(0, 5))}・${escapeHtml(block.label)}</span><button type="button" data-suppress-recurring-block="${escapeHtml(block.recurring_block_id)}" data-exception-date="${escapeHtml(date)}" aria-label="只移除 ${escapeHtml(date)} 的固定安排">×</button></span>`).join("")}<small>按 X 只會移除今天，不會改到之後相同星期。</small></div>` : ""}
          ${suppressedRecurring.length ? `<div class="recurring-day-note suppressed"><strong>今天已移除的固定安排</strong>${suppressedRecurring.map(block => `<span class="recurring-day-rule"><span>${escapeHtml(String(block.starts_at).slice(0, 5))}–${escapeHtml(String(block.ends_at).slice(0, 5))}・${escapeHtml(block.label)}</span><button type="button" data-restore-recurring-block="${escapeHtml(block.recurring_block_id)}" data-exception-date="${escapeHtml(date)}">恢復</button></span>`).join("")}</div>` : ""}
          ${records.length ? records.map(slot => `<div class="availability-chip ${escapeHtml(slot.availability_status)}"><div><strong>${slot.starts_at && slot.ends_at ? `${escapeHtml(String(slot.starts_at).slice(0, 5))}–${escapeHtml(String(slot.ends_at).slice(0, 5))}` : "整天"}</strong><span>${escapeHtml(statusLabels[slot.availability_status] || slot.availability_status)}</span>${slot.public_note ? `<small>${escapeHtml(slot.public_note)}</small>` : ""}</div><button type="button" data-delete-availability="${escapeHtml(slot.availability_id)}" aria-label="刪除此排班">×</button></div>`).join("") : `<p class="availability-empty">${escapeHtml(emptyMessage)}</p>`}
        </div>
        <form class="availability-form schedule-editor-form" data-availability-form>
          <input name="sitterId" type="hidden" value="${escapeHtml(sitter.sitter_id)}" />
          <label class="wide">日期 <span class="required-mark">必填</span><input name="availableDate" type="date" value="${escapeHtml(date)}" required /></label>
          <fieldset class="schedule-status-options"><legend>開放狀態</legend><label><input name="availabilityStatus" type="radio" value="available" checked /><span>開放</span></label><label><input name="availabilityStatus" type="radio" value="limited" /><span>少量</span></label><label><input name="availabilityStatus" type="radio" value="unavailable" /><span>額滿／不開放</span></label></fieldset>
          <div class="schedule-time-presets"><span>快速套用時段</span>${schedulePeriods(sitter).map(period => `<button type="button" data-time-preset="${period.key}">${period.label}<small>${period.startsAt}–${period.endsAt}</small></button>`).join("")}<button type="button" data-time-preset="all">整天<small>不填時間</small></button></div>
          <label>開始時間<input name="startsAt" type="time" /></label>
          <label>結束時間<input name="endsAt" type="time" /></label>
          <label class="availability-note">公開備註<input name="publicNote" maxlength="300" placeholder="只寫客戶可以看到的說明；私人行程不要填在這裡" /></label>
          <label class="availability-note">管理端私人備註<input name="internalNote" maxlength="500" placeholder="例如：私人行程；不會顯示給客戶" /></label>
          <label>前後緩衝（分鐘）<input name="bufferMinutes" type="number" min="0" max="240" value="${escapeHtml(sitterScheduleSetting(sitter).buffer_minutes || 0)}" /></label>
          <button class="primary-btn compact" type="submit">儲存這個時段</button>
        </form>
        <p class="schedule-privacy-note">私人行程與詳細原因只留在管理端；客戶端之後只會看到可否承接與可選時段。</p>
      </aside>
    `;
  }

  function sitterAvailabilityForDate(sitter, date) {
    return state.sitterAvailability
      .filter(slot => Number(slot.sitter_id) === Number(sitter.sitter_id) && String(slot.available_date) === date)
      .sort((left, right) => String(left.starts_at || "").localeCompare(String(right.starts_at || "")));
  }

  function recurringBlocksForDate(sitter, date) {
    return recurringBlocksMatchingDate(sitter, date).filter(block => !recurringBlockExceptionForDate(block, date));
  }

  function suppressedRecurringBlocksForDate(sitter, date) {
    return recurringBlocksMatchingDate(sitter, date).filter(block => recurringBlockExceptionForDate(block, date));
  }

  function recurringBlocksMatchingDate(sitter, date) {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    return state.sitterRecurringBlocks.filter(block =>
      Number(block.sitter_id) === Number(sitter.sitter_id) &&
      Number(block.weekday) === weekday && block.is_enabled !== false &&
      String(block.effective_from) <= date && (!block.effective_until || String(block.effective_until) >= date)
    );
  }

  function recurringBlockExceptionForDate(block, date) {
    return state.sitterRecurringBlockExceptions.find(exception =>
      Number(exception.recurring_block_id) === Number(block.recurring_block_id) &&
      String(exception.exception_date) === date
    );
  }

  function sitterOrdersForDate(sitter, date) {
    const target = new Date(`${date}T00:00:00`).getTime();
    const sitterName = normalize(sitter.display_name);
    const legacy = state.orders.filter(order => {
      const assigned = Number(order.sitterId) === Number(sitter.sitter_id) || normalize(order.caregiver) === sitterName;
      const occupiesSchedule = ["待執行", "待服務", "服務中", "完成"].some(status => normalize(order.status).includes(status));
      return assigned && occupiesSchedule && extractServiceTimestamps(order.serviceDate).includes(target) && !normalize(order.status).includes("取消");
    });
    const v2 = state.orderItemsScheduleV2.filter(item => {
      const order = v2ScheduleOrder(item);
      return Number(item.assigned_sitter_id) === Number(sitter.sitter_id) && String(item.service_date) === date &&
        item.item_status === "active" && order?.order_status !== "cancelled";
    }).map(item => {
      const order = v2ScheduleOrder(item) || {};
      return {
        orderId: item.order_id,
        displayOrderId: order.order_number || item.order_id,
        familyId: order.family_id,
        owner: order.owner_name_snapshot,
        specifiedTime: item.start_time && item.end_time ? `${String(item.start_time).slice(0, 5)}–${String(item.end_time).slice(0, 5)}` : "時間未指定",
        bookingSegment: "V2 service item",
        durationMinutes: item.start_time && item.end_time ? timeToMinutes(item.end_time) - timeToMinutes(item.start_time) : 0,
        v2ScheduleItem: item
      };
    });
    return [...legacy, ...v2];
  }

  function v2ScheduleOrder(item) {
    return Array.isArray(item.orders) ? item.orders[0] : item.orders;
  }

  function orderAvailabilityIntervals(sitter, date) {
    const defaultBuffer = Number(sitterScheduleSetting(sitter).buffer_minutes || 0);
    return sitterOrdersForDate(sitter, date).flatMap(order => {
      if (order.v2ScheduleItem?.start_time && order.v2ScheduleItem?.end_time) {
        return [{
          orderId: order.orderId,
          startsAt: minutesToTime(Math.max(0, timeToMinutes(order.v2ScheduleItem.start_time) - defaultBuffer)),
          endsAt: minutesToTime(Math.min(24 * 60, timeToMinutes(order.v2ScheduleItem.end_time) + defaultBuffer)),
          status: "unavailable",
          source: "order_item"
        }];
      }
      const match = String(order.specifiedTime || "").match(/(\d{1,2}:\d{2})/);
      const start = match ? timeToMinutes(match[1]) : Number.NaN;
      const duration = Number(order.durationMinutes || 0);
      if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return [];
      return [{
        orderId: order.orderId,
        startsAt: minutesToTime(Math.max(0, start - defaultBuffer)),
        endsAt: minutesToTime(Math.min(24 * 60, start + duration + defaultBuffer)),
        status: "unavailable",
        source: "order"
      }];
    });
  }

  function effectiveAvailabilityForDate(sitter, date) {
    const setting = sitterScheduleSetting(sitter);
    return calculateAvailability({
      date,
      singleDay: sitterAvailabilityForDate(sitter, date),
      recurringBlocks: state.sitterRecurringBlocks.filter(block => Number(block.sitter_id) === Number(sitter.sitter_id)),
      recurringExceptions: state.sitterRecurringBlockExceptions,
      orders: orderAvailabilityIntervals(sitter, date),
      monthlyOrderLimit: setting.monthly_order_limit,
      monthlyOrderCount: sitterMonthlyDemandCountForMonth(sitter, date.slice(0, 7)),
      summaryPeriods: CALENDAR_SUMMARY_PERIODS
    });
  }

  function overallScheduleDayStatus(sitter, date) {
    return effectiveAvailabilityForDate(sitter, date).status;
  }

  function scheduleStatusLabel(status) {
    return { available: "開放", limited: "部分", unavailable: "額滿" }[status] || status;
  }

  function applyScheduleTimePreset(key) {
    const form = document.querySelector(".schedule-editor-form");
    if (!form) return;
    const sitter = state.sitters.find(candidate => Number(candidate.sitter_id) === Number(state.scheduleSitterId));
    const period = sitter ? schedulePeriods(sitter).find(candidate => candidate.key === key) : DEFAULT_SCHEDULE_PERIODS.find(candidate => candidate.key === key);
    form.elements.startsAt.value = period?.startsAt || "";
    form.elements.endsAt.value = period?.endsAt || "";
  }

  async function submitAvailabilityForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const originalText = button.textContent;
    try {
      button.disabled = true;
      button.textContent = "儲存中…";
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.sitterId = Number(payload.sitterId);
      await requestApi("saveSitterAvailability", payload);
      await loadBootstrap(false);
      showToast("排班已加入");
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function deleteAvailability(button) {
    const availabilityId = Number(button.dataset.deleteAvailability);
    if (!availabilityId || !window.confirm("確定刪除這筆排班嗎？")) return;
    try {
      button.disabled = true;
      await requestApi("deleteSitterAvailability", { availabilityId });
      await loadBootstrap(false);
      showToast("排班已刪除");
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
    }
  }

  async function submitScheduleSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    try {
      button.disabled = true;
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.sitterId = Number(payload.sitterId);
      payload.bufferMinutes = Number(payload.bufferMinutes || 0);
      payload.monthlyOrderLimit = payload.monthlyOrderLimit ? Number(payload.monthlyOrderLimit) : "";
      await requestApi("saveSitterScheduleSettings", payload);
      await loadBootstrap(false);
      showToast("班別快捷鍵與接單上限已儲存");
    } catch (error) {
      button.disabled = false;
      showToast(error.message || String(error), true);
    }
  }

  async function submitRecurringBlock(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    try {
      button.disabled = true;
      const data = new FormData(form);
      const payload = Object.fromEntries(data.entries());
      payload.sitterId = Number(payload.sitterId);
      payload.recurringBlockId = payload.recurringBlockId ? Number(payload.recurringBlockId) : null;
      payload.weekdays = data.getAll("weekdays").map(Number);
      await requestApi("saveSitterRecurringBlock", payload);
      const wasEditing = Boolean(payload.recurringBlockId);
      state.editingRecurringBlockId = null;
      await loadBootstrap(false);
      showToast(wasEditing ? "固定排班已更新，月曆已重新計算" : "固定忙碌時段已加入，月曆已重新計算");
    } catch (error) {
      button.disabled = false;
      showToast(error.message || String(error), true);
    }
  }

  async function deleteRecurringBlock(button) {
    const recurringBlockId = Number(button.dataset.deleteRecurringBlock);
    if (!recurringBlockId || !window.confirm("確定刪除這筆固定忙碌時段嗎？")) return;
    try {
      button.disabled = true;
      await requestApi("deleteSitterRecurringBlock", { recurringBlockId });
      await loadBootstrap(false);
      showToast("固定忙碌時段已刪除");
    } catch (error) {
      button.disabled = false;
      showToast(error.message || String(error), true);
    }
  }

  async function suppressRecurringBlockForDate(button) {
    const recurringBlockId = Number(button.dataset.suppressRecurringBlock);
    const exceptionDate = button.dataset.exceptionDate;
    if (!recurringBlockId || !exceptionDate || !window.confirm(`只移除 ${exceptionDate} 套用的這筆固定安排嗎？\n之後相同星期不會受影響。`)) return;
    try {
      button.disabled = true;
      await requestApi("suppressSitterRecurringBlockForDate", { recurringBlockId, exceptionDate });
      await loadBootstrap(false);
      showToast(`${exceptionDate} 已改為單日 Override，可重新設定當天時段`);
    } catch (error) {
      button.disabled = false;
      showToast(error.message || String(error), true);
    }
  }

  async function restoreRecurringBlockForDate(button) {
    const recurringBlockId = Number(button.dataset.restoreRecurringBlock);
    const exceptionDate = button.dataset.exceptionDate;
    if (!recurringBlockId || !exceptionDate) return;
    try {
      button.disabled = true;
      await requestApi("restoreSitterRecurringBlockForDate", { recurringBlockId, exceptionDate });
      await loadBootstrap(false);
      showToast(`${exceptionDate} 已恢復固定排班預設`);
    } catch (error) {
      button.disabled = false;
      showToast(error.message || String(error), true);
    }
  }

  function sitterManagementCard(sitter) {
    const rates = sitterRates(sitter.sitter_id);
    const orderEntries = getSitterOrderEntries(sitter);
    const today = localDateValue(new Date());
    const current = rateForDate(sitter.sitter_id, today);
    const latest = rates[0];
    const earliestNextDate = latest ? addDays(latest.effective_from, 1) : today;
    const nextEffectiveDate = earliestNextDate > today ? earliestNextDate : today;
    const access = state.sitterAccessProfiles.find(profile => Number(profile.sitter_id) === Number(sitter.sitter_id)) || {};
    const checked = key => access[key] ? "checked" : "";
    const bindingStatus = access.binding_status || "not_invited";
    const bindingLabel = {
      not_invited: "尚未邀請",
      invited: "已邀請，等待 LINE 綁定",
      bound: "LINE 已綁定，可登入",
      suspended: "帳號已暫停",
    }[bindingStatus] || "尚未邀請";
    const bindingControl = ["bound", "suspended"].includes(bindingStatus)
      ? `<label>帳號使用狀態<select name="bindingStatus"><option value="bound" ${bindingStatus === "bound" ? "selected" : ""}>啟用（LINE 已綁定）</option><option value="suspended" ${bindingStatus === "suspended" ? "selected" : ""}>暫停登入</option></select></label>`
      : `<input name="bindingStatus" type="hidden" value="${escapeHtml(bindingStatus)}" />`;
    return `
      <article class="panel sitter-card">
        <header class="sitter-card-head">
          <div><span class="eyebrow">保姆 #${escapeHtml(sitter.sitter_id)}</span><h2>${escapeHtml(sitter.display_name)}</h2><p>${sitter.status === "active" ? "合作中" : "已停用"}</p></div>
          <div class="current-rate ${current ? "" : "missing"}"><span>目前抽成</span><strong>${current ? formatPercent(current.rate_percent) : "待設定"}</strong><small>${current ? `${current.effective_from} 起適用` : "暫不計入抽成收入"}</small></div>
        </header>
        <div class="sitter-card-body">
          <section class="rate-history">
            <h3>抽成歷史</h3>
            ${rates.length ? `<ol>${rates.map(rateHistoryItem).join("")}</ol>` : '<div class="empty compact-empty">尚未設定任何比例</div>'}
          </section>
          <details class="new-rate-details" ${rates.length ? "" : "open"}>
            <summary>＋ 新增一筆抽成版本</summary>
            <form class="sitter-rate-form" data-rate-form>
              <input name="sitterId" type="hidden" value="${escapeHtml(sitter.sitter_id)}" />
              <label>新抽成比例（%） <span class="required-mark">必填</span><input name="ratePercent" type="number" min="0" max="100" step="0.1" required placeholder="例如：15" /></label>
              <label>生效日期 <span class="required-mark">必填</span><input name="effectiveFrom" type="date" min="${escapeHtml(earliestNextDate)}" value="${escapeHtml(nextEffectiveDate)}" required /></label>
              <label class="wide">調整原因<input name="changeNote" maxlength="500" placeholder="例如：熟練度提升，調整為 15%" /></label>
              <p class="rate-form-warning">儲存後會保留舊比例，不提供覆蓋舊紀錄。</p>
              <button class="primary-btn compact" type="submit">儲存新比例</button>
            </form>
          </details>
          <details class="new-rate-details sitter-access-details">
            <summary>保姆帳號、LINE 綁定與資料權限</summary>
            <form class="sitter-access-form" data-sitter-access-form>
              <input name="sitterId" type="hidden" value="${escapeHtml(sitter.sitter_id)}" />
              <div class="sitter-binding-panel">
                <div><span>目前帳號狀態</span><strong data-binding-status="${escapeHtml(sitter.sitter_id)}">${escapeHtml(bindingLabel)}</strong></div>
                <button class="secondary-btn compact" type="button" data-generate-sitter-invite="${escapeHtml(sitter.sitter_id)}">${bindingStatus === "bound" ? "重新產生綁定連結" : "產生 7 天有效 LINE 綁定連結"}</button>
              </div>
              ${bindingStatus === "bound" ? `<div class="sitter-line-profile"><div><span>LINE 暱稱</span><strong>${escapeHtml(access.line_display_name || "尚未取得；重新綁定後會帶入")}</strong></div><div><span>LINE UID（私密識別資料）</span><code>${escapeHtml(access.line_user_id || "尚未取得")}</code></div></div>` : ""}
              ${bindingControl}
              <div class="invite-link-result" data-invite-result="${escapeHtml(sitter.sitter_id)}" hidden></div>
              <fieldset class="sitter-permission-list"><legend>被指派訂單可見範圍</legend><label><input name="canViewAssignedFamilyBasics" type="checkbox" ${checked("can_view_assigned_family_basics")} />家庭與毛孩基本資料</label><label><input name="canViewAssignedAddress" type="checkbox" ${checked("can_view_assigned_address")} />服務地址</label><label><input name="canViewAssignedPhone" type="checkbox" ${checked("can_view_assigned_phone")} />客戶電話</label><label><input name="canViewContractSummary" type="checkbox" ${checked("can_view_contract_summary")} />已核准的合約／緊急摘要</label><label><input name="canViewReviews" type="checkbox" ${checked("can_view_reviews")} />與本人服務相關的評價</label></fieldset>
              <p class="rate-form-warning">保姆只能用你產生的單次邀請連結綁定自己的 LINE；家庭編號不是登入憑證。只會讀到被指派服務與你在此勾選的資料。</p>
              <button class="primary-btn compact" type="submit">儲存權限設定</button>
            </form>
          </details>
        </div>
        <details class="sitter-orders-details">
          <summary><span>訂單歷史</span><strong>${orderEntries.length} 張需求單</strong></summary>
          <div class="sitter-order-history-list">
            ${orderEntries.length ? orderEntries.map(incomeOrderCard).join("") : '<div class="empty compact-empty">目前沒有這位保姆的訂單紀錄</div>'}
          </div>
        </details>
      </article>
    `;
  }

  function getSitterOrderEntries(sitter) {
    return getDemandOrders().flatMap(demand => {
      const matchingLines = demand.lines.filter(line => normalize(line.caregiver) === normalize(sitter.display_name));
      if (!matchingLines.length) return [];
      const timestamps = matchingLines.flatMap(line => extractServiceTimestamps(line.serviceDate));
      const entry = createIncomeEntry(demand, "commission", timestamps.length ? Math.max(...timestamps) : demand.timestamp);
      matchingLines.forEach(line => {
        const lineTimestamps = extractServiceTimestamps(line.serviceDate);
        addLineToIncomeEntry(entry, line, lineTimestamps.length ? Math.max(...lineTimestamps) : 0);
      });
      return [entry];
    }).sort((left, right) => right.timestamp - left.timestamp);
  }

  function rateHistoryItem(rate) {
    const range = rate.effective_until
      ? `${rate.effective_from} ～ ${rate.effective_until}`
      : `${rate.effective_from} 起`;
    return `<li><div class="rate-value"><strong>${formatPercent(rate.rate_percent)}</strong><span>${escapeHtml(range)}</span></div><div class="rate-audit"><span>設定時間：${escapeHtml(formatDateTime(rate.created_at))}</span>${rate.change_note ? `<small>${escapeHtml(rate.change_note)}</small>` : ""}</div></li>`;
  }

  async function submitSitterForm(event, operation) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const originalText = button.textContent;
    try {
      button.disabled = true;
      button.textContent = "正在儲存…";
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.ratePercent = Number(payload.ratePercent);
      if (payload.sitterId) payload.sitterId = Number(payload.sitterId);
      await requestApi(operation, payload);
      await loadBootstrap(false);
      showToast(operation === "createSitter" ? "保姆與初始抽成比例已建立" : "新抽成比例已保存，舊比例仍保留");
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function submitSitterAccessForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const originalText = button.textContent;
    const checkbox = name => form.elements[name].checked;
    try {
      button.disabled = true;
      button.textContent = "正在儲存…";
      await requestApi("saveSitterAccessProfile", {
        sitterId: Number(form.elements.sitterId.value),
        bindingStatus: form.elements.bindingStatus.value,
        canViewAssignedFamilyBasics: checkbox("canViewAssignedFamilyBasics"),
        canViewAssignedAddress: checkbox("canViewAssignedAddress"),
        canViewAssignedPhone: checkbox("canViewAssignedPhone"),
        canViewContractSummary: checkbox("canViewContractSummary"),
        canViewReviews: checkbox("canViewReviews"),
      });
      await loadBootstrap(false);
      showToast("保姆帳號狀態與資料權限已儲存");
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function generateSitterInvite(button) {
    const sitterId = Number(button.dataset.generateSitterInvite);
    const result = app.querySelector(`[data-invite-result="${sitterId}"]`);
    const status = app.querySelector(`[data-binding-status="${sitterId}"]`);
    const originalText = button.textContent;
    try {
      button.disabled = true;
      button.textContent = "正在產生…";
      const data = await requestApi("generateSitterBindingInvite", { sitterId });
      const inviteUrl = new URL("/sitter-preview/", window.location.origin);
      inviteUrl.hash = new URLSearchParams({ invite: data.inviteToken }).toString();
      result.hidden = false;
      result.innerHTML = `<label>請私下傳給這位保姆（7 天內、只能使用一次）<input type="text" readonly value="${escapeHtml(inviteUrl.toString())}" /></label><div><small>有效至 ${escapeHtml(formatDateTime(data.expiresAt))}</small><button class="secondary-btn compact" type="button" data-copy-sitter-invite>複製連結</button></div>`;
      result.querySelector("[data-copy-sitter-invite]").addEventListener("click", async event => {
        try {
          await navigator.clipboard.writeText(inviteUrl.toString());
          event.currentTarget.textContent = "已複製";
        } catch {
          result.querySelector("input").select();
          showToast("請按 Ctrl+C 複製已選取的連結");
        }
      });
      if (status) status.textContent = "已邀請，等待 LINE 綁定";
      showToast("綁定連結已產生；請只私下傳給指定保姆");
    } catch (error) {
      showToast(error.message || String(error), true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function sitterRates(sitterId) {
    return state.sitterCommissionRates
      .filter(rate => Number(rate.sitter_id) === Number(sitterId))
      .sort((left, right) => String(right.effective_from).localeCompare(String(left.effective_from)));
  }

  function rateForDate(sitterId, date) {
    return sitterRates(sitterId).find(rate =>
      rate.effective_from <= date && (!rate.effective_until || rate.effective_until >= date)
    ) || null;
  }

  function addDays(isoDate, days) {
    const date = new Date(`${isoDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    return localDateValue(date);
  }

  function formatPercent(value) {
    const percent = Number(value || 0);
    return `${Number(percent.toFixed(2))}%`;
  }

  function renderServiceSettings() {
    const groups = groupServicePresets(state.servicePresets);
    if (!state.editingServiceSettings) {
      app.innerHTML = `
        <section class="notice-card form-notice"><strong>服務選單</strong><span>新增訂單會依這裡的服務、分鐘方案及新舊客價格自動帶入標準單價。</span></section>
        <section class="panel service-catalog-panel">
          <div class="section-head"><div><h2>服務與標準單價</h2><p>先查看目前設定；需要調整時再進入編輯模式，不會影響歷史訂單價格。</p></div><button id="editServiceSettings" class="primary-btn compact" type="button">編輯服務選單</button></div>
          <div class="service-catalog">
            ${groups.map(group => serviceCatalogGroup(group)).join("") || '<div class="empty">目前沒有服務選單</div>'}
          </div>
        </section>
      `;
      document.getElementById("editServiceSettings").addEventListener("click", () => {
        state.editingServiceSettings = true;
        renderServiceSettings();
      });
      return;
    }

    app.innerHTML = `
      <section class="notice-card form-notice"><strong>編輯模式</strong><span>服務大項只需命名一次，再於下方管理它的多個分鐘方案與新舊客價格。</span></section>
      <form id="presetForm" class="panel form-panel">
        <div class="section-head"><div><h2>編輯服務選單</h2><p>儲存後只套用於往後新增的訂單，歷史訂單價格不會改變。</p></div><button id="cancelPresetEdit" class="secondary-btn" type="button">取消編輯</button></div>
        <div id="presetGroups" class="preset-groups"></div>
        <div class="form-actions service-form-actions"><button id="addPresetGroup" class="secondary-btn" type="button">＋ 新增服務大項</button><button class="primary-btn" type="submit">儲存服務選單</button></div>
      </form>
    `;
    const container = document.getElementById("presetGroups");
    groups.forEach(group => addPresetGroup(container, group.name, group.presets));
    document.getElementById("addPresetGroup").addEventListener("click", () => addPresetGroup(container, "", []));
    document.getElementById("cancelPresetEdit").addEventListener("click", () => {
      state.editingServiceSettings = false;
      renderServiceSettings();
    });
    document.getElementById("presetForm").addEventListener("submit", submitPresetForm);
  }

  function groupServicePresets(presets) {
    const groups = new Map();
    presets.forEach(preset => {
      if (!groups.has(preset.name)) groups.set(preset.name, []);
      groups.get(preset.name).push(preset);
    });
    return [...groups.entries()].map(([name, items]) => ({
      name,
      presets: items.sort((left, right) => Number(left.durationMinutes) - Number(right.durationMinutes))
    }));
  }

  function serviceCatalogGroup(group) {
    return `
      <article class="service-category-card">
        <header><div><span>服務大項</span><h3>${escapeHtml(group.name)}</h3></div><b>${group.presets.length} 個時間方案</b></header>
        <div class="service-plan-table">
          <div class="service-plan-head" aria-hidden="true"><span>時間方案</span><span>舊客單價</span><span>新客單價</span></div>
          ${group.presets.map(preset => `<div class="service-plan-row"><strong>${escapeHtml(timePlanLabel(preset))}</strong><span>${formatMoney(preset.returningCustomerPrice)}</span><span>${formatMoney(preset.newCustomerPrice)}</span></div>`).join("")}
        </div>
      </article>
    `;
  }

  function addPresetGroup(container, name, presets) {
    const group = document.createElement("section");
    group.className = "preset-group";
    group.innerHTML = `
      <div class="preset-group-head">
        <label>服務大項<input name="categoryName" required maxlength="80" value="${escapeHtml(name)}" placeholder="例如：到府服務" /></label>
        <div><button class="secondary-btn compact add-plan" type="button">＋ 新增時間方案</button><button class="remove-group" type="button">刪除大項</button></div>
      </div>
      <div class="preset-plan-head" aria-hidden="true"><span>分鐘</span><span>舊客單價</span><span>新客單價</span><span></span></div>
      <div class="preset-plan-rows"></div>
    `;
    const rows = group.querySelector(".preset-plan-rows");
    const initialPresets = presets.length ? presets : [{
      id: `service-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      durationMinutes: 30,
      returningCustomerPrice: 0,
      newCustomerPrice: 0
    }];
    initialPresets.forEach(preset => addPresetPlanRow(rows, preset));
    group.querySelector(".add-plan").addEventListener("click", () => addPresetPlanRow(rows, {
      id: `service-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      durationMinutes: 30,
      returningCustomerPrice: 0,
      newCustomerPrice: 0
    }));
    group.querySelector(".remove-group").addEventListener("click", () => group.remove());
    container.appendChild(group);
  }

  function addPresetPlanRow(container, preset) {
    const row = document.createElement("div");
    row.className = "preset-row";
    row.dataset.presetId = preset.id;
    row.innerHTML = `
      <label><span>分鐘</span><input name="durationMinutes" type="number" min="0" max="1440" step="1" required value="${Number(preset.durationMinutes || 0)}" /></label>
      <label><span>舊客單價</span><input name="returningCustomerPrice" type="number" min="0" step="1" required value="${Number(preset.returningCustomerPrice || 0)}" /></label>
      <label><span>新客單價</span><input name="newCustomerPrice" type="number" min="0" step="1" required value="${Number(preset.newCustomerPrice || 0)}" /></label>
      <button class="remove-preset" type="button" aria-label="刪除時間方案">×</button>
    `;
    row.querySelector(".remove-preset").addEventListener("click", () => row.remove());
    container.appendChild(row);
  }

  async function submitPresetForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    try {
      const presets = [...document.querySelectorAll(".preset-group")].flatMap(group => {
        const name = group.querySelector('[name="categoryName"]').value.trim();
        return [...group.querySelectorAll(".preset-row")].map(row => ({
          id: row.dataset.presetId,
          name,
          durationMinutes: Number(row.querySelector('[name="durationMinutes"]').value || 0),
          returningCustomerPrice: Number(row.querySelector('[name="returningCustomerPrice"]').value || 0),
          newCustomerPrice: Number(row.querySelector('[name="newCustomerPrice"]').value || 0)
        }));
      });
      if (!presets.length) throw new Error("至少保留一個服務類別");
      button.disabled = true;
      button.textContent = "正在儲存…";
      const result = await requestApi("saveServicePresets", { presets });
      state.servicePresets = result.servicePresets;
      state.editingServiceSettings = false;
      renderServiceSettings();
      showToast("快速服務選單已儲存");
    } catch (error) {
      showToast(error.message || String(error), true);
      button.disabled = false;
      button.textContent = "儲存服務選單";
    }
  }

  function getMonthlyIncomeEntries(scope) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const entries = [];

    getDemandOrders().forEach(demand => {
      const groupedLines = new Map();
      demand.lines.forEach(line => {
        const timestamps = extractServiceTimestamps(line.serviceDate);
        const serviceStart = timestamps.length ? Math.min(...timestamps) : 0;
        if (!serviceStart) return;
        const serviceDate = new Date(serviceStart);
        if (serviceDate.getFullYear() !== year || serviceDate.getMonth() !== month) return;
        if (normalize(line.status).includes("取消")) return;
        if (scope === "completed" && !isCompletedStatus(line.status)) return;

        const incomeType = lineIncomeType(line);
        const category = incomeType === "self" ? "self" : "commission";
        const current = groupedLines.get(category) || createIncomeEntry(demand, category, serviceStart);
        addLineToIncomeEntry(current, line, serviceStart);
        groupedLines.set(category, current);
      });
      entries.push(...groupedLines.values());
    });

    return entries.sort((left, right) => right.timestamp - left.timestamp);
  }

  function createIncomeEntry(demand, category, timestamp = 0) {
    return {
      demand,
      category,
      pending: false,
      netIncome: 0,
      commissionAmount: 0,
      orderTotal: 0,
      discountAmount: 0,
      ratePercents: [],
      caregivers: [],
      serviceDates: [],
      orderSources: [],
      statuses: [],
      timestamp
    };
  }

  function addLineToIncomeEntry(entry, line, timestamp = 0) {
    const incomeType = lineIncomeType(line);
    const ratePercent = lineCommissionRatePercent(line);
    entry.pending = entry.pending || incomeType === "commission-pending";
    entry.netIncome += recognizedLineNetIncome(line);
    entry.commissionAmount += recognizedLineCommission(line);
    entry.orderTotal += recognizedLineDiscountedTotal(line);
    entry.discountAmount += recognizedLineDiscountAmount(line);
    entry.ratePercents = unique([...entry.ratePercents, ...(ratePercent === null ? [] : [ratePercent])]);
    entry.caregivers = unique([...entry.caregivers, line.caregiver].filter(Boolean));
    entry.serviceDates = unique([...entry.serviceDates, line.serviceDate].filter(Boolean));
    entry.orderSources = unique([...entry.orderSources, line.orderSource].filter(Boolean));
    entry.statuses = unique([...entry.statuses, line.status].filter(Boolean));
    entry.timestamp = Math.max(entry.timestamp, timestamp);
    return entry;
  }

  function lineIncomeType(line) {
    if (line.providerType === "self") return "self";
    if (line.providerType === "sitter") return "commission";
    const caregiver = normalize(line.caregiver);
    const adminName = normalize(state.user?.displayName);
    if (!caregiver || caregiver === "品伃" || caregiver === adminName) return "self";
    return historicalRateForLine(line) ? "commission" : "commission-pending";
  }

  function historicalRateForLine(line) {
    const sitter = state.sitters.find(candidate => normalize(candidate.display_name) === normalize(line.caregiver));
    const serviceDate = splitServiceDate(line.serviceDate)[0];
    return sitter && serviceDate ? rateForDate(sitter.sitter_id, serviceDate) : null;
  }

  function lineCommissionRatePercent(line) {
    if (line.providerType === "sitter" && Number(line.commissionRate) >= 0) {
      return Number(line.commissionRate || 0) * 100;
    }
    const rate = historicalRateForLine(line);
    return rate ? Number(rate.rate_percent) : null;
  }

  function recognizedLineNetIncome(line) {
    const incomeType = lineIncomeType(line);
    if (incomeType === "commission-pending") return 0;
    if (line.providerType === "sitter") return recognizedLineCommission(line) - recognizedLineDiscountAmount(line);
    if (line.providerType === "self" || incomeType === "self") return Number(line.netIncome || 0);
    const rate = historicalRateForLine(line);
    if (!rate) return 0;
    const commission = Number(line.serviceSubtotal || 0) * Number(rate.rate_percent) / 100;
    const discount = recognizedLineDiscountAmount(line);
    return commission - discount;
  }

  function recognizedLinePreDiscountTotal(line) {
    const calculated = Number(line.serviceSubtotal || 0) + Number(line.travelSubtotal || 0) +
      Number(line.tip || 0) + Number(line.homeVisitFee || 0);
    return calculated > 0 ? calculated : Math.max(Number(line.totalBeforeDiscount || 0), Number(line.total || 0), 0);
  }

  function recognizedLineDiscountedTotal(line) {
    const beforeDiscount = recognizedLinePreDiscountTotal(line);
    const discountPercent = Math.min(Math.max(Number(line.discountPercent || 0), 0), 100);
    return Math.round(beforeDiscount * (1 - discountPercent / 100) * 100) / 100;
  }

  function recognizedLineDiscountAmount(line) {
    return Math.max(recognizedLinePreDiscountTotal(line) - recognizedLineDiscountedTotal(line), 0);
  }

  function recognizedLineUnpaidBalance(line) {
    if (normalize(line.orderSource) === normalize("毛小愛")) return 0;
    return Math.max(recognizedLineDiscountedTotal(line) - Number(line.paidAmount || 0), 0);
  }

  function recognizedLineCommission(line) {
    if (line.providerType === "sitter") return Number(line.commissionAmount || 0);
    const rate = historicalRateForLine(line);
    return rate ? Number(line.serviceSubtotal || 0) * Number(rate.rate_percent) / 100 : Number(line.commissionAmount || 0);
  }

  function recognizedLineSitterPayout(line) {
    if (line.providerType === "sitter") return Number(line.sitterPayout || 0);
    const rate = historicalRateForLine(line);
    if (!rate) return Number(line.sitterPayout || 0);
    return Number(line.serviceSubtotal || 0) - recognizedLineCommission(line) +
      Number(line.travelSubtotal || 0) + Number(line.tip || 0) + Number(line.homeVisitFee || 0);
  }

  function getDemandOrders() {
    const grouped = new Map();
    state.orders.forEach(order => {
      const demandId = String(order.displayOrderId || order.orderId || "未編號");
      if (!grouped.has(demandId)) grouped.set(demandId, []);
      grouped.get(demandId).push(order);
    });
    return [...grouped.entries()].map(([demandId, lines]) => {
      const timestamps = lines.flatMap(line => extractServiceTimestamps(line.serviceDate));
      const fallback = Math.max(...lines.map(line => Date.parse(line.establishedAt || line.createdAt || "") || 0), 0);
      return {
        demandId,
        lines,
        familyId: lines.find(line => line.familyId)?.familyId || "",
        owner: lines.find(line => line.owner)?.owner || "",
        pets: unique(lines.map(line => line.pet).filter(Boolean)),
        caregivers: unique(lines.map(line => line.caregiver).filter(Boolean)),
        statuses: unique(lines.map(line => line.status).filter(Boolean)),
        serviceDates: unique(lines.map(line => line.serviceDate).filter(Boolean)),
        timestamps,
        timestamp: timestamps.length ? Math.max(...timestamps) : fallback,
        nearestTimestamp: nearestTimestamp(timestamps, fallback),
        total: lines.reduce((sum, line) => sum + recognizedLineDiscountedTotal(line), 0),
        totalBeforeDiscount: lines.reduce((sum, line) => sum + recognizedLinePreDiscountTotal(line), 0),
        paidAmount: lines.reduce((sum, line) => sum + Number(line.paidAmount || 0), 0),
        unpaidBalance: lines.reduce((sum, line) => sum + recognizedLineUnpaidBalance(line), 0),
        requiredDeposit: lines.reduce((sum, line) => sum + Number(line.requiredDeposit || 0), 0),
        suggestedRequiredDeposit: lines.reduce((sum, line) => sum + Number(line.suggestedRequiredDeposit || 0), 0),
        depositLocked: lines.some(line => line.depositLocked),
        lockedRequiredDeposit: lines.reduce((sum, line) => sum + Number(line.lockedRequiredDeposit || 0), 0),
        depositLockedAt: lines.find(line => line.depositLockedAt)?.depositLockedAt || "",
        additionalDepositSuggested: lines.reduce((sum, line) => sum + Number(line.additionalDepositSuggested || 0), 0),
        customRequiredDeposit: lines.reduce((sum, line) => sum + Number(line.customRequiredDeposit || 0), 0),
        commissionAmount: lines.reduce((sum, line) => sum + recognizedLineCommission(line), 0),
        sitterPayout: lines.reduce((sum, line) => sum + recognizedLineSitterPayout(line), 0),
        netIncome: lines.reduce((sum, line) => sum + recognizedLineNetIncome(line), 0),
        hasPendingCommission: lines.some(line => lineIncomeType(line) === "commission-pending"),
        platformReceivable: lines.reduce((sum, line) => sum + Number(line.platformReceivable || 0), 0),
        platformPayoutStatuses: unique(lines.map(line => line.platformPayoutStatus).filter(Boolean)),
        orderSources: unique(lines.map(line => line.orderSource).filter(Boolean)),
        providerTypes: unique(lines.map(line => line.providerType === "legacy" && historicalRateForLine(line) ? "sitter" : line.providerType).filter(Boolean)),
        isDemo: lines.some(line => line.isDemo),
        notes: unique(lines.map(line => line.notes).filter(Boolean))
      };
    }).map(demand => ({
      ...demand,
      discountAmount: Math.max(demand.totalBeforeDiscount - demand.total, 0),
      discountRate: demand.totalBeforeDiscount > 0 ? demand.total / demand.totalBeforeDiscount : 1
    })).sort((left, right) => right.timestamp - left.timestamp);
  }

  function nearestTimestamp(timestamps, fallback = 0) {
    const candidates = timestamps.length ? timestamps : (fallback ? [fallback] : []);
    const now = Date.now();
    return candidates.reduce((nearest, timestamp) =>
      !nearest || Math.abs(timestamp - now) < Math.abs(nearest - now) ? timestamp : nearest
    , 0);
  }

  function compareDemandByServiceProximity(left, right) {
    const now = Date.now();
    const leftDistance = left.nearestTimestamp ? Math.abs(left.nearestTimestamp - now) : Number.POSITIVE_INFINITY;
    const rightDistance = right.nearestTimestamp ? Math.abs(right.nearestTimestamp - now) : Number.POSITIVE_INFINITY;
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    const leftIsFuture = left.nearestTimestamp >= now;
    const rightIsFuture = right.nearestTimestamp >= now;
    if (leftIsFuture !== rightIsFuture) return leftIsFuture ? -1 : 1;
    return left.nearestTimestamp - right.nearestTimestamp;
  }

  function getFamilyRecentService(familyId) {
    const timestamps = state.orders
      .filter(order => order.familyId === familyId)
      .flatMap(order => extractServiceTimestamps(order.serviceDate));
    return { timestamp: timestamps.length ? Math.max(...timestamps) : 0 };
  }

  function extractServiceTimestamps(value) {
    const currentYear = new Date().getFullYear();
    return (String(value || "").match(/\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/g) || []).flatMap(raw => {
      const parts = raw.replaceAll("-", "/").split("/").map(Number);
      if (parts[0] < 2000 || parts[0] > currentYear + 2) return [];
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return [];
      return [date.getTime()];
    });
  }

  function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }

  function isWithinRecentServiceRange(demand) {
    const lowerBound = new Date();
    lowerBound.setHours(0, 0, 0, 0);
    lowerBound.setMonth(lowerBound.getMonth() - 3);
    const upperBound = new Date();
    upperBound.setHours(23, 59, 59, 999);
    upperBound.setMonth(upperBound.getMonth() + 3);
    return demand.timestamps.some(timestamp =>
      timestamp >= lowerBound.getTime() && timestamp <= upperBound.getTime()
    );
  }

  function isClosedStatus(status) {
    const normalized = normalize(status);
    return isCompletedStatus(status) || normalized.includes("取消");
  }

  function isCompletedStatus(status) {
    return normalize(status) === "完成";
  }

  function serviceLabel(order) {
    return unique([order.serviceType, order.planName].filter(Boolean)).join("／") || "未填服務";
  }

  function statusTag(status) {
    const label = String(status || "未填狀態");
    return `<span class="tag status-tag ${statusClass(label)}">${escapeHtml(label)}</span>`;
  }

  function providerLabel(values) {
    if (values.includes("sitter")) return "其他保姆";
    if (values.includes("self")) return "我本人";
    return "舊資料未分類";
  }

  function payoutStatusLabel(values) {
    if (values.includes("pending")) return "毛小愛待撥款";
    if (values.includes("received")) return "毛小愛已撥款";
    return "平台撥款狀態未註記";
  }

  function statusClass(status) {
    const normalized = normalize(status);
    if (normalized.includes("未付訂金")) return "status-unpaid-deposit";
    if (normalized.includes("待付尾款") || normalized.includes("未付尾款") || normalized.includes("欠款")) return "status-unpaid-balance";
    if (normalized.includes("待服務") || normalized.includes("待執行") || normalized.includes("服務中") || normalized.includes("已確認")) return "status-in-progress";
    if (isCompletedStatus(status)) return "status-completed";
    if (normalized.includes("常客")) return "status-regular";
    if (normalized.includes("取消")) return "status-cancelled";
    if (normalized.includes("草稿")) return "status-draft";
    return "status-default";
  }

  function unique(values) {
    return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
  }

  function formatDateOnly(timestamp) {
    return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
  }

  function formatDateTime(value) {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp)
      ? new Intl.DateTimeFormat("zh-TW", {
          timeZone: "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }).format(new Date(timestamp))
      : "未記錄";
  }

  function showState(message) {
    app.innerHTML = `<section class="state-card"><div class="spinner" aria-hidden="true"></div><p>${escapeHtml(message)}</p></section>`;
  }

  function showError(error) {
    app.innerHTML = `<section class="state-card error-state"><h2>無法開啟測試後台</h2><p>${escapeHtml(error.message || String(error))}</p><button class="primary-btn" id="retryButton" type="button">再試一次</button></section>`;
    document.getElementById("retryButton").addEventListener("click", () => window.location.reload());
  }

  let toastTimer = 0;
  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast show${isError ? " error" : ""}`;
    toastTimer = window.setTimeout(() => { toast.className = "toast"; }, 3200);
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, "");
  }

  function formatMoney(value) {
    const number = Number(value || 0);
    return `$${Math.round(number).toLocaleString("zh-TW")}`;
  }

  function formatFactor(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number >= 1) return "原價";
    return `${Number((Math.max(number, 0) * 10).toFixed(2))} 折`;
  }

  function tomorrowDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
