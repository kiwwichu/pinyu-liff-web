import type { Json } from "./database.types";
import { getVerifiedLineUserId } from "./line";
import { getOrderV2, listOrdersV2, previewOrderV2, saveOrderV2 } from "./order-v2-service";
import { appendOrderLedger, getOrderLedger, type LedgerStore } from "./order-ledger-service";
import { createSupabaseAdmin } from "./supabase";
import { LedgerFailure, ledgerRpcFailure } from "./ledger-failure";
import { appendSitterPayment } from "./sitter-payment-service";
import { getSitterPayment } from "./sitter-payment-read";
import { getFinanceReport } from "./finance-report-read";
import { writeFinanceXlsx } from "./finance-xlsx";
import { notificationAdminDryRun } from "./notification-admin-dry-run";

type AdminRequest = {
  accessToken: string;
  operation:
    | "bootstrap"
    | "createOrder"
    | "updateDemoOrder"
    | "getOrderV2"
    | "getOrderLedgerV2"
    | "appendOrderLedgerV2"
    | "appendSitterPaymentV2"
    | "getSitterPaymentV2"
    | "getFinanceReportV2"
    | "downloadFinanceXlsxV2"
    | "notificationSyntheticDryRun"
    | "previewOrderV2"
    | "saveOrderV2"
    | "createFamily"
    | "getFamilyDetails"
    | "updateFamily"
    | "searchFamilyPhone"
    | "createContractDraft"
    | "getContractDetails"
    | "saveContractDraft"
    | "createHomeVisitDraft"
    | "getHomeVisitDetails"
    | "saveHomeVisitDraft"
    | "createPet"
    | "saveServicePresets"
    | "saveSiteDesign"
    | "createSitter"
    | "saveSitterAccessProfile"
    | "generateSitterBindingInvite"
    | "saveSitterAvailability"
    | "deleteSitterAvailability"
    | "saveSitterScheduleSettings"
    | "saveSitterRecurringBlock"
    | "deleteSitterRecurringBlock"
    | "suppressSitterRecurringBlockForDate"
    | "restoreSitterRecurringBlockForDate"
    | "updateBookingRequestStatus"
    | "setSitterCommissionRate";
  payload: unknown;
};

type AdminUser = {
  user_id: string;
  display_name: string;
  role: string;
  can_create_orders: boolean;
  can_edit_orders: boolean;
  can_send_notifications: boolean;
  can_view_money: boolean;
};

type DemoOrderInput = {
  familyId: string;
  petId: string;
  serviceDate: string;
  bookingSegment: string;
  specifiedTime: string;
  serviceType: string;
  planName: string;
  customerType: "new" | "returning";
  durationMinutes: number;
  quantity: number;
  standardUnitPrice: number;
  customUnitPrice: number;
  customPriceReason: string;
  travelFeePerVisit: number;
  tip: number;
  homeVisitFee: number;
  discountPercent: number;
  paidAmount: number;
  orderSource: string;
  providerType: "self" | "sitter";
  applyPlatformCommission: boolean;
  commissionRate: number;
  sitterId: number | null;
  commissionRateId: number | null;
  commissionEffectiveFrom: string;
  platformPayoutStatus: "not_applicable" | "pending" | "received";
  caregiver: string;
  orderStatus: string;
  notes: string;
};

type ParsedDemandInput = {
  inputs: DemoOrderInput[];
  orderIds: string[];
  paidAmount: number;
  depositRate: number;
  customRequiredDeposit: number;
  relockDeposit: boolean;
};

type ServicePreset = {
  id: string;
  name: string;
  durationMinutes: number;
  newCustomerPrice: number;
  returningCustomerPrice: number;
};

const ACTIVE_ADMIN_STATUSES = new Set(["active", "啟用"]);
const SERVICE_PRESET_SETTING_KEY = "admin_demo_service_presets_v2";
const SITE_DESIGN_SETTING_KEY = "site_design_v1";
const DEFAULT_SITE_DESIGN = {
  headerBrand: "快樂小狗 Pinyu 到府寵物保姆",
  heroBrandline: "@快樂小狗Pinyu 到府寵物保姆",
  heroTitleLine1: "安心，",
  heroTitleLine2: "從你找到我的那刻——就開始。",
  heroDescription: "從第一次詢問、服務前的資料確認與家訪，到服務中的完整回報，以及結束後的安全巡檢與照護建議，每一步都為了讓毛孩留在熟悉的家，也讓你放心出門。",
  primaryButtonLabel: "開始預約",
  secondaryButtonLabel: "了解服務方案與價格",
  primaryColor: "#2388cc",
  accentColor: "#52aceb",
  pageBackground: "#f4f8fb",
  textColor: "#31566f",
  borderRadius: 26,
} as const;
const DEFAULT_SERVICE_PRESETS: ServicePreset[] = [
  { id: "home-care-30", name: "到府照顧", durationMinutes: 30, newCustomerPrice: 550, returningCustomerPrice: 450 },
  { id: "home-care-45", name: "到府照顧", durationMinutes: 45, newCustomerPrice: 750, returningCustomerPrice: 650 },
  { id: "home-care-60", name: "到府照顧", durationMinutes: 60, newCustomerPrice: 800, returningCustomerPrice: 700 },
  { id: "dog-walk", name: "遛狗散步", durationMinutes: 30, newCustomerPrice: 450, returningCustomerPrice: 450 },
  { id: "long-stay", name: "長時間陪伴", durationMinutes: 120, newCustomerPrice: 900, returningCustomerPrice: 900 },
  { id: "home-visit", name: "家訪", durationMinutes: 30, newCustomerPrice: 0, returningCustomerPrice: 0 },
  { id: "medicine", name: "餵藥", durationMinutes: 0, newCustomerPrice: 50, returningCustomerPrice: 50 },
  { id: "multi-cat", name: "多貓家庭", durationMinutes: 30, newCustomerPrice: 0, returningCustomerPrice: 0 },
];

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;

const ORDER_SELECT = "order_id,legacy_order_id,order_status,caregiver,sitter_id,confirmation_result,established_at,service_date_raw,booking_segment,specified_time,family_id,owner_name_snapshot,pet_name_snapshot,service_type,plan_name,hours,quantity,standard_price,custom_price,travel_fee,tip,standard_deposit,custom_deposit,home_visit_fee,remaining_payment,discount,total,unpaid_balance,total_before_discount,order_platform,net_income,notes,notification_command,notification_state,legacy_data,created_at,updated_at" as const;

const ORDER_STATUSES = new Set([
  "草稿",
  "未付訂金",
  "待服務",
  "服務中",
  "待執行",
  "常客",
  "待付尾款",
  "完成",
  "已取消",
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBackendDataError(value: unknown): boolean {
  return isRecord(value) && (
    typeof value.code === "string" ||
    typeof value.details === "string" ||
    typeof value.hint === "string"
  );
}

function textField(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
  required = false,
): string {
  const value = source[key];
  if (typeof value !== "string") {
    if (required) throw new Error(`${key} 為必填欄位`);
    return "";
  }

  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${key} 為必填欄位`);
  if (trimmed.length > maxLength) throw new Error(`${key} 字數過長`);
  return trimmed;
}

function numberField(
  source: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  integer = false,
): number {
  const value = source[key];
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} 的數值不正確`);
  }
  if (integer && !Number.isInteger(parsed)) throw new Error(`${key} 必須是整數`);
  return parsed;
}

function booleanField(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  return value === true || value === "true" || value === "1" || value === 1;
}

function parseAdminRequest(value: unknown): AdminRequest | null {
  if (!isRecord(value)) return null;
  const accessToken = value.accessToken;
  const operation = value.operation;
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;
  if (
    operation !== "bootstrap" &&
    operation !== "createOrder" &&
    operation !== "updateDemoOrder" &&
    operation !== "getOrderV2" &&
    operation !== "getOrderLedgerV2" &&
    operation !== "appendOrderLedgerV2" &&
    operation !== "appendSitterPaymentV2" &&
    operation !== "getSitterPaymentV2" &&
    operation !== "getFinanceReportV2" &&
    operation !== "downloadFinanceXlsxV2" &&
    operation !== "notificationSyntheticDryRun" &&
    operation !== "previewOrderV2" &&
    operation !== "saveOrderV2" &&
    operation !== "createFamily" &&
    operation !== "getFamilyDetails" &&
    operation !== "updateFamily" &&
    operation !== "searchFamilyPhone" &&
    operation !== "createContractDraft" &&
    operation !== "getContractDetails" &&
    operation !== "saveContractDraft" &&
    operation !== "createHomeVisitDraft" &&
    operation !== "getHomeVisitDetails" &&
    operation !== "saveHomeVisitDraft" &&
    operation !== "createPet" &&
    operation !== "saveServicePresets" &&
    operation !== "saveSiteDesign" &&
    operation !== "createSitter" &&
    operation !== "saveSitterAccessProfile" &&
    operation !== "generateSitterBindingInvite" &&
    operation !== "saveSitterAvailability" &&
    operation !== "deleteSitterAvailability" &&
    operation !== "saveSitterScheduleSettings" &&
    operation !== "saveSitterRecurringBlock" &&
    operation !== "deleteSitterRecurringBlock" &&
    operation !== "suppressSitterRecurringBlockForDate" &&
    operation !== "restoreSitterRecurringBlockForDate" &&
    operation !== "updateBookingRequestStatus" &&
    operation !== "setSitterCommissionRate"
  ) {
    return null;
  }
  return { accessToken: accessToken.trim(), operation, payload: value.payload };
}

function parseSiteDesign(value: unknown) {
  const source = isRecord(value) ? value : {};
  const color = (key: string, fallback: string) => {
    const candidate = typeof source[key] === "string" ? source[key].trim() : "";
    return /^#[0-9a-f]{6}$/iu.test(candidate) ? candidate.toLowerCase() : fallback;
  };
  const text = (key: string, fallback: string, maxLength: number) => {
    const candidate = typeof source[key] === "string" ? source[key].trim() : "";
    return (candidate || fallback).slice(0, maxLength);
  };
  const radius = Number(source.borderRadius);
  return {
    headerBrand: text("headerBrand", DEFAULT_SITE_DESIGN.headerBrand, 80),
    heroBrandline: text("heroBrandline", DEFAULT_SITE_DESIGN.heroBrandline, 80),
    heroTitleLine1: text("heroTitleLine1", DEFAULT_SITE_DESIGN.heroTitleLine1, 40),
    heroTitleLine2: text("heroTitleLine2", DEFAULT_SITE_DESIGN.heroTitleLine2, 80),
    heroDescription: text("heroDescription", DEFAULT_SITE_DESIGN.heroDescription, 500),
    primaryButtonLabel: text("primaryButtonLabel", DEFAULT_SITE_DESIGN.primaryButtonLabel, 30),
    secondaryButtonLabel: text("secondaryButtonLabel", DEFAULT_SITE_DESIGN.secondaryButtonLabel, 40),
    primaryColor: color("primaryColor", DEFAULT_SITE_DESIGN.primaryColor),
    accentColor: color("accentColor", DEFAULT_SITE_DESIGN.accentColor),
    pageBackground: color("pageBackground", DEFAULT_SITE_DESIGN.pageBackground),
    textColor: color("textColor", DEFAULT_SITE_DESIGN.textColor),
    borderRadius: Number.isFinite(radius) ? Math.min(40, Math.max(8, Math.round(radius))) : DEFAULT_SITE_DESIGN.borderRadius,
  };
}

function parseOrderInput(value: unknown): DemoOrderInput {
  if (!isRecord(value)) throw new Error("訂單內容格式不正確");

  const serviceDate = textField(value, "serviceDate", 21, true);
  const [serviceStart, serviceEnd = ""] = serviceDate.split("～");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(serviceStart) ||
    (serviceEnd && !/^\d{4}-\d{2}-\d{2}$/.test(serviceEnd))
  ) {
    throw new Error("服務日期格式不正確");
  }
  if (serviceEnd && serviceEnd < serviceStart) {
    throw new Error("服務結束日期不可早於開始日期");
  }

  const orderStatus = textField(value, "orderStatus", 30, true);
  if (!ORDER_STATUSES.has(orderStatus)) throw new Error("訂單狀態不正確");

  return {
    familyId: textField(value, "familyId", 80, true),
    petId: textField(value, "petId", 80, true),
    serviceDate,
    bookingSegment: textField(value, "bookingSegment", 40),
    specifiedTime: textField(value, "specifiedTime", 40),
    serviceType: textField(value, "serviceType", 80, true),
    planName: textField(value, "planName", 80),
    customerType: textField(value, "customerType", 20) === "new" ? "new" : "returning",
    durationMinutes: numberField(value, "durationMinutes", 0, 1440, true),
    quantity: numberField(value, "quantity", 1, 100, true),
    standardUnitPrice: numberField(value, "standardUnitPrice", 0, 1_000_000),
    customUnitPrice: numberField(value, "customUnitPrice", 0, 1_000_000),
    customPriceReason: textField(value, "customPriceReason", 300),
    travelFeePerVisit: numberField(value, "travelFeePerVisit", 0, 1_000_000),
    tip: numberField(value, "tip", 0, 1_000_000),
    homeVisitFee: numberField(value, "homeVisitFee", 0, 1_000_000),
    discountPercent: numberField(value, "discountPercent", 0, 100),
    paidAmount: numberField(value, "paidAmount", 0, 10_000_000),
    orderSource: textField(value, "orderSource", 80) || "LINE",
    providerType: textField(value, "providerType", 20) === "sitter" ? "sitter" : "self",
    applyPlatformCommission: booleanField(value, "applyPlatformCommission"),
    commissionRate: numberField(value, "commissionRate", 0, 1),
    sitterId: null,
    commissionRateId: null,
    commissionEffectiveFrom: "",
    platformPayoutStatus: ["pending", "received"].includes(textField(value, "platformPayoutStatus", 30))
      ? textField(value, "platformPayoutStatus", 30) as "pending" | "received"
      : "not_applicable",
    caregiver: textField(value, "caregiver", 100),
    orderStatus,
    notes: textField(value, "notes", 2000),
  };
}

