import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!email || !password || !supabaseUrl || !publishableKey)
  throw new Error(
    "Load the Supabase and demo environment before running this check.",
  );
const demoEmail = email;
const demoPassword = password;
const projectUrl = supabaseUrl;
const publicKey = publishableKey;

type ApiResult = { response: Response; body: unknown };
async function main() {
  const auth = createClient(projectUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await auth.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });
  if (signedIn.error || !signedIn.data.session)
    throw signedIn.error ?? new Error("Demo sign-in failed.");
  const headers = {
    Authorization: `Bearer ${signedIn.data.session.access_token}`,
    "Content-Type": "application/json",
  };
  const unauthenticated = await fetch(`${baseUrl}/api/documents`);
  expect(
    unauthenticated.status === 401,
    "unauthenticated API access must be rejected",
  );
  async function api(
    path: string,
    init: RequestInit = {},
    parseJson = true,
  ): Promise<ApiResult> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    const text = await response.text();
    if (!text) return { response, body: null };
    if (!parseJson) return { response, body: text };
    try {
      return { response, body: JSON.parse(text) };
    } catch {
      throw new Error(
        `${path} returned non-JSON content with status ${response.status}.`,
      );
    }
  }
  const dataOf = <T>(result: ApiResult) => (result.body as { data: T }).data;
  function expect(condition: unknown, message: string) {
    if (!condition) throw new Error(message);
  }
  function status(result: ApiResult, expected: number, message: string) {
    expect(
      result.response.status === expected,
      `${message}: expected ${expected}, got ${result.response.status}`,
    );
  }

  const listed = await api("/api/documents");
  status(listed, 200, "list documents");
  const documents =
    dataOf<Array<{ id: string; status: string; title: string }>>(listed);
  const sample = documents.find(
    (document) => document.title === "Sample Pricing Document",
  );
  const finalized = documents.find(
    (document) => document.status === "finalized",
  );
  expect(sample, "seeded sample document is missing");
  expect(finalized, "a finalized document is required for immutability checks");
  const detail = await api(`/api/documents/${sample!.id}`);
  status(detail, 200, "get document");
  const sampleDetail = dataOf<{
    lineItems: unknown[];
    grandTotal: string;
    version: number;
  }>(detail);
  expect(
    sampleDetail.lineItems.length === 3 && sampleDetail.grandTotal === "421.50",
    "sample totals are incorrect",
  );
  const finalizedForMismatch = await api(`/api/documents/${finalized!.id}`);
  status(finalizedForMismatch, 200, "get finalized document for nested check");
  const finalizedForMismatchData = dataOf<{ lineItems: Array<{ id: string }> }>(
    finalizedForMismatch,
  );
  const nestedMismatch = await api(
    `/api/documents/${sample!.id}/line-items/${finalizedForMismatchData.lineItems[0].id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        description: "Should fail",
        quantity: "1",
        unitPrice: "1",
        discountType: "none",
        discountValue: "0",
        taxPercent: "0",
        version: sampleDetail.version,
      }),
    },
  );
  status(nestedMismatch, 404, "nested ownership mismatch");
  const missing = await api(
    "/api/documents/00000000-0000-0000-0000-000000000000",
  );
  status(missing, 404, "missing document is hidden");
  const malformed = await api("/api/documents", { method: "POST", body: "{" });
  status(malformed, 400, "malformed JSON is rejected");
  const created = await api("/api/documents", {
    method: "POST",
    body: JSON.stringify({}),
  });
  status(created, 201, "create document");
  const createdDetail = dataOf<{
    id: string;
    lineItems: unknown[];
    grandTotal: string;
    version: number;
    issueDate: string;
  }>(created);
  let createdId: string | undefined = createdDetail.id;
  try {
    expect(
      createdDetail.lineItems.length === 1 &&
        createdDetail.grandTotal === "0.00",
      "new documents start with one zero-value line",
    );
    const forbiddenTotal = await api(`/api/documents/${createdId}`, {
      method: "PATCH",
      body: JSON.stringify({
        grandTotal: "999999",
        version: createdDetail.version,
      }),
    });
    status(forbiddenTotal, 422, "client totals cannot be patched");
    const renamed = await api(`/api/documents/${createdId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "API smoke draft",
        customer: "Smoke customer",
        issueDate: createdDetail.issueDate,
        version: createdDetail.version,
      }),
    });
    status(renamed, 200, "update metadata");
    const current = dataOf<{
      version: number;
      lineItems: Array<{ id: string }>;
    }>(renamed);
    const invalidFinalizeMeta = await api(`/api/documents/${createdId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "", version: current.version }),
    });
    status(invalidFinalizeMeta, 200, "allow draft metadata validation state");
    const invalidFinalize = await api(`/api/documents/${createdId}/finalize`, {
      method: "POST",
      body: JSON.stringify({
        version: dataOf<{ version: number }>(invalidFinalizeMeta).version,
      }),
    });
    status(invalidFinalize, 422, "invalid finalization");
    expect(
      Boolean(
        invalidFinalize.body &&
        (
          invalidFinalize.body as {
            error?: { fields?: Record<string, string[]> };
          }
        ).error?.fields?.title,
      ),
      "finalization returns indexed field errors",
    );
    const restoredMeta = await api(`/api/documents/${createdId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "API smoke draft",
        version: dataOf<{ version: number }>(invalidFinalizeMeta).version,
      }),
    });
    status(restoredMeta, 200, "restore draft metadata");
    const line = dataOf<{ lineItems: Array<{ id: string }> }>(restoredMeta)
      .lineItems[0];
    const restored = dataOf<{
      version: number;
      lineItems: Array<{ id: string }>;
    }>(restoredMeta);
    const updatedLine = await api(
      `/api/documents/${createdId}/line-items/${line.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          description: "Smoke line",
          quantity: "2",
          unitPrice: "12.50",
          discountType: "none",
          discountValue: "0",
          taxPercent: "10",
          version: restored.version,
        }),
      },
    );
    status(updatedLine, 200, "update line");
    expect(
      dataOf<{ grandTotal: string }>(updatedLine).grandTotal === "27.50",
      "line update totals are incorrect",
    );
    const createdFinalized = await api(`/api/documents/${createdId}/finalize`, {
      method: "POST",
      body: JSON.stringify({
        version: dataOf<{ version: number }>(updatedLine).version,
      }),
    });
    status(createdFinalized, 200, "finalize smoke document");
    const reverted = await api(`/api/documents/${createdId}/revert`, {
      method: "POST",
      body: JSON.stringify({
        version: dataOf<{ version: number }>(createdFinalized).version,
      }),
    });
    status(reverted, 200, "change finalized document back to draft");
    expect(
      dataOf<{ status: string; finalizedAt: string | null }>(reverted)
        .status === "draft" &&
        dataOf<{ finalizedAt: string | null }>(reverted).finalizedAt === null,
      "reverted document lifecycle is incorrect",
    );
    const finalizedAgain = await api(`/api/documents/${createdId}/finalize`, {
      method: "POST",
      body: JSON.stringify({
        version: dataOf<{ version: number }>(reverted).version,
      }),
    });
    status(finalizedAgain, 200, "re-finalize smoke document");
    const deletedFinalized = await api(`/api/documents/${createdId}`, {
      method: "DELETE",
    });
    status(deletedFinalized, 204, "delete finalized document");
    createdId = undefined;
    const duplicated = await api(`/api/documents/${finalized!.id}/duplicate`, {
      method: "POST",
    });
    status(duplicated, 201, "duplicate finalized document");
    const duplicateId = dataOf<{ id: string }>(duplicated).id;
    const duplicateDelete = await api(`/api/documents/${duplicateId}`, {
      method: "DELETE",
    });
    status(duplicateDelete, 204, "delete duplicate draft");
    const finalizedDetail = await api(`/api/documents/${finalized!.id}`);
    status(finalizedDetail, 200, "get finalized document");
    const finalizedData = dataOf<{
      version: number;
      lineItems: Array<{ id: string }>;
    }>(finalizedDetail);
    const immutablePatch = await api(`/api/documents/${finalized!.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Should fail",
        version: finalizedData.version,
      }),
    });
    status(immutablePatch, 409, "finalized metadata is immutable");
    const immutableLine = await api(
      `/api/documents/${finalized!.id}/line-items/${finalizedData.lineItems[0].id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          description: "Should fail",
          quantity: "1",
          unitPrice: "1",
          discountType: "none",
          discountValue: "0",
          taxPercent: "0",
          version: finalizedData.version,
        }),
      },
    );
    status(immutableLine, 409, "finalized lines are immutable");
    const immutableAdd = await api(
      `/api/documents/${finalized!.id}/line-items`,
      {
        method: "POST",
        body: JSON.stringify({
          description: "Should fail",
          quantity: "1",
          unitPrice: "1",
          discountType: "none",
          discountValue: "0",
          taxPercent: "0",
        }),
      },
    );
    status(immutableAdd, 409, "finalized line insertion is rejected");
    const immutableLineDelete = await api(
      `/api/documents/${finalized!.id}/line-items/${finalizedData.lineItems[0].id}`,
      {
        method: "DELETE",
        body: JSON.stringify({ version: finalizedData.version }),
      },
    );
    status(immutableLineDelete, 409, "finalized line deletion is rejected");
    const report = await api(
      "/api/reports/summary?from=2020-01-01&to=2030-12-31",
    );
    status(report, 200, "report summary");
    expect(
      typeof dataOf<{ grandTotal: string }>(report).grandTotal === "string",
      "report total is present",
    );
    const invalidReport = await api(
      "/api/reports/summary?from=2030-01-01&to=2020-01-01",
    );
    status(invalidReport, 422, "invalid report range");
    const html = await api(
      `/api/documents/${sample!.id}/export/html`,
      {},
      false,
    );
    status(html, 200, "HTML export");
    expect(
      html.response.headers.get("content-type")?.includes("text/html"),
      "HTML export content type",
    );
  } finally {
    if (createdId) {
      const cleanup = await api(`/api/documents/${createdId}`, {
        method: "DELETE",
      });
      status(cleanup, 204, "delete smoke draft");
      createdId = undefined;
    }
    await auth.auth.signOut();
  }
  console.log(
    "API smoke check passed: auth, ownership, CRUD, calculation totals, exports, reports, and finalized immutability.",
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
