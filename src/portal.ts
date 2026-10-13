import { getVerifiedLineUserId } from "./line";
import { createSupabaseAdmin } from "./supabase";

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

export async function handlePortal(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);
  if (Number(request.headers.get("Content-Length") ?? 0) > 16 * 1024) {
    return json({ success: false, message: "Request body too large" }, 413);
  }
  const value: unknown = await request.json().catch(() => null);
  const accessToken = typeof value === "object" && value !== null && "accessToken" in value &&
      typeof value.accessToken === "string"
    ? value.accessToken.trim()
    : "";
  if (!accessToken) return json({ success: false, message: "請先用 LINE 登入" }, 400);

  const lineUserId = await getVerifiedLineUserId(accessToken, env.LINE_LIFF_CHANNEL_ID);
  if (!lineUserId) return json({ success: false, message: "LINE 登入驗證失敗" }, 403);

  const supabase = createSupabaseAdmin(env);
  const [adminResult, sitterResult, familyResult] = await Promise.all([
    supabase
      .from("app_users")
      .select("display_name,role,status")
      .eq("line_user_id", lineUserId)
      .maybeSingle(),
    supabase
      .from("sitter_access_profiles")
      .select("sitter_id,binding_status")
      .eq("line_user_id", lineUserId)
      .maybeSingle(),
    supabase
      .from("line_bindings")
      .select("family_id,binding_status,is_enabled")
      .eq("line_user_id", lineUserId)
      .eq("binding_status", "bound")
      .eq("is_enabled", true)
      .maybeSingle(),
  ]);
  if (adminResult.error) throw adminResult.error;
  if (sitterResult.error) throw sitterResult.error;
  if (familyResult.error) throw familyResult.error;

  const admin = adminResult.data;
  if (
    admin &&
    ["OWNER", "ADMIN"].includes(admin.role.toUpperCase()) &&
    ["active", "啟用"].includes(admin.status.trim().toLowerCase())
  ) {
    return json({ success: true, role: admin.role.toUpperCase(), displayName: admin.display_name, redirectTo: "/admin/" });
  }
  if (sitterResult.data?.binding_status === "bound") {
    return json({ success: true, role: "SITTER", redirectTo: "/sitter-preview/" });
  }
  if (familyResult.data) {
    return json({ success: true, role: "CUSTOMER", redirectTo: "/history.html" });
  }
  return json({ success: true, role: "GUEST", redirectTo: "/client-preview/#inquiry", message: "尚未綁定會員資料，可先填寫服務需求" });
}
