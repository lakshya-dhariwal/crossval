import { withUser, readJson } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { createDocument, listDocuments } from "@/lib/services/documents";
import { AppError, jsonError } from "@/lib/api/errors";
import { createDocumentSchema } from "@/lib/domain/schemas";

export async function GET(request: Request) {
  return withUser(request, async (userId, db) => { const url = new URL(request.url); const status = url.searchParams.get("status") ?? "all"; if (!["all", "draft", "finalized"].includes(status)) throw new AppError("VALIDATION_ERROR", "Invalid status filter.", 422); return ok(await listDocuments(userId, url.searchParams.get("search") ?? "", status as "all" | "draft" | "finalized", db)); });
}
export async function POST(request: Request) {
  try { return await withUser(request, async (userId, db) => { const body = await readJson<unknown>(request); const parsed = createDocumentSchema.safeParse(body); if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Please correct the document fields.", 422); return ok(await createDocument(userId, parsed.data, db), 201); }); } catch (error) { return jsonError(error); }
}
