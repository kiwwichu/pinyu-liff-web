import type {
  DepositRule,
  DiscountRule,
  OrderCalculationItemInput,
  PlatformSnapshotInput,
} from "./order-calculation";

export const ORDER_V2_STATUSES = [
  "draft",
  "awaiting_deposit",
  "confirmed",
  "in_service",
  "completed",
  "cancelled",
] as const;

export type OrderV2Status = typeof ORDER_V2_STATUSES[number];

export const ORDER_V2_PAYMENT_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
  "partially_refunded",
  "refunded",
] as const;

export type OrderV2PaymentStatus = typeof ORDER_V2_PAYMENT_STATUSES[number];

export const ORDER_V2_STATUS_LABELS: Record<OrderV2Status, string> = {
  draft: "草稿",
  awaiting_deposit: "未付訂金",
  confirmed: "待執行",
  in_service: "服務中",
  completed: "完成",
  cancelled: "已取消",
};

const STATUS_ALIASES = new Map<string, OrderV2Status>([
  ...ORDER_V2_STATUSES.map((status) => [status, status] as const),
  ["草稿", "draft"],
  ["未付訂金", "awaiting_deposit"],
  ["待執行", "confirmed"],
  ["待服務", "confirmed"],
  ["常客", "confirmed"],
  ["常客－未付尾款", "confirmed"],
  ["常客-未付尾款", "confirmed"],
  ["服務中", "in_service"],
  ["完成", "completed"],
  ["已完成", "completed"],
  ["已取消", "cancelled"],
  ["取消", "cancelled"],
]);

const ALLOWED_TRANSITIONS: Record<OrderV2Status, ReadonlySet<OrderV2Status>> = {
  draft: new Set(["draft", "awaiting_deposit", "confirmed", "cancelled"]),
  awaiting_deposit: new Set(["awaiting_deposit", "draft", "confirmed", "cancelled"]),
  confirmed: new Set(["confirmed", "in_service", "completed", "cancelled"]),
  in_service: new Set(["in_service", "confirmed", "completed", "cancelled"]),
  completed: new Set(["completed"]),
  cancelled: new Set(["cancelled"]),
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type AdminOrderV2Item = OrderCalculationItemInput & {
  orderItemId: string | null;
  petIds: string[];
};

export type AdminOrderV2Payload = {
  orderId: string | null;
  expectedUpdatedAt: string | null;
  familyId: string;
  petIds: string[];
  homeVisitIds: string[];
  customerType: "new" | "returning";
  orderStatus: OrderV2Status;
  paymentStatus: OrderV2PaymentStatus;
  cancellationReason: string | null;
  orderSource: string;
  notes: string | null;
  discount: DiscountRule;
  deposit: DepositRule;
  platform: PlatformSnapshotInput | null;
  items: AdminOrderV2Item[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
  required = false,
): string {
  const value = source[key];
  if (value === null || value === undefined) {
    if (required) throw new Error(`${key} 為必填欄位`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${key} 格式不正確`);
  const normalized = value.trim();
  if (required && !normalized) throw new Error(`${key} 為必填欄位`);
  if (normalized.length > maxLength) throw new Error(`${key} 字數過長`);
  return normalized;
}

function number(
  source: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  options: { required?: boolean; integer?: boolean; nullable?: boolean } = {},
): number | null {
  const raw = source[key];
  if ((raw === null || raw === undefined || raw === "") && options.nullable) return null;
  if ((raw === null || raw === undefined || raw === "") && options.required) {
    throw new Error(`${key} 為必填欄位`);
  }
  const parsed = Number(raw ?? 0);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} 的數值不正確`);
  }
  if (options.integer && !Number.isInteger(parsed)) throw new Error(`${key} 必須是整數`);
  return parsed;
}

function nullableUuid(source: Record<string, unknown>, key: string): string | null {
  const value = text(source, key, 80);
  if (!value) return null;
  if (!UUID.test(value)) throw new Error(`${key} 格式不正確`);
  return value;
}

function textArray(
  source: Record<string, unknown>,
  key: string,
  options: { maxItems: number; maxLength: number; uuid?: boolean; required?: boolean },
): string[] {
  const value = source[key];
  if (value === null || value === undefined) {
    if (options.required) throw new Error(`${key} 為必填欄位`);
    return [];
  }
  if (!Array.isArray(value) || value.length > options.maxItems) throw new Error(`${key} 格式不正確`);
  const result = [...new Set(value.map((item) => {
    if (typeof item !== "string") throw new Error(`${key} 格式不正確`);
    const normalized = item.trim();
    if (!normalized || normalized.length > options.maxLength || (options.uuid && !UUID.test(normalized))) {
      throw new Error(`${key} 格式不正確`);
    }
    return normalized;
  }))];
  if (options.required && result.length === 0) throw new Error(`${key} 至少需要一筆`);
  return result;
}

function nullableDate(source: Record<string, unknown>, key: string): string | null {
  const value = text(source, key, 10);
  if (!value) return null;
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`${key} 日期格式不正確`);
  }
  return value;
}