function parseDemandInput(value: unknown): ParsedDemandInput {
  if (!isRecord(value)) throw new Error("訂單內容格式不正確");
  if (!Array.isArray(value.services)) {
    const input = parseOrderInput(value);
    return {
      inputs: [{ ...input, paidAmount: 0 }],
      orderIds: [textField(value, "orderId", 100)],
      paidAmount: input.paidAmount,
      depositRate: numberField(value, "depositRate", 0, 1),
      customRequiredDeposit: numberField(value, "customRequiredDeposit", 0, 10_000_000),
      relockDeposit: booleanField(value, "relockDeposit"),
    };
  }
  if (value.services.length < 1 || value.services.length > 12) {
    throw new Error("每張需求單需有 1～12 個服務項目");
  }

  const common = {
    familyId: textField(value, "familyId", 80, true),
    petId: textField(value, "petId", 80, true),
    serviceDate: textField(value, "serviceDate", 21, true),
    orderStatus: textField(value, "orderStatus", 30, true),
    travelFeePerVisit: numberField(value, "travelFeePerVisit", 0, 1_000_000),
    tip: numberField(value, "tip", 0, 1_000_000),
    discountPercent: numberField(value, "discountPercent", 0, 100),
    orderSource: textField(value, "orderSource", 80) || "LINE",
    providerType: textField(value, "providerType", 20) === "sitter" ? "sitter" : "self",
    applyPlatformCommission: booleanField(value, "applyPlatformCommission"),
    commissionRate: numberField(value, "commissionRate", 0, 1),
    platformPayoutStatus: ["pending", "received"].includes(textField(value, "platformPayoutStatus", 30))
      ? textField(value, "platformPayoutStatus", 30) as "pending" | "received"
      : "not_applicable",
    notes: textField(value, "notes", 2000),
  };
  const paidAmount = numberField(value, "paidAmount", 0, 10_000_000);
  const depositRate = numberField(value, "depositRate", 0, 1);
  const customRequiredDeposit = numberField(value, "customRequiredDeposit", 0, 10_000_000);
  const relockDeposit = booleanField(value, "relockDeposit");
  const orderIds: string[] = [];
  const inputs = value.services.map((service, index) => {
    if (!isRecord(service)) throw new Error(`第 ${index + 1} 個服務項目格式不正確`);
    orderIds.push(textField(service, "orderId", 100));
    return parseOrderInput({
      ...service,
      ...common,
      travelFeePerVisit: 0,
      tip: index === 0 ? common.tip : 0,
      homeVisitFee: 0,
      paidAmount: 0,
    });
  });
  const travelLineIndex = inputs.reduce(
    (selected, input, index) => input.quantity > inputs[selected].quantity ? index : selected,
    0,
  );
  inputs[travelLineIndex] = {
    ...inputs[travelLineIndex],
    travelFeePerVisit: common.travelFeePerVisit,
  };
  return { inputs, orderIds, paidAmount, depositRate, customRequiredDeposit, relockDeposit };
}

async function applySitterCommissionRates(
  demand: ParsedDemandInput,
  env: Env,
): Promise<ParsedDemandInput> {
  if (!demand.inputs.some((input) => input.providerType === "sitter")) return demand;

  const supabase = createSupabaseAdmin(env);
  const [sittersResult, ratesResult] = await Promise.all([
    supabase
      .from("sitters")
      .select("sitter_id,display_name,status")
      .eq("status", "active"),
    supabase
      .from("sitter_commission_rates")
      .select("rate_id,sitter_id,rate_percent,effective_from,effective_until")
      .order("effective_from", { ascending: false }),
  ]);
  if (sittersResult.error) throw sittersResult.error;
  if (ratesResult.error) throw ratesResult.error;

  const sitters = sittersResult.data ?? [];
  const rates = ratesResult.data ?? [];
  const inputs = demand.inputs.map((input) => {
    if (input.providerType !== "sitter") return input;
    if (!input.caregiver) throw new Error("選擇其他保姆服務時，每個服務項目都必須指定保姆");

    const sitter = sitters.find((candidate) =>
      candidate.display_name.trim().toLocaleLowerCase("zh-TW") === input.caregiver.trim().toLocaleLowerCase("zh-TW")
    );
    if (!sitter) throw new Error(`${input.caregiver} 尚未建立保姆資料`);

    const serviceStart = input.serviceDate.split("～")[0];
    const rate = rates.find((candidate) =>
      candidate.sitter_id === sitter.sitter_id &&
      candidate.effective_from <= serviceStart &&
      (!candidate.effective_until || candidate.effective_until >= serviceStart)
    );
    if (!rate) throw new Error(`${sitter.display_name} 在 ${serviceStart} 尚未設定有效的抽成比例`);

    return {
      ...input,
      applyPlatformCommission: true,
      commissionRate: Number(rate.rate_percent) / 100,
      sitterId: sitter.sitter_id,
      commissionRateId: rate.rate_id,
      commissionEffectiveFrom: rate.effective_from,
    };
  });

  return { ...demand, inputs };
}

function isDemoMetadata(value: Json): boolean {
  return isRecord(value) && value.demo === true;
}

function metadataNumber(value: Json, key: string): number {
  if (!isRecord(value)) return 0;
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 0;
}

function metadataText(value: Json, key: string): string {
  if (!isRecord(value)) return "";
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : "";
}

function parseServicePresets(value: Json): ServicePreset[] {
  if (!Array.isArray(value)) return DEFAULT_SERVICE_PRESETS;

  const presets = value.flatMap((item): ServicePreset[] => {
    if (!isRecord(item)) return [];
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const durationMinutes = Number(item.durationMinutes);
    const newCustomerPrice = Number(item.newCustomerPrice);
    const returningCustomerPrice = Number(item.returningCustomerPrice);
    if (
      !id ||
      !name ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 0 ||
      durationMinutes > 1440 ||
      !Number.isFinite(newCustomerPrice) ||
      newCustomerPrice < 0 ||
      newCustomerPrice > 1_000_000 ||
      !Number.isFinite(returningCustomerPrice) ||
      returningCustomerPrice < 0 ||
      returningCustomerPrice > 1_000_000
    ) {
      return [];
    }
    return [{ id, name, durationMinutes, newCustomerPrice, returningCustomerPrice }];
  });

  return presets.length ? presets.slice(0, 20) : DEFAULT_SERVICE_PRESETS;
}

