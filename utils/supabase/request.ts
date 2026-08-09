import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { createClient as createCookieClient } from "@/utils/supabase/server";

export async function createRequestClient(request: Request): Promise<SupabaseClient> {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const { url, key } = publicEnv();
    return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: authorization } } });
  }
  return createCookieClient();
}
