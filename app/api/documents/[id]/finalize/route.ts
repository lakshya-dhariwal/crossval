import { withUser, readJson } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { finalizeDocument } from "@/lib/services/documents";
import { AppError, jsonError } from "@/lib/api/errors";
type Params = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Params) { const { id } = await params; try { return await withUser(request, async (userId, db) => { const body = await readJson<{ version?: number }>(request); if (typeof body.version !== "number") throw new AppError("VALIDATION_ERROR", "Version is required.", 422); return ok(await finalizeDocument(userId, id, body.version, db)); }); } catch (error) { return jsonError(error); } }