function parseServicePresetPayload(value: unknown): ServicePreset[] {
  if (!isRecord(value) || !Array.isArray(value.presets)) {
    throw new Error("服務快速選單格式不正確");
  }

  const presets = value.presets.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 個服務項目格式不正確`);
    return {
      id: textField(item, "id", 80) || crypto.randomUUID(),
      name: textField(item, "name", 60, true),
      durationMinutes: numberField(item, "durationMinutes", 0, 1440, true),
      newCustomerPrice: numberField(item, "newCustomerPrice", 0, 1_000_000),
      returningCustomerPrice: numberField(item, "returningCustomerPrice", 0, 1_000_000),
    } satisfies ServicePreset;
  });

  if (!presets.length || presets.length > 20) throw new Error("服務快速選單需有 1～20 個項目");
  const timePlans = presets.map((preset) =>
    `${preset.name.toLocaleLowerCase("zh-TW")}::${preset.durationMinutes}`,
  );
  if (new Set(timePlans).size !== timePlans.length) {
    throw new Error("同一服務類別不可有重複的時間方案");
  }
  return presets;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function authorizeAdmin(
  accessToken: string,
  env: Env,
): Promise<AdminUser | null> {
  const lineUserId = await getVerifiedLineUserId(
    accessToken,
    env.LINE_LIFF_CHANNEL_ID,
  );
  if (!lineUserId) return null;

  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "user_id,display_name,role,status,can_create_orders,can_edit_orders,can_send_notifications,can_view_money",
    )
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (error) throw error;
  if (
    !data ||
    !ACTIVE_ADMIN_STATUSES.has(data.status.trim().toLowerCase()) ||
    !["OWNER", "ADMIN"].includes(data.role.toUpperCase())
  ) {
    return null;
  }

  return {
    user_id: data.user_id,
    display_name: data.display_name,
    role: data.role,
    can_create_orders: data.can_create_orders,
    can_edit_orders: data.can_edit_orders,
    can_send_notifications: data.can_send_notifications,
    can_view_money: data.can_view_money,
  };
}

function serializeOrder(row: Record<string, unknown>, canViewMoney: boolean) {
  const metadata = row.legacy_data as Json;
  const quantity = Number(row.quantity) || 0;
  const standardPrice = Number(row.standard_price) || 0;
  const customPrice = Number(row.custom_price) || 0;
  const unitPrice = customPrice || standardPrice;
  const travelFeePerVisit = Number(row.travel_fee) || 0;
  const serviceSubtotal = money(unitPrice * quantity);
  const travelSubtotal = money(travelFeePerVisit * quantity);

  return {
    orderId: row.order_id,
    displayOrderId: row.legacy_order_id,
    status: row.order_status,
    caregiver: row.caregiver ?? "",
    establishedAt: row.established_at,
    serviceDate: row.service_date_raw ?? "",
    bookingSegment: row.booking_segment ?? "",
    specifiedTime: row.specified_time ?? "",
    familyId: row.family_id ?? "",
    owner: row.owner_name_snapshot ?? "",
    pet: row.pet_name_snapshot ?? "",
    serviceType: row.service_type ?? "",
    planName: row.plan_name ?? "",
    customerType: metadataText(metadata, "customer_type") || "returning",
    durationMinutes: Math.round((Number(row.hours) || 0) * 60),
    quantity,
    standardUnitPrice: canViewMoney ? standardPrice : null,
    customUnitPrice: canViewMoney ? customPrice : null,
    customPriceReason: metadataText(metadata, "custom_price_reason"),
    unitPrice: canViewMoney ? unitPrice : null,
    serviceSubtotal: canViewMoney ? serviceSubtotal : null,
    travelFeePerVisit: canViewMoney ? travelFeePerVisit : null,
    travelSubtotal: canViewMoney ? travelSubtotal : null,
    tip: canViewMoney ? Number(row.tip) || 0 : null,
    homeVisitFee: canViewMoney ? Number(row.home_visit_fee) || 0 : null,
    discountPercent: canViewMoney
      ? metadataNumber(metadata, "discount_percent") ||
        (Number(row.discount) > 0 ? money((1 - Number(row.discount)) * 100) : 0)
      : null,
    orderSource: metadataText(metadata, "order_source") || String(row.order_platform || "未設定"),
    providerType: metadataText(metadata, "provider_type") || (isDemoMetadata(metadata) ? "self" : "legacy"),
    sitterId: Number(row.sitter_id) || metadataNumber(metadata, "sitter_id") || null,
    applyPlatformCommission: metadataNumber(metadata, "apply_platform_commission") === 1,
    commissionRate: canViewMoney ? metadataNumber(metadata, "commission_rate") : null,
    commissionRateId: canViewMoney ? metadataNumber(metadata, "commission_rate_id") || null : null,
    commissionEffectiveFrom: canViewMoney ? metadataText(metadata, "commission_effective_from") : "",
    commissionAmount: canViewMoney ? metadataNumber(metadata, "commission_amount") : null,
    sitterPayout: canViewMoney ? metadataNumber(metadata, "sitter_payout") : null,
    platformPayoutStatus: metadataText(metadata, "platform_payout_status") || "not_recorded",
    platformReceivable: canViewMoney ? metadataNumber(metadata, "platform_receivable") : null,
    depositRate: canViewMoney ? metadataNumber(metadata, "deposit_rate") : null,
    customRequiredDeposit: canViewMoney ? metadataNumber(metadata, "custom_required_deposit") : null,
    requiredDeposit: canViewMoney
      ? metadataNumber(metadata, "required_deposit") || Math.max(Number(row.standard_deposit) || 0, Number(row.custom_deposit) || 0)
      : null,
    suggestedRequiredDeposit: canViewMoney ? metadataNumber(metadata, "suggested_required_deposit") : null,
    depositLocked: canViewMoney ? metadataNumber(metadata, "deposit_locked") === 1 : null,
    lockedRequiredDeposit: canViewMoney ? metadataNumber(metadata, "locked_required_deposit") : null,
    depositLockedAt: canViewMoney ? metadataText(metadata, "deposit_locked_at") : "",
    additionalDepositSuggested: canViewMoney ? metadataNumber(metadata, "additional_deposit_suggested") : null,
    paidAmount: canViewMoney
      ? Math.max(Number(row.custom_deposit) || 0, Number(row.standard_deposit) || 0)
      : null,
    totalBeforeDiscount: canViewMoney ? Number(row.total_before_discount) || 0 : null,
    total: canViewMoney ? Number(row.total) || 0 : null,
    netIncome: canViewMoney ? Number(row.net_income) || 0 : null,
    unpaidBalance: canViewMoney ? Number(row.unpaid_balance) || 0 : null,
    notificationCommand: row.notification_command ?? "",
    notificationState: row.notification_state ?? "",
    notes: row.notes ?? "",
    isDemo: isDemoMetadata(metadata),
    editable: isDemoMetadata(metadata),
    updatedAt: row.updated_at,
  };
}

async function bootstrap(user: AdminUser, env: Env): Promise<Response> {
  const supabase = createSupabaseAdmin(env);
  const [ordersResult, familiesResult, petsResult, plansResult, settingsResult, siteDesignResult, reviewsResult, sittersResult, ratesResult, sitterAccessResult, sitterAvailabilityResult, bookingRequestsResult, scheduleSettingsResult, recurringBlocksResult, recurringBlockExceptionsResult, calendarSyncResult, orderItemsScheduleResult, homeVisitSummariesResult] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("established_at", { ascending: false, nullsFirst: false })
      .limit(250),
    supabase
      .from("families")
      .select("family_id,owner_name,district,travel_fee,customer_category,notes,legacy_data")
      .order("owner_name", { ascending: true }),
    supabase
      .from("pets")
      .select("pet_id,family_id,pet_name,species,breed,is_enabled,legacy_data")
      .eq("is_enabled", true)
      .order("pet_name", { ascending: true }),
    supabase
      .from("service_plans")
      .select("plan_id,service_type,plan_name,duration_minutes,price")
      .eq("is_enabled", true)
      .order("service_type", { ascending: true }),
    supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", SERVICE_PRESET_SETTING_KEY)
      .maybeSingle(),
    supabase
      .from("public_site_settings")
      .select("setting_value")
      .eq("setting_key", SITE_DESIGN_SETTING_KEY)
      .maybeSingle(),
    supabase
      .from("service_reviews")
      .select("review_id,order_id,legacy_order_id,family_id,overall_rating,report_clarity,care_quality,pet_comfort,punctuality,communication,feedback,allow_anonymous_publication,public_name,submitted_at,last_modified_at")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(250),
    supabase
      .from("sitters")
      .select("sitter_id,display_name,status,notes,created_at,updated_at")
      .order("display_name", { ascending: true }),
    supabase
      .from("sitter_commission_rates")
      .select("rate_id,sitter_id,rate_percent,effective_from,effective_until,change_note,created_by,created_at")
      .order("effective_from", { ascending: false }),
    supabase
      .from("sitter_access_profiles")
      .select("sitter_id,binding_status,line_user_id,line_display_name,can_view_assigned_family_basics,can_view_assigned_address,can_view_assigned_phone,can_view_contract_summary,can_view_reviews,updated_at")
      .order("sitter_id", { ascending: true }),
    supabase
      .from("sitter_availability")
      .select("availability_id,sitter_id,available_date,starts_at,ends_at,availability_status,public_note,internal_note,buffer_minutes,created_at,updated_at")
      .gte("available_date", new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("available_date", { ascending: true })
      .order("starts_at", { ascending: true, nullsFirst: true })
      .limit(500),
    supabase
      .from("booking_requests")
      .select("request_id,request_number,request_status,customer_type,cat_count,dog_count,other_pets,care_needs,service_start_date,service_end_date,service_periods,district,distance_km,nearest_mrt,near_mrt,location_note,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("sitter_schedule_settings")
      .select("sitter_id,morning_start,morning_end,afternoon_start,afternoon_end,evening_start,evening_end,monthly_order_limit,buffer_minutes,updated_at")
      .order("sitter_id", { ascending: true }),
    supabase
      .from("sitter_recurring_blocks")
      .select("recurring_block_id,sitter_id,weekday,starts_at,ends_at,label,effective_from,effective_until,is_enabled,created_at,updated_at")
      .eq("is_enabled", true)
      .order("sitter_id", { ascending: true })
      .order("weekday", { ascending: true }),
    supabase
      .from("sitter_recurring_block_exceptions")
      .select("recurring_block_id,exception_date,created_at")
      .gte("exception_date", new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("exception_date", { ascending: true })
      .limit(500),
    supabase
      .from("google_calendar_sync_jobs")
      .select("sync_job_id,order_id,sync_action,sync_status,last_error,updated_at")
      .in("sync_status", ["pending", "failed"])
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("order_items")
      .select("order_item_id,order_id,item_status,item_type,service_date,start_time,end_time,assigned_sitter_id,orders!inner(order_number,order_status,family_id,owner_name_snapshot,order_model_version)")
      .eq("item_type", "service")
      .eq("orders.order_model_version", 2)
      .gte("service_date", new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("service_date", { ascending: true })
      .limit(1000),
    supabase
      .from("home_visit_records")
      .select("home_visit_id,family_id,visit_type,visit_status,scheduled_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (familiesResult.error) throw familiesResult.error;
  if (petsResult.error) throw petsResult.error;
  if (plansResult.error) throw plansResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (siteDesignResult.error) throw siteDesignResult.error;
  if (reviewsResult.error) throw reviewsResult.error;
  if (sittersResult.error) throw sittersResult.error;
  if (ratesResult.error) throw ratesResult.error;
  if (sitterAccessResult.error) throw sitterAccessResult.error;
  if (sitterAvailabilityResult.error) throw sitterAvailabilityResult.error;
  if (bookingRequestsResult.error) throw bookingRequestsResult.error;
  if (scheduleSettingsResult.error) throw scheduleSettingsResult.error;
  if (recurringBlocksResult.error) throw recurringBlocksResult.error;
  if (recurringBlockExceptionsResult.error) throw recurringBlockExceptionsResult.error;
  if (calendarSyncResult.error) throw calendarSyncResult.error;
  if (orderItemsScheduleResult.error) throw orderItemsScheduleResult.error;
  if (homeVisitSummariesResult.error) throw homeVisitSummariesResult.error;

  const orders = (ordersResult.data ?? []).map((row) =>
    serializeOrder(row, user.can_view_money),
  );
  const ordersV2 = await listOrdersV2(env, user.can_view_money);

  const demandId = (order: { displayOrderId: unknown; orderId: unknown }) =>
    String(order.displayOrderId || order.orderId);
  const statusesByDemand = new Map<string, string[]>();
  for (const order of orders) {
    const id = demandId(order);
    const statuses = statusesByDemand.get(id) ?? [];
    statuses.push(String(order.status ?? ""));
    statusesByDemand.set(id, statuses);
  }
  const isClosedStatus = (status: string) =>
    status.includes("完成") || status.includes("取消");
  const currentCount = [...statusesByDemand.values()].filter((statuses) =>
    statuses.some((status) => !isClosedStatus(status)),
  ).length;
  const demoCount = new Set(orders.filter((order) => order.isDemo).map(demandId)).size;
  const pendingNotificationCount = new Set(
    (ordersResult.data ?? [])
      .filter((row) =>
        Boolean(String(row.notification_command ?? "").trim()) ||
        String(row.notification_state ?? "").startsWith("⚠️"),
      )
      .map((row) => row.legacy_order_id || row.order_id),
  ).size;
  const totalDemandOrders = new Set(orders.map(demandId)).size;
  const servicePresets = parseServicePresets(settingsResult.data?.setting_value ?? null);
  const taipeiParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const datePart = (type: string) => taipeiParts.find((part) => part.type === type)?.value ?? "";
  const todayKey = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const monthKey = todayKey.slice(0, 7);
  const serviceStartKey = (value: unknown) => {
    const match = String(value ?? "").match(/\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
    return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "";
  };
  const incomeRows = ordersResult.data ?? [];
  const historicalRateForRow = (row: Record<string, unknown>) => {
    const caregiver = String(row.caregiver || "").trim().toLocaleLowerCase("zh-TW");
    const serviceDate = serviceStartKey(row.service_date_raw);
    const sitter = (sittersResult.data ?? []).find((candidate) =>
      candidate.display_name.trim().toLocaleLowerCase("zh-TW") === caregiver
    );
    if (!sitter || !serviceDate) return null;
    return (ratesResult.data ?? []).find((rate) =>
      rate.sitter_id === sitter.sitter_id &&
      rate.effective_from <= serviceDate &&
      (!rate.effective_until || rate.effective_until >= serviceDate)
    ) ?? null;
  };
  const recognizedDiscountAmount = (row: Record<string, unknown>) => {
    const unitPrice = Number(row.custom_price || row.standard_price || 0);
    const quantity = Number(row.quantity || 0);
    const beforeDiscount = unitPrice * quantity + Number(row.travel_fee || 0) * quantity +
      Number(row.tip || 0) + Number(row.home_visit_fee || 0);
    const storedCoefficient = Number(row.discount || 0);
    const coefficient = storedCoefficient > 0 && storedCoefficient <= 1 ? storedCoefficient : 1;
    return money(Math.max(beforeDiscount - beforeDiscount * coefficient, 0));
  };
  const recognizedNetIncome = (row: Record<string, unknown>) => {
    const metadata = row.legacy_data as Json;
    const providerType = metadataText(metadata, "provider_type");
    const caregiver = String(row.caregiver || "").trim();
    if (providerType === "self") return Number(row.net_income || 0);
    if (providerType === "sitter") {
      const unitPrice = Number(row.custom_price || row.standard_price || 0);
      const serviceSubtotal = unitPrice * Number(row.quantity || 0);
      const commissionAmount = serviceSubtotal * metadataNumber(metadata, "commission_rate");
      return money(commissionAmount - recognizedDiscountAmount(row));
    }
    if (!caregiver || caregiver === "品伃" || caregiver === user.display_name) return Number(row.net_income || 0);
    const historicalRate = historicalRateForRow(row);
    if (!historicalRate) return 0;
    const unitPrice = Number(row.custom_price || row.standard_price || 0);
    const serviceSubtotal = unitPrice * Number(row.quantity || 0);
    const commissionAmount = serviceSubtotal * Number(historicalRate.rate_percent) / 100;
    const discountAmount = recognizedDiscountAmount(row);
    return money(commissionAmount - discountAmount);
  };
  const dailyNetIncome = user.can_view_money
    ? money(incomeRows.reduce((sum, row) =>
      serviceStartKey(row.service_date_raw) === todayKey && !String(row.order_status || "").includes("取消")
        ? sum + recognizedNetIncome(row)
        : sum, 0))
    : null;
  const monthlyNetIncome = user.can_view_money
    ? money(incomeRows.reduce((sum, row) =>
      serviceStartKey(row.service_date_raw).startsWith(monthKey) && !String(row.order_status || "").includes("取消")
        ? sum + recognizedNetIncome(row)
        : sum, 0))
    : null;
  const monthlyCompletedNetIncome = user.can_view_money
    ? money(incomeRows.reduce((sum, row) =>
      serviceStartKey(row.service_date_raw).startsWith(monthKey) && String(row.order_status || "").includes("完成")
        ? sum + recognizedNetIncome(row)
        : sum, 0))
    : null;
  const unconfiguredCommissionDemandCount = new Set(incomeRows.filter((row) => {
    const metadata = row.legacy_data as Json;
    const caregiver = String(row.caregiver || "").trim();
    return serviceStartKey(row.service_date_raw).startsWith(monthKey) &&
      !String(row.order_status || "").includes("取消") &&
      metadataText(metadata, "provider_type") !== "sitter" && !historicalRateForRow(row) &&
      Boolean(caregiver) && caregiver !== "品伃" && caregiver !== user.display_name;
  }).map((row) => String(row.legacy_order_id || row.order_id))).size;

  const { error: loginError } = await supabase
    .from("app_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", user.user_id);
  if (loginError) throw loginError;

  return json({
    success: true,
    mode: "demo",
    user: { displayName: user.display_name, role: user.role },
    permissions: {
      canCreateOrders: user.can_create_orders,
      canEditOrders: user.can_edit_orders,
      canSendNotifications: false,
      canDryRunNotifications: user.can_send_notifications && env.APP_ENV === "development",
      canViewMoney: user.can_view_money,
      canManageSitters: user.can_view_money && ["OWNER", "ADMIN"].includes(user.role.toUpperCase()),
      canEditFamilies: user.can_edit_orders && ["OWNER", "ADMIN"].includes(user.role.toUpperCase()),
      canViewPrivateFamilyData: user.role.toUpperCase() === "OWNER",
      canManageContracts: user.role.toUpperCase() === "OWNER",
      canManageHomeVisits: canManageHomeVisits(user),
    },
    summary: {
      totalOrders: totalDemandOrders,
      currentOrders: currentCount,
      demoOrders: demoCount,
      serviceReviews: reviewsResult.data?.length ?? 0,
      pendingNotifications: pendingNotificationCount,
      newBookingRequests: (bookingRequestsResult.data ?? []).filter((request) => request.request_status === "new").length,
      pendingCalendarSync: calendarSyncResult.data?.length ?? 0,
      dailyNetIncome,
      monthlyNetIncome,
      monthlyCompletedNetIncome,
      unconfiguredCommissionDemandCount,
      incomeDate: todayKey,
    },
    orders,
    ordersV2,
    orderItemsScheduleV2: orderItemsScheduleResult.data ?? [],
    homeVisitSummaries: homeVisitSummariesResult.data ?? [],
    families: familiesResult.data ?? [],
    pets: petsResult.data ?? [],
    servicePlans: plansResult.data ?? [],
    servicePresets,
    siteDesign: parseSiteDesign(siteDesignResult.data?.setting_value ?? null),
    reviews: reviewsResult.data ?? [],
    sitters: sittersResult.data ?? [],
    sitterCommissionRates: user.can_view_money ? ratesResult.data ?? [] : [],
    sitterAccessProfiles: user.role.toUpperCase() === "OWNER" ? sitterAccessResult.data ?? [] : [],
    sitterAvailability: user.can_view_money ? sitterAvailabilityResult.data ?? [] : [],
    bookingRequests: bookingRequestsResult.data ?? [],
    sitterScheduleSettings: user.can_view_money ? scheduleSettingsResult.data ?? [] : [],
    sitterRecurringBlocks: user.can_view_money ? recurringBlocksResult.data ?? [] : [],
    sitterRecurringBlockExceptions: user.can_view_money ? recurringBlockExceptionsResult.data ?? [] : [],
    calendarSyncJobs: user.can_view_money ? calendarSyncResult.data ?? [] : [],
  });
}

type OrderSnapshots = {
  ownerName: string;
  petName: string;
};

async function loadOrderSnapshots(
  input: DemoOrderInput,
  env: Env,
): Promise<OrderSnapshots> {
  const supabase = createSupabaseAdmin(env);
  const [familyResult, petResult] = await Promise.all([
    supabase
      .from("families")
      .select("family_id,owner_name")
      .eq("family_id", input.familyId)
      .maybeSingle(),
    supabase
      .from("pets")
      .select("pet_id,family_id,pet_name")
      .eq("pet_id", input.petId)
      .maybeSingle(),
  ]);

  if (familyResult.error) throw familyResult.error;
  if (petResult.error) throw petResult.error;
  if (!familyResult.data) throw new Error("找不到指定家庭");
  if (!petResult.data || petResult.data.family_id !== input.familyId) {
    throw new Error("毛孩不屬於指定家庭");
  }

  return {
    ownerName: familyResult.data.owner_name,
    petName: petResult.data.pet_name,
  };
}

function buildOrderRecord(
  input: DemoOrderInput,
  user: AdminUser,
  snapshots: OrderSnapshots,
) {

  const actualUnitPrice = input.customUnitPrice || input.standardUnitPrice;
  if (actualUnitPrice <= 0 && input.serviceType !== "家訪") {
    throw new Error("服務單價必須大於 0；免費家訪請將服務類別選為家訪");
  }
  if (input.customUnitPrice > 0 && !input.customPriceReason) {
    throw new Error("使用客製價格時，請填寫調整原因");
  }

  const serviceSubtotal = money(actualUnitPrice * input.quantity);
  const travelSubtotal = money(input.travelFeePerVisit * input.quantity);
  const totalBeforeDiscount = money(
    serviceSubtotal + travelSubtotal + input.tip + input.homeVisitFee,
  );
  const total = money(totalBeforeDiscount * (1 - input.discountPercent / 100));
  const unpaidBalance = money(Math.max(total - input.paidAmount, 0));
  const discountAmount = money(totalBeforeDiscount - total);
  const commissionAmount = input.applyPlatformCommission
    ? input.providerType === "sitter"
      ? money(serviceSubtotal * input.commissionRate)
      : money(total * input.commissionRate)
    : 0;
  const sitterPayout = input.providerType === "sitter"
    ? money(serviceSubtotal - commissionAmount + travelSubtotal + input.tip + input.homeVisitFee)
    : 0;
  const netIncome = input.providerType === "self"
    ? money(total - commissionAmount)
    : input.applyPlatformCommission
      ? money(commissionAmount - discountAmount)
      : 0;
  const platformReceivable = input.orderSource === "毛小愛" && input.platformPayoutStatus === "pending"
    ? netIncome
    : 0;

  return {
    order_status: input.orderStatus,
    caregiver: input.caregiver || null,
    sitter_id: input.sitterId,
    confirmation_result: "測試資料",
    service_date_raw: input.serviceDate,
    booking_segment: input.bookingSegment || null,
    specified_time: input.specifiedTime || null,
    family_id: input.familyId,
    owner_name_snapshot: snapshots.ownerName,
    pet_name_snapshot: snapshots.petName,
    service_type: input.serviceType,
    plan_name: input.planName || null,
    hours: money(input.durationMinutes / 60),
    quantity: input.quantity,
    standard_price: input.standardUnitPrice,
    custom_price: input.customUnitPrice || null,
    travel_fee: input.travelFeePerVisit,
    tip: input.tip,
    order_platform: input.orderSource,
    standard_deposit: null,
    custom_deposit: input.paidAmount || null,
    home_visit_fee: input.homeVisitFee,
    remaining_payment: unpaidBalance,
    discount: input.discountPercent > 0 ? money(1 - input.discountPercent / 100) : null,
    total,
    unpaid_balance: unpaidBalance,
    total_before_discount: totalBeforeDiscount,
    net_income: netIncome,
    uses_wallet: false,
    notes: input.notes || null,
    notification_command: null,
    notification_state: "測試資料－不發送通知",
    visits_command: null,
    legacy_data: {
      demo: true,
      created_via: "cloudflare_admin_demo",
      custom_price_reason: input.customPriceReason,
      discount_percent: input.discountPercent,
      customer_type: input.customerType,
      order_source: input.orderSource,
      provider_type: input.providerType,
      sitter_id: input.sitterId,
      apply_platform_commission: input.applyPlatformCommission ? 1 : 0,
      commission_rate: input.commissionRate,
      commission_rate_id: input.commissionRateId,
      commission_effective_from: input.commissionEffectiveFrom,
      commission_amount: commissionAmount,
      commission_direction: input.providerType === "self" ? "external_platform_fee" : "pinyu_commission_income",
      sitter_payout: sitterPayout,
      customer_paid_via_platform: input.orderSource === "毛小愛",
      platform_payout_status: input.orderSource === "毛小愛" ? input.platformPayoutStatus : "not_applicable",
      platform_receivable: platformReceivable,
      last_edited_by_user_id: user.user_id,
    } satisfies Json,
  };
}

type DemoOrderRecord = ReturnType<typeof buildOrderRecord>;

function allocatePaidAmount(
  records: DemoOrderRecord[],
  paidAmount: number,
): DemoOrderRecord[] {
  const demandTotal = money(records.reduce((sum, record) => sum + Number(record.total || 0), 0));
  if (money(paidAmount) > demandTotal) {
    throw new Error("目前已付金額不可大於需求單總額");
  }
  let remainingPaid = money(paidAmount);
  return records.map((record) => {
    const lineTotal = money(record.total);
    const allocated = money(Math.min(remainingPaid, lineTotal));
    remainingPaid = money(Math.max(remainingPaid - allocated, 0));
    const unpaidBalance = money(Math.max(lineTotal - allocated, 0));
    return {
      ...record,
      custom_deposit: allocated || null,
      remaining_payment: unpaidBalance,
      unpaid_balance: unpaidBalance,
    };
  });
}

function annotateDemandDeposit(
  records: DemoOrderRecord[],
  depositRate: number,
  customRequiredDeposit: number,
  previousSnapshot?: { locked: boolean; amount: number; lockedAt: string },
  relockDeposit = false,
): DemoOrderRecord[] {
  const demandTotal = money(records.reduce((sum, record) => sum + Number(record.total || 0), 0));
  const suggestedRequiredDeposit = money(customRequiredDeposit > 0 ? customRequiredDeposit : demandTotal * depositRate);
  if (suggestedRequiredDeposit > demandTotal) throw new Error("應付訂金不可高於需求單總額");
  const shouldLockNow = records.some((record) => record.order_status !== "草稿");
  const keepPreviousLock = Boolean(previousSnapshot?.locked && !relockDeposit);
  const locked = keepPreviousLock || shouldLockNow || relockDeposit;
  const lockedRequiredDeposit = money(
    keepPreviousLock ? previousSnapshot?.amount || 0 : locked ? suggestedRequiredDeposit : 0,
  );
  const lockedAt = keepPreviousLock
    ? previousSnapshot?.lockedAt || new Date().toISOString()
    : locked
      ? new Date().toISOString()
      : "";
  const requiredDeposit = locked ? lockedRequiredDeposit : suggestedRequiredDeposit;
  const additionalDepositSuggested = money(Math.max(suggestedRequiredDeposit - lockedRequiredDeposit, 0));
  return records.map((record, index) => ({
    ...record,
    legacy_data: {
      ...record.legacy_data,
      deposit_rate: depositRate,
      custom_required_deposit: index === 0 ? customRequiredDeposit : 0,
      required_deposit: index === 0 ? requiredDeposit : 0,
      suggested_required_deposit: index === 0 ? suggestedRequiredDeposit : 0,
      deposit_locked: index === 0 && locked ? 1 : 0,
      locked_required_deposit: index === 0 ? lockedRequiredDeposit : 0,
      deposit_locked_at: index === 0 ? lockedAt : "",
      additional_deposit_suggested: index === 0 ? additionalDepositSuggested : 0,
    } satisfies Json,
  }));
}

function demandPaidAmount(records: DemoOrderRecord[], demand: ParsedDemandInput): number {
  if (demand.inputs[0]?.orderSource === "毛小愛") {
    return money(records.reduce((sum, record) => sum + Number(record.total || 0), 0));
  }
  return demand.paidAmount;
}

const CAPACITY_STATUSES = ["待執行", "待服務", "服務中"];

async function ensureSitterCapacity(
  demand: ParsedDemandInput,
  env: Env,
  excludedDemandId = "",
): Promise<void> {
  const assignments = new Map<string, { sitterId: number; month: string; sitterName: string }>();
  for (const input of demand.inputs) {
    if (!input.sitterId || !CAPACITY_STATUSES.includes(input.orderStatus)) continue;
    const month = input.serviceDate.slice(0, 7);
    assignments.set(`${input.sitterId}:${month}`, {
      sitterId: input.sitterId,
      month,
      sitterName: input.caregiver || `保姆 #${input.sitterId}`,
    });
  }
  if (!assignments.size) return;

  const supabase = createSupabaseAdmin(env);
  for (const assignment of assignments.values()) {
    const { data: setting, error: settingError } = await supabase
      .from("sitter_schedule_settings")
      .select("monthly_order_limit")
      .eq("sitter_id", assignment.sitterId)
      .maybeSingle();
    if (settingError) throw settingError;
    const limit = Number(setting?.monthly_order_limit || 0);
    if (!limit) continue;

    const { data: rows, error } = await supabase
      .from("orders")
      .select("legacy_order_id")
      .eq("sitter_id", assignment.sitterId)
      .in("order_status", CAPACITY_STATUSES)
      .like("service_date_raw", `${assignment.month}%`);
    if (error) throw error;
    const assignedDemandIds = new Set(
      (rows ?? [])
        .map((row) => row.legacy_order_id)
        .filter((id) => Boolean(id) && id !== excludedDemandId),
    );
    if (assignedDemandIds.size >= limit) {
      throw new Error(`${assignment.sitterName} ${assignment.month} 已達每月 ${limit} 張需求單上限，請改派其他保姆或調整上限`);
    }
  }
}

