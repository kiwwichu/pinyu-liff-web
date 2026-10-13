(() => {
  "use strict";
  const config = window.DESIGN_ADMIN_CONFIG || {};
  const form = document.getElementById("designForm");
  const loading = document.getElementById("loading");
  const message = document.getElementById("message");
  let accessToken = "";
  let savedDesign = null;

  async function api(operation, payload = {}) {
    const response = await fetch(config.API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, operation, payload }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error(result?.message || `讀取失敗（HTTP ${response.status}）`);
    return result;
  }
  function values() { return Object.fromEntries(new FormData(form).entries()); }
  function fill(design) { Object.entries(design).forEach(([key,value]) => { if (form.elements[key]) form.elements[key].value = value; }); updatePreview(); }
  function updatePreview() {
    const design = values();
    document.getElementById("previewBrandline").textContent = design.heroBrandline || " ";
    document.getElementById("previewTitle1").textContent = design.heroTitleLine1 || " ";
    document.getElementById("previewTitle2").textContent = design.heroTitleLine2 || " ";
    document.getElementById("previewDescription").textContent = design.heroDescription || " ";
    document.getElementById("previewPrimary").textContent = design.primaryButtonLabel || "主要按鈕";
    document.getElementById("previewSecondary").textContent = design.secondaryButtonLabel || "次要按鈕";
    const hero = document.getElementById("previewHero");
    hero.style.background = `linear-gradient(145deg, ${design.primaryColor}, ${design.accentColor})`;
    hero.style.borderRadius = `${design.borderRadius}px`;
    document.body.style.background = design.pageBackground;
    document.getElementById("radiusValue").textContent = `${design.borderRadius}px`;
  }
  async function init() {
    try {
      await liff.init({ liffId: config.LIFF_ID });
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return; }
      accessToken = liff.getAccessToken() || "";
      const portalResponse = await fetch(config.PORTAL_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
      const portal = await portalResponse.json().catch(() => null);
      if (!portalResponse.ok || portal?.role !== "OWNER") throw new Error("只有 OWNER 可以開啟網站版面管理");
      const data = await api("bootstrap");
      savedDesign = data.siteDesign;
      fill(savedDesign);
      loading.hidden = true;
      form.hidden = false;
    } catch (error) { loading.textContent = error.message || String(error); }
  }
  form.addEventListener("input", updatePreview);
  form.addEventListener("submit", async event => {
    event.preventDefault(); const button = form.querySelector('[type="submit"]');
    try { button.disabled = true; message.textContent = "正在儲存…"; message.className = ""; const result = await api("saveSiteDesign", values()); savedDesign = result.siteDesign; fill(savedDesign); message.textContent = "已儲存，測試首頁會在重新整理後套用。"; }
    catch (error) { message.textContent = error.message || String(error); message.className = "error"; }
    finally { button.disabled = false; }
  });
  document.getElementById("resetPreview").addEventListener("click", () => savedDesign && fill(savedDesign));
  init();
})();
