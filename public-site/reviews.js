(function () {
  "use strict";

  const target = document.getElementById("publicReviews");
  if (!target) return;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  fetch("/api/public-reviews", { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
      if (!reviews.length) throw new Error("No public reviews");
      target.innerHTML = reviews.map((review) => {
        const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));
        const tags = Array.isArray(review.tags) ? review.tags.slice(0, 3) : [];
        return `<article class="review"><div class="stars" aria-label="${rating} 星評價">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div><p class="source">${escapeHtml(review.sourceLabel)}</p><h2>${escapeHtml(review.title)}</h2><p>${escapeHtml(review.text)}</p><footer><b>${escapeHtml(review.displayName)}</b><span>${tags.map((tag) => `<em>${escapeHtml(tag)}</em>`).join("")}</span></footer></article>`;
      }).join("");
    })
    .catch(() => {
      target.innerHTML = '<p class="notice">公開評價目前無法載入。你仍可到 Instagram 查看真實服務紀錄，或稍後再試一次。</p>';
    });
}());
