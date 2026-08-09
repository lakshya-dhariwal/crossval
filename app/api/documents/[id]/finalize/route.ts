import { withUser, readJson } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { finalizeDocument } from "@/lib/services/documents";
import { AppError, jsonError } from "@/lib/api/errors";
import { finalizeDocumentSchema } from "@/lib/domain/schemas";
type Params = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    return await withUser(request, async (userId, db) => {
      const body = await readJson<unknown>(request);
      const parsed = finalizeDocumentSchema.safeParse(body);
      if (!parsed.success)
        throw new AppError(
          "VALIDATION_ERROR",
          "Please complete the document before publishing.",
          422,
          Object.fromEntries(
            parsed.error.issues.map((issue) => [
              issue.path.join("."),
              [issue.message],
            ]),
          ),
        );
      return ok(await finalizeDocument(userId, id, parsed.data, db));
    });
  } catch (error) {
    return jsonError(error);
  }
}
