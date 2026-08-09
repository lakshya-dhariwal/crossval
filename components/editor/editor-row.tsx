"use client";

import { Trash2 } from "lucide-react";
import { useState, type FocusEvent, type KeyboardEvent } from "react";
import type {
  CalculatedLineItem,
  DiscountType,
  RawLineItem,
} from "@/lib/domain/types";
import { calculateLineItem } from "@/lib/domain/calculations";
import {
  errorMessage,
  rawOf,
  type Field,
  type FieldErrors,
} from "@/components/editor/editor-types";

type EditorRowProps = {
  line: CalculatedLineItem;
  readOnly: boolean;
  lineIndex: number;
  fieldErrors: FieldErrors;
  onChange: (line: CalculatedLineItem, raw: RawLineItem) => void;
  onReset: (line: CalculatedLineItem, field: keyof RawLineItem) => void;
  onAdd: () => Promise<void>;
  onRemove: () => void | Promise<void>;
};

export function EditorRow({
  line,
  readOnly,
  lineIndex,
  fieldErrors,
  onChange,
  onReset,
  onAdd,
  onRemove,
}: EditorRowProps) {
  const draft = rawOf(line);
  const [localError, setLocalError] = useState("");

  function update(next: RawLineItem) {
    try {
      calculateLineItem(next);
      setLocalError("");
    } catch (cause) {
      setLocalError(errorMessage(cause, "Check this value before saving."));
    }
    onChange(line, next);
  }

  function set(field: Field, value: string) {
    update({ ...draft, [field]: value });
  }

  function setNumeric(field: Field, value: string, wholeNumber = false) {
    const pattern = wholeNumber ? /^\d*$/ : /^\d*(?:\.\d*)?$/;
    if (pattern.test(value)) set(field, value);
  }

  function key(event: KeyboardEvent<HTMLInputElement>, field: Field) {
    if (event.key === "Escape") {
      event.preventDefault();
      setLocalError("");
      onReset(line, field);
      event.currentTarget.blur();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    try {
      calculateLineItem(draft);
      setLocalError("");
    } catch (cause) {
      setLocalError(errorMessage(cause, "Check this value before saving."));
      return;
    }
    if (event.shiftKey) {
      void onAdd();
      return;
    }
    if (field === "unitPrice") {
      document
        .querySelector<HTMLElement>(`[data-cell="${line.id}:discountType"]`)
        ?.focus();
      return;
    }
    const next = (
      {
        description: "quantity",
        quantity: "unitPrice",
        discountValue: "taxPercent",
      } as Partial<Record<Field, Field>>
    )[field];
    const target = next
      ? document.querySelector<HTMLElement>(`[data-cell="${line.id}:${next}"]`)
      : document.querySelector<HTMLElement>(
          `[data-line-index="${lineIndex + 1}"][data-field="description"]`,
        );
    target?.focus();
  }

  function discountTypeKey(event: KeyboardEvent<HTMLSelectElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onReset(line, "discountType");
      event.currentTarget.blur();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) {
      void onAdd();
      return;
    }
    const nextField =
      draft.discountType === "none" ? "taxPercent" : "discountValue";
    document
      .querySelector<HTMLElement>(`[data-cell="${line.id}:${nextField}"]`)
      ?.focus();
  }

  const errorId = `line-${line.id}-error`;
  const errorFor = (field: Field) =>
    fieldErrors[`lineItems.${lineIndex}.${field}`]?.[0] ??
    fieldErrors[field]?.[0] ??
    "";
  const propsFor = (field: Field) => {
    const message = errorFor(field) || localError;
    return {
      "aria-invalid": Boolean(message),
      "aria-describedby": message ? errorId : undefined,
      className: `cell-input${message ? " input-invalid" : ""}`,
    };
  };
  const focusNumber = (event: FocusEvent<HTMLInputElement>) =>
    event.currentTarget.select();
  const descriptionProps = propsFor("description");
  const quantityProps = propsFor("quantity");
  const unitPriceProps = propsFor("unitPrice");
  const discountProps = propsFor("discountValue");
  const taxProps = propsFor("taxPercent");
  const rowError =
    (
      [
        "description",
        "quantity",
        "unitPrice",
        "discountValue",
        "taxPercent",
      ] as Field[]
    )
      .map(errorFor)
      .find(Boolean) || localError;

  return (
    <tr>
      <td className="numeric">{line.position}</td>
      <td>
        <input
          data-cell={`${line.id}:description`}
          data-line-index={lineIndex}
          data-field="description"
          {...descriptionProps}
          value={draft.description}
          disabled={readOnly}
          onChange={(event) => set("description", event.target.value)}
          onKeyDown={(event) => key(event, "description")}
          aria-label={`Line ${line.position} description`}
        />
        {rowError && (
          <span className="sr-only" id={errorId} role="alert">
            {rowError}
          </span>
        )}
      </td>
      <td>
        <input
          data-cell={`${line.id}:quantity`}
          {...quantityProps}
          className={`${quantityProps.className} numeric`}
          type="number"
          min="1"
          step="1"
          value={draft.quantity}
          disabled={readOnly}
          inputMode="numeric"
          onFocus={focusNumber}
          onChange={(event) => setNumeric("quantity", event.target.value, true)}
          onKeyDown={(event) => key(event, "quantity")}
          aria-label={`Line ${line.position} quantity`}
        />
      </td>
      <td>
        <input
          data-cell={`${line.id}:unitPrice`}
          {...unitPriceProps}
          className={`${unitPriceProps.className} numeric no-stepper`}
          type="number"
          min="0"
          step="any"
          value={draft.unitPrice}
          disabled={readOnly}
          inputMode="decimal"
          onFocus={focusNumber}
          onChange={(event) => setNumeric("unitPrice", event.target.value)}
          onKeyDown={(event) => key(event, "unitPrice")}
          aria-label={`Line ${line.position} unit price`}
        />
      </td>
      <td>
        <div className="discount-editor">
          <input
            data-cell={`${line.id}:discountValue`}
            {...discountProps}
            className={`${discountProps.className} numeric no-stepper`}
            type="number"
            min="0"
            step="any"
            value={draft.discountType === "none" ? "0" : draft.discountValue}
            disabled={readOnly || draft.discountType === "none"}
            inputMode="decimal"
            onFocus={focusNumber}
            onChange={(event) =>
              setNumeric("discountValue", event.target.value)
            }
            onKeyDown={(event) => key(event, "discountValue")}
            aria-label={`Line ${line.position} discount value`}
          />
          <select
            data-cell={`${line.id}:discountType`}
            className={`discount-select${errorFor("discountValue") ? " input-invalid" : ""}`}
            value={draft.discountType}
            disabled={readOnly}
            onChange={(event) => {
              const discountType = event.target.value as DiscountType;
              update({
                ...draft,
                discountType,
                discountValue: "0",
              });
            }}
            onKeyDown={discountTypeKey}
            aria-label={`Line ${line.position} discount type`}
            aria-invalid={Boolean(errorFor("discountValue"))}
            aria-describedby={errorFor("discountValue") ? errorId : undefined}
          >
            <option value="none">None</option>
            <option value="percentage">%</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
      </td>
      <td>
        <input
          data-cell={`${line.id}:taxPercent`}
          {...taxProps}
          className={`${taxProps.className} numeric`}
          type="number"
          min="0"
          max="100"
          step="0.0001"
          value={draft.taxPercent}
          disabled={readOnly}
          inputMode="decimal"
          onFocus={focusNumber}
          onChange={(event) => set("taxPercent", event.target.value)}
          onKeyDown={(event) => key(event, "taxPercent")}
          aria-label={`Line ${line.position} tax percent`}
        />
      </td>
      <td className="readonly-cell numeric">${line.subtotal}</td>
      <td className="readonly-cell numeric">−${line.discountAmount}</td>
      <td className="readonly-cell numeric">${line.taxAmount}</td>
      <td className="readonly-cell numeric">
        <strong>${line.lineTotal}</strong>
      </td>
      {!readOnly && (
        <td>
          <button
            className="icon-button"
            type="button"
            onClick={() => void onRemove()}
            aria-label={`Remove line ${line.position}`}
          >
            <Trash2 size={15} />
          </button>
        </td>
      )}
    </tr>
  );
}
