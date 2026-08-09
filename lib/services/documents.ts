import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createRlsClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateDocument,
  calculateLineItem,
  sampleLines,
} from "@/lib/domain/calculations";
import {
  lineInputSchema,
  type FinalizeDocumentInput,
} from "@/lib/domain/schemas";
import type {
  CalculatedLineItem,
  DocumentDetail,
  DocumentStatus,
  DocumentSummary,
  RawLineItem,
} from "@/lib/domain/types";
import { AppError } from "@/lib/api/errors";
import Decimal from "decimal.js";

type DbDocument = Record<string, unknown>;
type DbLine = Record<string, unknown>;
const str = (value: unknown) => String(value ?? "");
const moneyString = (value: unknown) => new Decimal(str(value)).toFixed(2);
const rawFromRow = (row: DbLine): RawLineItem => ({
  description: str(row.description),
  quantity: str(row.quantity),
  unitPrice: str(row.unit_price),
  discountType: row.discount_type as RawLineItem["discountType"],
  discountValue: str(row.discount_value),
  taxPercent: str(row.tax_percent),
});
const lineFromRow = (row: DbLine): CalculatedLineItem => ({
  id: str(row.id),
  position: Number(row.position),
  ...rawFromRow(row),
  subtotal: moneyString(row.subtotal),
  discountAmount: moneyString(row.discount_amount),
  discountedAmount: moneyString(row.discounted_amount),
  taxAmount: moneyString(row.tax_amount),
  lineTotal: moneyString(row.line_total),
});
const detailFromRows = (doc: DbDocument, lines: DbLine[]): DocumentDetail => ({
  id: str(doc.id),
  title: str(doc.title),
  customer: str(doc.customer),
  issueDate: str(doc.issue_date),
  status: doc.status as DocumentStatus,
  subtotal: moneyString(doc.subtotal),
  totalDiscount: moneyString(doc.total_discount),
  totalTax: moneyString(doc.total_tax),
  grandTotal: moneyString(doc.grand_total),
  version: Number(doc.version),
  createdAt: str(doc.created_at),
  updatedAt: str(doc.updated_at),
  finalizedAt: doc.finalized_at ? str(doc.finalized_at) : null,
  lineItems: lines
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map(lineFromRow),
  itemCount: lines.length,
});

export async function getOwnedDocument(
  userId: string,
  id: string,
  db?: SupabaseClient,
): Promise<DocumentDetail> {
  const supabase = db ?? (await createRlsClient());
  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !doc)
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  const { data: lines, error: lineError } = await supabase
    .from("line_items")
    .select("*")
    .eq("document_id", id)
    .order("position");
  if (lineError) throw lineError;
  return detailFromRows(doc, lines ?? []);
}

export async function getOwnedFinalizedDocument(
  userId: string,
  id: string,
  db?: SupabaseClient,
) {
  const document = await getOwnedDocument(userId, id, db);
  if (document.status !== "finalized")
    throw new AppError(
      "OUTPUT_NOT_AVAILABLE",
      "Print and export are available after the document is finalized.",
      409,
    );
  return document;
}

export async function listDocuments(
  userId: string,
  search = "",
  status: "all" | "draft" | "finalized" = "all",
  db?: SupabaseClient,
): Promise<DocumentSummary[]> {
  const supabase = db ?? (await createRlsClient());
  let query = supabase
    .from("documents")
    .select(
      "id,title,customer,issue_date,status,grand_total,updated_at,line_items(count)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  if (search) {
    const safeSearch = search.replace(/[%,()\\_]/g, " ");
    query = query.or(
      `title.ilike.%${safeSearch}%,customer.ilike.%${safeSearch}%`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    customer: row.customer,
    issueDate: row.issue_date,
    status: row.status,
    grandTotal: moneyString(row.grand_total),
    updatedAt: row.updated_at,
    itemCount: Array.isArray(row.line_items)
      ? Number((row.line_items[0] as { count?: number })?.count ?? 0)
      : 0,
  }));
}

