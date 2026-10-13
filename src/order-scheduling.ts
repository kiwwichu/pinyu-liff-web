import { calculateAvailability, intervalHasUnavailableSegment, intervalsOverlap, timeToMinutes } from "../admin/availability-core.js";
import type { AdminOrderV2Item } from "./order-v2-admin";
import { createSupabaseAdmin } from "./supabase";

type ScheduleItem = Pick<AdminOrderV2Item,
  "orderItemId" | "itemType" | "itemStatus" | "serviceDate" | "startTime" | "endTime" | "assignedSitterId"
>;

export function requestedIntervalsOverlap(left: ScheduleItem, right: ScheduleItem): boolean {
  if (!left.startTime || !left.endTime || !right.startTime || !right.endTime) return false;
  return intervalsOverlap(left.startTime, left.endTime, right.startTime, right.endTime);
}

function minutesToTime(value: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, value));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function activeScheduledItems(items: AdminOrderV2Item[]): AdminOrderV2Item[] {
  return items.filter((item) =>
    item.itemType === "service" && item.itemStatus === "active" && item.assignedSitterId && item.serviceDate
  );
}

function isClosedLegacyOrder(status: unknown): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return ["completed", "cancelled", "canceled", "已完成", "已取消", "完成", "取消"].includes(normalized);
}

export async function assertOrderScheduleAvailable(
  items: AdminOrderV2Item[],
  currentOrderId: string | null,
  env: Env,
): Promise<void> {
  const candidates = activeScheduledItems(items);
  const exactCandidates = candidates.filter((item) => item.startTime && item.endTime);
  for (let leftIndex = 0; leftIndex < exactCandidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < exactCandidates.length; rightIndex += 1) {
      const left = exactCandidates[leftIndex];
      const right = exactCandidates[rightIndex];
      if (left.assignedSitterId === right.assignedSitterId && left.serviceDate === right.serviceDate && requestedIntervalsOverlap(left, right)) {
        throw new Error(`同一保姆在 ${left.serviceDate} 的訂單服務時段互相重疊`);
      }
    }
  }

  const supabase = createSupabaseAdmin(env);
  const groups = new Map<string, { sitterId: number; date: string }>();
  for (const item of candidates) groups.set(`${item.assignedSitterId}:${item.serviceDate}`, {
    sitterId: item.assignedSitterId as number,
    date: item.serviceDate as string,
  });

  for (const { sitterId, date } of groups.values()) {
    const monthStart = `${date.slice(0, 7)}-01`;
    const monthEndDate = new Date(`${monthStart}T00:00:00Z`);
    monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
    monthEndDate.setUTCDate(0);
    const monthEnd = monthEndDate.toISOString().slice(0, 10);
    const [settingsResult, slotsResult, blocksResult, exceptionsResult, occupiedResult, legacyResult] = await Promise.all([
      supabase.from("sitter_schedule_settings").select("monthly_order_limit,buffer_minutes").eq("sitter_id", sitterId).maybeSingle(),
      supabase.from("sitter_availability").select("availability_id,available_date,starts_at,ends_at,availability_status").eq("sitter_id", sitterId).eq("available_date", date),
      supabase.from("sitter_recurring_blocks").select("recurring_block_id,weekday,starts_at,ends_at,effective_from,effective_until,is_enabled").eq("sitter_id", sitterId).eq("is_enabled", true).lte("effective_from", date).or(`effective_until.is.null,effective_until.gte.${date}`),
      supabase.from("sitter_recurring_block_exceptions").select("recurring_block_id,exception_date").eq("exception_date", date),
      supabase.from("order_items").select("order_item_id,order_id,service_date,start_time,end_time,item_status,item_type").eq("assigned_sitter_id", sitterId).eq("item_status", "active").eq("item_type", "service").gte("service_date", monthStart).lte("service_date", monthEnd).limit(1000),
      supabase.from("orders").select("order_id,order_model_version,order_status,service_date_raw,specified_time,hours").eq("sitter_id", sitterId).is("order_model_version", null).limit(1000),
    ]);
    for (const result of [settingsResult, slotsResult, blocksResult, exceptionsResult, occupiedResult, legacyResult]) {
      if (result.error) throw result.error;
    }

    const setting = settingsResult.data;
    const buffer = Number(setting?.buffer_minutes || 0);
    const occupied = (occupiedResult.data ?? []).filter((item) => item.order_id !== currentOrderId);
    const otherDemandIds = new Set(occupied.map((item) => item.order_id));
    for (const order of legacyResult.data ?? []) {
      if (!isClosedLegacyOrder(order.order_status) && String(order.service_date_raw || "").includes(date.slice(0, 7))) {
        otherDemandIds.add(order.order_id);
      }
    }
    if (setting?.monthly_order_limit && otherDemandIds.size >= Number(setting.monthly_order_limit)) {
      throw new Error(`保姆 ${sitterId} 在 ${date.slice(0, 7)} 已達每月接單上限`);
    }

    const occupiedToday = occupied.filter((item) => item.service_date === date && item.start_time && item.end_time).map((item) => ({
      order_id: item.order_id,
      starts_at: minutesToTime(timeToMinutes(item.start_time) - buffer),
      ends_at: minutesToTime(timeToMinutes(item.end_time) + buffer),
      status: "unavailable",
      source: "order",
    }));
    const result = calculateAvailability({
      date,
      singleDay: slotsResult.data ?? [],
      recurringBlocks: blocksResult.data ?? [],
      recurringExceptions: exceptionsResult.data ?? [],
      orders: occupiedToday,
    });
    for (const item of candidates.filter((candidate) => candidate.assignedSitterId === sitterId && candidate.serviceDate === date)) {
      if (item.startTime && item.endTime && intervalHasUnavailableSegment(result.segments, item.startTime, item.endTime)) {
        throw new Error(`保姆 ${sitterId} 在 ${date} ${item.startTime}–${item.endTime} 不可承接或已有衝突`);
      }
    }
  }
}
