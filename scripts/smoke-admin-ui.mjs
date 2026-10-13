import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const remoteBaseUrl = process.env.SMOKE_ADMIN_BASE_URL?.replace(/\/$/, "") || "";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const userDataDir = await mkdtemp(join(tmpdir(), "pinyu-admin-smoke-"));
const screenshotPath = resolve(root, "artifacts", "admin-schedule-smoke.png");
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const relative = pathname === "/" ? "admin/index.html" : pathname.endsWith("/") ? `${pathname.replace(/^\//, "")}index.html` : pathname.replace(/^\//, "");
    const absolute = normalize(resolve(root, relative));
    if (!absolute.startsWith(root)) throw new Error("invalid path");
    const body = await readFile(absolute);
    response.writeHead(200, { "Content-Type": mime[extname(absolute)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});
await new Promise(resolveReady => server.listen(0, "127.0.0.1", resolveReady));
const sitePort = server.address().port;
const adminUrl = remoteBaseUrl ? `${remoteBaseUrl}/admin/` : `http://127.0.0.1:${sitePort}/admin/`;
const debugPort = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, [
  "--headless=new",
  "--no-sandbox",
  "--in-process-gpu",
  "--disable-gpu",
  "--disable-gpu-sandbox",
  "--use-angle=swiftshader",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank"
], { stdio: "ignore" });

const wait = milliseconds => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));
let browserInfo;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    browserInfo = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then(response => response.json());
    break;
  } catch {
    await wait(100);
  }
}
if (!browserInfo) throw new Error("Chrome DevTools did not start");

