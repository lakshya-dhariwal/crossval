export type DocumentStatus = "draft" | "finalized";
export type DiscountType = "none" | "percentage" | "fixed";

export type RawLineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxPercent: string;
};

export type CalculatedLineItem = RawLineItem & {
  id?: string;
  position?: number;
  subtotal: string;
  discountAmount: string;
  discountedAmount: string;
  taxAmount: string;
  lineTotal: string;
};

export type DocumentTotals = {
  subtotal: string;
  totalDiscount: string;
  totalTax: string;
  grandTotal: string;
};
export type DocumentDetail = DocumentTotals & {
  id: string;
  title: string;
  customer: string;
  issueDate: string;
  status: DocumentStatus;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  lineItems: CalculatedLineItem[];
  itemCount: number;
};

export type DocumentSummary = Pick<
  DocumentDetail,
  | "id"
  | "title"
  | "customer"
  | "issueDate"
  | "status"
  | "grandTotal"
  | "updatedAt"
> & { itemCount: number };
