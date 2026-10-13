import assert from "node:assert/strict";
import { availabilityAt, calculateAvailability } from "../admin/availability-core.js";

const monday = "2026-09-07";
const friday = "2026-09-11";
const nextFriday = "2026-09-18";
const nextMonthMonday = "2026-10-05";
const baseRule = {
  recurring_block_id: 101,
  sitter_id: 3,
  weekday: 1,
  starts_at: "09:00",
  ends_at: "18:00",
  effective_from: "2026-08-01",
  effective_until: "2026-12-31",
  is_enabled: true
};

const calculate = (date, recurringBlocks = [], recurringExceptions = [], extra = {}) => calculateAvailability({
  date,
  recurringBlocks,
  recurringExceptions,
  ...extra
});

const tests = [];
function test(name, callback) {
  callback();
  tests.push({ name, passed: true });
}

test("Test 1｜完全沒有設定時預設開放", () => {
  const result = calculate(monday);
  assert.equal(result.status, "available");
  assert.equal(result.defaultOpen, true);
  assert.equal(availabilityAt(result, "10:00"), "available");
});

test("Test 2｜新增週一至週五 09:00–18:00 後符合日期重算", () => {
  const rules = [1, 2, 3, 4, 5].map((weekday, index) => ({ ...baseRule, recurring_block_id: 101 + index, weekday }));
  const result = calculate(monday, rules);
  assert.equal(result.status, "limited");
  assert.deepEqual(result.segments.map(segment => [segment.startsAt, segment.endsAt, segment.status]), [
    ["00:00", "09:00", "available"],
    ["09:00", "18:00", "unavailable"],
    ["18:00", "24:00", "available"]
  ]);
});

test("Test 3｜實際時間區間精確判斷", () => {
  const result = calculate(monday, [baseRule]);
  assert.equal(availabilityAt(result, "08:00"), "available");
  assert.equal(availabilityAt(result, "10:00"), "unavailable");
  assert.equal(availabilityAt(result, "17:00"), "unavailable");
  assert.equal(availabilityAt(result, "19:00"), "available");
});

test("Test 4｜修改規則為 10:00–17:00 立即重算", () => {
  const updated = { ...baseRule, starts_at: "10:00", ends_at: "17:00" };
  const result = calculate(monday, [updated]);
  assert.equal(availabilityAt(result, "09:30"), "available");
  assert.equal(availabilityAt(result, "10:00"), "unavailable");
  assert.equal(availabilityAt(result, "17:00"), "available");
});

test("Test 5｜刪除整條規則恢復預設開放", () => {
  const result = calculate(monday, []);
  assert.equal(result.status, "available");
  assert.equal(result.defaultOpen, true);
});

test("Test 6｜單日 X 只解除該週五", () => {
  const fridayRule = { ...baseRule, recurring_block_id: 201, weekday: 5 };
  const exceptions = [{ recurring_block_id: 201, exception_date: friday }];
  assert.equal(availabilityAt(calculate(friday, [fridayRule], exceptions), "10:00"), "available");
  assert.equal(availabilityAt(calculate(nextFriday, [fridayRule], exceptions), "10:00"), "unavailable");
});

test("Test 7｜刪除 exception 後固定規則恢復", () => {
  const fridayRule = { ...baseRule, recurring_block_id: 201, weekday: 5 };
  assert.equal(availabilityAt(calculate(friday, [fridayRule], []), "10:00"), "unavailable");
});

test("Test 8｜切換下個月仍套用有效 recurring rule", () => {
  assert.equal(availabilityAt(calculate(nextMonthMonday, [baseRule]), "10:00"), "unavailable");
});

test("Test 9｜新增／修改／刪除後可直接用新 state 重算", () => {
  let rules = [];
  assert.equal(availabilityAt(calculate(monday, rules), "10:00"), "available");
  rules = [baseRule];
  assert.equal(availabilityAt(calculate(monday, rules), "10:00"), "unavailable");
  rules = [{ ...baseRule, starts_at: "10:00", ends_at: "17:00" }];
  assert.equal(availabilityAt(calculate(monday, rules), "09:30"), "available");
  rules = [];
  assert.equal(availabilityAt(calculate(monday, rules), "10:00"), "available");
});

test("補充｜少量、成立訂單與月上限使用同一優先順序", () => {
  const result = calculate(monday, [], [], {
    singleDay: [{ starts_at: "08:00", ends_at: "12:00", availability_status: "limited" }],
    orders: [{ startsAt: "09:00", endsAt: "10:00", status: "unavailable", source: "order" }]
  });
  assert.equal(availabilityAt(result, "08:30"), "limited");
  assert.equal(availabilityAt(result, "09:30"), "unavailable");
  assert.equal(calculate(monday, [], [], { monthlyOrderLimit: 2, monthlyOrderCount: 2 }).status, "unavailable");
});

process.stdout.write(`${JSON.stringify({ passed: tests.length, tests }, null, 2)}\n`);
