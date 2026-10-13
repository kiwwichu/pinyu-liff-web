import { createSupabaseAdmin } from "./supabase";

const JSON_HEADERS = {
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Content-Type": "application/json; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
} as const;

const SITE_DESIGN_SETTING_KEY = "site_design_v1";

export async function handleSiteSettings(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...JSON_HEADERS, Allow: "GET" },
    });
  }
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("public_site_settings")
    .select("setting_value")
    .eq("setting_key", SITE_DESIGN_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  return new Response(JSON.stringify({ success: true, siteDesign: data?.setting_value ?? null }), {
    headers: JSON_HEADERS,
  });
}