async function enqueueCalendarSync(
  rows: Array<{ order_id: string; order_status: string }>,
  env: Env,
): Promise<void> {
  const jobs = rows.flatMap((row) => {
    const status = String(row.order_status || "");
    if (status.includes("取消")) return [{ order_id: row.order_id, sync_action: "cancel" }];
    if (CAPACITY_STATUSES.includes(status)) return [{ order_id: row.order_id, sync_action: "upsert" }];
    return [];
  });
  if (!jobs.length) return;
  const supabase = createSupabaseAdmin(env);
  const orderIds = jobs.map((job) => job.order_id);
  const { error: deleteError } = await supabase
    .from("google_calendar_sync_jobs")
    .delete()
    .in("order_id", orderIds)
    .in("sync_status", ["pending", "failed"]);
  if (deleteError) throw deleteError;
  const { error } = await supabase.from("google_calendar_sync_jobs").insert(jobs);
  if (error) throw error;
}

async function createDemoOrder(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!user.can_create_orders) return json({ success: false, message: "沒有新增訂單權限" }, 403);

  const demand = await applySitterCommissionRates(parseDemandInput(payload), env);
  await ensureSitterCapacity(demand, env);
  const snapshots = await loadOrderSnapshots(demand.inputs[0], env);
  const records = annotateDemandDeposit(
    (() => {
      const built = demand.inputs.map((input) => buildOrderRecord(input, user, snapshots));
      return allocatePaidAmount(built, demandPaidAmount(built, demand));
    })(),
    demand.depositRate,
    demand.customRequiredDeposit,
  );
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const demandId = `DEMO-${datePart}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const establishedAt = new Date().toISOString();
  const rows = records.map((record, index) => ({
    ...record,
    order_id: records.length === 1 ? demandId : `${demandId}-${String(index + 1).padStart(2, "0")}`,
    legacy_order_id: demandId,
    established_at: establishedAt,
  }));
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("orders")
    .insert(rows)
    .select(ORDER_SELECT);

  if (error) throw error;
  await enqueueCalendarSync(data ?? [], env);
  const orders = (data ?? []).map((row) => serializeOrder(row, user.can_view_money));
  if (!orders.length) throw new Error("訂單建立後未取得資料");
  return json({ success: true, order: orders[0], orders }, 201);
}

async function updateDemoOrder(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!user.can_edit_orders) return json({ success: false, message: "沒有編輯訂單權限" }, 403);
  if (!isRecord(payload)) throw new Error("訂單內容格式不正確");

  const demandId = textField(payload, "demandId", 100, true);
  const demand = await applySitterCommissionRates(parseDemandInput(payload), env);
  await ensureSitterCapacity(demand, env, demandId);
  const supabase = createSupabaseAdmin(env);
  const { data: existingRows, error: existingError } = await supabase
    .from("orders")
    .select("order_id,legacy_order_id,order_status,legacy_data,established_at")
    .eq("legacy_order_id", demandId);

  if (existingError) throw existingError;
  if (!existingRows?.length) return json({ success: false, message: "找不到訂單" }, 404);
  if (existingRows.some((row) => !isDemoMetadata(row.legacy_data))) {
    return json({ success: false, message: "匯入的舊訂單在 Demo 階段維持唯讀" }, 409);
  }

  const existingIds = new Set(existingRows.map((row) => row.order_id));
  const suppliedIds = demand.orderIds.filter(Boolean);
  if (suppliedIds.some((orderId) => !existingIds.has(orderId))) {
    throw new Error("服務項目的訂單編號不屬於這張需求單");
  }
  if ([...existingIds].some((orderId) => !suppliedIds.includes(orderId))) {
    throw new Error("目前不可刪除已儲存的服務項目；可以新增其他服務類別");
  }

  const snapshots = await loadOrderSnapshots(demand.inputs[0], env);
  const previousFirst = existingRows[0];
  const previousMetadata = previousFirst?.legacy_data as Json;
  const previousRequiredDeposit = metadataNumber(previousMetadata, "locked_required_deposit") ||
    metadataNumber(previousMetadata, "required_deposit");
  const previousDepositSnapshot = {
    locked: metadataNumber(previousMetadata, "deposit_locked") === 1 ||
      Boolean(previousFirst && previousFirst.order_status !== "草稿"),
    amount: previousRequiredDeposit,
    lockedAt: metadataText(previousMetadata, "deposit_locked_at"),
  };
  const records = annotateDemandDeposit(
    (() => {
      const built = demand.inputs.map((input) => buildOrderRecord(input, user, snapshots));
      return allocatePaidAmount(built, demandPaidAmount(built, demand));
    })(),
    demand.depositRate,
    demand.customRequiredDeposit,
    previousDepositSnapshot,
    demand.relockDeposit,
  );
  const establishedById = new Map(existingRows.map((row) => [row.order_id, row.established_at]));
  const now = new Date().toISOString();
  const rows = records.map((record, index) => {
    const orderId = demand.orderIds[index] || `${demandId}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    return {
      ...record,
      order_id: orderId,
      legacy_order_id: demandId,
      established_at: establishedById.get(orderId) || now,
    };
  });
  const { data, error } = await supabase
    .from("orders")
    .upsert(rows, { onConflict: "order_id" })
    .select(ORDER_SELECT);

  if (error) throw error;
  await enqueueCalendarSync(data ?? [], env);
  const orders = (data ?? []).map((row) => serializeOrder(row, user.can_view_money));
  if (!orders.length) throw new Error("訂單更新後未取得資料");
  return json({ success: true, order: orders[0], orders });
}

