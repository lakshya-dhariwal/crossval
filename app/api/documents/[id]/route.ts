import { withUser, readJson } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { deleteDocument, getOwnedDocument, updateDocument } from "@/lib/services/documents";
import { AppError, jsonError } from "@/lib/api/errors";
import { patchMetadataSchema } from "@/lib/domain/schemas";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) { const { id } = await params; return withUser(request, async (userId, db) => ok(await getOwnedDocument(userId, id, db))); }
export async function PATCH(request: Request, { params }: Params) { const { id } = await params; try { return await withUser(request, async (userId, db) => { const body = await readJson<unknown>(request); const parsed = patchMetadataSchema.safeParse(body); if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Please correct the document fields.", 422); return ok(await updateDocument(userId, id, parsed.data, db)); }); } catch (error) { return jsonError(error); } }
export async function DELETE(request: Request, { params }: Params) { const { id } = await params; return withUser(request, async (userId, db) => { await deleteDocument(userId, id, db); return new Response(null, { status: 204 }); }); }