const target = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(adminUrl)}`, { method: "PUT" }).then(response => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", rejectOpen, { once: true });
});
let commandId = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve: resolveCommand, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolveCommand(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text || "Unknown browser exception");
});
const send = (method, params = {}) => new Promise((resolveCommand, reject) => {
  const id = ++commandId;
  pending.set(id, { resolve: resolveCommand, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Network.setBlockedURLs", { urls: ["https://static.line-scdn.net/*"] });
await send("Page.addScriptToEvaluateOnNewDocument", { source: `
  window.liff = { init: async () => {}, isLoggedIn: () => true, getAccessToken: () => "mock-line-token" };
  const originalFetch = window.fetch.bind(window);
  const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
  const mockDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  window.__scheduleMock = {
    recurringBlocks: [{ recurring_block_id: 1, sitter_id: 3, weekday: new Date(mockDate + "T12:00:00").getDay(), starts_at: "09:00:00", ends_at: "18:00:00", label: "固定工作", effective_from: "2026-01-01", effective_until: null, is_enabled: true }],
    exceptions: [],
    availability: []
  };
  window.fetch = (url, options = {}) => {
    const target = String(url);
    if (target.includes("/api/portal")) return json({ success: true, role: "OWNER", redirectTo: "/admin/" });
    if (target.includes("/api/admin")) {
      const body = JSON.parse(options.body || "{}");
      if (body.operation === "suppressSitterRecurringBlockForDate") {
        const exists = window.__scheduleMock.exceptions.some(item => item.recurring_block_id === body.payload.recurringBlockId && item.exception_date === body.payload.exceptionDate);
        if (!exists) window.__scheduleMock.exceptions.push({ recurring_block_id: body.payload.recurringBlockId, exception_date: body.payload.exceptionDate, created_at: new Date().toISOString() });
        return json({ success: true });
      }
      if (body.operation === "restoreSitterRecurringBlockForDate") {
        window.__scheduleMock.exceptions = window.__scheduleMock.exceptions.filter(item => item.recurring_block_id !== body.payload.recurringBlockId || item.exception_date !== body.payload.exceptionDate);
        return json({ success: true });
      }
      if (body.operation === "deleteSitterRecurringBlock") {
        window.__scheduleMock.recurringBlocks = window.__scheduleMock.recurringBlocks.filter(item => item.recurring_block_id !== body.payload.recurringBlockId);
        window.__scheduleMock.exceptions = window.__scheduleMock.exceptions.filter(item => item.recurring_block_id !== body.payload.recurringBlockId);
        return json({ success: true });
      }
      if (body.operation === "saveSitterRecurringBlock") {
        if (body.payload.recurringBlockId) {
          const target = window.__scheduleMock.recurringBlocks.find(item => item.recurring_block_id === body.payload.recurringBlockId);
          if (target) Object.assign(target, {
            weekday: Number(body.payload.weekdays[0]),
            starts_at: body.payload.startsAt,
            ends_at: body.payload.endsAt,
            label: body.payload.label,
            effective_from: body.payload.effectiveFrom,
            effective_until: body.payload.effectiveUntil || null
          });
          return json({ success: true, recurringBlocks: target ? [target] : [], updated: true });
        }
        const created = body.payload.weekdays.map((weekday, index) => ({
          recurring_block_id: 100 + window.__scheduleMock.recurringBlocks.length + index,
          sitter_id: body.payload.sitterId,
          weekday: Number(weekday),
          starts_at: body.payload.startsAt,
          ends_at: body.payload.endsAt,
          label: body.payload.label,
          effective_from: body.payload.effectiveFrom,
          effective_until: body.payload.effectiveUntil || null,
          is_enabled: true
        }));
        window.__scheduleMock.recurringBlocks.push(...created);
        return json({ success: true, recurringBlocks: created, updated: false }, 201);
      }
      if (body.operation === "saveSitterAvailability") {
        window.__scheduleMock.availability.push({
          availability_id: window.__scheduleMock.availability.length + 1,
          sitter_id: body.payload.sitterId,
          available_date: body.payload.availableDate,
          starts_at: body.payload.startsAt || null,
          ends_at: body.payload.endsAt || null,
          availability_status: body.payload.availabilityStatus,
          public_note: body.payload.publicNote || null,
          internal_note: body.payload.internalNote || null,
          buffer_minutes: Number(body.payload.bufferMinutes || 0)
        });
        return json({ success: true });
      }
      if (body.operation !== "bootstrap") return json({ success: true });
      return json({
        success: true,
        user: { displayName: "品伃", role: "OWNER" },
        permissions: { canManageSitters: true, canViewMoney: true, canCreateOrders: true, canEditOrders: true },
        summary: { currentOrders: 1, demoOrders: 0, serviceReviews: 0, monthlyNetIncome: 6250, newBookingRequests: 1 },
        orders: [{ orderId: 1, displayOrderId: "DEMO-001", status: "待服務", caregiver: "品伃", sitterId: 3, serviceDate: "2026-08-25", specifiedTime: "10:00", owner: "測試家庭", familyId: "112-013", pet: "熊歐", total: 1000, isDemo: true }],
        ordersV2: [{ orderId: "V2-MOCK-001", orderNumber: "P-MOCK-001", orderStatus: "draft", paymentStatus: "unpaid", familyId: "F-MOCK", ownerName: "測試家庭", petName: "測試毛孩", serviceDate: "2026-09-10～2026-09-12", caregiver: "未指派", orderSource: "LINE", depositAmountDue: 750, customerTotal: 1500, updatedAt: "2026-09-01T00:00:00Z" }],
        families: [{ family_id: "F-MOCK", owner_name: "測試家庭" }],
        pets: [{ pet_id: "P-MOCK", family_id: "F-MOCK", pet_name: "測試毛孩" }],
        servicePlans: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", service_type: "到府照顧", plan_name: "30 分鐘", duration_minutes: 30, price: 500 }],
        servicePresets: [], reviews: [], sitterCommissionRates: [], sitterAccessProfiles: [],
        sitters: [{ sitter_id: 3, display_name: "品伃", status: "active", notes: "" }, { sitter_id: 4, display_name: "勇蓉", status: "active", notes: "" }],
        sitterAvailability: window.__scheduleMock.availability,
        bookingRequests: [{ request_id: "11111111-1111-4111-8111-111111111111", request_number: "REQ-20260823-TEST", request_status: "new", customer_type: "new", cat_count: 1, dog_count: 0, other_pets: null, care_needs: "鏟砂與陪玩", service_start_date: "2026-08-25", service_end_date: "2026-08-25", service_periods: [{ serviceType: "到府照顧", duration: "30", quantity: 1 }], district: "台北市中正區", distance_km: 2, nearest_mrt: "古亭站", near_mrt: true, location_note: "", created_at: "2026-08-23T10:00:00Z" }],
        sitterScheduleSettings: [{ sitter_id: 3, morning_start: "09:00:00", morning_end: "12:00:00", afternoon_start: "13:00:00", afternoon_end: "18:00:00", evening_start: "18:00:00", evening_end: "22:00:00", monthly_order_limit: 12, buffer_minutes: 15 }],
        sitterRecurringBlocks: window.__scheduleMock.recurringBlocks,
        sitterRecurringBlockExceptions: window.__scheduleMock.exceptions,
        calendarSyncJobs: []
      });
    }
    return originalFetch(url, options);
  };
