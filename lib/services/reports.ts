import Decimal from "decimal.js";
import { createClient as createRlsClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStatus } from "@/lib/domain/types";
export async function getSummary(
  userId: string,
  from: string,
  to: string,
  includeDrafts = false,
  db?: SupabaseClient,
) {
  const supabase = db ?? (await createRlsClient());
  let query = supabase
    .from("documents")
    .select(
      "id,title,customer,issue_date,status,total_discount,total_tax,grand_total",
    )
    .eq("user_id", userId)
    .gte("issue_date", from)
    .lte("issue_date", to)
    .order("issue_date", { ascending: false });
  if (!includeDrafts) query = query.eq("status", "finalized");
  const { data, error } = await query;
  if (error) throw error;
  const money = (value: unknown) => new Decimal(String(value ?? 0)).toFixed(2);
  const rows = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    customer: row.customer,
    issueDate: row.issue_date,
    status: row.status as DocumentStatus,
    totalDiscount: money(row.total_discount),
    totalTax: money(row.total_tax),
    grandTotal: money(row.grand_total),
  }));
  const sum = (key: "totalDiscount" | "totalTax" | "grandTotal") =>
    rows
      .reduce((total, row) => total.plus(row[key]), new Decimal(0))
      .toFixed(2);
  return {
    from,
    to,
    documentCount: rows.length,
    totalDiscount: sum("totalDiscount"),
    totalTax: sum("totalTax"),
    grandTotal: sum("grandTotal"),
    rows,
  };
}
