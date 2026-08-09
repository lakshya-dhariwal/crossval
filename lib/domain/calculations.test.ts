import { describe, expect, it } from "vitest";
import { calculateDocument, calculateLineItem, sampleLines } from "./calculations";

describe("pricing calculations", () => {
  it("calculates the assignment sample", () => {
    const lines = sampleLines.map(calculateLineItem);
    expect(lines.map((line) => line.lineTotal)).toEqual(["189.00", "52.50", "180.00"]);
    expect(calculateDocument(lines)).toEqual({ subtotal: "450.00", totalDiscount: "40.00", totalTax: "11.50", grandTotal: "421.50" });
  });
  it("rounds half up per monetary step", () => {
    expect(calculateLineItem({ description: "", quantity: "1", unitPrice: "1.005", discountType: "none", discountValue: "0", taxPercent: "0" }).subtotal).toBe("1.01");
  });
  it("rejects a fixed discount above subtotal", () => {
    expect(() => calculateLineItem({ description: "", quantity: "1", unitPrice: "20", discountType: "fixed", discountValue: "20.01", taxPercent: "0" })).toThrow("Fixed discount cannot exceed");
  });
  it("allows a fixed discount equal to subtotal and preserves fractional inputs", () => {
    const zero = calculateLineItem({ description: "", quantity: "1", unitPrice: "20", discountType: "fixed", discountValue: "20", taxPercent: "5" });
    expect(zero.discountedAmount).toBe("0.00"); expect(zero.taxAmount).toBe("0.00"); expect(zero.lineTotal).toBe("0.00");
    expect(calculateLineItem({ description: "", quantity: "1.25", unitPrice: "10.1250", discountType: "none", discountValue: "0", taxPercent: "0" }).subtotal).toBe("12.66");
  });
  it("applies percentage discount before tax", () => {
    const line = calculateLineItem({ description: "", quantity: "2", unitPrice: "100", discountType: "percentage", discountValue: "10", taxPercent: "5" });
    expect(line.taxAmount).toBe("9.00");
  });
  it("supports no discount, fixed discount, and 100 percent discount", () => {
    expect(calculateLineItem({ description: "", quantity: "1", unitPrice: "10", discountType: "none", discountValue: "0", taxPercent: "0" }).lineTotal).toBe("10.00");
    expect(calculateLineItem({ description: "", quantity: "1", unitPrice: "10", discountType: "fixed", discountValue: "2.50", taxPercent: "0" }).lineTotal).toBe("7.50");
    expect(calculateLineItem({ description: "", quantity: "1", unitPrice: "10", discountType: "percentage", discountValue: "100", taxPercent: "10" }).lineTotal).toBe("0.00");
  });
  it("rounds each line before document aggregation", () => {
    const lines = [
      calculateLineItem({ description: "", quantity: "1", unitPrice: "1.005", discountType: "none", discountValue: "0", taxPercent: "0" }),
      calculateLineItem({ description: "", quantity: "1", unitPrice: "1.005", discountType: "none", discountValue: "0", taxPercent: "0" }),
    ];
    expect(lines.map((line) => line.lineTotal)).toEqual(["1.01", "1.01"]);
    expect(calculateDocument(lines).grandTotal).toBe("2.02");
  });
  it("rejects invalid numeric and discount combinations", () => {
    expect(() => calculateLineItem({ description: "", quantity: "0", unitPrice: "10", discountType: "none", discountValue: "0", taxPercent: "0" })).toThrow("Quantity must be at least 1");
    expect(() => calculateLineItem({ description: "", quantity: "1", unitPrice: "-1", discountType: "none", discountValue: "0", taxPercent: "0" })).toThrow("negative");
    expect(() => calculateLineItem({ description: "", quantity: "1", unitPrice: "10", discountType: "percentage", discountValue: "101", taxPercent: "0" })).toThrow("between 0 and 100");
  });
});
