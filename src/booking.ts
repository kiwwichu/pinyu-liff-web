import type { Json } from "./database.types";
import { createSupabaseAdmin } from "./supabase";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textField(source: Record<string, unknown>, key: string, maxLength: number, required = false): string {
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

function integerField(source: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = Number(source[key]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} 數值不正確`);
  return value;
}

function numberField(source: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = Number(source[key]);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key} 數值不正確`);
  return value;
}

function dateField(source: Record<string, unknown>, key: string): string {
  const value = textField(source, key, 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${key} 日期格式不正確`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${key} 日期不正確`);
  }
  return value;
}

function parseServicePeriods(value: unknown): Json[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    throw new Error("請至少選擇一個服務內容，最多 10 個");
  }
  return value.map((entry) => {
    if (!isRecord(entry)) throw new Error("服務內容格式不正確");
    const serviceType = textField(entry, "serviceType", 50, true);
    const duration = textField(entry, "duration", 20, true);
    const quantity = integerField(entry, "quantity", 1, 100);
    return { serviceType, duration, quantity } satisfies Json;
  });
}

async function ipHash(request: Request, env: Env): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${env.SUPABASE_SECRET_KEY.slice(0, 24)}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function handleBooking(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 30_000) return json({ success: false, message: "送出內容過大" }, 413);

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("需求格式不正確");
    if (textField(body, "website", 200)) {
      return json({ success: true, message: "需求已送出" }, 201);
    }

    const customerType = textField(body, "customerType", 20, true);
    if (customerType !== "new") throw new Error("舊客請先使用 LINE 登入");
    const catCount = integerField(body, "catCount", 0, 20);
    const dogCount = integerField(body, "dogCount", 0, 20);
    const otherPets = textField(body, "otherPets", 60);
    if (catCount + dogCount === 0 && !otherPets) throw new Error("請至少填寫一隻毛孩");
    const serviceStartDate = dateField(body, "startDate");
    const serviceEndDate = dateField(body, "endDate");
    if (serviceEndDate < serviceStartDate) throw new Error("結束日期不可早於開始日期");
    const servicePeriods = parseServicePeriods(body.servicePeriods);
    const nearMrt = body.nearMrt === true || body.nearMrt === "yes";
    if (![true, false, "yes", "no"].includes(body.nearMrt as boolean | string)) {
      throw new Error("請選擇是否在捷運站步行 10 分鐘內");
    }

    const hash = await ipHash(request, env);
    const supabase = createSupabaseAdmin(env);
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("booking_requests")
      .select("request_id", { count: "exact", head: true })
      .eq("source_ip_hash", hash)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) {
      return json({ success: false, message: "短時間送出次數過多，請稍後再試" }, 429);
    }

    const requestNumber = `REQ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { error } = await supabase.from("booking_requests").insert({
      request_number: requestNumber,
      customer_type: customerType,
      cat_count: catCount,
      dog_count: dogCount,
      other_pets: otherPets || null,
      care_needs: textField(body, "careNeeds", 800, true),
      service_start_date: serviceStartDate,
      service_end_date: serviceEndDate,
      service_periods: servicePeriods,
      district: textField(body, "district", 50, true),
      distance_km: numberField(body, "distanceKm", 0, 100),
      nearest_mrt: textField(body, "nearestMrt", 60, true),
      near_mrt: nearMrt,
      location_note: textField(body, "locationNote", 400) || null,
      source_ip_hash: hash,
    });
    if (error) throw error;
    return json({ success: true, requestNumber, message: "需求已送進 Pinyu 後台" }, 201);
  } catch (error) {
    console.error(JSON.stringify({
      message: "Booking request failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    const message = error instanceof Error ? error.message : "需求送出失敗";
    return json({ success: false, message }, 400);
  }
}
