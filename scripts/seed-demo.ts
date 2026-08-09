import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  calculateDocument,
  calculateLineItem,
  sampleLines,
} from "../lib/domain/calculations";

loadEnvConfig(process.cwd());

const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
if (!email || !password)
  throw new Error(
    "Set DEMO_EMAIL and DEMO_PASSWORD before seeding the demo account.",
  );
async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = users.data.users.find((candidate) => candidate.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("Could not create demo user.");
    user = created.data.user;
  }
  const existing = await admin
    .from("documents")
    .select("id")
    .eq("user_id", user.id)
    .eq("sample_key", "assignment-v1")
    .maybeSingle();
  if (!existing.data) {
    const totals = calculateDocument(sampleLines.map(calculateLineItem));
    const { data: document, error } = await admin
      .from("documents")
      .insert({
        user_id: user.id,
        title: "Sample document",
        customer: "Acme Corp",
        issue_date: new Date().toISOString().slice(0, 10),
        sample_key: "assignment-v1",
        subtotal: totals.subtotal,
        total_discount: totals.totalDiscount,
        total_tax: totals.totalTax,
        grand_total: totals.grandTotal,
      })
      .select("id")
      .single();
    if (error || !document)
      throw error ?? new Error("Could not create demo document.");
    const lines = sampleLines.map(calculateLineItem);
    const { error: lineError } = await admin.from("line_items").insert(
      lines.map((line, index) => ({
        document_id: document.id,
        position: index + 1,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        discount_type: line.discountType,
        discount_value: line.discountValue,
        tax_percent: line.taxPercent,
        subtotal: line.subtotal,
        discount_amount: line.discountAmount,
        discounted_amount: line.discountedAmount,
        tax_amount: line.taxAmount,
        line_total: line.lineTotal,
      })),
    );
    if (lineError) throw lineError;
  }
  console.log(`Demo account ready: ${email}`);
}
void main();