async function createDemoFamily(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!user.can_create_orders) {
    return json({ success: false, message: "目前帳號沒有新增家庭權限" }, 403);
  }
  if (!isRecord(payload)) throw new Error("家庭資料格式不正確");

  const familyId = textField(payload, "familyId", 80, true);
  if (!/^[A-Za-z0-9_-]+$/.test(familyId)) {
    throw new Error("家庭編號只能使用英文字母、數字、- 或 _");
  }
  const ownerName = textField(payload, "ownerName", 100, true);
  const customerCategory = textField(payload, "customerCategory", 40);
  const notes = textField(payload, "notes", 1000);
  const travelFee = numberField(payload, "travelFee", 0, 1_000_000);
  const supabase = createSupabaseAdmin(env);
  const { data: existing, error: existingError } = await supabase
    .from("families")
    .select("family_id")
    .eq("family_id", familyId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error("這個家庭編號已經存在");

  const { data, error } = await supabase
    .from("families")
    .insert({
      family_id: familyId,
      owner_name: ownerName,
      customer_category: customerCategory || null,
      travel_fee: travelFee,
      notes: notes || null,
      established_at: new Date().toISOString(),
      legacy_data: {
        demo: true,
        created_via: "cloudflare_admin_demo",
        created_by_user_id: user.user_id,
      },
    })
    .select("family_id,owner_name,district,travel_fee,customer_category,notes,legacy_data")
    .single();
  if (error) throw error;
  return json({ success: true, family: data }, 201);
}

function ownerCanViewPrivateFamilyData(user: AdminUser): boolean {
  return user.role.toUpperCase() === "OWNER";
}

function canManageHomeVisits(user: AdminUser): boolean {
  return user.can_edit_orders && ["OWNER", "ADMIN"].includes(user.role.toUpperCase());
}

async function getFamilyDetails(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!user.can_edit_orders) return json({ success: false, message: "沒有查看家庭檔案權限" }, 403);
  if (!isRecord(payload)) throw new Error("家庭查詢格式不正確");
  const familyId = textField(payload, "familyId", 80, true);
  const supabase = createSupabaseAdmin(env);
  const [familyResult, petsResult, contractsResult, homeVisitsResult] = await Promise.all([
    supabase
      .from("families")
      .select("family_id,owner_name,district,travel_fee,customer_category,notes,contract_status,legacy_data,updated_at")
      .eq("family_id", familyId)
      .maybeSingle(),
    supabase
      .from("pets")
      .select("pet_id,pet_name,species,breed,age_text,sex,neuter_status,medical_notes,behavior_notes,feeding_notes,is_enabled")
      .eq("family_id", familyId)
      .eq("is_enabled", true)
      .order("pet_name", { ascending: true }),
    supabase
      .from("family_contracts")
      .select("contract_id,template_name,template_version,contract_status,signed_at,created_at,updated_at")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("home_visit_records")
      .select("home_visit_id,visit_type,visit_status,scheduled_at,completed_at,fee_decision,confirmed_fee,created_at,updated_at,order_home_visits(order_id)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false }),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (petsResult.error) throw petsResult.error;
  if (contractsResult.error) throw contractsResult.error;
  if (homeVisitsResult.error) throw homeVisitsResult.error;
  if (!familyResult.data) throw new Error("找不到指定家庭");
  const relatedOrdersV2 = (await listOrdersV2(env, user.can_view_money)).filter((order) => order.familyId === familyId);

  let privateContact: { address: string | null; phone: string | null; updated_at: string } | null = null;
  if (ownerCanViewPrivateFamilyData(user)) {
    const { data, error } = await supabase
      .from("family_private_contacts")
      .select("address,phone,updated_at")
      .eq("family_id", familyId)
      .maybeSingle();
    if (error) throw error;
    privateContact = data;
  }

  return json({
    success: true,
    family: familyResult.data,
    pets: petsResult.data ?? [],
    privateContact,
    contracts: contractsResult.data ?? [],
    homeVisits: homeVisitsResult.data ?? [],
    ordersV2: relatedOrdersV2,
    privateAccess: ownerCanViewPrivateFamilyData(user),
  });
}

async function updateFamily(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!user.can_edit_orders) return json({ success: false, message: "沒有修改家庭資料權限" }, 403);
  if (!isRecord(payload)) throw new Error("家庭資料格式不正確");
  const familyId = textField(payload, "familyId", 80, true);
  const ownerName = textField(payload, "ownerName", 100, true);
  const district = textField(payload, "district", 100);
  const customerCategory = textField(payload, "customerCategory", 40);
  const notes = textField(payload, "notes", 2000);
  const travelFee = numberField(payload, "travelFee", 0, 1_000_000);
  const address = textField(payload, "address", 1000);
  const phone = textField(payload, "phone", 100);
  const hasPrivatePayload = Object.prototype.hasOwnProperty.call(payload, "address") || Object.prototype.hasOwnProperty.call(payload, "phone");
  if (hasPrivatePayload && !ownerCanViewPrivateFamilyData(user)) {
    return json({ success: false, message: "只有 OWNER 可以修改地址與電話" }, 403);
  }

  const supabase = createSupabaseAdmin(env);
  const now = new Date().toISOString();
  const { data: family, error: familyError } = await supabase
    .from("families")
    .update({
      owner_name: ownerName,
      district: district || null,
      customer_category: customerCategory || null,
      travel_fee: travelFee,
      notes: notes || null,
      updated_at: now,
    })
    .eq("family_id", familyId)
    .select("family_id,owner_name,district,travel_fee,customer_category,notes,legacy_data")
    .single();
  if (familyError) throw familyError;

  if (hasPrivatePayload) {
    const { error: privateError } = await supabase
      .from("family_private_contacts")
      .upsert({
        family_id: familyId,
        address: address || null,
        phone: phone || null,
        updated_by: user.user_id,
        updated_at: now,
      }, { onConflict: "family_id" });
    if (privateError) throw privateError;
  }
  return json({ success: true, family });
}

async function searchFamilyPhone(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!ownerCanViewPrivateFamilyData(user)) return json({ success: false, message: "沒有搜尋敏感聯絡資料權限" }, 403);
  if (!isRecord(payload)) throw new Error("搜尋格式不正確");
  const digits = textField(payload, "digits", 20).replace(/\D/g, "");
  if (digits.length < 3) return json({ success: true, familyIds: [] });
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("family_private_contacts")
    .select("family_id")
    .ilike("phone", `%${digits}%`)
    .limit(20);
  if (error) throw error;
  return json({ success: true, familyIds: (data ?? []).map(row => row.family_id) });
}

