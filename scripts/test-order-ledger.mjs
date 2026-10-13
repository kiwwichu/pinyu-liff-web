import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { calculateOrder } from "../src/order-calculation.ts";
import { moneyUnits, moneyText, parseLedgerEntry, cashMonth, summarizeOrderLedger } from "../src/order-ledger.ts";

// Resolve repo's extensionless Worker imports without build output or configuration edits.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.startsWith(new URL('../src/', import.meta.url).href) && specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(specifier + ".ts", context);
  }
  return nextResolve(specifier, context);
}});
const { getOrderLedger, appendOrderLedger, ledgerResponse } = await import("../src/order-ledger-service.ts");
const { handleAdmin } = await import("../src/admin.ts");
const orderId = "V2-synthetic-ledger";
const updatedAt = "2026-09-10T00:00:00.123456+00:00";
const actor = { userId: "00000000-0000-4000-8000-000000000001", role: "OWNER", canViewMoney: true, canEditOrders: true };
const devUrl = "https://zzkdmenxlucgxirwxayb.supabase.co";
const service = (extra = {}) => ({ key: "s1", itemType: "service", itemName: "Synthetic service",
  serviceDate: "2026-09-10", chargedUnitPrice: 1000, quantity: 1,
  providerType: "sitter", assignedSitterId: 2, commissionRate: 0.2, ...extra });
const fee = (type, amount, sitterAmount) => ({ key: type, itemType: type, itemName: type,
  chargedUnitPrice: amount, providerType: "sitter", assignedSitterId: 2,
  sitterAllocationAmount: sitterAmount, companyAllocationAmount: amount - sitterAmount });
const snapshot = c => ({ orderId, updatedAt, orderModelVersion: 2,
  customerTotal: String(c.customerTotal), ownerEarningsTotal: String(c.ownerEarningsTotal),
  sitterEarningsTotal: String(c.sitterEarningsTotal),
  companyEarningsBeforePlatform: String(c.companyEarningsBeforePlatform), platformName: c.platformName });
const event = (extra = {}) => ({ requestId: "00000000-0000-4000-8000-000000000010",
  orderId, ledger: "payments", kind: "receipt", amount: "100", occurredAt: "2026-09-10T10:00:00+08:00",
  channel: "direct", method: "synthetic transfer", note: "", ...extra });

