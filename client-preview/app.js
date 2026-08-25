(() => {
  "use strict";

  const config = window.CLIENT_PORTAL_CONFIG || {};
  const form = document.getElementById("inquiryForm");
  const periods = document.getElementById("servicePeriods");
  const message = document.getElementById("formMessage");
  const finalDialog = document.getElementById("finalConfirmDialog");
  const galleryDialog = document.getElementById("galleryDialog");
  const galleryImage = document.getElementById("galleryImage");
  const galleryCounter = document.getElementById("galleryCounter");
  const galleryItems = [...document.querySelectorAll("[data-gallery-index] img")];
  const reviewsTrack = document.getElementById("reviewsTrack");
  const reviewDots = document.getElementById("reviewDots");
  const reviewDialog = document.getElementById("reviewDialog");
  let periodSequence = 0;
  let galleryIndex = 0;
  let returningLoginStarted = false;
  let bookingStep = 1;
  let publicReviews = [];
  let reviewIndex = 0;
  let reviewScrollFrame = 0;
  let reviewPausedUntil = 0;
  let reviewHoverPaused = false;

  async function loadSiteDesign() {
    try {
      const response = await fetch("/api/site-settings", { headers: { Accept: "application/json" } });
      const result = await response.json();
      const design = result?.siteDesign;
      if (!response.ok || !result?.success || !design) return;
      const root = document.documentElement;
      root.style.setProperty("--blue", design.accentColor);
      root.style.setProperty("--dark", design.primaryColor);
      root.style.setProperty("--page-background", design.pageBackground);
      root.style.setProperty("--site-text", design.textColor);
      root.style.setProperty("--site-radius", `${design.borderRadius}px`);
      document.body.style.backgroundColor = design.pageBackground;
      const brand = document.querySelector(".brand-lockup b");
      const brandline = document.querySelector(".hero-brandline");
      const titleLines = document.querySelectorAll(".hero h1 > span");
      const description = document.querySelector(".hero-copy > p");
      const primaryButtons = document.querySelectorAll(".hero-actions .primary, .header-booking, .mobile-primary");
      const secondary = document.querySelector(".hero-actions .secondary");
      if (brand) brand.textContent = design.headerBrand;
      if (brandline) brandline.textContent = design.heroBrandline;
      if (titleLines[0]) titleLines[0].textContent = design.heroTitleLine1;
      if (titleLines[1]) titleLines[1].textContent = design.heroTitleLine2;
      if (description) description.textContent = design.heroDescription;
      const primaryLabel = design.primaryButtonLabel === "開始預約" ? "先評估看看" : design.primaryButtonLabel;
      const secondaryLabel = design.secondaryButtonLabel === "了解服務方案與價格" ? "看看服務方式" : design.secondaryButtonLabel;
      primaryButtons.forEach(button => { button.textContent = primaryLabel; });
      if (secondary) secondary.textContent = secondaryLabel;
    } catch {
      // Public content remains usable with the checked-in brand defaults.
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function safeReview(review) {
    if (!review || typeof review !== "object") return null;
    const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));
    const text = String(review.text || "").trim().slice(0, 1200);
    if (!text) return null;
    return {
      displayName: String(review.displayName || "毛孩家長").trim().slice(0, 30) || "毛孩家長",
      rating,
      title: String(review.title || "這次服務後，飼主想說的話").trim().slice(0, 80),
      text,
      tags: Array.isArray(review.tags) ? review.tags.map(tag => String(tag).trim().slice(0, 20)).filter(Boolean).slice(0, 2) : [],
      sourceLabel: String(review.sourceLabel || "Pinyu 服務後評價").trim().slice(0, 40),
    };
  }

  function reviewCardMarkup(review, index) {
    const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    const tags = review.tags.length ? `<div class="review-tags">${review.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : "";
    return `<article class="review-card" data-review-index="${index}">
      <div class="review-photo branded-placeholder" role="img" aria-label="Pinyu 品牌評價圖片占位；目前沒有取得可公開的毛孩照片"><span>真實回饋</span></div>
      <div><span class="review-source">${escapeHtml(review.sourceLabel)}</span><div class="stars" aria-label="${review.rating} 顆星">${stars}</div><h3>${escapeHtml(review.title)}</h3><span class="review-name">${escapeHtml(review.displayName)}</span><p class="review-excerpt">${escapeHtml(review.text)}</p>${tags}<button class="review-more" type="button" data-open-review="${index}">閱讀完整內容</button></div>
    </article>`;
  }

  function updateReviewDots() {
    [...reviewDots.querySelectorAll("button")].forEach((dot, index) => {
      dot.classList.toggle("active", index === reviewIndex);
      dot.setAttribute("aria-current", index === reviewIndex ? "true" : "false");
    });
  }

  function reviewStepWidth() {
    const card = reviewsTrack.querySelector(".review-card");
    if (!card) return 0;
    const gap = Number.parseFloat(getComputedStyle(reviewsTrack).columnGap || getComputedStyle(reviewsTrack).gap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function goToReview(index, behavior = "smooth") {
    if (!publicReviews.length) return;
    reviewIndex = (index + publicReviews.length) % publicReviews.length;
    reviewsTrack.scrollTo({ left: reviewIndex * reviewStepWidth(), behavior });
    updateReviewDots();
  }

  function pauseReviews(milliseconds = 18000) {
    reviewPausedUntil = Math.max(reviewPausedUntil, Date.now() + milliseconds);
  }

  function openReview(index) {
    const review = publicReviews[index];
    if (!review) return;
    document.getElementById("reviewDialogSource").textContent = review.sourceLabel;
    document.getElementById("reviewDialogStars").textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    document.getElementById("reviewDialogStars").setAttribute("aria-label", `${review.rating} 顆星`);
    document.getElementById("reviewDialogTitle").textContent = review.title;
    document.getElementById("reviewDialogName").textContent = review.displayName;
    document.getElementById("reviewDialogText").textContent = review.text;
    pauseReviews();
    openDialog("reviewDialog");
  }

  function renderReviews(reviews) {
    publicReviews = reviews.map(safeReview).filter(Boolean);
    const controls = document.querySelector(".review-controls");
    const shareScore = document.querySelector(".share-score");
    if (!publicReviews.length) {
      reviewsTrack.innerHTML = `<p class="review-empty">目前沒有可公開的評價。只有飼主明確同意公開後，內容才會出現在這裡。</p>`;
      reviewDots.innerHTML = "";
      controls.hidden = true;
      shareScore.hidden = true;
      return;
    }
    reviewsTrack.innerHTML = publicReviews.map(reviewCardMarkup).join("");
    reviewDots.innerHTML = publicReviews.map((_, index) => `<button type="button" aria-label="前往第 ${index + 1} 則評價" data-review-dot="${index}"></button>`).join("");
    controls.hidden = publicReviews.length < 2;
    shareScore.hidden = false;
    const average = publicReviews.reduce((sum, review) => sum + review.rating, 0) / publicReviews.length;
    shareScore.querySelector("strong").textContent = `目前公開評價平均 ${average.toFixed(1)}`;
    reviewsTrack.querySelectorAll("[data-open-review]").forEach(button => button.addEventListener("click", () => openReview(Number(button.dataset.openReview))));
    reviewDots.querySelectorAll("[data-review-dot]").forEach(button => button.addEventListener("click", () => {
      pauseReviews();
      goToReview(Number(button.dataset.reviewDot));
    }));
    reviewIndex = 0;
    updateReviewDots();
  }

  async function loadPublicReviews() {
    try {
      const response = await fetch("/api/public-reviews", { headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok || !result?.success || !Array.isArray(result.reviews)) throw new Error("公開評價讀取失敗");
      renderReviews(result.reviews);
    } catch {
      reviewsTrack.innerHTML = `<p class="review-empty">暫時無法讀取公開評價，請稍後再試。其他預約與登入功能不受影響。</p>`;
      reviewDots.innerHTML = "";
      document.querySelector(".review-controls").hidden = true;
      document.querySelector(".share-score").hidden = true;
    }
  }

  function addServicePeriod(service = "到府照顧") {
    periodSequence += 1;
    const row = document.createElement("div");
    row.className = "service-period";
    row.dataset.period = String(periodSequence);
    row.innerHTML = `
      <label><span class="field-label">服務類別 <span class="required-dot">●</span></span><select name="serviceType_${periodSequence}" required><option ${service === "到府照顧" ? "selected" : ""}>到府照顧</option><option ${service === "遛狗散步" ? "selected" : ""}>遛狗散步</option><option ${service === "長時間陪伴" ? "selected" : ""}>長時間陪伴</option><option ${service === "家訪" ? "selected" : ""}>家訪</option><option ${service === "餵藥協助" ? "selected" : ""}>餵藥協助</option><option>其他／客製服務</option></select></label>
      <label><span class="field-label">時間方案 <span class="required-dot">●</span></span><select name="duration_${periodSequence}" required><option value="30">30 分鐘</option><option value="45">45 分鐘</option><option value="60">60 分鐘</option><option value="120">120 分鐘</option><option value="custom">自訂時間</option></select></label>
      <label><span class="field-label">預計次數 <span class="required-dot">●</span></span><input name="quantity_${periodSequence}" type="number" min="1" max="100" value="1" required /></label>
      <button type="button" aria-label="移除此服務">×</button>`;
    row.querySelector("button").addEventListener("click", () => {
      if (periods.children.length === 1) return;
      row.remove();
    });
    periods.appendChild(row);
  }

  function servicePeriodPayload() {
    return [...periods.querySelectorAll(".service-period")].map(row => ({
      serviceType: row.querySelector("select[name^='serviceType_']").value,
      duration: row.querySelector("select[name^='duration_']").value,
      quantity: Number(row.querySelector("input[name^='quantity_']").value),
    }));
  }

  function validateBookingStep(step) {
    const section = document.querySelector(`[data-booking-step="${step}"]`);
    if (!section) return true;
    if (step === 1) {
      const petCount = Number(form.elements.catCount.value) + Number(form.elements.dogCount.value);
      if (petCount <= 0 && !String(form.elements.otherPets.value).trim()) {
        message.textContent = "請至少填寫一隻毛孩。";
        message.classList.add("error");
        form.elements.catCount.focus();
        return false;
      }
    }
    const invalid = [...section.querySelectorAll("input, select, textarea")].find(field => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    return true;
  }

  function updateReviewSummary() {
    const services = servicePeriodPayload();
    const petSummary = [Number(form.elements.catCount.value) ? `貓 ${form.elements.catCount.value} 隻` : "", Number(form.elements.dogCount.value) ? `狗 ${form.elements.dogCount.value} 隻` : "", String(form.elements.otherPets.value).trim()].filter(Boolean).join("、");
    document.getElementById("bookingReviewSummary").innerHTML = `
      <span class="eyebrow">送出前確認</span><h3>請確認這次的初步需求</h3>
      <dl><div><dt>毛孩</dt><dd>${escapeHtml(petSummary)}</dd></div><div><dt>服務日期</dt><dd>${escapeHtml(form.elements.startDate.value)}${form.elements.endDate.value !== form.elements.startDate.value ? ` ～ ${escapeHtml(form.elements.endDate.value)}` : ""}</dd></div><div><dt>服務內容</dt><dd>${services.map(item => `${escapeHtml(item.serviceType)}・${escapeHtml(item.duration === "custom" ? "自訂時間" : `${item.duration} 分鐘`)} × ${item.quantity}`).join("<br>")}</dd></div><div><dt>服務地區</dt><dd>${escapeHtml(form.elements.district.value)}・距離約 ${escapeHtml(form.elements.distanceKm.value)} 公里・${escapeHtml(form.elements.nearestMrt.value)}</dd></div></dl>`;
  }

  function showBookingStep(step, shouldScroll = true) {
    bookingStep = Math.min(4, Math.max(1, step));
    document.querySelectorAll("[data-booking-step]").forEach(section => section.classList.toggle("active", Number(section.dataset.bookingStep) === bookingStep));
    document.querySelectorAll("[data-progress-step]").forEach(item => {
      const value = Number(item.dataset.progressStep);
      item.classList.toggle("active", value === bookingStep);
      item.classList.toggle("complete", value < bookingStep);
    });
    document.getElementById("bookingStepStatus").textContent = `第 ${bookingStep} 步，共 4 步`;
    if (bookingStep === 4) updateReviewSummary();
    message.textContent = "";
    message.classList.remove("error");
    if (shouldScroll) document.getElementById("inquiry").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    if (dialog?.open) dialog.close();
  }

  function updateAssessment() {
    const distance = Number(form.elements.distanceKm.value);
    const title = document.getElementById("assessmentTitle");
    const text = document.getElementById("assessmentText");
    if (!Number.isFinite(distance) || distance < 0 || form.elements.distanceKm.value === "") {
      title.textContent = "填入距離後查看承接方向";
      text.textContent = "網頁只先判斷服務範圍方向；保姆檔期、毛孩狀況、車馬費與最終價格仍需人工確認。";
    } else if (distance <= 7) {
      const roundedDistance = Math.round(distance);
      const travelFee = roundedDistance <= 3 ? 0 : roundedDistance <= 5 ? 50 : 100;
      title.textContent = "在 Pinyu 優先評估範圍內";
      text.textContent = `最短距離約 ${distance} 公里，四捨五入為 ${roundedDistance} 公里；目前車馬費基準為 ${travelFee} 元。是否承接與正式價格仍由人工確認。`;
    } else {
      title.textContent = "仍可送出，我們會協助轉介";
      text.textContent = `距離約 ${distance} 公里，超出 Pinyu 目前 7 公里的優先範圍，但不會擋住需求；我們會詢問其他合作保姆。`;
    }
  }

  function showGalleryImage(index) {
    galleryIndex = (index + galleryItems.length) % galleryItems.length;
    const source = galleryItems[galleryIndex];
    galleryImage.src = source.src;
    galleryImage.alt = source.alt;
    galleryCounter.textContent = `${galleryIndex + 1}／${galleryItems.length}`;
  }

  function enterPortal() {
    const button = document.getElementById("portalButton");
    button.disabled = true;
    button.textContent = "正在前往 LINE 登入…";
    window.location.assign(config.ENTRY_URL || "/admin/");
  }

  document.getElementById("addServicePeriod").addEventListener("click", () => addServicePeriod());
  document.querySelectorAll("[data-booking-next]").forEach(button => button.addEventListener("click", () => {
    if (validateBookingStep(bookingStep)) showBookingStep(bookingStep + 1);
  }));
  document.querySelectorAll("[data-booking-back]").forEach(button => button.addEventListener("click", () => showBookingStep(bookingStep - 1)));
  document.querySelectorAll("[data-service-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const firstService = periods.querySelector("select[name^='serviceType_']");
      const firstDuration = periods.querySelector("select[name^='duration_']");
      if (firstService) firstService.value = button.dataset.serviceChoice;
      if (firstDuration && button.dataset.durationChoice) firstDuration.value = button.dataset.durationChoice;
      document.getElementById("inquiry").scrollIntoView({ behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-gallery-index]").forEach(button => {
    button.addEventListener("click", () => {
      showGalleryImage(Number(button.dataset.galleryIndex));
      openDialog("galleryDialog");
    });
  });
  document.getElementById("galleryPrevious").addEventListener("click", () => showGalleryImage(galleryIndex - 1));
  document.getElementById("galleryNext").addEventListener("click", () => showGalleryImage(galleryIndex + 1));
  document.getElementById("reviewPrevious").addEventListener("click", () => {
    pauseReviews();
    goToReview(reviewIndex - 1);
  });
  document.getElementById("reviewNext").addEventListener("click", () => {
    pauseReviews();
    goToReview(reviewIndex + 1);
  });
  reviewsTrack.addEventListener("scroll", () => {
    window.cancelAnimationFrame(reviewScrollFrame);
    reviewScrollFrame = window.requestAnimationFrame(() => {
      const step = reviewStepWidth();
      if (!step || !publicReviews.length) return;
      reviewIndex = Math.max(0, Math.min(publicReviews.length - 1, Math.round(reviewsTrack.scrollLeft / step)));
      updateReviewDots();
    });
  }, { passive: true });
  reviewsTrack.addEventListener("pointerdown", () => pauseReviews(), { passive: true });
  reviewsTrack.addEventListener("touchstart", () => pauseReviews(), { passive: true });
  reviewsTrack.addEventListener("mouseenter", () => { reviewHoverPaused = true; });
  reviewsTrack.addEventListener("mouseleave", () => { reviewHoverPaused = false; });
  reviewsTrack.addEventListener("focusin", () => { reviewHoverPaused = true; });
  reviewsTrack.addEventListener("focusout", event => {
    if (!reviewsTrack.contains(event.relatedTarget)) reviewHoverPaused = false;
  });
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(reviewScrollFrame);
    reviewScrollFrame = window.requestAnimationFrame(() => goToReview(reviewIndex, "auto"));
  });
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(() => {
      if (publicReviews.length > 1 && !reviewHoverPaused && Date.now() >= reviewPausedUntil && !reviewDialog.open) {
        goToReview(reviewIndex + 1);
      }
    }, 6000);
  }
  document.querySelectorAll("[data-open-dialog]").forEach(button => button.addEventListener("click", () => openDialog(button.dataset.openDialog)));
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) closeDialog(dialog);
  }));
  const connectReadingCheckbox = ({ dialogCheckboxId, acceptedId, statusId, dialogId }) => {
    const dialogCheckbox = document.getElementById(dialogCheckboxId);
    const accepted = document.getElementById(acceptedId);
    const status = document.getElementById(statusId);
    dialogCheckbox.addEventListener("change", () => {
      accepted.checked = dialogCheckbox.checked;
      status.textContent = dialogCheckbox.checked ? "已閱讀 ✓" : "未閱讀";
      status.classList.toggle("read", dialogCheckbox.checked);
      if (dialogCheckbox.checked) window.setTimeout(() => closeDialog(document.getElementById(dialogId)), 260);
    });
  };
  connectReadingCheckbox({ dialogCheckboxId: "rulesDialogAccepted", acceptedId: "rulesAccepted", statusId: "rulesReadStatus", dialogId: "bookingRulesDialog" });
  connectReadingCheckbox({ dialogCheckboxId: "privacyDialogAccepted", acceptedId: "privacyAccepted", statusId: "privacyReadStatus", dialogId: "privacyDialog" });
  form.elements.startDate.addEventListener("change", () => {
    form.elements.endDate.min = form.elements.startDate.value;
    if (!form.elements.endDate.value || form.elements.endDate.value < form.elements.startDate.value) form.elements.endDate.value = form.elements.startDate.value;
  });
  form.elements.distanceKm.addEventListener("input", updateAssessment);
  form.elements.customerType.addEventListener("change", () => {
    if (form.elements.customerType.value !== "returning") return;
    returningLoginStarted = false;
    openDialog("returningLoginDialog");
  });
  const returningLoginDialog = document.getElementById("returningLoginDialog");
  returningLoginDialog.addEventListener("close", () => {
    if (!returningLoginStarted) form.elements.customerType.value = "new";
  });
  document.getElementById("returningLoginButton").addEventListener("click", () => {
    returningLoginStarted = true;
    enterPortal();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    message.textContent = "";
    message.classList.remove("error");
    const petCount = Number(form.elements.catCount.value) + Number(form.elements.dogCount.value);
    if (petCount <= 0 && !String(form.elements.otherPets.value).trim()) {
      message.textContent = "請至少填寫一隻毛孩。";
      message.classList.add("error");
      return;
    }
    if (!document.getElementById("rulesAccepted").checked) {
      openDialog("bookingRulesDialog");
      return;
    }
    if (!document.getElementById("privacyAccepted").checked) {
      openDialog("privacyDialog");
      return;
    }
    document.getElementById("healthConfirmed").checked = false;
    document.getElementById("confirmMessage").textContent = "";
    openDialog("finalConfirmDialog");
  });
  document.getElementById("confirmInquiry").addEventListener("click", async event => {
    const confirmMessage = document.getElementById("confirmMessage");
    if (!document.getElementById("healthConfirmed").checked) {
      confirmMessage.textContent = "請先確認毛孩健康狀況與服務限制。";
      confirmMessage.classList.add("error");
      return;
    }
    const button = event.currentTarget;
    try {
      button.disabled = true;
      button.textContent = "正在安全送出…";
      const data = new FormData(form);
      const payload = Object.fromEntries(data.entries());
      payload.catCount = Number(payload.catCount);
      payload.dogCount = Number(payload.dogCount);
      payload.distanceKm = Number(payload.distanceKm);
      payload.nearMrt = payload.nearMrt === "yes";
      payload.servicePeriods = servicePeriodPayload();
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({ success: false, message: "伺服器回應格式錯誤" }));
      if (!response.ok || !result.success) throw new Error(result.message || `送出失敗（HTTP ${response.status}）`);
      closeDialog(finalDialog);
      message.textContent = `已送出！需求編號 ${result.requestNumber}，Pinyu 後台已收到並會進行承接評估。`;
      message.classList.remove("error");
      button.textContent = "已送出";
    } catch (error) {
      confirmMessage.textContent = error.message || String(error);
      confirmMessage.classList.add("error");
      button.disabled = false;
      button.textContent = "確認送出評估需求";
    }
  });
  document.getElementById("portalButton").addEventListener("click", enterPortal);
  document.getElementById("mobilePortalButton").addEventListener("click", enterPortal);

  addServicePeriod();
  showBookingStep(1, false);
  void loadSiteDesign();
  void loadPublicReviews();
})();
