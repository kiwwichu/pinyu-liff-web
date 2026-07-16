(() => {
  "use strict";
  const config = window.ADMIN_CONFIG || {};
  const state = {
    permissions: {},
    recentOrders: [],
    allOrders: [],
    pendingNotifications: [],
    page: "dashboard",
    orderFilter: "current"
  };

  const app = document.getElementById("app");
  document.addEventListener("DOMContentLoaded", init);
  document.getElementById("btnRefresh").addEventListener("click", () => loadBootstrap(true));

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });

  async function init() {
    try {
      if (!config.LIFF_ID || !config.API_URL) {
        throw new Error("請先在 config.js 填入 LIFF_ID 與 API_URL");
      }

      await liff.init({ liffId: config.LIFF_ID });

      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      await loadBootstrap(false);
    } catch (err) {
      showError(err);
    }
  }

  async function loadBootstrap(showLoading) {
    if (showLoading) showState("正在重新整理…");

    const idToken = liff.getIDToken();
    if (!idToken) throw new Error("無法取得 LINE ID token");

    const body = new URLSearchParams({
      action: "adminPortal",
      op: "bootstrap",
      payload: JSON.stringify({ idToken })
    });

    const response = await fetch(config.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString()
    });

    const data = JSON.parse(await response.text());

    if (!data.success) {
      throw new Error(data.message || "管理員驗證失敗");
    }

    state.permissions = data.permissions || {};
    state.recentOrders = data.recentOrders || [];
    state.allOrders = data.allOrders || [];
    state.pendingNotifications = data.pendingNotifications || [];

    navigate(state.page);
  }

  function navigate(page) {
    state.page = page;
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });

    if (page === "dashboard") renderDashboard();
    else if (page === "orders") renderOrders();
    else if (page === "notifications") renderNotifications();
    else renderPlaceholder(page);
  }

  function renderDashboard() {
    app.innerHTML = "";
    app.appendChild(document.getElementById("dashboardTemplate").content.cloneNode(true));

    document.getElementById("recentCount").textContent = state.recentOrders.length;
    document.getElementById("pendingCount").textContent = state.pendingNotifications.length;

    renderOrderCards(document.getElementById("recentOrders"), state.recentOrders.slice(0,5), false);
    renderOrderCards(document.getElementById("pendingNotifications"), state.pendingNotifications.slice(0,3), true);

    app.querySelectorAll("[data-open]").forEach(btn => {
      btn.addEventListener("click", () => navigate(btn.dataset.open));
    });
  }

  function renderOrders() {
    app.innerHTML = "";
    app.appendChild(document.getElementById("ordersTemplate").content.cloneNode(true));

    const search = document.getElementById("orderSearch");
    const target = document.getElementById("orderResults");

    const refresh = () => {
      const keyword = normalize(search.value);
      const list = state.allOrders.filter(order => {
        const isOther = ["完成", "未付訂金"].includes(order.status);
        const filterOk =
          state.orderFilter === "all" ||
          (state.orderFilter === "other" && isOther) ||
          (state.orderFilter === "current" && !isOther);

        return filterOk && (!keyword || normalize(order.searchText).includes(keyword));
      });

      renderOrderCards(target, list, false);
    };

    search.addEventListener("input", refresh);

    app.querySelectorAll("[data-order-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.orderFilter = btn.dataset.orderFilter;
        app.querySelectorAll("[data-order-filter]").forEach(x => x.classList.toggle("active", x === btn));
        refresh();
      });
    });

    refresh();
  }

  function renderNotifications() {
    app.innerHTML = "";
    app.appendChild(document.getElementById("notificationsTemplate").content.cloneNode(true));
    renderOrderCards(document.getElementById("notificationResults"), state.pendingNotifications, true);
  }

  function renderPlaceholder(page) {
    app.innerHTML = "";
    app.appendChild(document.getElementById("placeholderTemplate").content.cloneNode(true));

    const map = {
      create: ["新增訂單／家庭", "下一階段加入快速複製、全新訂單與新增家庭。"],
      visits: ["到府明細", "下一階段加入今日行程、未來14天、同步異常與撞期資料。"]
    };

    const [title, text] = map[page] || ["功能建置中", "這個頁面尚未接線。"];
    document.getElementById("placeholderTitle").textContent = title;
    document.getElementById("placeholderText").textContent = text;
  }

  function renderOrderCards(container, orders, warning) {
    container.innerHTML = "";

    if (!orders.length) {
      container.innerHTML = '<div class="empty">目前沒有資料</div>';
      return;
    }

    orders.forEach(order => {
      const card = document.createElement("article");
      card.className = "order-card" + (warning ? " warning" : "");

      const totalHtml = state.permissions.canViewAmount
        ? `<div>總金額：${escapeHtml(order.total || 0)} 元</div>`
        : "";

      card.innerHTML = `
        <div class="order-title">
          <strong>${escapeHtml(order.owner || "未填姓名")}｜${escapeHtml(order.pet || "未填毛孩")}</strong>
          <span class="status">${escapeHtml(order.status || "—")}</span>
        </div>
        <div class="meta">
          <div>服務日期：${escapeHtml(order.serviceDate || "—")}</div>
          <div>家庭編號：${escapeHtml(order.familyId || "—")}</div>
          ${warning ? `<div>通知：${escapeHtml(order.notifyStatus || "—")}</div>` : ""}
          ${totalHtml}
        </div>
        <div class="card-actions">
          <button class="action-btn">查看詳情</button>
          ${warning && state.permissions.canSendNotification ? '<button class="action-btn primary">立即發送</button>' : ""}
        </div>
      `;

      container.appendChild(card);
    });
  }

  function showState(text) {
    app.innerHTML = `<section class="state-card"><div class="spinner"></div><p>${escapeHtml(text)}</p></section>`;
  }

  function showError(err) {
    app.innerHTML = `<section class="state-card"><h2>無法開啟管理後台</h2><p>${escapeHtml(err.message || String(err))}</p></section>`;
  }

  function normalize(v) {
    return String(v || "").toLowerCase().replace(/\s+/g, "");
  }

  function escapeHtml(v) {
    return String(v)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
})();
