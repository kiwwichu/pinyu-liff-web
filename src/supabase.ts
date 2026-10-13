import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createSupabaseAdmin(env: Env) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function canReachSupabase(env: Env): Promise<boolean> {
  const { error } = await createSupabaseAdmin(env)
    .from("app_settings")
    .select("setting_key", { count: "exact", head: true });

  return error === null;
}
