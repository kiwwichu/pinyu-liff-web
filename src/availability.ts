import { CALENDAR_SUMMARY_PERIODS, calculateAvailability, minutesToTime, timeToMinutes } from "../admin/availability-core.js";
import { createSupabaseAdmin } from "./supabase";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function monthBounds(year: string | null, month: string | null): { monthKey: string; firstDate: string; lastDate: string } | null {
  if (!year || !month || !/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) return null;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  if (yearNumber < 2020 || yearNumber > 2100 || monthNumber < 1 || monthNumber > 12) return null;
  const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  return { monthKey, firstDate: `${monthKey}-01`, lastDate: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

function datesInRange(firstDate: string, lastDate: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${firstDate}T00:00:00Z`);
  const end = new Date(`${lastDate}T00:00:00Z`);
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function orderDates(value: unknown): string[] {
  const matches = [...String(value ?? "").matchAll(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/g)]
    .map(match => `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`);
  if (matches.length < 2) return [...new Set(matches)];
  const first = matches[0];
  const last = matches.at(-1) ?? first;
  const duration = (new Date(`${last}T00:00:00Z`).getTime() - new Date(`${first}T00:00:00Z`).getTime()) / 86_400_000;
  if (!Number.isInteger(duration) || duration < 0 || duration > 366) return [...new Set(matches)];
  return datesInRange(first, last);
}

export async function handleAvailability(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ success: false, message: "Method not allowed" }, 405);
  const incoming = new URL(request.url);
  const bounds = monthBounds(incoming.searchParams.get("year"), incoming.searchParams.get("month"));
  if (!bounds) return json({ success: false, message: "Invalid year/month" }, 400);
  const requestedSitterId = Number(incoming.searchParams.get("sitterId") || 0);
  const supabase = createSupabaseAdmin(env);

  const sitterQuery = supabase.from("sitters").select("sitter_id,display_name").eq("status", "active").order("sitter_id", { ascending: true });
  const { data: sitters, error: sitterError } = Number.isInteger(requestedSitterId) && requestedSitterId > 0
    ? await sitterQuery.eq("sitter_id", requestedSitterId)
    : await sitterQuery.limit(1);
  if (sitterError) throw sitterError;
  const sitter = sitters?.[0];
  if (!sitter) return json({ success: false, message: "Sitter not found" }, 404);

  const [settingsResult, slotsResult, blocksResult, exceptionsResult, ordersResult, orderItemsResult] = await Promise.all([
    supabase.from("sitter_schedule_settings")
      .select("monthly_order_limit,buffer_minutes")
      .eq("sitter_id", sitter.sitter_id)
      .maybeSingle(),
    supabase.from("sitter_availability")
      .select("availability_id,available_date,starts_at,ends_at,availability_status")
      .eq("sitter_id", sitter.sitter_id)
      .gte("available_date", bounds.firstDate)
      .lte("available_date", bounds.lastDate),
    supabase.from("sitter_recurring_blocks")
      .select("recurring_block_id,weekday,starts_at,ends_at,effective_from,effective_until,is_enabled")
      .eq("sitter_id", sitter.sitter_id)
      .eq("is_enabled", true)
      .lte("effective_from", bounds.lastDate)
      .or(`effective_until.is.null,effective_until.gte.${bounds.firstDate}`),
    supabase.from("sitter_recurring_block_exceptions")
      .select("recurring_block_id,exception_date")
      .gte("exception_date", bounds.firstDate)
      .lte("exception_date", bounds.lastDate),
    supabase.from("orders")
      .select("order_id,legacy_order_id,order_status,service_date_raw,specified_time,hours")
      .eq("sitter_id", sitter.sitter_id)
      .is("order_model_version", null)
      .limit(1000),
    supabase.from("order_items")
      .select("order_item_id,order_id,item_status,service_date,start_time,end_time,orders!inner(order_status,order_model_version)")
      .eq("assigned_sitter_id", sitter.sitter_id)
      .eq("item_type", "service")
      .eq("item_status", "active")
      .gte("service_date", bounds.firstDate)
      .lte("service_date", bounds.lastDate)
      .eq("orders.order_model_version", 2)
      .limit(1000),
  ]);
  for (const result of [settingsResult, slotsResult, blocksResult, exceptionsResult, ordersResult, orderItemsResult]) {
    if (result.error) throw result.error;
  }

  const setting = settingsResult.data;
  const bufferMinutes = Number(setting?.buffer_minutes || 0);
  const activeOrders = (ordersResult.data ?? []).filter(order => !String(order.order_status || "").includes("取消"));
  const demandIds = new Set(activeOrders.flatMap(order =>
    orderDates(order.service_date_raw).some(date => date.startsWith(bounds.monthKey))
      ? [String(order.legacy_order_id || order.order_id)]
      : []
  ));
  for (const item of orderItemsResult.data ?? []) demandIds.add(String(item.order_id));
  const monthDates = datesInRange(bounds.firstDate, bounds.lastDate);
  const days = Object.fromEntries(monthDates.map(date => {
    const orderIntervals = activeOrders.flatMap(order => {
      if (!orderDates(order.service_date_raw).includes(date)) return [];
      const match = String(order.specified_time || "").match(/(\d{1,2}:\d{2})/);
      const start = match ? timeToMinutes(match[1]) : Number.NaN;
      const duration = Math.round(Number(order.hours || 0) * 60);
      if (!Number.isFinite(start) || duration <= 0) return [];
      return [{
        order_id: order.order_id,
        starts_at: minutesToTime(Math.max(0, start - bufferMinutes)),
        ends_at: minutesToTime(Math.min(24 * 60, start + duration + bufferMinutes)),
        status: "unavailable",
        source: "order",
      }];
    });
    orderIntervals.push(...(orderItemsResult.data ?? []).flatMap(item => {
      if (item.service_date !== date || !item.start_time || !item.end_time) return [];
      return [{
        order_id: item.order_id,
        starts_at: minutesToTime(Math.max(0, timeToMinutes(item.start_time) - bufferMinutes)),
        ends_at: minutesToTime(Math.min(24 * 60, timeToMinutes(item.end_time) + bufferMinutes)),
        status: "unavailable",
        source: "order_item",
      }];
    }));
    const result = calculateAvailability({
      date,
      singleDay: (slotsResult.data ?? []).filter(slot => slot.available_date === date),
      recurringBlocks: blocksResult.data ?? [],
      recurringExceptions: exceptionsResult.data ?? [],
      orders: orderIntervals,
      monthlyOrderLimit: setting?.monthly_order_limit ?? null,
      monthlyOrderCount: demandIds.size,
      summaryPeriods: CALENDAR_SUMMARY_PERIODS,
    });
    return [date, {
      status: result.status,
      periods: result.periods,
      segments: result.segments,
      defaultOpen: result.defaultOpen,
    }];
  }));

  return json({
    success: true,
    sitterId: sitter.sitter_id,
    month: bounds.monthKey,
    monthlyOrderCount: demandIds.size,
    monthlyOrderLimit: setting?.monthly_order_limit ?? null,
    days,
  });
}
