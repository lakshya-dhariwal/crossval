import { describe, expect, it } from "vitest";
import { calculateDocument, calculateLineItem } from "@/lib/domain/calculations";
import type { DocumentDetail } from "@/lib/domain/types";
import { htmlForDocument } from "./outputs";
import { toOutputViewModel } from "./output-view-model";

function fixture(): DocumentDetail {
  const lineItems = [calculateLineItem({ description: "<script>", quantity: "1", unitPrice: "10", discountType: "percentage", discountValue: "5", taxPercent: "10" })];
  return {
    id: "document-id", title: "<Pricing>", customer: "Acme & Co.", issueDate: "2026-08-09", status: "finalized", finalizedAt: "2026-08-09T00:00:00.000Z", createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z", version: 1, lineItems, itemCount: lineItems.length, ...calculateDocument(lineItems),
  };
}

describe("document output view model", () => {
  it("normalizes shared output labels and keeps calculated values", () => {
    const output = toOutputViewModel(fixture());
    expect(output.statusLabel).toBe("Finalized");
    expect(output.customer).toBe("Acme & Co.");
    expect(output.lineItems[0]).toMatchObject({ description: "<script>", discount: "5%", lineTotal: "10.45" });
  });

  it("escapes user text in standalone HTML output", () => {
    const html = htmlForDocument(fixture());
    expect(html).toContain("&lt;Pricing&gt;");
    expect(html).toContain("Acme &amp; Co.");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
