export type ErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "VALIDATION_ERROR" | "DOCUMENT_FINALIZED" | "DOCUMENT_VERSION_CONFLICT" | "BAD_REQUEST" | "INTERNAL_ERROR";
export class AppError extends Error {
  constructor(public code: ErrorCode, message: string, public status = 400, public fields?: Record<string, string[]>) { super(message); }
}
export function errorFromUnknown(error: unknown) {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return new AppError("UNAUTHENTICATED", "You must sign in to continue.", 401);
  if (message.includes("DOCUMENT_FINALIZED")) return new AppError("DOCUMENT_FINALIZED", "Finalized documents cannot be edited.", 409);
  if (message.includes("DOCUMENT_VERSION_CONFLICT") || message.includes("DOCUMENT_NOT_FINALIZED")) return new AppError("DOCUMENT_VERSION_CONFLICT", "This document changed elsewhere. Refresh and try again.", 409);
  if (message.includes("DOCUMENT_NOT_FOUND")) return new AppError("NOT_FOUND", "Document not found.", 404);
  return new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}
export function jsonError(error: unknown, requestId = crypto.randomUUID()) {
  const mapped = errorFromUnknown(error);
  if (mapped.status >= 500) console.error(`[crossval:${requestId}]`, error instanceof Error ? error.message : "Unexpected error");
  return Response.json({ error: { code: mapped.code, message: mapped.message, ...(mapped.fields ? { fields: mapped.fields } : {}) } }, { status: mapped.status, headers: { "X-Request-Id": requestId } });
}
