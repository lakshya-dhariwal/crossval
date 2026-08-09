import { withUser } from "@/app/api/_shared";
import { ok } from "@/lib/api/response";
import { AppError, jsonError } from "@/lib/api/errors";
import { getSummary } from "@/lib/services/reports";
export async function GET(request: Request) {
  try {
    return await withUser(request, async (userId, db) => {
      const url = new URL(request.url);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const includeDrafts = url.searchParams.get("includeDrafts") === "1";
      if (
        !from ||
        !to ||
        !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
        from > to
      )
        throw new AppError(
          "VALIDATION_ERROR",
          "Choose a valid date range.",
          422,
          {
            from: ["Enter a valid start date."],
            to: ["End date must be on or after start date."],
          },
        );
      return ok(await getSummary(userId, from, to, includeDrafts, db));
    });
  } catch (error) {
    return jsonError(error);
  }
}
