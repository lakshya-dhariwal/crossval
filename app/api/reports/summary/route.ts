import { withUser } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { AppError, jsonError } from "@/lib/api/errors";
import { getSummary } from "@/lib/services/reports";
import { reportQuerySchema } from "@/lib/domain/schemas";
export async function GET(request: Request) {
  try {
    return await withUser(request, async (userId, db) => {
      const url = new URL(request.url);
      const parsed = reportQuerySchema.safeParse({
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      });
      const includeDrafts = url.searchParams.get("includeDrafts") === "1";
      if (!parsed.success)
        throw new AppError(
          "VALIDATION_ERROR",
          "Choose a valid date range.",
          422,
          Object.fromEntries(
            parsed.error.issues.map((issue) => [
              issue.path.join("."),
              [issue.message],
            ]),
          ),
        );
      return ok(
        await getSummary(
          userId,
          parsed.data.from,
          parsed.data.to,
          includeDrafts,
          db,
        ),
      );
    });
  } catch (error) {
    return jsonError(error);
  }
}
