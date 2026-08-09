import { z } from "zod";
import type { DiscountType } from "./types";

const decimal = (scale: number, message = "Enter a valid decimal value.") =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`), message);
const nonNegative = (scale: number) =>
  decimal(scale).refine(
    (value) => !value.startsWith("-"),
    "Value cannot be negative.",
  );
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid issue date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Use a valid issue date.");
const lineInputFields = {
  description: z.string().max(500),
  quantity: decimal(4, "Quantity must be a decimal with up to 4 places."),
  unitPrice: nonNegative(4),
  discountType: z.enum(["none", "percentage", "fixed"]),
  discountValue: nonNegative(4),
  taxPercent: nonNegative(4),
};

const refineLineInput = (
  value: {
    quantity: string;
    unitPrice: string;
    discountType: DiscountType;
    discountValue: string;
    taxPercent: string;
  },
  ctx: z.RefinementCtx,
) => {
  if (Number(value.quantity) < 1)
    ctx.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Quantity must be at least 1.",
    });
  if (Number(value.quantity) > 999999999)
    ctx.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Quantity is too large.",
    });
  if (Number(value.unitPrice) > 999999999999)
    ctx.addIssue({
      code: "custom",
      path: ["unitPrice"],
      message: "Unit price is too large.",
    });
  if (Number(value.taxPercent) > 100)
    ctx.addIssue({
      code: "custom",
      path: ["taxPercent"],
      message: "Tax must be between 0 and 100.",
    });
  if (value.discountType === "none" && value.discountValue !== "0")
    ctx.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "A line without a discount must use 0.",
    });
  if (value.discountType === "percentage" && Number(value.discountValue) > 100)
    ctx.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Discount must be between 0 and 100.",
    });
  if (
    value.discountType === "fixed" &&
    value.discountValue.split(".")[1]?.length > 2
  )
    ctx.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Fixed discounts support up to 2 decimal places.",
    });
};

export const lineInputSchema = z
  .object(lineInputFields)
  .strict()
  .superRefine(refineLineInput);

export const finalizeDocumentSchema = z
  .object({
    title: z.string().max(240),
    customer: z.string().max(240),
    issueDate: dateOnly,
    version: z.number().int().positive(),
    lineItems: z
      .array(
        z
          .object({ id: z.string().uuid(), ...lineInputFields })
          .strict()
          .superRefine(refineLineInput),
      )
      .min(1, "Add at least one line item."),
  })
  .strict();
export const metadataSchema = z
  .object({
    title: z.string().max(240),
    customer: z.string().max(240),
    issueDate: dateOnly,
    version: z.number().int().positive(),
  })
  .strict();
export const patchMetadataSchema = z
  .object({
    title: z.string().max(240).optional(),
    customer: z.string().max(240).optional(),
    issueDate: dateOnly.optional(),
    version: z.number().int().positive(),
  })
  .strict();
export const createDocumentSchema = z
  .object({
    title: z.string().max(240).optional(),
    customer: z.string().max(240).optional(),
    issueDate: dateOnly.optional(),
  })
  .strict();
export const documentQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(["all", "draft", "finalized"]).default("all"),
});
export const reportQuerySchema = z
  .object({
    from: dateOnly,
    to: dateOnly,
  })
  .refine((value) => value.from <= value.to, {
    path: ["to"],
    message: "The start date must be on or before the end date.",
  });
export type LineInput = z.infer<typeof lineInputSchema> & {
  discountType: DiscountType;
};
export type FinalizeDocumentInput = z.infer<typeof finalizeDocumentSchema>;
