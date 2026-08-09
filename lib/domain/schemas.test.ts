import { describe, expect, it } from "vitest";
import { lineInputSchema, metadataSchema, patchMetadataSchema, reportQuerySchema } from "./schemas";

const valid = { description: "Work", quantity: "1.25", unitPrice: "10.1250", discountType: "percentage" as const, discountValue: "10", taxPercent: "5" };
describe("request schemas", () => {
  it("rejects exponent, empty, and excess-precision tokens", () => {
    expect(lineInputSchema.safeParse({ ...valid, quantity: "1e2" }).success).toBe(false);
    expect(lineInputSchema.safeParse({ ...valid, quantity: "" }).success).toBe(false);
    expect(lineInputSchema.safeParse({ ...valid, unitPrice: "10.12345" }).success).toBe(false);
  });
  it("enforces percentage and discount-mode bounds", () => {
    expect(lineInputSchema.safeParse({ ...valid, taxPercent: "100.01" }).success).toBe(false);
    expect(lineInputSchema.safeParse({ ...valid, discountValue: "20.001", discountType: "fixed" }).success).toBe(false);
    expect(lineInputSchema.safeParse({ ...valid, discountType: "none", discountValue: "1" }).success).toBe(false);
  });
  it("accepts exact boundaries and rejects reversed report ranges", () => {
    expect(lineInputSchema.safeParse({ ...valid, quantity: "1", taxPercent: "100", discountValue: "0" }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ from: "2026-08-10", to: "2026-08-09" }).success).toBe(false);
  });
  it("rejects non-finite tokens and unknown authoritative fields", () => {
    for (const token of ["NaN", "Infinity", "-Infinity", "1e2", "1.23456"]) {
      expect(lineInputSchema.safeParse({ ...valid, quantity: token }).success).toBe(false);
    }
    expect(patchMetadataSchema.safeParse({ title: "x", version: 1, grandTotal: "999" }).success).toBe(false);
  });
  it("validates finalize metadata and report date-only syntax", () => {
    expect(metadataSchema.safeParse({ title: "", customer: "", issueDate: "2026-08-09", version: 1 }).success).toBe(true);
    expect(metadataSchema.safeParse({ title: "x", customer: "y", issueDate: "08/09/2026", version: 1 }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2026-8-1", to: "2026-08-09" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2026-08-09", to: "2026-08-09" }).success).toBe(true);
  });
});
