import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;

if (!supabaseUrl || !publishableKey || !secretKey || !email || !password) {
  throw new Error(
    "Load the Supabase and demo environment before running this check.",
  );
}

const projectUrl = supabaseUrl;
const publicKey = publishableKey;
const serverKey = secretKey;
const demoEmail = email;
const demoPassword = password;

async function main() {
  const auth = createClient(projectUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await auth.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });
  if (signedIn.error || !signedIn.data.user) {
    throw signedIn.error ?? new Error("Demo sign-in failed.");
  }

  const admin = createClient(projectUrl, serverKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let documentId: string | undefined;

  try {
    const { data: created, error: createError } = await admin
      .from("documents")
      .insert({
        user_id: signedIn.data.user.id,
        title: `Finalization check ${crypto.randomUUID()}`,
        customer: "Integration check",
        issue_date: new Date().toISOString().slice(0, 10),
      })
      .select("id, version, issue_date")
      .single();
    if (createError || !created) {
      throw (
        createError ??
        new Error("Could not create the finalization check document.")
      );
    }
    documentId = created.id;

    const { error: finalizeError } = await admin.rpc(
      "persist_document_snapshot",
      {
        p_user_id: signedIn.data.user.id,
        p_document_id: created.id,
        p_expected_version: created.version,
        p_title: "Unsaved title published atomically",
        p_customer: "Unsaved customer",
        p_issue_date: created.issue_date,
        p_status: "finalized",
        p_finalized_at: new Date().toISOString(),
        p_subtotal: "10.00",
        p_total_discount: "0.00",
        p_total_tax: "0.00",
        p_grand_total: "10.00",
        p_lines: [
          {
            position: 1,
            description: "Unsaved line published atomically",
            quantity: "1",
            unitPrice: "10",
            discountType: "none",
            discountValue: "0",
            taxPercent: "0",
            subtotal: "10.00",
            discountAmount: "0.00",
            discountedAmount: "10.00",
            taxAmount: "0.00",
            lineTotal: "10.00",
          },
        ],
      },
    );
    if (finalizeError) throw finalizeError;

    const { data: finalized, error: readError } = await admin
      .from("documents")
      .select("status, title, line_items(description)")
      .eq("id", created.id)
      .single();
    if (readError) throw readError;
    if (
      finalized?.status !== "finalized" ||
      finalized.title !== "Unsaved title published atomically" ||
      finalized.line_items[0]?.description !==
        "Unsaved line published atomically"
    ) {
      throw new Error("Finalization did not persist the submitted snapshot.");
    }

    console.log("Atomic save-and-finalize check passed.");
  } finally {
    if (documentId) {
      const { error } = await admin
        .from("documents")
        .delete()
        .eq("id", documentId);
      if (error) throw error;
    }
    await auth.auth.signOut();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