async function createContractDraft(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!ownerCanViewPrivateFamilyData(user)) return json({ success: false, message: "只有 OWNER 可以建立完整合約" }, 403);
  if (!isRecord(payload)) throw new Error("合約資料格式不正確");
  const familyId = textField(payload, "familyId", 80, true);
  const supabase = createSupabaseAdmin(env);
  const [familyResult, contactResult, existingResult] = await Promise.all([
    supabase.from("families").select("family_id,owner_name").eq("family_id", familyId).maybeSingle(),
    supabase.from("family_private_contacts").select("address,phone").eq("family_id", familyId).maybeSingle(),
    supabase.from("family_contracts").select("contract_id").eq("family_id", familyId).eq("contract_status", "draft").maybeSingle(),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (contactResult.error) throw contactResult.error;
  if (existingResult.error) throw existingResult.error;
  if (!familyResult.data) throw new Error("找不到指定家庭");
  if (existingResult.data) return json({ success: true, contractId: existingResult.data.contract_id, existed: true });
  const { data, error } = await supabase
    .from("family_contracts")
    .insert({
      family_id: familyId,
      template_name: "快樂小狗 Pinyu 寵物保姆服務合約",
      template_version: "0821",
      typed_party_data: {
        ownerName: familyResult.data.owner_name,
        phone: contactResult.data?.phone ?? "",
        address: contactResult.data?.address ?? "",
      },
      created_by: user.user_id,
    })
    .select("contract_id")
    .single();
  if (error) throw error;
  return json({ success: true, contractId: data.contract_id, existed: false }, 201);
}

async function getContractDetails(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!ownerCanViewPrivateFamilyData(user)) return json({ success: false, message: "只有 OWNER 可以查看完整合約" }, 403);
  if (!isRecord(payload)) throw new Error("合約查詢格式不正確");
  const contractId = textField(payload, "contractId", 100, true);
  const supabase = createSupabaseAdmin(env);
  const { data: contract, error: contractError } = await supabase
    .from("family_contracts")
    .select("contract_id,family_id,template_name,template_version,contract_status,typed_party_data,signed_at,created_at,updated_at")
    .eq("contract_id", contractId)
    .maybeSingle();
  if (contractError) throw contractError;
  if (!contract) throw new Error("找不到指定合約");
  const [familyResult, petsResult, summaryResult] = await Promise.all([
    supabase.from("families").select("family_id,owner_name").eq("family_id", contract.family_id).single(),
    supabase.from("pets").select("pet_id,pet_name,species,breed,age_text,sex,neuter_status,medical_notes,behavior_notes,feeding_notes").eq("family_id", contract.family_id).eq("is_enabled", true).order("pet_name", { ascending: true }),
    supabase.from("contract_sitter_summaries").select("*").eq("contract_id", contractId).maybeSingle(),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (petsResult.error) throw petsResult.error;
  if (summaryResult.error) throw summaryResult.error;
  return json({ success: true, contract, family: familyResult.data, pets: petsResult.data ?? [], sitterSummary: summaryResult.data });
}

async function saveContractDraft(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!ownerCanViewPrivateFamilyData(user)) return json({ success: false, message: "只有 OWNER 可以修改完整合約" }, 403);
  if (!isRecord(payload)) throw new Error("合約資料格式不正確");
  const contractId = textField(payload, "contractId", 100, true);
  const typedSource = isRecord(payload.typedPartyData) ? payload.typedPartyData : {};
  const summarySource = isRecord(payload.sitterSummary) ? payload.sitterSummary : {};
  const disclosureSource = isRecord(typedSource.disclosures) ? typedSource.disclosures : {};
  const disclosureKeys = [
    "health_information_truth", "health_risk_disclosure", "carrier_ready", "nails_trimmed", "other_animals_disclosed",
    "private_line_reporting", "medicine_scope_and_fee", "medicine_supplies", "medicine_method",
    "deposit_policy", "balance_policy", "cancellation_policy", "force_majeure",
    "emergency_definition", "emergency_decision_process", "emergency_authorization", "emergency_costs",
    "home_privacy", "professional_judgment", "personal_data_use",
  ];
  const disclosures = Object.fromEntries(disclosureKeys.map((key) => [key, disclosureSource[key] === true]));
  const typedPartyData = {
    homeVisitDate: textField(typedSource, "homeVisitDate", 20),
    ownerName: textField(typedSource, "ownerName", 100),
    phone: textField(typedSource, "phone", 100),
    address: textField(typedSource, "address", 1000),
    firstServiceDate: textField(typedSource, "firstServiceDate", 20),
    servicePlan: textField(typedSource, "servicePlan", 500),
    notes: textField(typedSource, "notes", 2000),
    disclosures,
  };
  const approved = booleanField(summarySource, "approvedByOwner");
  const now = new Date().toISOString();
  const supabase = createSupabaseAdmin(env);
  const { error: contractError } = await supabase
    .from("family_contracts")
    .update({ typed_party_data: typedPartyData, updated_at: now })
    .eq("contract_id", contractId);
  if (contractError) throw contractError;
  const { error: summaryError } = await supabase
    .from("contract_sitter_summaries")
    .upsert({
      contract_id: contractId,
      emergency_authorizer: textField(summarySource, "emergencyAuthorizer", 200),
      emergency_contact_name: textField(summarySource, "emergencyContactName", 200),
      emergency_contact_phone: textField(summarySource, "emergencyContactPhone", 100),
      preferred_hospital: textField(summarySource, "regularHospital", 500, true),
      emergency_hospital: textField(summarySource, "emergencyHospital", 500, true),
      emergency_transport_consent: booleanField(summarySource, "emergencyTransportConsent"),
      cpr_consent: false,
      hospitalization_consent: false,
      medical_spending_limit: null,
      treatment_notes: textField(summarySource, "treatmentNotes", 3000),
      approved_by_owner: approved,
      approved_at: approved ? now : null,
      updated_by: user.user_id,
      updated_at: now,
    }, { onConflict: "contract_id" });
  if (summaryError) throw summaryError;
  return json({ success: true });
}

async function createHomeVisitDraft(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageHomeVisits(user)) return json({ success: false, message: "沒有建立家訪紀錄的權限" }, 403);
  if (!isRecord(payload)) throw new Error("家訪資料格式不正確");
  const familyId = textField(payload, "familyId", 80, true);
  const supabase = createSupabaseAdmin(env);
  const [familyResult, petsResult] = await Promise.all([
    supabase.from("families").select("family_id").eq("family_id", familyId).maybeSingle(),
    supabase.from("pets").select("pet_id").eq("family_id", familyId).eq("is_enabled", true),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (petsResult.error) throw petsResult.error;
  if (!familyResult.data) throw new Error("找不到指定家庭");

  const { data: visit, error: visitError } = await supabase
    .from("home_visit_records")
    .insert({ family_id: familyId, created_by: user.user_id })
    .select("home_visit_id")
    .single();
  if (visitError) throw visitError;
  const petRows = (petsResult.data ?? []).map((pet) => ({ home_visit_id: visit.home_visit_id, pet_id: pet.pet_id }));
  if (petRows.length) {
    const { error: petsError } = await supabase.from("home_visit_pet_records").insert(petRows);
    if (petsError) throw petsError;
  }
  return json({ success: true, homeVisitId: visit.home_visit_id }, 201);
}

async function getHomeVisitDetails(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageHomeVisits(user)) return json({ success: false, message: "沒有查看家訪紀錄的權限" }, 403);
  if (!isRecord(payload)) throw new Error("家訪查詢格式不正確");
  const homeVisitId = textField(payload, "homeVisitId", 100, true);
  const supabase = createSupabaseAdmin(env);
  const { data: visit, error: visitError } = await supabase
    .from("home_visit_records")
    .select("*")
    .eq("home_visit_id", homeVisitId)
    .maybeSingle();
  if (visitError) throw visitError;
  if (!visit) throw new Error("找不到指定家訪紀錄");
  const [familyResult, petsResult, petRecordsResult] = await Promise.all([
    supabase.from("families").select("family_id,owner_name").eq("family_id", visit.family_id).single(),
    supabase.from("pets").select("pet_id,pet_name,species,breed").eq("family_id", visit.family_id).eq("is_enabled", true).order("pet_name"),
    supabase.from("home_visit_pet_records").select("*").eq("home_visit_id", homeVisitId),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (petsResult.error) throw petsResult.error;
  if (petRecordsResult.error) throw petRecordsResult.error;
  const records = new Map((petRecordsResult.data ?? []).map((record) => [record.pet_id, record]));
  return json({
    success: true,
    visit,
    family: familyResult.data,
    pets: (petsResult.data ?? []).map((pet) => ({ ...pet, record: records.get(pet.pet_id) ?? null })),
  });
}

async function saveHomeVisitDraft(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageHomeVisits(user)) return json({ success: false, message: "沒有修改家訪紀錄的權限" }, 403);
  if (!isRecord(payload)) throw new Error("家訪資料格式不正確");
  const homeVisitId = textField(payload, "homeVisitId", 100, true);
  const visitType = textField(payload, "visitType", 20, true);
  const visitStatus = textField(payload, "visitStatus", 20, true);
  const feeDecision = textField(payload, "feeDecision", 30, true);
  if (!new Set(["first", "revisit"]).has(visitType)) throw new Error("家訪類型不正確");
  if (!new Set(["draft", "scheduled", "completed", "cancelled"]).has(visitStatus)) throw new Error("家訪狀態不正確");
  if (!new Set(["pending_discussion", "confirmed", "waived"]).has(feeDecision)) throw new Error("家訪費決定不正確");
  const scheduledAtInput = textField(payload, "scheduledAt", 40);
  const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) throw new Error("家訪時間格式不正確");
  const proposedFee = numberField(payload, "proposedFee", 0, 1_000_000);
  const confirmedFee = numberField(payload, "confirmedFee", 0, 1_000_000);
  const petRecords = Array.isArray(payload.petRecords) ? payload.petRecords : [];
  if (petRecords.length > 50 || petRecords.some((item) => !isRecord(item))) throw new Error("毛孩家訪紀錄格式不正確");

  const supabase = createSupabaseAdmin(env);
  const { data: visit, error: visitLookupError } = await supabase
    .from("home_visit_records")
    .select("family_id")
    .eq("home_visit_id", homeVisitId)
    .maybeSingle();
  if (visitLookupError) throw visitLookupError;
  if (!visit) throw new Error("找不到指定家訪紀錄");
  const petIds = petRecords.map((item) => textField(item as Record<string, unknown>, "petId", 100, true));
  if (petIds.length) {
    const { data: validPets, error: petsError } = await supabase
      .from("pets")
      .select("pet_id")
      .eq("family_id", visit.family_id)
      .in("pet_id", petIds);
    if (petsError) throw petsError;
    if ((validPets ?? []).length !== new Set(petIds).size) throw new Error("家訪紀錄包含其他家庭的毛孩");
  }
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("home_visit_records")
    .update({
      visit_type: visitType,
      visit_status: visitStatus,
      scheduled_at: scheduledAt?.toISOString() ?? null,
      completed_at: visitStatus === "completed" ? now : null,
      access_notes: textField(payload, "accessNotes", 3000) || null,
      environment_notes: textField(payload, "environmentNotes", 5000) || null,
      general_notes: textField(payload, "generalNotes", 5000) || null,
      follow_up_notes: textField(payload, "followUpNotes", 5000) || null,
      fee_decision: feeDecision,
      proposed_fee: proposedFee,
      fee_reason: textField(payload, "feeReason", 2000) || null,
      confirmed_fee: feeDecision === "confirmed" ? confirmedFee : null,
      updated_at: now,
    })
    .eq("home_visit_id", homeVisitId);
  if (updateError) throw updateError;
  if (petRecords.length) {
    const rows = petRecords.map((item) => {
      const source = item as Record<string, unknown>;
      return {
        home_visit_id: homeVisitId,
        pet_id: textField(source, "petId", 100, true),
        health_notes: textField(source, "healthNotes", 5000) || null,
        medication_notes: textField(source, "medicationNotes", 5000) || null,
        feeding_notes: textField(source, "feedingNotes", 5000) || null,
        behavior_notes: textField(source, "behaviorNotes", 5000) || null,
        touch_restrictions: textField(source, "touchRestrictions", 5000) || null,
        walk_and_toilet_notes: textField(source, "walkAndToiletNotes", 5000) || null,
        updated_at: now,
      };
    });
    const { error: recordsError } = await supabase.from("home_visit_pet_records").upsert(rows, { onConflict: "home_visit_id,pet_id" });
    if (recordsError) throw recordsError;
  }
  return json({ success: true });
}

async function createDemoPet(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!user.can_create_orders) {
    return json({ success: false, message: "目前帳號沒有新增毛孩權限" }, 403);
  }
  if (!isRecord(payload)) throw new Error("毛孩資料格式不正確");

  const familyId = textField(payload, "familyId", 80, true);
  const petName = textField(payload, "petName", 100, true);
  const species = textField(payload, "species", 40);
  const breed = textField(payload, "breed", 80);
  const notes = textField(payload, "notes", 1000);
  const supabase = createSupabaseAdmin(env);
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("family_id")
    .eq("family_id", familyId)
    .maybeSingle();
  if (familyError) throw familyError;
  if (!family) throw new Error("找不到指定的家庭");

  const petId = `DEMO-PET-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("pets")
    .insert({
      pet_id: petId,
      family_id: familyId,
      pet_name: petName,
      species: species || null,
      breed: breed || null,
      behavior_notes: notes || null,
      is_enabled: true,
      legacy_data: {
        demo: true,
        created_via: "cloudflare_admin_demo",
        created_by_user_id: user.user_id,
      },
    })
    .select("pet_id,family_id,pet_name,species,breed,is_enabled,legacy_data")
    .single();
  if (error) throw error;
  return json({ success: true, pet: data }, 201);
}

async function saveServicePresets(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (!user.can_edit_orders) {
    return json({ success: false, message: "目前帳號沒有修改服務選單權限" }, 403);
  }

  const presets = parseServicePresetPayload(payload);
  const settingValue = presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    durationMinutes: preset.durationMinutes,
    newCustomerPrice: preset.newCustomerPrice,
    returningCustomerPrice: preset.returningCustomerPrice,
  })) satisfies Json;
  const supabase = createSupabaseAdmin(env);
  const { error } = await supabase.from("app_settings").upsert({
    setting_key: SERVICE_PRESET_SETTING_KEY,
    setting_value: settingValue,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return json({ success: true, servicePresets: presets });
}

async function saveSiteDesign(
  payload: unknown,
  user: AdminUser,
  env: Env,
): Promise<Response> {
  if (user.role.toUpperCase() !== "OWNER") {
    return json({ success: false, message: "只有 OWNER 可以修改公開網站版面" }, 403);
  }
  const siteDesign = parseSiteDesign(payload);
  const supabase = createSupabaseAdmin(env);
  const { error } = await supabase.from("public_site_settings").upsert({
    setting_key: SITE_DESIGN_SETTING_KEY,
    setting_value: siteDesign satisfies Json,
    updated_by: user.user_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "setting_key" });
  if (error) throw error;
  return json({ success: true, siteDesign });
}

function canManageSitters(user: AdminUser): boolean {
  return user.can_view_money && ["OWNER", "ADMIN"].includes(user.role.toUpperCase());
}

function sitterRatePayload(payload: unknown, includeName: boolean) {
  if (!isRecord(payload)) throw new Error("保姆抽成資料格式不正確");
  const effectiveFrom = textField(payload, "effectiveFrom", 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("抽成生效日期格式不正確");
  const parsedDate = new Date(`${effectiveFrom}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== effectiveFrom) {
    throw new Error("抽成生效日期不正確");
  }
  return {
    displayName: includeName ? textField(payload, "displayName", 100, true) : "",
    sitterId: includeName ? 0 : numberField(payload, "sitterId", 1, Number.MAX_SAFE_INTEGER, true),
    ratePercent: numberField(payload, "ratePercent", 0, 100),
    effectiveFrom,
    changeNote: textField(payload, "changeNote", 500),
  };
}

