import assert from "node:assert/strict";
import { calculateOrder, ORDER_CALCULATION_VERSION } from "../src/order-calculation.ts";
import {
  assertOrderV2Transition,
  expandIsoDateRange,
  parseAdminOrderV2Payload,
} from "../src/order-v2-admin.ts";
import { intervalHasUnavailableSegment, intervalsOverlap } from "../admin/availability-core.js";

const ownerService = (overrides = {}) => ({
  key: "service-1",
  itemType: "service",
  itemName: "到府照顧 30 分鐘",
  serviceDate: "2026-09-01",
  chargedUnitPrice: 550,
  standardUnitPrice: 550,
  quantity: 1,
  providerType: "owner",
  assignedSitterId: 1,
  petIds: ["P001"],
  ...overrides,
});

const sitterService = (overrides = {}) => ({
  key: "service-sitter-1",
  itemType: "service",
  itemName: "到府照顧 30 分鐘",
  serviceDate: "2026-09-01",
  chargedUnitPrice: 1000,
  standardUnitPrice: 1000,
  quantity: 1,
  providerType: "sitter",
  assignedSitterId: 2,
  petIds: ["P001"],
  commissionRate: 0.2,
  ...overrides,
});

function close(actual, expected, message = "") {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${message}: expected ${expected}, got ${actual}`);
}

function expectThrow(fn, pattern) {
  assert.throws(fn, pattern);
}

{
  const result = calculateOrder({ items: [ownerService()] });
  assert.equal(result.calculationVersion, ORDER_CALCULATION_VERSION);
  close(result.serviceSubtotal, 550, "owner subtotal");
  close(result.customerTotal, 550, "owner total");
  close(result.ownerEarningsTotal, 550, "owner earnings");
  close(result.sitterEarningsTotal, 0, "external sitter earnings");
  close(result.depositAmountDue, 275, "default 50% deposit");
  close(result.balanceAmountDue, 275, "default balance");
}

{
  const result = calculateOrder({ items: [ownerService()], discount: { type: "rate", value: 0.9 } });
  close(result.discountAmount, 55, "9 discount");
  close(result.customerTotal, 495, "discounted total");
  close(result.ownerEarningsTotal, 550, "discount does not reduce owner execution snapshot");
  close(result.companyEarningsBeforePlatform, 495, "company absorbs discount");
  close(result.items[0].companyDiscountAbsorbedAmount, 55, "item discount allocation");
}

{
  const result = calculateOrder({ items: [ownerService()], discount: { type: "fixed", value: 100 } });
  close(result.customerTotal, 450, "fixed discount");
  close(result.companyDiscountAbsorbed, 100, "fixed discount absorbed");
}

{
  const result = calculateOrder({ items: [sitterService()] });
  close(result.companyServiceShareTotal, 200, "company commission");
  close(result.sitterEarningsTotal, 800, "sitter payout");
  close(result.companyEarningsBeforePlatform, 200, "company earnings");
}

{
  const result = calculateOrder({ items: [sitterService()], discount: { type: "rate", value: 0.5 } });
  close(result.sitterEarningsTotal, 800, "discount cannot reduce sitter payout");
  close(result.companyEarningsBeforePlatform, -300, "negative company earnings are preserved");
  close(result.customerTotal, 500, "customer discounted total");
}

{
  const result = calculateOrder({
    items: [
      ownerService({ key: "day-1", serviceDate: "2026-09-01" }),
      ownerService({ key: "day-2", serviceDate: "2026-09-02" }),
      ownerService({ key: "day-3", serviceDate: "2026-09-03" }),
    ],
  });
  close(result.serviceSubtotal, 1650, "multiple service dates");
  assert.equal(result.items.length, 3);
}

{
  const result = calculateOrder({
    items: [
      ownerService({ key: "owner-day", serviceDate: "2026-09-01" }),
      sitterService({ key: "sitter-day", serviceDate: "2026-09-02", chargedUnitPrice: 550, standardUnitPrice: 550 }),
    ],
    discount: { type: "rate", value: 0.9 },
  });
  close(result.ownerEarningsTotal, 550, "owner service in mixed order");
  close(result.sitterEarningsTotal, 440, "collaborator service in mixed order");
  close(result.companyServiceShareTotal, 110, "mixed company share");
  close(result.companyDiscountAbsorbed, 110, "proportional discount total");
  close(result.items[0].companyDiscountAbsorbedAmount, 55, "owner item discount allocation");
  close(result.items[1].companyDiscountAbsorbedAmount, 55, "sitter item discount allocation");
}

{
  const result = calculateOrder({
    items: [
      ownerService({ key: "rounding-1", chargedUnitPrice: "0.26", standardUnitPrice: "0.26" }),
      ownerService({ key: "rounding-2", chargedUnitPrice: "0.26", standardUnitPrice: "0.26" }),
      ownerService({ key: "rounding-3", chargedUnitPrice: "0.26", standardUnitPrice: "0.26" }),
      ownerService({ key: "rounding-4", chargedUnitPrice: "0.22", standardUnitPrice: "0.22" }),
    ],
    discount: { type: "fixed", value: "0.0002" },
  });
  close(
    result.items.reduce((sum, item) => sum + item.companyDiscountAbsorbedAmount, 0),
    0.0002,
    "discount rounding allocation remains exact",
  );
  assert.ok(result.items.every((item) => item.companyDiscountAbsorbedAmount >= 0));
}

{
  const result = calculateOrder({
    items: [
      ownerService(),
      {
        key: "travel-1",
        itemType: "travel_fee",
        itemName: "車馬費",
        chargedUnitPrice: 100,
        providerType: "sitter",
        assignedSitterId: 2,
        sitterAllocationAmount: 100,
        companyAllocationAmount: 0,
      },
    ],
  });
  close(result.travelFeeTotal, 100, "travel total");
  close(result.sitterEarningsTotal, 100, "travel belongs to assigned collaborator");
  close(result.depositAmountDue, 325, "travel is included in deposit base");
}

{
  const result = calculateOrder({
    items: [
      ownerService(),
      {
        key: "visit-1",
        itemType: "home_visit_fee",
        itemName: "家訪費",
        chargedUnitPrice: 200,
        providerType: "sitter",
        assignedSitterId: 2,
        sitterAllocationAmount: 80,
        companyAllocationAmount: 120,
        homeVisitExecutionMode: "training",
      },
    ],
  });
  close(result.homeVisitFeeTotal, 200, "home visit total");
  close(result.sitterEarningsTotal, 80, "training visit sitter allocation");
  close(result.companyEarningsBeforePlatform, 670, "training visit company allocation");
}

{
  const result = calculateOrder({
    items: [
      ownerService(),
      {
        key: "tip-1",
        itemType: "tip",
        itemName: "小費",
        chargedUnitPrice: 50,
        providerType: "sitter",
        assignedSitterId: 2,
      },
    ],
  });
  close(result.tipTotal, 50, "tip total");
  close(result.sitterEarningsTotal, 50, "tip goes to actual sitter");
  close(result.depositAmountDue, 275, "tip is excluded from deposit base");
}

{
  const result = calculateOrder({
    items: [ownerService({ standardUnitPrice: 550, customUnitPrice: 500, chargedUnitPrice: 500 })],
  });
  close(result.items[0].standardUnitPriceSnapshot, 550, "standard price snapshot");
  close(result.items[0].customUnitPrice, 500, "custom price snapshot");
  close(result.customerTotal, 500, "custom charged price");
}

{
  const result = calculateOrder({
    items: [ownerService()],
    deposit: { type: "custom_rate", rate: 0.3 },
  });
  close(result.depositAmountDue, 165, "custom deposit rate");
  close(result.depositRateSnapshot, 0.3, "custom rate snapshot");
}

{
  const result = calculateOrder({
    items: [ownerService()],
    deposit: { type: "custom_amount", amount: 123 },
  });
  close(result.depositAmountDue, 123, "custom deposit amount");
  close(result.customDepositAmount, 123, "custom deposit snapshot");
}

{
  const result = calculateOrder({ items: [ownerService()], deposit: { type: "waived" } });
  close(result.depositAmountDue, 0, "returning customer waived deposit");
  close(result.balanceAmountDue, 550, "waived deposit balance");
}

{
  const result = calculateOrder({
    items: [ownerService({ quantity: 2 })],
    deposit: { type: "default_rate", defaultRate: 0.5, lockedAmount: 275 },
  });
  close(result.suggestedDepositAmount, 550, "new suggested deposit after adding service");
  close(result.depositAmountDue, 275, "locked deposit is not overwritten");
  close(result.suggestedAdditionalDeposit, 275, "suggested additional deposit");
}

{
  const result = calculateOrder({
    items: [
      ownerService({ key: "active", serviceDate: "2026-09-01" }),
      ownerService({
        key: "cancelled",
        serviceDate: "2026-09-02",
        itemStatus: "cancelled",
        cancelledAt: "2026-08-30T00:00:00Z",
        cancellationReason: "測試取消",
      }),
    ],
  });
  close(result.serviceSubtotal, 550, "cancelled item excluded from totals");
  close(result.items[1].lineAmount, 550, "cancelled item keeps original snapshot");
  close(result.items[1].sitterEarningsAmount, 0, "cancelled item has no active earnings");
}

{
  const result = calculateOrder({
    items: [ownerService()],
    platform: { name: "測試平台", orderRef: "PLATFORM-1", payoutStatus: "pending" },
  });
  assert.equal(result.platformPayoutStatus, "pending");
  assert.equal(result.platformActualPayout, null);
  assert.equal(result.platformDifference, null);
}

{
  const result = calculateOrder({
    items: [ownerService()],
    platform: { name: "測試平台", orderRef: "PLATFORM-2", payoutStatus: "received", actualPayout: 450 },
  });
  close(result.platformActualPayout, 450, "platform actual payout");
  close(result.platformDifference, 100, "platform difference");
}

{
  const result = calculateOrder({
    items: [ownerService({ chargedUnitPrice: "262.5", standardUnitPrice: "262.5" })],
  });
  close(result.customerTotal, 262.5, "decimal precision");
  close(result.depositAmountDue, 131.25, "decimal deposit precision");
}

{
  const result = calculateOrder({
    items: [sitterService({ chargedUnitPrice: "1312.5", standardUnitPrice: "1312.5", commissionRate: "0.2" })],
  });
  close(result.companyServiceShareTotal, 262.5, "decimal commission precision");
  close(result.sitterEarningsTotal, 1050, "decimal sitter earnings");
}

{
  const result = calculateOrder({
    items: [ownerService({ providerType: "unassigned", assignedSitterId: null })],
  });
  assert.equal(result.warnings.length, 1);
  close(result.companyEarningsBeforePlatform, 550, "unassigned draft remains reconciled");
}

expectThrow(
  () => calculateOrder({ items: [ownerService()], discount: { type: "fixed", value: 551 } }),
  /fixed discount cannot exceed/,
);

expectThrow(
  () => calculateOrder({ items: [sitterService({ commissionRate: null })] }),
  /commissionRate is required/,
);

expectThrow(
  () => calculateOrder({
    items: [{
      key: "bad-travel",
      itemType: "travel_fee",
      itemName: "車馬費",
      chargedUnitPrice: 100,
      providerType: "sitter",
      assignedSitterId: 2,
    }],
  }),
  /allocations must be explicitly saved/,
);

expectThrow(
  () => calculateOrder({
    items: [{
      key: "bad-tip",
      itemType: "tip",
      itemName: "小費",
      chargedUnitPrice: 100,
      providerType: "sitter",
      assignedSitterId: 2,
      companyAllocationAmount: 10,
    }],
  }),
  /tip is 100% assigned/,
);

console.log("order calculation tests passed");

{
  assert.deepEqual(expandIsoDateRange("2026-09-01", "2026-09-03"), [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
  ]);
  expectThrow(() => expandIsoDateRange("2026-09-03", "2026-09-01"), /日期區間/);
  assert.doesNotThrow(() => assertOrderV2Transition("awaiting_deposit", "confirmed"));
  expectThrow(() => assertOrderV2Transition("completed", "confirmed"), /不可由/);
}

{
  const parsed = parseAdminOrderV2Payload({
    familyId: "F001",
    petIds: ["P001", "P002"],
    homeVisitIds: ["00000000-0000-4000-8000-000000000001"],
    customerType: "returning",
    orderSource: "LINE",
    orderStatus: "confirmed",
    paymentStatus: "unpaid",
    discountType: "rate",
    discountValue: 0.9,
    depositRuleType: "waived",
    items: [ownerService({ petIds: ["P001", "P002"] })],
  });
  assert.equal(parsed.familyId, "F001");
  assert.deepEqual(parsed.petIds, ["P001", "P002"]);
  assert.deepEqual(parsed.items[0].petIds, ["P001", "P002"]);
  assert.equal(parsed.paymentStatus, "unpaid");
  assert.equal(parsed.deposit.type, "waived");
  assert.equal(parsed.items[0].serviceDate, "2026-09-01");
  assert.equal("lineUserId" in parsed, false, "V2 order payload must not contain a single LINE recipient");
  expectThrow(() => parseAdminOrderV2Payload({
    familyId: "F001",
    petIds: ["P001"],
    customerType: "new",
    orderSource: "LINE",
    orderStatus: "draft",
    paymentStatus: "pending",
    items: [ownerService()],
  }), /paymentStatus/);
}

{
  const base = ownerService({ startTime: "09:00", endTime: "10:00" });
  assert.equal(intervalsOverlap(base.startTime, base.endTime, "09:30", "10:30"), true);
  assert.equal(intervalsOverlap(base.startTime, base.endTime, "10:00", "11:00"), false);
  assert.equal(intervalHasUnavailableSegment([{ start: 540, end: 600, status: "unavailable" }], "09:30", "10:30"), true);
  assert.equal(intervalHasUnavailableSegment([{ start: 540, end: 600, status: "limited" }], "09:30", "10:30"), false);
}

console.log("order V2 admin boundary tests passed");

{
  const payload={familyId:'synthetic-family',petIds:['synthetic-pet'],customerType:'new',orderSource:'synthetic',orderStatus:'draft',paymentStatus:'unpaid',items:[ownerService({key:'synthetic-home',itemType:'home_visit_fee',petIds:['synthetic-pet'],serviceDate:'2026-07-01'})]};
  assert.equal(parseAdminOrderV2Payload(payload).items[0].serviceDate,'2026-07-01');
  assert.throws(()=>parseAdminOrderV2Payload({...payload,items:[{...payload.items[0],serviceDate:null}]}),/家訪日期/);
  assert.throws(()=>parseAdminOrderV2Payload({...payload,items:[{...payload.items[0],serviceDate:'2026-02-30'}]}),/日期/);
}