` });
await send("Page.navigate", { url: adminUrl });
await wait(1200);
const dashboard = await send("Runtime.evaluate", { expression: `({ title: document.title, error: document.querySelector('.error-state p')?.textContent || '', appText: document.querySelector('#app')?.textContent || '' })`, returnByValue: true });
await send("Runtime.evaluate", { expression: `document.querySelector('[data-page="sitters"]')?.click()` });
await wait(500);
const schedule = await send("Runtime.evaluate", { expression: `({ heading: document.querySelector('.schedule-heading h2')?.textContent || '', days: document.querySelectorAll('[data-schedule-date]').length, error: document.querySelector('.error-state p')?.textContent || '', height: document.documentElement.scrollHeight })`, returnByValue: true });
const scheduleBeforeOverride = await send("Runtime.evaluate", { expression: `({
  configOpen: document.querySelector('.schedule-config')?.open || false,
  directDeleteVisible: Boolean(document.querySelector('.recurring-rules-overview [data-delete-recurring-block]')?.offsetParent),
  suppressVisible: Boolean(document.querySelector('[data-suppress-recurring-block]')),
  recurringCount: window.__scheduleMock.recurringBlocks.length,
  exceptionCount: window.__scheduleMock.exceptions.length
})`, returnByValue: true });
await send("Runtime.evaluate", { expression: `window.confirm = () => true; document.querySelector('[data-suppress-recurring-block]')?.click()` });
await wait(600);
const scheduleOverridden = await send("Runtime.evaluate", { expression: `({
  suppressVisible: Boolean(document.querySelector('[data-suppress-recurring-block]')),
  restoreVisible: Boolean(document.querySelector('[data-restore-recurring-block]')),
  recurringCount: window.__scheduleMock.recurringBlocks.length,
  exceptionCount: window.__scheduleMock.exceptions.length,
  editorText: document.querySelector('#scheduleEditor')?.textContent || ''
})`, returnByValue: true });
await send("Runtime.evaluate", { expression: `(() => {
  const form = document.querySelector('.schedule-editor-form');
  form.elements.startsAt.value = '10:00';
  form.elements.endsAt.value = '12:00';
  form.elements.availabilityStatus.value = 'available';
  form.requestSubmit();
})()` });
await wait(600);
const scheduleCustomSlot = await send("Runtime.evaluate", { expression: `({
  exceptionCount: window.__scheduleMock.exceptions.length,
  availabilityCount: window.__scheduleMock.availability.length,
  availabilityText: [...document.querySelectorAll('.availability-chip')].map(node => node.textContent.trim()),
  periodLabels: [...document.querySelectorAll('.schedule-day.selected .schedule-period')].map(node => node.textContent.trim())
})`, returnByValue: true });
await send("Runtime.evaluate", { expression: `document.querySelector('[data-restore-recurring-block]')?.click()` });
await wait(600);
const scheduleRestored = await send("Runtime.evaluate", { expression: `({
  suppressVisible: Boolean(document.querySelector('[data-suppress-recurring-block]')),
  exceptionCount: window.__scheduleMock.exceptions.length,
  periodLabels: [...document.querySelectorAll('.schedule-day.selected .schedule-period')].map(node => node.textContent.trim())
})`, returnByValue: true });
await send("Runtime.evaluate", { expression: `document.querySelector('[data-edit-recurring-block]')?.click()` });
await wait(200);
await send("Runtime.evaluate", { expression: `(() => {
  const form = document.getElementById('recurringBlockForm');
  form.elements.startsAt.value = '10:00';
  form.elements.endsAt.value = '17:00';
  form.requestSubmit();
})()` });
await wait(600);
const scheduleRuleEdited = await send("Runtime.evaluate", { expression: `({
  startsAt: window.__scheduleMock.recurringBlocks[0]?.starts_at || '',
  endsAt: window.__scheduleMock.recurringBlocks[0]?.ends_at || '',
  editMode: Boolean(document.getElementById('cancelRecurringBlockEdit')),
  periodLabels: [...document.querySelectorAll('.schedule-day.selected .schedule-period')].map(node => node.textContent.trim())
})`, returnByValue: true });
await send("Runtime.evaluate", { expression: `document.querySelector('.recurring-rules-overview [data-delete-recurring-block]')?.click()` });
await wait(600);
const scheduleRuleDeleted = await send("Runtime.evaluate", { expression: `({
  directDeleteVisible: Boolean(document.querySelector('.recurring-rules-overview [data-delete-recurring-block]')),
  recurringCount: window.__scheduleMock.recurringBlocks.length,
  configOpen: document.querySelector('.schedule-config')?.open || false,
  periodLabels: [...document.querySelectorAll('.schedule-day.selected .schedule-period')].map(node => node.textContent.trim())
})`, returnByValue: true });
await send("Runtime.evaluate", { expression: `document.getElementById('bookingBell')?.click()` });
await wait(150);
const requests = await send("Runtime.evaluate", { expression: `({ count: document.querySelectorAll('.booking-request-card').length, bell: document.getElementById('bookingBellCount')?.textContent || '' })`, returnByValue: true });
await send("Runtime.evaluate", { expression: `document.querySelector('[data-page="orders"]')?.click()` });
await wait(200);
const ordersV2 = await send("Runtime.evaluate", { expression: `({ cards: document.querySelectorAll('[data-order-v2-id]').length, text: document.getElementById('app')?.textContent || '' })`, returnByValue: true });
await send("Runtime.evaluate", { expression: `document.querySelector('[data-page="create"]')?.click()` });
await wait(200);
await send("Runtime.evaluate", { expression: `(() => {
  const form = document.getElementById('orderV2Form');
  form.elements.familyId.value = 'F-MOCK';
  form.elements.familyId.dispatchEvent(new Event('change'));
  form.querySelector('[name="petIds"]').checked = true;
  document.getElementById('v2BatchStart').value = '2026-09-10';
  document.getElementById('v2BatchEnd').value = '2026-09-12';
  document.getElementById('v2ExpandDates').click();
})()` });
await wait(100);
const orderV2Form = await send("Runtime.evaluate", { expression: `({ exists: Boolean(document.getElementById('orderV2Form')), itemRows: document.querySelectorAll('.v2-item-row').length, petChoices: document.querySelectorAll('[name="petIds"]').length, lineUidFields: document.querySelectorAll('[name*="line" i], [data-field*="line" i]').length, text: document.getElementById('app')?.textContent || '' })`, returnByValue: true });
const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

const result = {
  dashboard: dashboard.result.value,
  schedule: schedule.result.value,
  scheduleV2: {
    beforeOverride: scheduleBeforeOverride.result.value,
    overridden: scheduleOverridden.result.value,
    customSlot: scheduleCustomSlot.result.value,
    restored: scheduleRestored.result.value,
    ruleEdited: scheduleRuleEdited.result.value,
    ruleDeleted: scheduleRuleDeleted.result.value
  },
  requests: requests.result.value,
  ordersV2: ordersV2.result.value,
  orderV2Form: orderV2Form.result.value,
  exceptions,
  adminUrl,
  screenshotPath
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
socket.close();
chrome.kill();
server.close();
await wait(400);
await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
if (
  result.dashboard.error || result.schedule.error || exceptions.length || result.schedule.heading !== "保姆月班表" || result.schedule.days < 28 ||
  result.scheduleV2.beforeOverride.configOpen || !result.scheduleV2.beforeOverride.directDeleteVisible || !result.scheduleV2.beforeOverride.suppressVisible ||
  result.scheduleV2.beforeOverride.recurringCount !== 1 || result.scheduleV2.beforeOverride.exceptionCount !== 0 ||
  result.scheduleV2.overridden.suppressVisible || !result.scheduleV2.overridden.restoreVisible || result.scheduleV2.overridden.recurringCount !== 1 ||
  result.scheduleV2.overridden.exceptionCount !== 1 || !result.scheduleV2.overridden.editorText.includes("今天已移除的固定安排") ||
  result.scheduleV2.customSlot.exceptionCount !== 1 || result.scheduleV2.customSlot.availabilityCount !== 1 ||
  !result.scheduleV2.customSlot.availabilityText.some(text => text.includes("10:00–12:00") && text.includes("開放")) ||
  !result.scheduleV2.customSlot.periodLabels.some(text => text.includes("早開放")) ||
  !result.scheduleV2.restored.suppressVisible || result.scheduleV2.restored.exceptionCount !== 0 ||
  !result.scheduleV2.restored.periodLabels.some(text => text.includes("早部分")) ||
  result.scheduleV2.ruleEdited.startsAt !== "10:00" || result.scheduleV2.ruleEdited.endsAt !== "17:00" || result.scheduleV2.ruleEdited.editMode ||
  result.scheduleV2.ruleDeleted.directDeleteVisible || result.scheduleV2.ruleDeleted.recurringCount !== 0 || result.scheduleV2.ruleDeleted.configOpen ||
  !result.scheduleV2.ruleDeleted.periodLabels.every(text => text.includes("開放")) ||
  result.requests.count !== 1 || result.requests.bell !== "1" ||
  result.ordersV2.cards !== 1 || !result.ordersV2.text.includes("家庭為核心關聯") ||
  !result.orderV2Form.exists || result.orderV2Form.itemRows !== 4 || result.orderV2Form.petChoices !== 1 || result.orderV2Form.lineUidFields !== 0 ||
  !result.orderV2Form.text.includes("不寫入 LINE userId")
) process.exitCode = 1;
