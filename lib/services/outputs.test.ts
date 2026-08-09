import { describe, expect, it } from "vitest";
import { htmlForDocument, safeFilename } from "./outputs";
import type { DocumentDetail } from "@/lib/domain/types";

const document: DocumentDetail = {
  id: "id",
  title: "<Quote> / June",
  customer: "A & B",
  issueDate: "2026-08-09",
  status: "draft",
  finalizedAt: null,
  createdAt: "",
  updatedAt: "",
  version: 1,
  subtotal: "10.00",
  totalDiscount: "0.00",
  totalTax: "1.00",
  grandTotal: "11.00",
  itemCount: 1,
  lineItems: [
    {
      id: "line",
      position: 1,
      description: "<script>alert(1)</script>",
      quantity: "1",
      unitPrice: "10",
      discountType: "none",
      discountValue: "0",
      taxPercent: "10",
      subtotal: "10.00",
      discountAmount: "0.00",
      discountedAmount: "10.00",
      taxAmount: "1.00",
      lineTotal: "11.00",
    },
  ],
};
describe("document output safety", () => {
  it("escapes all user content and creates a safe filename", () => {
    const html = htmlForDocument(document);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(safeFilename(document.title)).toBe("quote-june");
  });
});
