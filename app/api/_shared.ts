import { requireUser } from "@/lib/auth/require-user";
import { jsonError } from "@/lib/api/errors";
import { createRequestClient } from "@/utils/supabase/request";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function withUser(
  request: Request,
  handler: (userId: string, db: SupabaseClient) => Promise<Response>,
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const user = await requireUser(request);
    const db = await createRequestClient(request);
    return await handler(user.id, db);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new (await import("@/lib/api/errors")).AppError(
      "BAD_REQUEST",
      "Request body must be valid JSON.",
      400,
    );
  }
}
