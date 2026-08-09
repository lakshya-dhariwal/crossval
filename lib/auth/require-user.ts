import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

export async function getUser(request?: Request) {
  const authorization = request?.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const { url, key } = publicEnv();
    const supabase = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  }
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function requireUser(request?: Request) {
  const user = await getUser(request);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requirePageUser() {
  const user = await getUser();
  if (!user) redirect("/auth");
  return user;
}
