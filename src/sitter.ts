import { createSupabaseAdmin } from "./supabase";
import { getVerifiedLineProfile } from "./line";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

async function sitterSession(lineUserId: string, lineDisplayName: string, env: Env): Promise<Response> {
  const supabase = createSupabaseAdmin(env);
  const { data: profile, error: profileError } = await supabase
    .from("sitter_access_profiles")
    .select("sitter_id,binding_status,can_view_assigned_family_basics,can_view_assigned_address,can_view_assigned_phone,can_view_contract_summary,can_view_reviews")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.binding_status !== "bound") return json({ success: false, message: "這個 LINE 帳號尚未綁定可用的保姆帳號" }, 403);
  if (lineDisplayName) {
    const { error: nameError } = await supabase
      .from("sitter_access_profiles")
      .update({ line_display_name: lineDisplayName })
      .eq("sitter_id", profile.sitter_id)
      .eq("line_user_id", lineUserId);
    if (nameError) throw nameError;
  }

  const { data: sitter, error: sitterError } = await supabase
    .from("sitters")
    .select("sitter_id,display_name,status")
    .eq("sitter_id", profile.sitter_id)
    .maybeSingle();
  if (sitterError) throw sitterError;
  if (!sitter || sitter.status !== "active") return json({ success: false, message: "保姆帳號目前未啟用" }, 403);

  const { data: orderRows, error: orderError } = await supabase
    .from("orders")
    .select("order_id,legacy_order_id,order_status,service_date_raw,booking_segment,specified_time,family_id,owner_name_snapshot,pet_name_snapshot,service_type,plan_name,notes")
    .eq("caregiver", sitter.display_name)
    .is("order_model_version", null)
    .order("established_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (orderError) throw orderError;

  const { data: itemRows, error: itemError } = await supabase
    .from("order_items")
    .select("order_item_id,order_id,item_status,item_name_snapshot,service_date,start_time,end_time,specified_time_note")
    .eq("assigned_sitter_id", sitter.sitter_id)
    .eq("item_type", "service")
    .order("service_date", { ascending: false })
    .limit(200);
  if (itemError) throw itemError;
  const v2OrderIds = [...new Set((itemRows ?? []).map((item) => item.order_id))];
  const { data: v2Orders, error: v2OrderError } = v2OrderIds.length
    ? await supabase.from("orders").select("order_id,order_number,order_status,family_id,owner_name_snapshot,notes").in("order_id", v2OrderIds).eq("order_model_version", 2)
    : { data: [], error: null };
  if (v2OrderError) throw v2OrderError;
  const itemIds = (itemRows ?? []).map((item) => item.order_item_id);
  const { data: itemPetRows, error: itemPetError } = itemIds.length
    ? await supabase.from("order_item_pets").select("order_item_id,pet_id,pets(pet_name)").in("order_item_id", itemIds)
    : { data: [], error: null };
  if (itemPetError) throw itemPetError;

  const rows = orderRows ?? [];
  const v2OrderById = new Map((v2Orders ?? []).map((order) => [order.order_id, order]));
  const familyIds = [...new Set([
    ...rows.map(row => row.family_id),
    ...(v2Orders ?? []).map(row => row.family_id),
  ].filter((value): value is string => Boolean(value)))];
  const privateByFamily = new Map<string, { address: string | null; phone: string | null }>();
  if (familyIds.length && (profile.can_view_assigned_address || profile.can_view_assigned_phone)) {
    const { data: contacts, error: contactsError } = await supabase
      .from("family_private_contacts")
      .select("family_id,address,phone")
      .in("family_id", familyIds);
    if (contactsError) throw contactsError;
    for (const contact of contacts ?? []) privateByFamily.set(contact.family_id, contact);
  }

  const assignments = rows.map(row => {
    const contact = row.family_id ? privateByFamily.get(row.family_id) : undefined;
    return {
      demandId: row.legacy_order_id || row.order_id,
      orderItemId: null as string | null,
      status: row.order_status,
      serviceDate: row.service_date_raw,
      bookingSegment: row.booking_segment,
      specifiedTime: row.specified_time,
      serviceType: row.service_type,
      planName: row.plan_name,
      familyId: profile.can_view_assigned_family_basics ? row.family_id : null,
      owner: profile.can_view_assigned_family_basics ? row.owner_name_snapshot : null,
      pet: profile.can_view_assigned_family_basics ? row.pet_name_snapshot : null,
      address: profile.can_view_assigned_address ? contact?.address ?? null : null,
      phone: profile.can_view_assigned_phone ? contact?.phone ?? null : null,
      notes: row.notes,
    };
  });
  for (const item of itemRows ?? []) {
    const order = v2OrderById.get(item.order_id);
    if (!order) continue;
    const contact = order.family_id ? privateByFamily.get(order.family_id) : undefined;
    const petNames = (itemPetRows ?? []).filter((relation) => relation.order_item_id === item.order_item_id).map((relation) => {
      const pet = Array.isArray(relation.pets) ? relation.pets[0] : relation.pets;
      return pet?.pet_name;
    }).filter(Boolean);
    assignments.push({
      demandId: order.order_number || order.order_id,
      orderItemId: item.order_item_id,
      status: item.item_status === "cancelled" ? "cancelled" : order.order_status,
      serviceDate: item.service_date,
      bookingSegment: null,
      specifiedTime: item.start_time && item.end_time ? `${String(item.start_time).slice(0, 5)}–${String(item.end_time).slice(0, 5)}` : item.specified_time_note,
      serviceType: item.item_name_snapshot,
      planName: null,
      familyId: profile.can_view_assigned_family_basics ? order.family_id : null,
      owner: profile.can_view_assigned_family_basics ? order.owner_name_snapshot : null,
      pet: profile.can_view_assigned_family_basics ? petNames.join("、") : null,
      address: profile.can_view_assigned_address ? contact?.address ?? null : null,
      phone: profile.can_view_assigned_phone ? contact?.phone ?? null : null,
      notes: order.notes,
    });
  }

  return json({
    success: true,
    sitter: { sitterId: sitter.sitter_id, displayName: sitter.display_name },
    permissions: {
      canViewAssignedFamilyBasics: profile.can_view_assigned_family_basics,
      canViewAssignedAddress: profile.can_view_assigned_address,
      canViewAssignedPhone: profile.can_view_assigned_phone,
      canViewContractSummary: profile.can_view_contract_summary,
      canViewReviews: profile.can_view_reviews,
    },
    assignments,
  });
}