async function createSitter(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理保姆的權限" }, 403);
  const input = sitterRatePayload(payload, true);
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase.rpc("create_sitter_with_rate", {
    p_display_name: input.displayName,
    p_rate_percent: input.ratePercent,
    p_effective_from: input.effectiveFrom,
    p_change_note: input.changeNote,
    p_created_by: user.user_id,
  });
  if (error) {
    if (error.code === "23505") throw new Error("這位保姆已經存在，請直接新增抽成比例");
    throw error;
  }
  const createdSitterId = Array.isArray(data) && data.length && isRecord(data[0])
    ? Number(data[0].created_sitter_id)
    : 0;
  if (createdSitterId) {
    const { error: accessError } = await supabase.from("sitter_access_profiles").upsert({
      sitter_id: createdSitterId,
      updated_by: user.user_id,
    }, { onConflict: "sitter_id" });
    if (accessError) throw accessError;
  }
  return json({ success: true, result: data }, 201);
}

async function saveSitterAccessProfile(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (user.role.toUpperCase() !== "OWNER") return json({ success: false, message: "只有 OWNER 可以修改保姆資料權限" }, 403);
  if (!isRecord(payload)) throw new Error("保姆權限資料格式不正確");
  const sitterId = numberField(payload, "sitterId", 1, Number.MAX_SAFE_INTEGER, true);
  const bindingStatus = textField(payload, "bindingStatus", 30, true);
  if (!["not_invited", "invited", "bound", "suspended"].includes(bindingStatus)) throw new Error("綁定狀態不正確");
  const supabase = createSupabaseAdmin(env);
  const { data: existing, error: existingError } = await supabase
    .from("sitter_access_profiles")
    .select("line_user_id,binding_status")
    .eq("sitter_id", sitterId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (bindingStatus === "bound" && !existing?.line_user_id) {
    throw new Error("必須先由保姆使用邀請連結完成 LINE 綁定，不能在後台直接標示為已綁定");
  }
  if (bindingStatus === "invited" && existing?.binding_status !== "invited") {
    throw new Error("請使用「產生 LINE 綁定連結」建立邀請");
  }
  const { error } = await supabase.from("sitter_access_profiles").upsert({
    sitter_id: sitterId,
    binding_status: bindingStatus,
    can_view_assigned_family_basics: booleanField(payload, "canViewAssignedFamilyBasics"),
    can_view_assigned_address: booleanField(payload, "canViewAssignedAddress"),
    can_view_assigned_phone: booleanField(payload, "canViewAssignedPhone"),
    can_view_contract_summary: booleanField(payload, "canViewContractSummary"),
    can_view_reviews: booleanField(payload, "canViewReviews"),
    updated_by: user.user_id,
  }, { onConflict: "sitter_id" });
  if (error) throw error;
  return json({ success: true });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function inviteTokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

async function generateSitterBindingInvite(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (user.role.toUpperCase() !== "OWNER") return json({ success: false, message: "只有 OWNER 可以產生保姆綁定邀請" }, 403);
  if (!isRecord(payload)) throw new Error("邀請資料格式不正確");
  const sitterId = numberField(payload, "sitterId", 1, Number.MAX_SAFE_INTEGER, true);
  const rawToken = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await inviteTokenHash(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseAdmin(env);

  const { data: sitter, error: sitterError } = await supabase
    .from("sitters")
    .select("sitter_id")
    .eq("sitter_id", sitterId)
    .maybeSingle();
  if (sitterError) throw sitterError;
  if (!sitter) throw new Error("找不到指定保姆");

  const { error: invalidateError } = await supabase
    .from("sitter_binding_invites")
    .update({ used_at: now.toISOString() })
    .eq("sitter_id", sitterId)
    .is("used_at", null);
  if (invalidateError) throw invalidateError;

  const { error: inviteError } = await supabase.from("sitter_binding_invites").insert({
    sitter_id: sitterId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: user.user_id,
  });
  if (inviteError) throw inviteError;

  const { error: profileError } = await supabase.from("sitter_access_profiles").upsert({
    sitter_id: sitterId,
    binding_status: "invited",
    updated_by: user.user_id,
  }, { onConflict: "sitter_id" });
  if (profileError) throw profileError;

  return json({ success: true, inviteToken: rawToken, expiresAt });
}

function availabilityDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName}格式不正確`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName}不正確`);
  }
  return value;
}

async function saveSitterAvailability(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理排班的權限" }, 403);
  if (!isRecord(payload)) throw new Error("排班資料格式不正確");
  const sitterId = numberField(payload, "sitterId", 1, Number.MAX_SAFE_INTEGER, true);
  const availableDate = availabilityDate(payload.availableDate, "排班日期");
  const status = textField(payload, "availabilityStatus", 20, true);
  if (!["available", "limited", "unavailable"].includes(status)) throw new Error("排班狀態不正確");
  const startsAt = textField(payload, "startsAt", 8);
  const endsAt = textField(payload, "endsAt", 8);
  if (Boolean(startsAt) !== Boolean(endsAt)) throw new Error("開始與結束時間請一起填寫，或一起留白");
  if (startsAt && (!/^\d{2}:\d{2}$/.test(startsAt) || !/^\d{2}:\d{2}$/.test(endsAt) || startsAt >= endsAt)) {
    throw new Error("排班時間不正確，結束時間必須晚於開始時間");
  }
  const publicNote = textField(payload, "publicNote", 300);
  const internalNote = textField(payload, "internalNote", 500);
  const bufferMinutes = numberField(payload, "bufferMinutes", 0, 240, true);
  const supabase = createSupabaseAdmin(env);
  const { data: sitter, error: sitterError } = await supabase
    .from("sitters")
    .select("sitter_id")
    .eq("sitter_id", sitterId)
    .eq("status", "active")
    .maybeSingle();
  if (sitterError) throw sitterError;
  if (!sitter) throw new Error("找不到啟用中的保姆");
  const { data, error } = await supabase.from("sitter_availability").insert({
    sitter_id: sitterId,
    available_date: availableDate,
    starts_at: startsAt || null,
    ends_at: endsAt || null,
    availability_status: status,
    public_note: publicNote || null,
    internal_note: internalNote || null,
    buffer_minutes: bufferMinutes,
    created_by: user.user_id,
  }).select("availability_id").single();
  if (error) {
    if (error.code === "23505") throw new Error("這位保姆在相同日期與時段已有排班");
    throw error;
  }
  return json({ success: true, availabilityId: data.availability_id }, 201);
}

async function deleteSitterAvailability(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理排班的權限" }, 403);
  if (!isRecord(payload)) throw new Error("排班資料格式不正確");
  const availabilityId = numberField(payload, "availabilityId", 1, Number.MAX_SAFE_INTEGER, true);
  const supabase = createSupabaseAdmin(env);
  const { error, count } = await supabase
    .from("sitter_availability")
    .delete({ count: "exact" })
    .eq("availability_id", availabilityId);
  if (error) throw error;
  if (!count) throw new Error("找不到這筆排班，可能已被刪除");
  return json({ success: true });
}

function scheduleTime(source: Record<string, unknown>, key: string): string {
  const value = textField(source, key, 5, true);
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`${key} 時間格式不正確`);
  return value;
}

async function saveSitterScheduleSettings(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理排班的權限" }, 403);
  if (!isRecord(payload)) throw new Error("排班設定格式不正確");
  const sitterId = numberField(payload, "sitterId", 1, Number.MAX_SAFE_INTEGER, true);
  const morningStart = scheduleTime(payload, "morningStart");
  const morningEnd = scheduleTime(payload, "morningEnd");
  const afternoonStart = scheduleTime(payload, "afternoonStart");
  const afternoonEnd = scheduleTime(payload, "afternoonEnd");
  const eveningStart = scheduleTime(payload, "eveningStart");
  const eveningEnd = scheduleTime(payload, "eveningEnd");
  if (morningStart >= morningEnd || afternoonStart >= afternoonEnd || eveningStart >= eveningEnd) {
    throw new Error("每個班別的結束時間都必須晚於開始時間");
  }
  const rawLimit = payload.monthlyOrderLimit;
  const monthlyOrderLimit = rawLimit === "" || rawLimit === null || rawLimit === undefined
    ? null
    : numberField(payload, "monthlyOrderLimit", 1, 200, true);
  const bufferMinutes = numberField(payload, "bufferMinutes", 0, 240, true);
  const supabase = createSupabaseAdmin(env);
  const { error } = await supabase.from("sitter_schedule_settings").upsert({
    sitter_id: sitterId,
    morning_start: morningStart,
    morning_end: morningEnd,
    afternoon_start: afternoonStart,
    afternoon_end: afternoonEnd,
    evening_start: eveningStart,
    evening_end: eveningEnd,
    monthly_order_limit: monthlyOrderLimit,
    buffer_minutes: bufferMinutes,
    updated_by: user.user_id,
  }, { onConflict: "sitter_id" });
  if (error) throw error;
  return json({ success: true });
}