function nullableTime(source: Record<string, unknown>, key: string): string | null {
  const value = text(source, key, 8);
  if (!value) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u.test(value)) {
    throw new Error(`${key} 時間格式不正確`);
  }
  return value;
}

export function normalizeOrderV2Status(value: unknown): OrderV2Status {
  if (typeof value !== "string") throw new Error("orderStatus 格式不正確");
  const status = STATUS_ALIASES.get(value.trim());
  if (!status) throw new Error("orderStatus 不支援");
  return status;
}

export function assertOrderV2Transition(
  current: OrderV2Status,
  next: OrderV2Status,
): void {
  if (!ALLOWED_TRANSITIONS[current].has(next)) {
    throw new Error(`訂單狀態不可由「${ORDER_V2_STATUS_LABELS[current]}」直接改成「${ORDER_V2_STATUS_LABELS[next]}」`);
  }
}

export function expandIsoDateRange(start: string, end = start, maxDays = 366): string[] {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) throw new Error("服務日期格式不正確");
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    throw new Error("服務日期區間不正確");
  }
  const days = Math.round((endTime - startTime) / 86_400_000) + 1;
  if (days > maxDays) throw new Error(`單張訂單最多可展開 ${maxDays} 天`);
  return Array.from({ length: days }, (_, index) =>
    new Date(startTime + index * 86_400_000).toISOString().slice(0, 10)
  );
}

function parseDiscount(source: Record<string, unknown>): DiscountRule {
  const type = text(source, "discountType", 20) || "none";
  if (type === "none") return { type: "none" };
  if (type === "rate") {
    return { type, value: number(source, "discountValue", 0, 1, { required: true }) as number };
  }
  if (type === "fixed") {
    return { type, value: number(source, "discountValue", 0, 10_000_000, { required: true }) as number };
  }
  throw new Error("discountType 不支援");
}

function parseDeposit(source: Record<string, unknown>): DepositRule {
  const type = text(source, "depositRuleType", 30) || "default_rate";
  const lockedAmount = number(source, "lockedDepositAmount", 0, 10_000_000, { nullable: true });
  if (type === "default_rate") {
    return { type, defaultRate: number(source, "depositRate", 0, 1) as number, lockedAmount };
  }
  if (type === "custom_rate") {
    return { type, rate: number(source, "depositRate", 0, 1, { required: true }) as number, lockedAmount };
  }
  if (type === "custom_amount") {
    return {
      type,
      amount: number(source, "customDepositAmount", 0, 10_000_000, { required: true }) as number,
      lockedAmount,
    };
  }
  if (type === "waived") return { type, lockedAmount };
  throw new Error("depositRuleType 不支援");
}

function parsePlatform(source: Record<string, unknown>): PlatformSnapshotInput | null {
  const name = text(source, "platformName", 100);
  const orderRef = text(source, "platformOrderRef", 200);
  const payoutStatus = text(source, "platformPayoutStatus", 30) || "not_applicable";
  if (!name && !orderRef && payoutStatus === "not_applicable") return null;
  if (!["not_applicable", "pending", "received"].includes(payoutStatus)) {
    throw new Error("platformPayoutStatus 不支援");
  }
  return {
    name: name || null,
    orderRef: orderRef || null,
    payoutStatus: payoutStatus as "not_applicable" | "pending" | "received",
    actualPayout: number(source, "platformActualPayout", 0, 10_000_000, { nullable: true }),
  };
}

