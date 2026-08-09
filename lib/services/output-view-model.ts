import type { DocumentDetail } from "@/lib/domain/types";

export type DocumentOutput = {
  title: string;
  customer: string;
  issueDate: string;
  statusLabel: "Draft" | "Finalized";
  subtotal: string;
  totalDiscount: string;
  totalTax: string;
  grandTotal: string;
  lineItems: Array<{
    id?: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    taxAmount: string;
    lineTotal: string;
  }>;
};

export function discountLabel(
  type: "none" | "percentage" | "fixed",
  value: string,
) {
  return type === "none"
    ? "—"
    : `${value}${type === "percentage" ? "%" : " dollars"}`;
}

export function toOutputViewModel(document: DocumentDetail): DocumentOutput {
  return {
    title: document.title || "Untitled document",
    customer: document.customer || "No customer",
    issueDate: document.issueDate,
    statusLabel: document.status === "finalized" ? "Finalized" : "Draft",
    subtotal: document.subtotal,
    totalDiscount: document.totalDiscount,
    totalTax: document.totalTax,
    grandTotal: document.grandTotal,
    lineItems: document.lineItems.map((line) => ({
      id: line.id,
      description: line.description || "—",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: discountLabel(line.discountType, line.discountValue),
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
    })),
  };
}