function snapshotLines(lines: CalculatedLineItem[]) {
  return lines.map((line, index) => ({ ...line, position: index + 1 }));
}
async function createSnapshot(
  userId: string,
  values: {
    title: string;
    customer: string;
    issueDate: string;
    sampleKey?: string | null;
  },
  lines: CalculatedLineItem[],
  db?: SupabaseClient,
) {
  const calculated = snapshotLines(lines);
  const totals = calculateDocument(calculated);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_document_snapshot", {
    p_user_id: userId,
    p_title: values.title,
    p_customer: values.customer,
    p_issue_date: values.issueDate,
    p_sample_key: values.sampleKey ?? null,
    p_subtotal: totals.subtotal,
    p_total_discount: totals.totalDiscount,
    p_total_tax: totals.totalTax,
    p_grand_total: totals.grandTotal,
    p_lines: calculated,
  });
  if (error) throw error;
  const created = (data as DbDocument[] | null)?.[0];
  if (!created)
    throw new AppError(
      "INTERNAL_ERROR",
      "The document could not be created.",
      500,
    );
  return getOwnedDocument(userId, str(created.id), db);
}
async function persist(
  userId: string,
  current: DocumentDetail,
  lines: CalculatedLineItem[],
  next: {
    title?: string;
    customer?: string;
    issueDate?: string;
    status?: DocumentStatus;
    finalizedAt?: string | null;
  } = {},
  db?: SupabaseClient,
) {
  const calculated = snapshotLines(lines);
  const totals = calculateDocument(calculated);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("persist_document_snapshot", {
    p_user_id: userId,
    p_document_id: current.id,
    p_expected_version: current.version,
    p_title: next.title ?? current.title,
    p_customer: next.customer ?? current.customer,
    p_issue_date: next.issueDate ?? current.issueDate,
    p_status: next.status ?? current.status,
    p_finalized_at:
      next.finalizedAt === undefined ? current.finalizedAt : next.finalizedAt,
    p_subtotal: totals.subtotal,
    p_total_discount: totals.totalDiscount,
    p_total_tax: totals.totalTax,
    p_grand_total: totals.grandTotal,
    p_lines: calculated,
  });
  if (error) throw new Error(error.message);
  const committed = (data as DbDocument[] | null)?.[0];
  if (!committed)
    throw new AppError(
      "INTERNAL_ERROR",
      "The document could not be saved.",
      500,
    );
  return getOwnedDocument(userId, current.id, db);
}

function assertEditable(current: DocumentDetail) {
  if (current.status === "finalized")
    throw new AppError(
      "DOCUMENT_FINALIZED",
      "Finalized documents cannot be edited.",
      409,
    );
}
function validateLine(raw: RawLineItem) {
  const parsed = lineInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      422,
      Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join("."),
          [issue.message],
        ]),
      ),
    );
  try {
    return calculateLineItem(parsed.data);
  } catch (error) {
    if (error instanceof Error && "field" in error) {
      const field = (error as { field: string }).field;
      throw new AppError(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        422,
        { [field]: [error.message] },
      );
    }
    throw error;
  }
}

export async function createDocument(
  userId: string,
  values: Partial<
    Pick<DocumentDetail, "title" | "customer" | "issueDate">
  > = {},
  db?: SupabaseClient,
) {
  const blank = validateLine({
    description: "",
    quantity: "1",
    unitPrice: "0",
    discountType: "none",
    discountValue: "0",
    taxPercent: "0",
  });
  return createSnapshot(
    userId,
    {
      title: values.title ?? "Untitled document",
      customer: values.customer ?? "",
      issueDate: values.issueDate ?? new Date().toISOString().slice(0, 10),
    },
    [{ ...blank, position: 1 }],
    db,
  );
}

export async function updateDocument(
  userId: string,
  id: string,
  values: {
    title?: string;
    customer?: string;
    issueDate?: string;
    version: number;
  },
  db?: SupabaseClient,
) {
  const current = await getOwnedDocument(userId, id, db);
  assertEditable(current);
  if (values.version !== current.version)
    throw new AppError(
      "DOCUMENT_VERSION_CONFLICT",
      "This document changed elsewhere. Refresh and try again.",
      409,
    );
  return persist(userId, current, current.lineItems, values, db);
}

export async function addLine(
  userId: string,
  id: string,
  raw: RawLineItem,
  afterLineItemId?: string,
  lineItemId?: string,
  db?: SupabaseClient,
) {
  const current = await getOwnedDocument(userId, id, db);
  assertEditable(current);
  const line = validateLine(raw);
  if (lineItemId) line.id = lineItemId;
  const index = afterLineItemId
    ? current.lineItems.findIndex((item) => item.id === afterLineItemId) + 1
    : current.lineItems.length;
  if (afterLineItemId && index === 0)
    throw new AppError("NOT_FOUND", "Line item not found.", 404);
  return persist(
    userId,
    current,
    [
      ...current.lineItems.slice(0, index),
      line,
      ...current.lineItems.slice(index),
    ],
    {},
    db,
  );
}

export async function updateLine(
  userId: string,
  id: string,
  lineId: string,
  raw: RawLineItem,
  version: number,
  db?: SupabaseClient,
) {
  const current = await getOwnedDocument(userId, id, db);
  assertEditable(current);
  if (version !== current.version)
    throw new AppError(
      "DOCUMENT_VERSION_CONFLICT",
      "This document changed elsewhere. Refresh and try again.",
      409,
    );
  const index = current.lineItems.findIndex((item) => item.id === lineId);
  if (index < 0) throw new AppError("NOT_FOUND", "Line item not found.", 404);
  const line = validateLine(raw);
  line.id = lineId;
  return persist(
    userId,
    current,
    current.lineItems.map((item, i) => (i === index ? line : item)),
    {},
    db,
  );
}