function parseItem(value: unknown, index: number): AdminOrderV2Item {
  if (!isRecord(value)) throw new Error(`第 ${index + 1} 個服務項目格式不正確`);
  const itemType = text(value, "itemType", 30, true);
  if (!["service", "travel_fee", "home_visit_fee", "tip"].includes(itemType)) {
    throw new Error(`第 ${index + 1} 個 itemType 不支援`);
  }
  const itemStatus = text(value, "itemStatus", 20) || "active";
  if (!["active", "cancelled"].includes(itemStatus)) {
    throw new Error(`第 ${index + 1} 個 itemStatus 不支援`);
  }
  const providerType = text(value, "providerType", 20) || "unassigned";
  if (!["owner", "sitter", "unassigned"].includes(providerType)) {
    throw new Error(`第 ${index + 1} 個 providerType 不支援`);
  }
  const serviceDate = nullableDate(value, "serviceDate");
  if (itemType === "service" && !serviceDate) {
    throw new Error(`第 ${index + 1} 個服務項目缺少服務日期`);
  }
  const cancellationReason = text(value, "cancellationReason", 2000);
  if (itemType === "home_visit_fee" && !serviceDate) {
    throw new Error(`第 ${index + 1} 個家訪項目需獨立選填家訪日期`);
  }
  if (itemStatus === "cancelled" && !cancellationReason) {
    throw new Error(`第 ${index + 1} 個取消項目需填寫取消原因`);
  }
  const assignedSitterId = number(value, "assignedSitterId", 1, Number.MAX_SAFE_INTEGER, {
    integer: true,
    nullable: true,
  });
  const orderItemId = nullableUuid(value, "orderItemId");
  const petIds = textArray(value, "petIds", { maxItems: 50, maxLength: 80 });
  if (["service", "home_visit_fee"].includes(itemType) && itemStatus === "active" && petIds.length === 0) {
    throw new Error(`第 ${index + 1} 個服務項目至少需要一隻毛孩`);
  }
  const homeVisitExecutionMode = text(value, "homeVisitExecutionMode", 40) || null;
  if (homeVisitExecutionMode && !["pinyu_self", "sitter_independent", "training", "custom"].includes(homeVisitExecutionMode)) {
    throw new Error(`第 ${index + 1} 個 homeVisitExecutionMode 不支援`);
  }
  return {
    orderItemId,
    petIds,
    key: orderItemId || text(value, "key", 100, true),
    itemType: itemType as AdminOrderV2Item["itemType"],
    itemStatus: itemStatus as AdminOrderV2Item["itemStatus"],
    displayOrder: number(value, "displayOrder", 0, 100_000, { integer: true }) as number,
    servicePlanId: nullableUuid(value, "servicePlanId"),
    itemName: text(value, "itemName", 200, true),
    durationMinutes: number(value, "durationMinutes", 0, 100_000, { integer: true, nullable: true }),
    standardUnitPrice: number(value, "standardUnitPrice", 0, 10_000_000) as number,
    customUnitPrice: number(value, "customUnitPrice", 0, 10_000_000, { nullable: true }),
    chargedUnitPrice: number(value, "chargedUnitPrice", 0, 10_000_000, { required: true }) as number,
    quantity: number(value, "quantity", 0.0001, 100_000, { required: true }) as number,
    serviceDate,
    startTime: nullableTime(value, "startTime"),
    endTime: nullableTime(value, "endTime"),
    specifiedTimeNote: text(value, "specifiedTimeNote", 500) || null,
    assignedSitterId,
    providerType: providerType as AdminOrderV2Item["providerType"],
    commissionRate: number(value, "commissionRate", 0, 1, { nullable: true }),
    sitterAllocationAmount: number(value, "sitterAllocationAmount", 0, 10_000_000, { nullable: true }),
    companyAllocationAmount: number(value, "companyAllocationAmount", 0, 10_000_000, { nullable: true }),
    homeVisitExecutionMode: homeVisitExecutionMode as AdminOrderV2Item["homeVisitExecutionMode"],
    allocationNote: text(value, "allocationNote", 2000) || null,
    cancelledAt: itemStatus === "cancelled"
      ? text(value, "cancelledAt", 40) || new Date().toISOString()
      : null,
    cancellationReason: cancellationReason || null,
  };
}

export function parseAdminOrderV2Payload(value: unknown): AdminOrderV2Payload {
  if (!isRecord(value)) throw new Error("訂單內容格式不正確");
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 500) {
    throw new Error("每張訂單需有 1～500 個實際服務或費用項目");
  }
  const orderStatus = normalizeOrderV2Status(value.orderStatus);
  const cancellationReason = text(value, "cancellationReason", 2000) || null;
  if (orderStatus === "cancelled" && !cancellationReason) {
    throw new Error("取消整張訂單時需填寫原因");
  }
  const customerType = text(value, "customerType", 20, true);
  if (!(["new", "returning"] as const).includes(customerType as "new" | "returning")) {
    throw new Error("customerType 不支援");
  }
  const paymentStatus = text(value, "paymentStatus", 30) || "unpaid";
  if (!(ORDER_V2_PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) {
    throw new Error("paymentStatus 不支援");
  }
  const petIds = textArray(value, "petIds", { maxItems: 50, maxLength: 80, required: true });
  const items = value.items.map(parseItem);
  if (items.some((item) => item.petIds.some((petId) => !petIds.includes(petId)))) {
    throw new Error("服務項目的毛孩必須包含在訂單毛孩中");
  }
  return {
    orderId: text(value, "orderId", 100) || null,
    expectedUpdatedAt: text(value, "expectedUpdatedAt", 40) || null,
    familyId: text(value, "familyId", 80, true),
    petIds,
    homeVisitIds: textArray(value, "homeVisitIds", { maxItems: 50, maxLength: 80, uuid: true }),
    customerType: customerType as "new" | "returning",
    orderStatus,
    paymentStatus: paymentStatus as OrderV2PaymentStatus,
    cancellationReason,
    orderSource: text(value, "orderSource", 80, true),
    notes: text(value, "notes", 2000) || null,
    discount: parseDiscount(value),
    deposit: parseDeposit(value),
    platform: parsePlatform(value),
    items,
  };
}