async function saveSitterRecurringBlock(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理排班的權限" }, 403);
  if (!isRecord(payload)) throw new Error("固定時段格式不正確");
  const sitterId = numberField(payload, "sitterId", 1, Number.MAX_SAFE_INTEGER, true);
  const weekdays = Array.isArray(payload.weekdays)
    ? [...new Set(payload.weekdays.map((value) => Number(value)))]
    : [];
  if (!weekdays.length || weekdays.some((value) => !Number.isInteger(value) || value < 0 || value > 6)) {
    throw new Error("請至少選擇一個星期");
  }
  const startsAt = scheduleTime(payload, "startsAt");
  const endsAt = scheduleTime(payload, "endsAt");
  if (startsAt >= endsAt) throw new Error("固定時段的結束時間必須晚於開始時間");
  const label = textField(payload, "label", 100, true);
  const effectiveFrom = availabilityDate(payload.effectiveFrom, "開始日期");
  const effectiveUntilRaw = textField(payload, "effectiveUntil", 10);
  const effectiveUntil = effectiveUntilRaw ? availabilityDate(effectiveUntilRaw, "結束日期") : null;
  if (effectiveUntil && effectiveUntil < effectiveFrom) throw new Error("結束日期不可早於開始日期");
  const supabase = createSupabaseAdmin(env);
  const recurringBlockId = payload.recurringBlockId === null || payload.recurringBlockId === undefined || payload.recurringBlockId === ""
    ? null
    : numberField(payload, "recurringBlockId", 1, Number.MAX_SAFE_INTEGER, true);

  if (recurringBlockId) {
    if (weekdays.length !== 1) throw new Error("修改單一固定排班時，請只選一個星期");
    const { data, error } = await supabase
      .from("sitter_recurring_blocks")
      .update({
        weekday: weekdays[0],
        starts_at: startsAt,
        ends_at: endsAt,
        label,
        effective_from: effectiveFrom,
        effective_until: effectiveUntil,
      })
      .eq("recurring_block_id", recurringBlockId)
      .eq("sitter_id", sitterId)
      .select("recurring_block_id,sitter_id,weekday,starts_at,ends_at,label,effective_from,effective_until,is_enabled,created_at,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("找不到要修改的固定排班規則");
    return json({ success: true, recurringBlocks: [data], updated: true });
  }

  const { data, error } = await supabase.from("sitter_recurring_blocks").insert(weekdays.map((weekday) => ({
    sitter_id: sitterId,
    weekday,
    starts_at: startsAt,
    ends_at: endsAt,
    label,
    effective_from: effectiveFrom,
    effective_until: effectiveUntil,
    created_by: user.user_id,
  }))).select("recurring_block_id,sitter_id,weekday,starts_at,ends_at,label,effective_from,effective_until,is_enabled,created_at,updated_at");
  if (error) throw error;
  return json({ success: true, recurringBlocks: data ?? [], updated: false }, 201);
}

async function deleteSitterRecurringBlock(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理排班的權限" }, 403);
  if (!isRecord(payload)) throw new Error("固定時段格式不正確");
  const recurringBlockId = numberField(payload, "recurringBlockId", 1, Number.MAX_SAFE_INTEGER, true);
  const supabase = createSupabaseAdmin(env);
  const { count, error } = await supabase
    .from("sitter_recurring_blocks")
    .delete({ count: "exact" })
    .eq("recurring_block_id", recurringBlockId);
  if (error) throw error;
  if (!count) throw new Error("找不到這筆固定時段");
  return json({ success: true });
}

async function recurringBlockForException(
  payload: Record<string, unknown>,
  env: Env,
): Promise<{ recurringBlockId: number; exceptionDate: string }> {
  const recurringBlockId = numberField(payload, "recurringBlockId", 1, Number.MAX_SAFE_INTEGER, true);
  const exceptionDate = availabilityDate(payload.exceptionDate, "例外日期");
  const supabase = createSupabaseAdmin(env);
  const { data: block, error } = await supabase
    .from("sitter_recurring_blocks")
    .select("recurring_block_id,weekday,effective_from,effective_until,is_enabled")
    .eq("recurring_block_id", recurringBlockId)
    .maybeSingle();
  if (error) throw error;
  if (!block || block.is_enabled === false) throw new Error("找不到啟用中的固定排班規則");

  const weekday = new Date(`${exceptionDate}T00:00:00Z`).getUTCDay();
  const appliesOnDate = Number(block.weekday) === weekday &&
    String(block.effective_from) <= exceptionDate &&
    (!block.effective_until || String(block.effective_until) >= exceptionDate);
  if (!appliesOnDate) throw new Error("這條固定排班並未套用在指定日期");
  return { recurringBlockId, exceptionDate };
}

async function suppressSitterRecurringBlockForDate(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理排班的權限" }, 403);
  if (!isRecord(payload)) throw new Error("單日排班例外格式不正確");
  const input = await recurringBlockForException(payload, env);
  const supabase = createSupabaseAdmin(env);
  const { error } = await supabase.from("sitter_recurring_block_exceptions").upsert({
    recurring_block_id: input.recurringBlockId,
    exception_date: input.exceptionDate,
    created_by: user.user_id,
  }, { onConflict: "recurring_block_id,exception_date" });
  if (error) throw error;
  return json({ success: true }, 201);
}

async function restoreSitterRecurringBlockForDate(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理排班的權限" }, 403);
  if (!isRecord(payload)) throw new Error("單日排班例外格式不正確");
  const recurringBlockId = numberField(payload, "recurringBlockId", 1, Number.MAX_SAFE_INTEGER, true);
  const exceptionDate = availabilityDate(payload.exceptionDate, "例外日期");
  const supabase = createSupabaseAdmin(env);
  const { error } = await supabase
    .from("sitter_recurring_block_exceptions")
    .delete()
    .eq("recurring_block_id", recurringBlockId)
    .eq("exception_date", exceptionDate);
  if (error) throw error;
  return json({ success: true });
}

async function updateBookingRequestStatus(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!["OWNER", "ADMIN"].includes(user.role.toUpperCase())) {
    return json({ success: false, message: "沒有處理預約需求的權限" }, 403);
  }
  if (!isRecord(payload)) throw new Error("預約需求格式不正確");
  const requestId = textField(payload, "requestId", 36, true);
  const requestStatus = textField(payload, "requestStatus", 20, true);
  if (!["new", "reviewing", "approved", "rejected", "converted"].includes(requestStatus)) {
    throw new Error("預約需求狀態不正確");
  }
  const supabase = createSupabaseAdmin(env);
  const { count, error } = await supabase.from("booking_requests").update({
    request_status: requestStatus,
    reviewed_at: requestStatus === "new" ? null : new Date().toISOString(),
    reviewed_by: requestStatus === "new" ? null : user.user_id,
  }, { count: "exact" }).eq("request_id", requestId);
  if (error) throw error;
  if (!count) throw new Error("找不到這筆預約需求");
  return json({ success: true });
}

async function setSitterCommissionRate(payload: unknown, user: AdminUser, env: Env): Promise<Response> {
  if (!canManageSitters(user)) return json({ success: false, message: "沒有管理保姆的權限" }, 403);
  const input = sitterRatePayload(payload, false);
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase.rpc("set_sitter_commission_rate", {
    p_sitter_id: input.sitterId,
    p_rate_percent: input.ratePercent,
    p_effective_from: input.effectiveFrom,
    p_change_note: input.changeNote,
    p_created_by: user.user_id,
  });
  if (error) throw error;
  return json({ success: true, rateId: data }, 201);
}

export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 512 * 1024) {
    return json({ success: false, message: "Request body too large" }, 413);
  }

  let input: AdminRequest | null = null;
  try {
    input = parseAdminRequest(await request.json());
  } catch {
    return json({ success: false, message: "JSON 格式不正確" }, 400);
  }
  if (!input) return json({ success: false, message: "請求內容不完整" }, 400);

  const user = await authorizeAdmin(input.accessToken, env);
  if (!user) return json({ success: false, message: "管理員驗證失敗" }, 403);

  try {
    if (input.operation === "bootstrap") return await bootstrap(user, env);
    if (input.operation === "notificationSyntheticDryRun") {
      return json({success:true,...notificationAdminDryRun({role:user.role,canSendNotifications:user.can_send_notifications},env)});
    }
    if (input.operation === "getFinanceReportV2" || input.operation === "downloadFinanceXlsxV2") {
      const data = await getFinanceReport({userId:user.user_id,role:user.role,canViewMoney:user.can_view_money,canEditOrders:user.can_edit_orders},env);
      if(input.operation === "getFinanceReportV2") return json({success:true,...data});
      const bytes=await writeFinanceXlsx(data.report);
      return new Response(bytes, {headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="pinyu-dev-v2-finance.xlsx"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if (input.operation === "getSitterPaymentV2") {
      const actor = { userId: user.user_id, role: user.role, canViewMoney: user.can_view_money, canEditOrders: user.can_edit_orders };
      return json({ success: true, ...(await getSitterPayment(input.payload, actor, env)) });
    }
    if (input.operation === "appendSitterPaymentV2") {
      const actor = { userId: user.user_id, role: user.role, canViewMoney: user.can_view_money, canEditOrders: user.can_edit_orders };
      const result = await appendSitterPayment(input.payload, actor, env.APP_ENV, env.SUPABASE_URL, {
        async append(entry, actorId, orderVersion, itemVersion) {
          const { data, error } = await createSupabaseAdmin(env).rpc("append_sitter_payment_v2", {
            p_entry: entry, p_actor_id: actorId,
            p_expected_order_updated_at: orderVersion, p_expected_item_updated_at: itemVersion,
          });
          if (error) throw ledgerRpcFailure(error);
          return data;
        },
      });
      return json({ success: true, ...result });
    }
    if (input.operation === "getOrderLedgerV2" || input.operation === "appendOrderLedgerV2") {
      const database = createSupabaseAdmin(env);
      const store: LedgerStore = {
        async read(orderId, actorId) {
          const { data, error } = await database.rpc("get_order_ledger_v2", { p_order_id: orderId, p_actor_id: actorId });
          if (error) throw new Error("流水尚未就緒或讀取失敗；請確認 Dev migration 已獲准並驗證");
          return data;
        },
        async append(entry, actorId, expectedUpdatedAt) {
          const { data, error } = await database.rpc("append_order_ledger_v2", {
            p_entry: entry, p_actor_id: actorId, p_expected_updated_at: expectedUpdatedAt,
          });
          if (error) throw ledgerRpcFailure(error);
          return data;
        },
      };
      const actor = { userId: user.user_id, role: user.role, canViewMoney: user.can_view_money, canEditOrders: user.can_edit_orders };
      const action = input.operation === "getOrderLedgerV2" ? getOrderLedger : appendOrderLedger;
      return json({ success: true, ...(await action(input.payload, actor, env.APP_ENV, env.SUPABASE_URL, store)) });
    }
    const orderV2Actor = {
      userId: user.user_id,
      canCreateOrders: user.can_create_orders,
      canEditOrders: user.can_edit_orders,
      canViewMoney: user.can_view_money,
    };
    if (input.operation === "getOrderV2") {
      return json({ success: true, ...(await getOrderV2(input.payload, env, user.can_view_money)) });
    }
    if (input.operation === "previewOrderV2") {
      return json({ success: true, ...(await previewOrderV2(input.payload, orderV2Actor, env)) });
    }
    if (input.operation === "saveOrderV2") {
      const result = await saveOrderV2(input.payload, orderV2Actor, env);
      return json({ success: true, ...result }, input.payload && isRecord(input.payload) && input.payload.orderId ? 200 : 201);
    }
    if (input.operation === "createOrder") {
      return await createDemoOrder(input.payload, user, env);
    }
    if (input.operation === "updateDemoOrder") {
      return await updateDemoOrder(input.payload, user, env);
    }
    if (input.operation === "createFamily") {
      return await createDemoFamily(input.payload, user, env);
    }
    if (input.operation === "getFamilyDetails") {
      return await getFamilyDetails(input.payload, user, env);
    }
    if (input.operation === "updateFamily") {
      return await updateFamily(input.payload, user, env);
    }
    if (input.operation === "searchFamilyPhone") {
      return await searchFamilyPhone(input.payload, user, env);
    }
    if (input.operation === "createContractDraft") {
      return await createContractDraft(input.payload, user, env);
    }
    if (input.operation === "getContractDetails") {
      return await getContractDetails(input.payload, user, env);
    }
    if (input.operation === "saveContractDraft") {
      return await saveContractDraft(input.payload, user, env);
    }
    if (input.operation === "createHomeVisitDraft") {
      return await createHomeVisitDraft(input.payload, user, env);
    }
    if (input.operation === "getHomeVisitDetails") {
      return await getHomeVisitDetails(input.payload, user, env);
    }
    if (input.operation === "saveHomeVisitDraft") {
      return await saveHomeVisitDraft(input.payload, user, env);
    }
    if (input.operation === "createPet") {
      return await createDemoPet(input.payload, user, env);
    }
    if (input.operation === "saveServicePresets") {
      return await saveServicePresets(input.payload, user, env);
    }
    if (input.operation === "saveSiteDesign") {
      return await saveSiteDesign(input.payload, user, env);
    }
    if (input.operation === "createSitter") {
      return await createSitter(input.payload, user, env);
    }
    if (input.operation === "saveSitterAccessProfile") {
      return await saveSitterAccessProfile(input.payload, user, env);
    }
    if (input.operation === "generateSitterBindingInvite") {
      return await generateSitterBindingInvite(input.payload, user, env);
    }
    if (input.operation === "saveSitterAvailability") {
      return await saveSitterAvailability(input.payload, user, env);
    }
    if (input.operation === "deleteSitterAvailability") {
      return await deleteSitterAvailability(input.payload, user, env);
    }
    if (input.operation === "saveSitterScheduleSettings") {
      return await saveSitterScheduleSettings(input.payload, user, env);
    }
    if (input.operation === "saveSitterRecurringBlock") {
      return await saveSitterRecurringBlock(input.payload, user, env);
    }
    if (input.operation === "deleteSitterRecurringBlock") {
      return await deleteSitterRecurringBlock(input.payload, user, env);
    }
    if (input.operation === "suppressSitterRecurringBlockForDate") {
      return await suppressSitterRecurringBlockForDate(input.payload, user, env);
    }
    if (input.operation === "restoreSitterRecurringBlockForDate") {
      return await restoreSitterRecurringBlockForDate(input.payload, user, env);
    }
    if (input.operation === "updateBookingRequestStatus") {
      return await updateBookingRequestStatus(input.payload, user, env);
    }
    if (input.operation !== "setSitterCommissionRate") {
      return json({ success: false, message: "不支援的管理操作" }, 400);
    }
    return await setSitterCommissionRate(input.payload, user, env);
  } catch (error) {
    if (error instanceof LedgerFailure) {
      return json({ success: false, code: error.code, message: error.message }, error.status);
    }
    const backendError = isBackendDataError(error);
    const internalMessage = error instanceof Error
      ? error.message
      : isRecord(error) && typeof error.message === "string"
        ? error.message
        : "操作失敗";
    const publicMessage = backendError ? "資料處理失敗，請稍後再試或通知 Pinyu" : internalMessage;
    console.error(
      JSON.stringify({
        message: "Admin demo operation failed",
        operation: input.operation,
        error: internalMessage,
      }),
    );
    return json({ success: false, message: publicMessage }, backendError ? 500 : 400);
  }
}
