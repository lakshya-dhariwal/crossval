import { withUser, readJson } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { addLine, getOwnedDocument } from "@/lib/services/documents";
import { AppError, jsonError } from "@/lib/api/errors";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withUser(request, async (userId, db) =>
    ok((await getOwnedDocument(userId, id, db)).lineItems),
  );
}
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    return await withUser(request, async (userId, db) => {
      const body = await readJson<Record<string, unknown>>(request);
      const { afterLineItemId, ...raw } = body;
      if (typeof raw.description !== "string")
        throw new AppError(
          "VALIDATION_ERROR",
          "Line input is incomplete.",
          422,
        );
      return ok(
        await addLine(
          userId,
          id,
          raw as never,
          typeof afterLineItemId === "string" ? afterLineItemId : undefined,
          db,
        ),
        201,
      );
    });
  } catch (error) {
    return jsonError(error);
  }
}
