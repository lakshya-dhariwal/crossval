import { withUser } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { duplicateDocument } from "@/lib/services/documents";
type Params = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Params) { const { id } = await params; return withUser(request, async (userId, db) => ok(await duplicateDocument(userId, id, db), 201)); }
