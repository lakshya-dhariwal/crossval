import type {
  CalculatedLineItem,
  DocumentDetail,
  RawLineItem,
} from "@/lib/domain/types";

export type Field =
  "description" | "quantity" | "unitPrice" | "discountValue" | "taxPercent";
export type Metadata = Pick<DocumentDetail, "title" | "customer" | "issueDate">;
export type FieldErrors = Record<string, string[]>;

export const money = (value: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value),
  );

export const rawOf = (line: CalculatedLineItem): RawLineItem => ({
  description: line.description,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  discountType: line.discountType,
  discountValue: line.discountValue,
  taxPercent: line.taxPercent,
});

export const errorMessage = (value: unknown, fallback: string) =>
  value instanceof Error ? value.message : fallback;
