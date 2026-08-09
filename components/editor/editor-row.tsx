"use client";

import { Trash2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
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
  onSave: (line: CalculatedLineItem, raw: RawLineItem) => Promise<void>;
  onAdd: () => Promise<void>;
  onRemove: () => void | Promise<void>;
};

export function EditorRow({
  line,
  readOnly,
  lineIndex,
  fieldErrors,
  onSave,
  onAdd,
  onRemove,
}: EditorRowProps) {
  const initialRaw = rawOf(line);
  const [draft, setDraft] = useState(initialRaw);
  const [localError, setLocalError] = useState("");
  const draftRef = useRef(initialRaw);
  const serverKey = JSON.stringify(initialRaw);
  const lastServerKey = useRef(serverKey);
  const dirty = useRef(false);
  const editSequence = useRef(0);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (serverKey !== lastServerKey.current && !dirty.current) {
      const next = rawOf(line);
      draftRef.current = next;
      setDraft(next);
    }
    lastServerKey.current = serverKey;
  }, [line, serverKey]);

  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    [],
  );

  function set(field: Field, value: string) {
    dirty.current = true;
    setLocalError("");
    const next = { ...draftRef.current, [field]: value };
    draftRef.current = next;
    setDraft(next);
  }

  async function commit() {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    if (readOnly || !dirty.current) return true;
    const sequence = ++editSequence.current;
    const next = draftRef.current;
    dirty.current = false;
    try {
      calculateLineItem(next);
      setLocalError("");
      await onSave(line, next);
      if (sequence === editSequence.current) dirty.current = false;
      return true;
    } catch (cause) {
      if (sequence === editSequence.current) {
        dirty.current = true;
        setLocalError(errorMessage(cause, "Check this value before saving."));
      }
      return false;
    }
  }

  function scheduleCommit() {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      void commit();
    }, 500);
  }

  function key(event: KeyboardEvent<HTMLInputElement>, field: Field) {
    if (event.key === "Escape") {
      event.preventDefault();
      dirty.current = false;
      const next = rawOf(line);
      draftRef.current = next;
      setDraft(next);
      setLocalError("");
      event.currentTarget.blur();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    try {
      calculateLineItem(draftRef.current);
      setLocalError("");
    } catch (cause) {
      setLocalError(errorMessage(cause, "Check this value before saving."));
      return;
    }
    void commit();
    if (event.shiftKey) {
      void onAdd();
      return;
    }
    const fields: Field[] = [
      "description",
      "quantity",
      "unitPrice",
      "discountValue",
      "taxPercent",
    ];
    const next = fields[fields.indexOf(field) + 1];
    if (next)
      document
        .querySelector<HTMLInputElement>(`[data-cell="${line.id}:${next}"]`)
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
          {...descriptionProps}
          value={draft.description}
          disabled={readOnly}
          onChange={(event) => set("description", event.target.value)}
          onBlur={() => void commit()}
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
          step="0.0001"
          value={draft.quantity}
          disabled={readOnly}
          inputMode="decimal"
          onFocus={focusNumber}
          onChange={(event) => {
            set("quantity", event.target.value);
            scheduleCommit();
          }}
          onBlur={() => void commit()}
          onKeyDown={(event) => key(event, "quantity")}
          aria-label={`Line ${line.position} quantity`}
        />
      </td>
      <td>
        <input
          data-cell={`${line.id}:unitPrice`}
          {...unitPriceProps}
          className={`${unitPriceProps.className} numeric`}
          type="number"
          min="0"
          step="0.0001"
          value={draft.unitPrice}
          disabled={readOnly}
          inputMode="decimal"
          onFocus={focusNumber}
          onChange={(event) => {
            set("unitPrice", event.target.value);
            scheduleCommit();
          }}
          onBlur={() => void commit()}
          onKeyDown={(event) => key(event, "unitPrice")}
          aria-label={`Line ${line.position} unit price`}
        />
      </td>
      <td>
        <div className="discount-editor">
          <input
            data-cell={`${line.id}:discountValue`}
            {...discountProps}
            className={`${discountProps.className} numeric`}
            type="number"
            min="0"
            step="0.0001"
            value={draft.discountType === "none" ? "0" : draft.discountValue}
            disabled={readOnly || draft.discountType === "none"}
            inputMode="decimal"
            onFocus={focusNumber}
            onChange={(event) => {
              set("discountValue", event.target.value);
              scheduleCommit();
            }}
            onBlur={() => void commit()}
            onKeyDown={(event) => key(event, "discountValue")}
            aria-label={`Line ${line.position} discount value`}
          />
          <select
            className={`discount-select${errorFor("discountValue") ? " input-invalid" : ""}`}
            value={draft.discountType}
            disabled={readOnly}
            onChange={(event) => {
              const discountType = event.target.value as DiscountType;
              dirty.current = true;
              const next = {
                ...draftRef.current,
                discountType,
                discountValue:
                  discountType === "none"
                    ? "0"
                    : draftRef.current.discountValue,
              };
              draftRef.current = next;
              setDraft(next);
              scheduleCommit();
            }}
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
          onChange={(event) => {
            set("taxPercent", event.target.value);
            scheduleCommit();
          }}
          onBlur={() => void commit()}
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
