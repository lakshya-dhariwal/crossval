import { withUser, readJson } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { revertDocumentToDraft } from "@/lib/services/documents";
import { jsonError } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    return await withUser(request, async (userId, db) => {
      const body = await readJson<{ version?: number }>(request);
      return ok(await revertDocumentToDraft(userId, id, body.version, db));
    });
  } catch (error) {
    return jsonError(error);
  }
}
