import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function createAdminClient() {
  const { url, secret } = serverEnv();
  return createSupabaseClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}
