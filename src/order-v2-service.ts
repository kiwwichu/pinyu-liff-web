import type { Json } from "./database.types";
import { calculateOrder, type CalculatedOrderItem, type OrderCalculationResult } from "./order-calculation";
import {
  assertOrderV2Transition,
  normalizeOrderV2Status,
  parseAdminOrderV2Payload,
  type AdminOrderV2Item,
  type AdminOrderV2Payload,
} from "./order-v2-admin";
import { createSupabaseAdmin } from "./supabase";
import { assertOrderScheduleAvailable } from "./order-scheduling";

export type OrderV2Actor = {
  userId: string;
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canViewMoney: boolean;
};

const ORDER_V2_SELECT = [
  "order_id", "order_number", "order_status", "payment_status", "family_id",
  "owner_name_snapshot", "pet_name_snapshot", "service_date_raw", "caregiver",
  "order_source", "notes", "legacy_data", "cancellation_reason", "updated_at",
  "confirmed_at", "completed_at", "cancelled_at", "service_subtotal",
  "travel_fee_total", "home_visit_fee_total", "tip_total", "discount_type",
  "discount_value", "discount_amount", "customer_total", "deposit_rule_type",
  "deposit_rate_snapshot", "custom_deposit_amount", "deposit_amount_due",
  "balance_amount_due", "owner_earnings_total", "sitter_earnings_total",
  "company_service_share_total", "company_discount_absorbed",
  "company_earnings_before_platform", "platform_name", "platform_order_ref",
  "platform_payout_status", "platform_actual_payout", "calculation_version",
  "calculated_at", "created_at",
].join(",");

const ORDER_ITEM_V2_SELECT = [
  "order_item_id", "order_id", "item_type", "item_status", "display_order",
  "service_plan_id", "item_name_snapshot", "duration_minutes_snapshot",
  "standard_unit_price_snapshot", "custom_unit_price", "charged_unit_price",
  "quantity", "line_amount", "service_date", "start_time", "end_time",
  "specified_time_note", "assigned_sitter_id", "provider_type_snapshot",
  "commission_rate_snapshot", "commission_base_amount", "company_share_amount",
  "sitter_earnings_amount", "company_discount_absorbed_amount",
  "home_visit_execution_mode", "allocation_note", "cancelled_at",
  "cancellation_reason", "created_at", "updated_at",
].join(",");

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function metadataText(value: unknown, key: string): string {
  const source = asRecord(value);
  return typeof source[key] === "string" ? source[key].trim() : "";
}

function metadataNumber(value: unknown, key: string): number | null {
  const source = asRecord(value);
  const number = Number(source[key]);
  return Number.isFinite(number) ? number : null;
}

function metadataTexts(value: unknown, key: string): string[] {
  const source = asRecord(value);
  return Array.isArray(source[key])
    ? source[key].filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return [...new Set(values.filter((value): value is number => Number.isInteger(value)))];
}

function activeServiceDates(items: AdminOrderV2Item[]): string[] {
  return items
    .filter((item) => item.itemStatus !== "cancelled" && item.itemType === "service" && item.serviceDate)
    .map((item) => item.serviceDate as string)
    .sort();
}

function resolveCommissionRate(
  sitterId: number,
  serviceDate: string | null | undefined,
  rates: Array<{ sitter_id: number; rate_percent: number; effective_from: string; effective_until: string | null }>,
): number {
  if (!serviceDate) throw new Error("合作保姆服務項目需填寫服務日期，才能鎖定分潤快照");
  const match = rates.find((rate) =>
    rate.sitter_id === sitterId &&
    rate.effective_from <= serviceDate &&
    (!rate.effective_until || rate.effective_until >= serviceDate)
  );
  if (!match) throw new Error(`保姆 ${sitterId} 在 ${serviceDate} 沒有有效的分潤設定`);
  return Number(match.rate_percent) / 100;
}

function orderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `P-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function itemRpcRecord(item: CalculatedOrderItem, itemId: string, petIds: string[]) {
  return {
    order_item_id: itemId,
    item_type: item.itemType,
    item_status: item.itemStatus,
    display_order: item.displayOrder,
    service_plan_id: item.servicePlanId,
    item_name_snapshot: item.itemNameSnapshot,
    duration_minutes_snapshot: item.durationMinutesSnapshot,
    standard_unit_price_snapshot: item.standardUnitPriceSnapshot,
    custom_unit_price: item.customUnitPrice,
    charged_unit_price: item.chargedUnitPrice,
    quantity: item.quantity,
    line_amount: item.lineAmount,
    service_date: item.serviceDate,
    start_time: item.startTime,
    end_time: item.endTime,
    specified_time_note: item.specifiedTimeNote,
    assigned_sitter_id: item.assignedSitterId,
    provider_type_snapshot: item.providerTypeSnapshot,
    commission_rate_snapshot: item.commissionRateSnapshot,
    commission_base_amount: item.commissionBaseAmount,
    company_share_amount: item.companyShareAmount,
    sitter_earnings_amount: item.sitterEarningsAmount,
    company_discount_absorbed_amount: item.companyDiscountAbsorbedAmount,
    home_visit_execution_mode: item.homeVisitExecutionMode,
    allocation_note: item.allocationNote,
    cancelled_at: item.cancelledAt,
    cancellation_reason: item.cancellationReason,
    pet_ids: petIds,
  };
}

function publicCalculation(calculation: OrderCalculationResult, canViewMoney: boolean) {
  if (canViewMoney) return calculation;
  return { calculationVersion: calculation.calculationVersion, warnings: calculation.warnings };
}

function serializeHeader(row: Record<string, unknown>, canViewMoney: boolean) {
  const money = (key: string) => canViewMoney ? Number(row[key] ?? 0) : null;
  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
    familyId: row.family_id,
    petIds: metadataTexts(row.legacy_data, "pet_ids"),
    customerType: metadataText(row.legacy_data, "customer_type") || "returning",
    ownerName: row.owner_name_snapshot,
    petName: row.pet_name_snapshot,
    serviceDate: row.service_date_raw,
    caregiver: row.caregiver,
    orderSource: row.order_source,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    discountType: row.discount_type,
    discountValue: canViewMoney ? Number(row.discount_value ?? 0) : null,
    depositRuleType: row.deposit_rule_type,
    depositRate: canViewMoney ? row.deposit_rate_snapshot : null,
    customDepositAmount: money("custom_deposit_amount"),
    lockedDepositAmount: canViewMoney ? metadataNumber(row.legacy_data, "deposit_locked_amount") : null,
    platformName: row.platform_name,
    platformOrderRef: row.platform_order_ref,
    platformPayoutStatus: row.platform_payout_status,
    platformActualPayout: money("platform_actual_payout"),
    serviceSubtotal: money("service_subtotal"),
    travelFeeTotal: money("travel_fee_total"),
    homeVisitFeeTotal: money("home_visit_fee_total"),
    tipTotal: money("tip_total"),
    discountAmount: money("discount_amount"),
    customerTotal: money("customer_total"),
    depositAmountDue: money("deposit_amount_due"),
    balanceAmountDue: money("balance_amount_due"),
    ownerEarningsTotal: money("owner_earnings_total"),
    sitterEarningsTotal: money("sitter_earnings_total"),
    companyServiceShareTotal: money("company_service_share_total"),
    companyDiscountAbsorbed: money("company_discount_absorbed"),
    companyEarningsBeforePlatform: money("company_earnings_before_platform"),
    calculationVersion: row.calculation_version,
    confirmedAt: row.confirmed_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeItem(row: Record<string, unknown>, canViewMoney: boolean, petIds: string[] = []) {
  const money = (key: string) => canViewMoney ? Number(row[key] ?? 0) : null;
  return {
    orderItemId: row.order_item_id,
    itemType: row.item_type,
    itemStatus: row.item_status,
    displayOrder: row.display_order,
    servicePlanId: row.service_plan_id,
    itemName: row.item_name_snapshot,
    durationMinutes: row.duration_minutes_snapshot,
    standardUnitPrice: money("standard_unit_price_snapshot"),
    customUnitPrice: canViewMoney ? row.custom_unit_price : null,
    chargedUnitPrice: money("charged_unit_price"),
    quantity: canViewMoney ? Number(row.quantity ?? 0) : null,
    lineAmount: money("line_amount"),
    serviceDate: row.service_date,
    startTime: row.start_time,
    endTime: row.end_time,
    specifiedTimeNote: row.specified_time_note,
    assignedSitterId: row.assigned_sitter_id,
    providerType: row.provider_type_snapshot,
    commissionRate: canViewMoney ? row.commission_rate_snapshot : null,
    commissionBaseAmount: money("commission_base_amount"),
    companyShareAmount: money("company_share_amount"),
    sitterEarningsAmount: money("sitter_earnings_amount"),
    companyDiscountAbsorbedAmount: money("company_discount_absorbed_amount"),
    homeVisitExecutionMode: row.home_visit_execution_mode,
    sitterAllocationAmount: money("sitter_earnings_amount"),
    companyAllocationAmount: money("company_share_amount"),
    allocationNote: row.allocation_note,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    petIds,
  };
}

async function prepareOrder(
  raw: unknown,
  actor: OrderV2Actor,
  env: Env,
): Promise<{ payload: AdminOrderV2Payload; calculation: OrderCalculationResult; order: Record<string, unknown>; items: Record<string, unknown>[] }> {
  const payload = parseAdminOrderV2Payload(raw);
  const supabase = createSupabaseAdmin(env);
  const existingResult = payload.orderId
    ? await supabase.from("orders").select("order_id,order_model_version,order_number,order_status,updated_at,created_by,confirmed_at,completed_at").eq("order_id", payload.orderId).maybeSingle()
    : { data: null, error: null };
  if (existingResult.error) throw existingResult.error;
  if (existingResult.data) {
    if (existingResult.data.order_model_version !== 2) throw new Error("舊版訂單不可透過新版 CRUD 編輯");
    assertOrderV2Transition(normalizeOrderV2Status(existingResult.data.order_status), payload.orderStatus);
    if (!payload.expectedUpdatedAt || payload.expectedUpdatedAt !== existingResult.data.updated_at) {
      throw new Error("訂單已被其他操作更新，請重新載入後再儲存");
    }
  }

  const [familyResult, petsResult, homeVisitsResult] = await Promise.all([
    supabase.from("families").select("family_id,owner_name").eq("family_id", payload.familyId).maybeSingle(),
    supabase.from("pets").select("pet_id,family_id,pet_name,is_enabled").in("pet_id", payload.petIds),
    payload.homeVisitIds.length
      ? supabase.from("home_visit_records").select("home_visit_id,family_id").in("home_visit_id", payload.homeVisitIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (petsResult.error) throw petsResult.error;
  if (homeVisitsResult.error) throw homeVisitsResult.error;
  if (!familyResult.data) throw new Error("找不到指定家庭");
  const petById = new Map((petsResult.data ?? []).map((pet) => [pet.pet_id, pet]));
  if (petById.size !== payload.petIds.length || payload.petIds.some((petId) => {
    const pet = petById.get(petId);
    return !pet || pet.family_id !== payload.familyId || !pet.is_enabled;
  })) throw new Error("所有毛孩都必須是指定家庭中已啟用的既有毛孩");
  if ((homeVisitsResult.data ?? []).length !== payload.homeVisitIds.length || (homeVisitsResult.data ?? []).some((visit) => visit.family_id !== payload.familyId)) {
    throw new Error("所有家訪紀錄都必須屬於指定家庭");
  }

  const sitterIds = uniqueNumbers(payload.items.map((item) => item.assignedSitterId));
  const [sittersResult, ratesResult] = await Promise.all([
    sitterIds.length
      ? supabase.from("sitters").select("sitter_id,display_name,status").in("sitter_id", sitterIds)
      : Promise.resolve({ data: [], error: null }),
    sitterIds.length
      ? supabase.from("sitter_commission_rates").select("sitter_id,rate_percent,effective_from,effective_until").in("sitter_id", sitterIds).order("effective_from", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sittersResult.error) throw sittersResult.error;
  if (ratesResult.error) throw ratesResult.error;
  const sitterById = new Map((sittersResult.data ?? []).map((sitter) => [sitter.sitter_id, sitter]));
  if (sitterById.size !== sitterIds.length) throw new Error("部分指派保姆不存在");

  const cancellationTime = new Date().toISOString();
  const hydratedItems = payload.items.map((item) => {
    const assigned = item.assignedSitterId ? sitterById.get(item.assignedSitterId) : null;
    if (assigned && String(assigned.status).trim().toLowerCase() !== "active" && item.itemStatus !== "cancelled") {
      throw new Error(`保姆「${assigned.display_name}」目前不是啟用狀態`);
    }
    const cancelled = payload.orderStatus === "cancelled";
    return {
      ...item,
      itemStatus: cancelled ? "cancelled" as const : item.itemStatus,
      cancelledAt: cancelled ? item.cancelledAt || cancellationTime : item.cancelledAt,
      cancellationReason: cancelled ? item.cancellationReason || payload.cancellationReason : item.cancellationReason,
      commissionRate: item.providerType === "sitter" && item.assignedSitterId
        ? resolveCommissionRate(item.assignedSitterId, item.serviceDate, ratesResult.data ?? [])
        : null,
    };
  });
  if (payload.orderStatus !== "cancelled" && !hydratedItems.some((item) =>
    item.itemStatus !== "cancelled" && (item.itemType === "service" || item.itemType === "home_visit_fee")
  )) throw new Error("未取消訂單至少需要一個有效服務或家訪項目");
  if (["confirmed", "in_service", "completed"].includes(payload.orderStatus) && hydratedItems.some((item) =>
    item.itemStatus === "active" && item.itemType === "service" && !item.assignedSitterId
  )) throw new Error("已確認、服務中或已完成的服務項目必須指派保姆");

  await assertOrderScheduleAvailable(hydratedItems, payload.orderId, env);

  const calculation = calculateOrder({
    items: hydratedItems,
    discount: payload.discount,
    deposit: payload.deposit,
    platform: payload.platform,
  });
  const itemIds = hydratedItems.map((item) => item.orderItemId || crypto.randomUUID());
  const dates = activeServiceDates(hydratedItems);
  const activeSitterIds = uniqueNumbers(hydratedItems.filter((item) => item.itemStatus !== "cancelled").map((item) => item.assignedSitterId));
  const sitterNames = activeSitterIds
    .map((id) => sitterById.get(id)?.display_name)
    .filter(Boolean) as string[];
  const resolvedOrderId = payload.orderId || `V2-${crypto.randomUUID()}`;
  const resolvedOrderNumber = existingResult.data?.order_number || orderNumber();
  const now = new Date().toISOString();
  const order = {
    order_id: resolvedOrderId,
    order_number: resolvedOrderNumber,
    legacy_order_id: resolvedOrderNumber,
    order_model_version: 2,
    order_status: payload.orderStatus,
    payment_status: payload.paymentStatus,
    family_id: payload.familyId,
    owner_name_snapshot: familyResult.data.owner_name,
    pet_name_snapshot: payload.petIds.map((petId) => petById.get(petId)?.pet_name).filter(Boolean).join("、"),
    caregiver: sitterNames.length > 1 ? "多位保姆" : sitterNames[0] || null,
    sitter_id: activeSitterIds.length === 1 ? activeSitterIds[0] : null,
    confirmation_result: "V2",
    established_at: existingResult.data ? undefined : now,
    service_date_raw: dates.length ? (dates[0] === dates.at(-1) ? dates[0] : `${dates[0]}～${dates.at(-1)}`) : null,
    order_source: payload.orderSource,
    notes: payload.notes,
    cancellation_reason: payload.cancellationReason,
    confirmed_at: existingResult.data?.confirmed_at ?? (["confirmed", "in_service", "completed"].includes(payload.orderStatus) ? now : null),
    completed_at: existingResult.data?.completed_at ?? (payload.orderStatus === "completed" ? now : null),
    cancelled_at: payload.orderStatus === "cancelled" ? now : null,
    service_subtotal: calculation.serviceSubtotal,
    travel_fee_total: calculation.travelFeeTotal,
    home_visit_fee_total: calculation.homeVisitFeeTotal,
    tip_total: calculation.tipTotal,
    total_before_discount: calculation.totalBeforeDiscount,
    discount_type: calculation.discountType,
    discount_value: calculation.discountValue,
    discount_amount: calculation.discountAmount,
    customer_total: calculation.customerTotal,
    deposit_rule_type: calculation.depositRuleType,
    deposit_rate_snapshot: calculation.depositRateSnapshot,
    custom_deposit_amount: calculation.customDepositAmount,
    deposit_amount_due: calculation.depositAmountDue,
    balance_amount_due: calculation.balanceAmountDue,
    owner_earnings_total: calculation.ownerEarningsTotal,
    sitter_earnings_total: calculation.sitterEarningsTotal,
    company_service_share_total: calculation.companyServiceShareTotal,
    company_discount_absorbed: calculation.companyDiscountAbsorbed,
    company_earnings_before_platform: calculation.companyEarningsBeforePlatform,
    platform_name: calculation.platformName,
    platform_order_ref: calculation.platformOrderRef,
    platform_payout_status: calculation.platformPayoutStatus,
    platform_actual_payout: calculation.platformActualPayout,
    calculation_version: calculation.calculationVersion,
    calculated_at: now,
    created_by: existingResult.data?.created_by ?? actor.userId,
    updated_by: actor.userId,
    legacy_data: {
      pet_ids: payload.petIds,
      customer_type: payload.customerType,
      family_relation_model: "family_id",
      family_member_management: "deferred",
      notification_recipient_resolution: "deferred",
      deposit_locked_amount: "lockedAmount" in payload.deposit ? payload.deposit.lockedAmount ?? null : null,
    } satisfies Json,
    pet_ids: payload.petIds,
    home_visit_ids: payload.homeVisitIds,
  };
  return {
    payload,
    calculation,
    order,
    items: calculation.items.map((item, index) => itemRpcRecord(item, itemIds[index], hydratedItems[index].petIds)),
  };
}

export async function listOrdersV2(env: Env, canViewMoney: boolean) {
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase.from("orders").select(ORDER_V2_SELECT).eq("order_model_version", 2).order("created_at", { ascending: false }).limit(250);
  if (error) throw error;
  return (data ?? []).map((row) => serializeHeader(row as unknown as Record<string, unknown>, canViewMoney));
}

export async function getOrderV2(raw: unknown, env: Env, canViewMoney: boolean) {
  const source = asRecord(raw);
  const orderId = typeof source.orderId === "string" ? source.orderId.trim() : "";
  if (!orderId) throw new Error("orderId 為必填欄位");
  const supabase = createSupabaseAdmin(env);
  const [orderResult, itemsResult, homeVisitRelationsResult] = await Promise.all([
    supabase.from("orders").select(ORDER_V2_SELECT).eq("order_id", orderId).eq("order_model_version", 2).maybeSingle(),
    supabase.from("order_items").select(ORDER_ITEM_V2_SELECT).eq("order_id", orderId).order("display_order", { ascending: true }),
    supabase.from("order_home_visits").select("home_visit_id").eq("order_id", orderId),
  ]);
  if (orderResult.error) throw orderResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (homeVisitRelationsResult.error) throw homeVisitRelationsResult.error;
  if (!orderResult.data) throw new Error("找不到新版訂單");
  const itemRows = (itemsResult.data ?? []) as unknown as Array<Record<string, unknown> & { order_item_id: string }>;
  const itemIds = itemRows.map((item) => item.order_item_id);
  const petRelationsResult = itemIds.length
    ? await supabase.from("order_item_pets").select("order_item_id,pet_id").in("order_item_id", itemIds)
    : { data: [], error: null };
  if (petRelationsResult.error) throw petRelationsResult.error;
  const petIdsByItem = new Map<string, string[]>();
  for (const relation of petRelationsResult.data ?? []) {
    const values = petIdsByItem.get(relation.order_item_id) ?? [];
    values.push(relation.pet_id);
    petIdsByItem.set(relation.order_item_id, values);
  }
  return {
    order: serializeHeader(orderResult.data as unknown as Record<string, unknown>, canViewMoney),
    items: itemRows.map((row) => serializeItem(row, canViewMoney, petIdsByItem.get(row.order_item_id) ?? [])),
    homeVisitIds: (homeVisitRelationsResult.data ?? []).map((relation) => relation.home_visit_id),
  };
}

export async function previewOrderV2(raw: unknown, actor: OrderV2Actor, env: Env) {
  if (!actor.canViewMoney) throw new Error("沒有檢視訂單金額的權限");
  const prepared = await prepareOrder(raw, actor, env);
  return { calculation: publicCalculation(prepared.calculation, actor.canViewMoney) };
}

export async function saveOrderV2(raw: unknown, actor: OrderV2Actor, env: Env) {
  const source = asRecord(raw);
  const updating = typeof source.orderId === "string" && Boolean(source.orderId.trim());
  if (updating ? !actor.canEditOrders : !actor.canCreateOrders) {
    throw new Error(updating ? "沒有編輯訂單的權限" : "沒有新增訂單的權限");
  }
  if (!actor.canViewMoney) throw new Error("沒有檢視訂單金額的權限");
  const prepared = await prepareOrder(raw, actor, env);
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase.rpc("save_order_v2_with_relations", {
    p_order: prepared.order as Json,
    p_items: prepared.items as Json,
    p_expected_updated_at: prepared.payload.expectedUpdatedAt,
  });
  if (error) throw error;
  return {
    orderId: data,
    calculation: publicCalculation(prepared.calculation, actor.canViewMoney),
  };
}
