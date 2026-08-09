import Decimal from "decimal.js";
import type { CalculatedLineItem, DocumentTotals, RawLineItem } from "./types";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const decimal = (value: string) => new Decimal(value);

export class CalculationError extends Error {
  constructor(public field: string, message: string) { super(message); this.name = "CalculationError"; }
}

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
export function assertDecimalToken(value: string, field: string, scale: number) {
  if (!value || !DECIMAL.test(value) || value.split(".")[1]?.length > scale) throw new CalculationError(field, "Enter a valid decimal value.");
}

export function calculateLineItem(raw: RawLineItem): CalculatedLineItem {
  try {
    const quantity = decimal(raw.quantity); const unitPrice = decimal(raw.unitPrice);
    if (quantity.lt(1)) throw new CalculationError("quantity", "Quantity must be at least 1.");
    if (unitPrice.lt(0)) throw new CalculationError("unitPrice", "Unit price cannot be negative.");
    const taxPercent = decimal(raw.taxPercent || "0");
    if (taxPercent.lt(0) || taxPercent.gt(100)) throw new CalculationError("taxPercent", "Tax must be between 0 and 100.");
    const subtotal = new Decimal(quantity).mul(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const discountValue = decimal(raw.discountValue || "0");
    if (discountValue.lt(0)) throw new CalculationError("discountValue", "Discount cannot be negative.");
    if (raw.discountType === "percentage" && discountValue.gt(100)) throw new CalculationError("discountValue", "Discount must be between 0 and 100.");
    if (raw.discountType === "none" && !discountValue.isZero()) throw new CalculationError("discountValue", "A line without a discount must use 0.");
    let discountAmount = new Decimal(0);
    if (raw.discountType === "percentage") discountAmount = subtotal.mul(discountValue).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (raw.discountType === "fixed") {
      if (discountValue.gt(subtotal)) throw new CalculationError("discountValue", "Fixed discount cannot exceed the line subtotal.");
      discountAmount = discountValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
    const discountedAmount = subtotal.minus(discountAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const taxAmount = discountedAmount.mul(taxPercent).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lineTotal = discountedAmount.plus(taxAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return { ...raw, discountValue: raw.discountType === "none" ? "0" : raw.discountValue, subtotal: subtotal.toFixed(2), discountAmount: money(discountAmount), discountedAmount: money(discountedAmount), taxAmount: money(taxAmount), lineTotal: money(lineTotal) };
  } catch (error) {
    if (error instanceof CalculationError) throw error;
    throw new CalculationError("line", "Line item contains an invalid numeric value.");
  }
}

export function calculateDocument(lines: CalculatedLineItem[]): DocumentTotals {
  const sum = (key: keyof Pick<CalculatedLineItem, "subtotal" | "discountAmount" | "taxAmount" | "lineTotal">) => lines.reduce((total, line) => total.plus(line[key]), new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  return { subtotal: sum("subtotal"), totalDiscount: sum("discountAmount"), totalTax: sum("taxAmount"), grandTotal: sum("lineTotal") };
}

export const sampleLines: RawLineItem[] = [
  { description: "Widget A", quantity: "2", unitPrice: "100.00", discountType: "percentage", discountValue: "10", taxPercent: "5" },
  { description: "Widget B", quantity: "1", unitPrice: "50.00", discountType: "none", discountValue: "0", taxPercent: "5" },
  { description: "Service fee", quantity: "1", unitPrice: "200.00", discountType: "fixed", discountValue: "20.00", taxPercent: "0" },
];
