(() => {
  "use strict";

  const config = window.SITTER_CONFIG || {};
  const authPanel = document.getElementById("authPanel");
  const authTitle = document.getElementById("authTitle");
  const authMessage = document.getElementById("authMessage");
  const loginButton = document.getElementById("loginButton");
  const accountState = document.getElementById("accountState");
  const workspace = document.getElementById("workspace");
  const INVITE_STORAGE_KEY = "pinyu_sitter_invite";

  function captureInviteToken() {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.replace(/^#/u, ""));
    const inviteToken = fragment.get("invite");
    if (inviteToken) {
      window.sessionStorage.setItem(INVITE_STORAGE_KEY, inviteToken);
      url.hash = "";
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
    return window.sessionStorage.getItem(INVITE_STORAGE_KEY);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
    })[character]);
  }

  async function requestApi(operation, accessToken, extra = {}) {
    const response = await fetch(config.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, accessToken, ...extra }),
    });
    const data = await response.json().catch(() => ({ success: false, message: "伺服器回應格式錯誤" }));
    if (!response.ok || !data.success) throw new Error(data.message || `操作失敗（HTTP ${response.status}）`);
    return data;
  }

  function showError(message) {
    authPanel.classList.add("error");
    authTitle.textContent = "目前無法開啟保姆工作台";
    authMessage.textContent = message;
    accountState.textContent = "驗證失敗";
  }

  function renderSession(data) {
    document.getElementById("sitterName").textContent = data.sitter.displayName;
    accountState.textContent = "LINE 已綁定";
    authPanel.hidden = true;
    workspace.hidden = false;

    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    document.getElementById("assignmentCount").textContent = `${assignments.length} 個服務`;
    document.getElementById("assignmentList").innerHTML = assignments.length
      ? assignments.map(assignment => `<article class="job">
          <time>${escapeHtml(assignment.specifiedTime || assignment.bookingSegment || "時間待確認")}</time>
          <div>
            <strong>${escapeHtml(assignment.serviceType || assignment.planName || "到府服務")}</strong>
            <p>${escapeHtml(assignment.serviceDate || "日期待確認")}｜${escapeHtml(assignment.status || "狀態待確認")}</p>
            ${assignment.owner || assignment.pet ? `<small>${escapeHtml([assignment.owner, assignment.pet].filter(Boolean).join("｜"))}</small>` : ""}
            ${assignment.address ? `<small>地址：${escapeHtml(assignment.address)}</small>` : ""}
            ${assignment.phone ? `<small>電話：${escapeHtml(assignment.phone)}</small>` : ""}
            ${assignment.notes ? `<small>服務備註：${escapeHtml(assignment.notes)}</small>` : ""}
          </div>
        </article>`).join("")
      : '<p class="empty">目前沒有被指派的服務</p>';

    const permissions = data.permissions || {};
    const items = [
      ["家庭與毛孩基本資料", permissions.canViewAssignedFamilyBasics],
      ["服務地址", permissions.canViewAssignedAddress],
      ["客戶電話", permissions.canViewAssignedPhone],
      ["已核准合約／緊急摘要", permissions.canViewContractSummary],
      ["與本人服務相關的評價", permissions.canViewReviews],
    ];
    document.getElementById("permissionList").innerHTML = items
      .map(([label, allowed]) => `<li><span>${escapeHtml(label)}</span><b class="${allowed ? "allowed" : "denied"}">${allowed ? "已開放" : "未開放"}</b></li>`)
      .join("");
  }

  async function start() {
    try {
      const inviteToken = captureInviteToken();
      if (!window.liff || !config.LIFF_ID) throw new Error("LINE 登入設定尚未完成");
      await window.liff.init({ liffId: config.LIFF_ID });
      if (!window.liff.isLoggedIn()) {
        authTitle.textContent = "請先使用 LINE 登入";
        authMessage.textContent = "登入後，系統會核對這個 LINE 是否已綁定保姆帳號。";
        loginButton.hidden = false;
        loginButton.addEventListener("click", () => window.liff.login({ redirectUri: window.location.href }));
        return;
      }

      const accessToken = window.liff.getAccessToken();
      if (!accessToken) throw new Error("無法取得 LINE 登入資訊，請關閉頁面後重新開啟");
      if (inviteToken) {
        authTitle.textContent = "正在綁定保姆帳號";
        await requestApi("bind", accessToken, { inviteToken });
        window.sessionStorage.removeItem(INVITE_STORAGE_KEY);
      }
      const session = await requestApi("session", accessToken);
      renderSession(session);
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    }
  }

  start();
})();
