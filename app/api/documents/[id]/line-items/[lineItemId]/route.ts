import { withUser, readJson } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { deleteLine, updateLine } from "@/lib/services/documents";
import { AppError, jsonError } from "@/lib/api/errors";
type Params = { params: Promise<{ id: string; lineItemId: string }> };
export async function PATCH(request: Request, { params }: Params) { const { id, lineItemId } = await params; try { return await withUser(request, async (userId, db) => { const body = await readJson<Record<string, unknown> & { version?: number }>(request); if (typeof body.version !== "number") throw new AppError("VALIDATION_ERROR", "Version is required.", 422); const { version, ...raw } = body; return ok(await updateLine(userId, id, lineItemId, raw as never, version, db)); }); } catch (error) { return jsonError(error); } }
export async function DELETE(request: Request, { params }: Params) { const { id, lineItemId } = await params; try { return await withUser(request, async (userId, db) => { const body = await readJson<{ version?: number }>(request); if (typeof body.version !== "number") throw new AppError("VALIDATION_ERROR", "Version is required.", 422); await deleteLine(userId, id, lineItemId, body.version, db); return new Response(null, { status: 204 }); }); } catch (error) { return jsonError(error); } }
