// Presentation only. Permissions come from bootstrap; server authorization is unchanged.
export function setupMobileNavigation({ navigate }) {
  const menu = document.getElementById("mobileMenu");
  const trigger = document.getElementById("openMobileMenu");
  const closeButton = document.getElementById("closeMobileMenu");
  const media = matchMedia("(max-width: 900px)");
  const key = "pinyuMobileMenu";
  let token = null, previousHistory = null, savedBody = null, scrollY = 0;
  let authenticated = false, pendingBack = false;
  const unlock = () => {
    if (!savedBody) return;
    Object.assign(document.body.style, savedBody);
    savedBody = null;
    window.scrollTo(0, scrollY);
    trigger.setAttribute("aria-expanded", "false");
  };
  const close = ({ fromHistory = false } = {}) => {
    if (!menu.open) return;
    menu.close();
    unlock();
    if (!fromHistory && history.state?.[key] === token) {
      pendingBack = true;
      history.back();
    }
    if (media.matches) trigger.focus({ preventScroll: true });
  };
  const open = () => {
    if (!authenticated || !media.matches || menu.open || pendingBack) return;
    scrollY = window.scrollY;
    savedBody = Object.fromEntries(["position", "top", "width", "overflow"].map(k => [k, document.body.style[k]]));
    Object.assign(document.body.style, { position: "fixed", top: "-" + scrollY + "px", width: "100%", overflow: "hidden" });
    previousHistory = history.state;
    token = crypto.randomUUID();
    history.pushState({ ...history.state, [key]: token }, "");
    menu.showModal();
    trigger.setAttribute("aria-expanded", "true");
    closeButton.focus();
  };
  trigger.addEventListener("click", open);
  closeButton.addEventListener("click", () => close());
  menu.addEventListener("cancel", event => { event.preventDefault(); close(); });
  // Ignore interior padding; only the actual backdrop closes the drawer.
  menu.addEventListener("click", event => {
    const rect = menu.getBoundingClientRect();
    if (event.target === menu && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  menu.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const focusable = [...menu.querySelectorAll("button:not(:disabled)")].filter(el => !el.hidden && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener("popstate", event => {
    pendingBack = false;
    if (menu.open && event.state?.[key] !== token) close({ fromHistory: true });
    // Forward navigation to an obsolete overlay entry must not trap the page.
    if (!menu.open && event.state?.[key] === token) history.replaceState(previousHistory, "");
  });
  media.addEventListener("change", () => { if (!media.matches) close(); });
  menu.querySelectorAll("[data-mobile-page]").forEach(button => button.addEventListener("click", () => {
    if (!authenticated || button.hidden || button.disabled) return;
    close();
    navigate(button.dataset.mobilePage);
    document.getElementById("app").focus({ preventScroll: true });
  }));
  return {
    update(user, permissions) {
      authenticated = ["OWNER", "ADMIN"].includes(user?.role);
      trigger.disabled = !authenticated;
      document.getElementById("mobileUserName").textContent = user?.displayName || "管理後台";
      menu.querySelectorAll("[data-mobile-permission]").forEach(button => {
        button.hidden = !authenticated || permissions[button.dataset.mobilePermission] !== true;
      });
      document.querySelectorAll('.bottom-nav [data-page="create"]').forEach(button => {
        button.disabled = !authenticated || permissions.canCreateOrders !== true;
      });
      if (!authenticated) close();
    }
  };
}