const scenarios = [
  ["no discount", [service()], undefined, 1000, 800, 200],
  ["service discount", [service()], { type: "rate", value: 0.9 }, 900, 800, 100],
  ["travel never discounted", [service(), fee("travel_fee", 100, 100)], { type: "rate", value: 0.9 }, 1000, 900, 100],
  ["home visit separate actual allocation", [service(), fee("home_visit_fee", 200, 60)], { type: "rate", value: 0.9 }, 1100, 860, 240],
  ["tip never discounted; 100% sitter", [service(), fee("tip", 100, 100)], { type: "rate", value: 0.9 }, 1000, 900, 100],
  ["all fee boundaries", [service(), fee("travel_fee", 100, 70), fee("home_visit_fee", 200, 60), fee("tip", 50, 50)],
    { type: "rate", value: 0.9 }, 1250, 980, 270],
  ["owner included exactly once", [service({ providerType: "owner", assignedSitterId: 1 })], { type: "rate", value: 0.9 }, 900, 0, 900],
  ["fixed discount and negative company income", [service()], { type: "fixed", value: 500 }, 500, 800, -300],
  ["partially cancelled service", [service(), service({ key: "s2", itemStatus: "cancelled" })], undefined, 1000, 800, 200],
  ["whole cancellation does not invent refund", [service({ itemStatus: "cancelled" })], undefined, 0, 0, 0],
];
for (const [name, items, discount, receivable, sitter, company] of scenarios) {
  test(name, () => {
    const c = calculateOrder({ items, discount });
    assert.equal(c.customerTotal, receivable);
    assert.equal(c.sitterEarningsTotal, sitter);
    assert.equal(c.companyEarningsBeforePlatform, company);
    for (const item of c.items) {
      if (item.itemStatus === "cancelled") continue;
      if (item.itemType === "service" && item.providerTypeSnapshot === "sitter") {
        assert.equal(item.commissionBaseAmount, 1000);
        assert.equal(item.sitterEarningsAmount, 800);
      } else if (item.itemType !== "service") {
        assert.equal(item.commissionBaseAmount, 0);
        assert.equal(item.companyDiscountAbsorbedAmount, 0);
      }
    }
    const order = snapshot(c);
    const before = structuredClone(order);
    const s = summarizeOrderLedger(order, []);
    assert.equal(s.customerReceivable, moneyText(moneyUnits(receivable)));
    assert.equal(s.companyIncomeBeforePlatform, moneyText(moneyUnits(company)));
    assert.equal(s.actualCashNet, "0.0000");
    assert.equal(s.customerNetPaid, "0.0000");
    const receipt = summarizeOrderLedger(order, [event()]);
    assert.equal(receipt.actualCashNet, "100.0000");
    assert.equal(receipt.sitterEarningsSnapshot, s.sitterEarningsSnapshot);
    assert.equal(receipt.companyIncomeBeforePlatform, s.companyIncomeBeforePlatform);
    assert.deepEqual(order, before, "ledger cannot mutate snapshots or reprice items");
  });
}
test("platform payment and payout never double counted; no legacy 75/80% estimate", () => {
  const order = snapshot(calculateOrder({ items: [service()], platform: {
    name: "Synthetic platform", payoutStatus: "received", actualPayout: 777,
  }}));
  const base = summarizeOrderLedger(order, []);
  assert.equal(base.platformSettlementNet, "0.0000", "header snapshot is not a ledger event");
  const entries = [
    event({ amount: "1000", channel: "platform" }),
    event({ requestId: "00000000-0000-4000-8000-000000000011", ledger: "platform_settlements", channel: "platform", amount: "600" }),
    event({ requestId: "00000000-0000-4000-8000-000000000012", ledger: "platform_settlements", channel: "platform", amount: "177" }),
  ];
  const s = summarizeOrderLedger(order, entries);
  assert.equal(s.customerNetPaid, "1000.0000");
  assert.equal(s.actualCashNet, "777.0000");
  assert.equal(s.platformSettlementNet, "777.0000");
  assert.equal(s.customerReceivable, "1000.0000");
  assert.equal(s.sitterEarningsSnapshot, "800.0000");
  assert.equal(s.companyIncomeBeforePlatform, "200.0000");
});
test("refunds and negative platform adjustment belong to actual month", () => {
  const order = snapshot(calculateOrder({ items: [service()], platform: { name: "Synthetic" } }));
  const s = summarizeOrderLedger(order, [
    event({ amount: "1000", occurredAt: "2026-08-31T15:59:59Z" }),
    event({ requestId: "00000000-0000-4000-8000-000000000011", kind: "refund", amount: "100", note: "synthetic refund", occurredAt: "2026-08-31T16:00:00Z" }),
    event({ requestId: "00000000-0000-4000-8000-000000000012", ledger: "platform_settlements", channel: "platform", kind: "adjustment", amount: "-12.3456", note: "synthetic adjustment" }),
  ]);
  assert.deepEqual(s.cashByMonth, { "2026-08": "1000.0000", "2026-09": "-112.3456" });
  assert.equal(s.customerNetPaid, "900.0000");
  assert.equal(s.actualCashNet, "887.6544");
  assert.equal(s.sitterEarningsSnapshot, "800.0000");
});
test("unconfirmed zero/ref/#REF/invalid decimals fail closed", () => {
  for (const amount of ["#REF!", "", "NaN", Infinity, NaN, {}, null, "0.00001", "1e3", "0", "-1"]) {
    assert.throws(() => parseLedgerEntry(event({ amount })));
  }
  assert.equal(moneyText(moneyUnits("0.1") + moneyUnits("0.2")), "0.3000");
  assert.throws(() => ledgerResponse({ order: { ...snapshot(calculateOrder({ items: [service()] })), customerTotal: null }, entries: [] }, orderId));
});
test("strict calendar, timezone and month edges", () => {
  for (const occurredAt of ["2026-02-29T12:00:00Z", "2026-02-31T12:00:00Z", "2026-09-10T24:00:00Z",
    "2026-09-10T12:00:00", "2026-09-10T12:00:00+14:30"]) {
    assert.throws(() => parseLedgerEntry(event({ occurredAt })));
  }
  assert.equal(cashMonth("2028-02-29T23:59:59+08:00"), "2028-02");
  assert.equal(cashMonth("2026-08-31T16:00:00Z"), "2026-09");
});
test("historical platform entries survive header edits; mismatches and duplicates rejected", () => {
  const o = snapshot(calculateOrder({ items: [service()] }));
  assert.equal(summarizeOrderLedger(o, [event({ channel: "platform" })]).actualCashNet, "0.0000");
  assert.throws(() => summarizeOrderLedger(o, [event({ orderId: "V2-another" })]));
  assert.throws(() => summarizeOrderLedger(o, [event(), event()]));
  assert.throws(() => summarizeOrderLedger({ ...o, companyEarningsBeforePlatform: "1000" }, []));
  assert.throws(() => parseLedgerEntry(event({ ledger: "payments", kind: "adjustment" })));
  assert.throws(() => parseLedgerEntry(event({ kind: "refund", note: "" })));
});
test("service rejects access before store IO; source fields are not trusted", async () => {
  let calls = 0;
  const result = { order: snapshot(calculateOrder({ items: [service()] })), entries: [] };
  const store = { read: async () => { calls++; return result; }, append: async () => { calls++; return result; } };
  for (const role of ["SITTER", "MEMBER", "PUBLIC"]) {
    await assert.rejects(getOrderLedger({ orderId }, { ...actor, role }, "development", devUrl, store));
  }
  await assert.rejects(getOrderLedger({ orderId }, { ...actor, canViewMoney: false }, "development", devUrl, store));
  await assert.rejects(appendOrderLedger(event(), { ...actor, canEditOrders: false }, "development", devUrl, store));
  await assert.rejects(getOrderLedger({ orderId }, actor, "production", devUrl, store));
  await assert.rejects(getOrderLedger({ orderId }, actor, "development", "https://another.supabase.co", store));
  assert.equal(calls, 0);
  const got = await getOrderLedger({ orderId, customerTotal: 999999, paidAmount: 8888 }, actor, "development", devUrl, store);
  assert.equal(got.summary.customerReceivable, "1000.0000");
  assert.equal(got.summary.customerNetPaid, "0.0000");
});
test("service preserves CAS microseconds and exact retry key (mock RPC, not SQL execution)", async () => {
  const result = { order: snapshot(calculateOrder({ items: [service()] })), entries: [] };
  const seen = new Map();
  const store = {
    read: async () => result,
    append: async (entry, userId, version) => {
      assert.equal(userId, actor.userId); assert.equal(version, updatedAt);
      const previous = seen.get(entry.requestId);
      if (previous) assert.deepEqual(previous, entry);
      else { seen.set(entry.requestId, entry); result.entries.push(entry); }
      return result;
    },
  };
  const input = { ...event(), expectedUpdatedAt: updatedAt, sitterEarnings: 0, companyIncome: 1000 };
  await appendOrderLedger(input, actor, "development", devUrl, store);
  const retry = await appendOrderLedger(input, actor, "development", devUrl, store);
  assert.equal(retry.summary.entryCount, 1);
  assert.equal(retry.summary.actualCashNet, "100.0000");
  assert.equal(retry.summary.sitterEarningsSnapshot, "800.0000");
});
test("real Admin handler routes authenticated ledger operations; outbound APIs fully mocked", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  console.error = value => logs.push(String(value));
  let role = "OWNER", canView = true, failRpc = false, rpcCalls = 0, writes = 0;
  const result = { order: snapshot(calculateOrder({ items: [service()] })), entries: [] };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "api.line.me" && url.pathname === "/oauth2/v2.1/verify") return Response.json({ client_id: "synthetic-channel", expires_in: 60 });
    if (url.hostname === "api.line.me" && url.pathname === "/v2/profile") return Response.json({ userId: "synthetic-line-user" });
    if (url.origin !== devUrl) throw new Error("Unexpected outbound network request");
    if (url.pathname === "/rest/v1/app_users") return Response.json({
      user_id: actor.userId, display_name: "Synthetic admin", role, status: "active",
      can_view_money: canView, can_edit_orders: true, can_create_orders: true, can_send_notifications: false,
    });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      rpcCalls++;
      if (failRpc) return Response.json({ code: "PGRST202", message: "synthetic-sensitive-database-error" }, { status: 404 });
      const body = JSON.parse(init.body);
      assert.equal(body.p_actor_id, actor.userId);
      if (url.pathname.endsWith("/append_order_ledger_v2")) {
        writes++; assert.equal(body.p_expected_updated_at, updatedAt);
        assert.equal(body.p_entry.recorded_by, undefined);
        result.entries.push(body.p_entry);
      } else assert.equal(body.p_order_id, orderId);
      return Response.json(result);
    }
    throw new Error("Unexpected endpoint");
  };
  const env = { APP_ENV: "development", SUPABASE_URL: devUrl, SUPABASE_SECRET_KEY: "synthetic-only",
    LINE_LIFF_CHANNEL_ID: "synthetic-channel" };
  const request = (operation, payload = { orderId }) => handleAdmin(new Request("https://example.invalid/api/admin", {
    method: "POST", body: JSON.stringify({ operation, accessToken: "synthetic-token", payload }),
    headers: { "Content-Type": "application/json" },
  }), env);
  try {
    const read = await request("getOrderLedgerV2");
    assert.equal(read.status, 200);
    assert.equal((await read.json()).summary.customerNetPaid, "0.0000");
    const append = await request("appendOrderLedgerV2", { ...event(), expectedUpdatedAt: updatedAt, recorded_by: "spoofed" });
    assert.equal(append.status, 200); assert.equal(writes, 1);
    assert.equal((await append.json()).summary.actualCashNet, "100.0000");
    const before = rpcCalls;
    role = "SITTER";
    assert.equal((await request("getOrderLedgerV2")).status, 403);
    role = "ADMIN"; canView = false;
    assert.equal((await request("getOrderLedgerV2")).status, 400);
    assert.equal(rpcCalls, before);
    canView = true; failRpc = true;
    const missing = await request("getOrderLedgerV2");
    const missingBody = await missing.json();
    assert.equal(missingBody.success, false);
    assert.equal(missingBody.summary, undefined, "missing schema must not masquerade as zero cash");
    assert.ok(!JSON.stringify(missingBody).includes("synthetic-sensitive"));
    assert.ok(!logs.join("").includes("synthetic-sensitive"));
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
});
test("SQL draft static safety contract (NOT database verification)", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260909183359_add_order_financial_ledgers.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /grant select, insert on public.order_financial_entries to service_role/i);
  assert.match(sql, /before update or delete/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /primary key/i);
  assert.match(sql, /p_expected_updated_at is null/i);
  assert.match(sql, /is distinct from p_actor_id/i);
  assert.doesNotMatch(sql, /security definer|drop table|truncate|update public.orders|update public.order_items/i);
  assert.match(sql, /revoke all on function public.append_order_ledger_v2.*from public, anon, authenticated/i);
});