export async function deleteLine(
  userId: string,
  id: string,
  lineId: string,
  version: number,
  db?: SupabaseClient,
) {
  const current = await getOwnedDocument(userId, id, db);
  assertEditable(current);
  if (version !== current.version)
    throw new AppError(
      "DOCUMENT_VERSION_CONFLICT",
      "This document changed elsewhere. Refresh and try again.",
      409,
    );
  const next = current.lineItems.filter((item) => item.id !== lineId);
  if (next.length === current.lineItems.length)
    throw new AppError("NOT_FOUND", "Line item not found.", 404);
  return persist(userId, current, next, {}, db);
}

export async function finalizeDocument(
  userId: string,
  id: string,
  values: FinalizeDocumentInput,
  db?: SupabaseClient,
) {
  const current = await getOwnedDocument(userId, id, db);
  assertEditable(current);
  if (values.version !== current.version)
    throw new AppError(
      "DOCUMENT_VERSION_CONFLICT",
      "This document changed elsewhere. Refresh and try again.",
      409,
    );
  const submittedIds = new Set(values.lineItems.map((line) => line.id));
  if (submittedIds.size !== values.lineItems.length)
    throw new AppError(
      "DOCUMENT_VERSION_CONFLICT",
      "The document contains duplicate line items. Refresh and try again.",
      409,
    );

  const fields: Record<string, string[]> = {};
  if (!values.title.trim()) fields.title = ["Title is required."];
  if (!values.customer.trim()) fields.customer = ["Customer is required."];
  values.lineItems.forEach((line, index) => {
    if (!line.description.trim())
      fields[`lineItems.${index}.description`] = ["Description is required."];
  });
  if (Object.keys(fields).length)
    throw new AppError(
      "VALIDATION_ERROR",
      "Please complete the document before publishing.",
      422,
      fields,
    );
  const lines = values.lineItems.map(({ id: lineId, ...line }, index) => {
    try {
      return { ...validateLine(line), id: lineId };
    } catch (error) {
      if (error instanceof AppError && error.fields) {
        throw new AppError(
          error.code,
          error.message,
          error.status,
          Object.fromEntries(
            Object.entries(error.fields).map(([field, messages]) => [
              `lineItems.${index}.${field}`,
              messages,
            ]),
          ),
        );
      }
      throw error;
    }
  });
  return persist(
    userId,
    current,
    lines,
    {
      title: values.title,
      customer: values.customer,
      issueDate: values.issueDate,
      status: "finalized",
      finalizedAt: new Date().toISOString(),
    },
    db,
  );
}

export async function deleteDocument(
  userId: string,
  id: string,
  db?: SupabaseClient,
) {
  await getOwnedDocument(userId, id, db);
  const admin = createAdminClient();
  const { error } = await admin
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function revertDocumentToDraft(
  userId: string,
  id: string,
  version?: number,
  db?: SupabaseClient,
) {
  const current = await getOwnedDocument(userId, id, db);
  if (current.status === "draft") return current;
  if (version !== undefined && version !== current.version)
    throw new AppError(
      "DOCUMENT_VERSION_CONFLICT",
      "This document changed elsewhere. Refresh and try again.",
      409,
    );
  const admin = createAdminClient();
  const { error } = await admin.rpc("revert_document_to_draft", {
    p_user_id: userId,
    p_document_id: id,
    p_expected_version: current.version,
  });
  if (error) throw error;
  return getOwnedDocument(userId, id, db);
}

export async function duplicateDocument(
  userId: string,
  id: string,
  db?: SupabaseClient,
) {
  const source = await getOwnedDocument(userId, id, db);
  const calculated = source.lineItems.map((line) =>
    calculateLineItem({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxPercent: line.taxPercent,
    }),
  );
  return createSnapshot(
    userId,
    {
      title: `Copy of ${source.title}`,
      customer: source.customer,
      issueDate: new Date().toISOString().slice(0, 10),
    },
    calculated,
    db,
  );
}

export async function ensureSampleDocument(userId: string) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("documents")
    .select("id,title,status")
    .eq("user_id", userId)
    .eq("sample_key", "assignment-v1")
    .maybeSingle();
  if (existing) {
    if (existing.status === "draft" && existing.title !== "Sample document")
      await supabase
        .from("documents")
        .update({ title: "Sample document" })
        .eq("id", existing.id)
        .eq("user_id", userId);
    return;
  }
  const lines = sampleLines.map(calculateLineItem);
  const admin = createAdminClient();
  const { error } = await admin.rpc("create_document_snapshot", {
    p_user_id: userId,
    p_title: "Sample document",
    p_customer: "Acme Corp",
    p_issue_date: new Date().toISOString().slice(0, 10),
    p_sample_key: "assignment-v1",
    p_subtotal: calculateDocument(lines).subtotal,
    p_total_discount: calculateDocument(lines).totalDiscount,
    p_total_tax: calculateDocument(lines).totalTax,
    p_grand_total: calculateDocument(lines).grandTotal,
    p_lines: snapshotLines(lines),
  });
  if (error) {
    const { data: raced } = await admin
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("sample_key", "assignment-v1")
      .maybeSingle();
    if (!raced) throw error;
  }
}