export async function handleSitter(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 16 * 1024) return json({ success: false, message: "Request body too large" }, 413);

  const value: unknown = await request.json().catch(() => null);
  if (!isRecord(value)) return json({ success: false, message: "請求格式不正確" }, 400);
  const operation = value.operation;
  const accessToken = typeof value.accessToken === "string" ? value.accessToken.trim() : "";
  if (!accessToken || (operation !== "bind" && operation !== "session")) return json({ success: false, message: "請求內容不完整" }, 400);

  const lineProfile = await getVerifiedLineProfile(accessToken, env.LINE_LIFF_CHANNEL_ID);
  if (!lineProfile) return json({ success: false, message: "LINE 登入驗證失敗" }, 403);
  const lineUserId = lineProfile.userId;

  try {
    if (operation === "session") return await sitterSession(lineUserId, lineProfile.displayName, env);
    const inviteToken = typeof value.inviteToken === "string" ? value.inviteToken.trim() : "";
    if (!/^[A-Za-z0-9_-]{43}$/u.test(inviteToken)) return json({ success: false, message: "邀請連結格式不正確" }, 400);
    const supabase = createSupabaseAdmin(env);
    const { data, error } = await supabase.rpc("bind_sitter_invite", {
      p_token_hash: await tokenHash(inviteToken),
      p_line_user_id: lineUserId,
    });
    if (error) {
      const expired = error.message.includes("invalid_or_expired_invite");
      const alreadyBound = error.message.includes("line_account_already_bound");
      return json({ success: false, message: expired ? "邀請連結已失效，請向 Pinyu 取得新連結" : alreadyBound ? "這個 LINE 已綁定其他保姆帳號" : "綁定失敗" }, 400);
    }
    const bound = data?.[0];
    if (bound?.bound_sitter_id) {
      const { error: profileError } = await supabase
        .from("sitter_access_profiles")
        .update({ line_display_name: lineProfile.displayName || null })
        .eq("sitter_id", bound.bound_sitter_id)
        .eq("line_user_id", lineUserId);
      if (profileError) throw profileError;
    }
    return json({ success: true, sitter: { sitterId: bound?.bound_sitter_id, displayName: bound?.bound_display_name } });
  } catch (error) {
    console.error(JSON.stringify({ message: "Sitter operation failed", operation, error: error instanceof Error ? error.message : String(error) }));
    return json({ success: false, message: "系統暫時無法完成操作" }, 500);
  }
}
