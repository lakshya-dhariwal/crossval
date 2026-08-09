"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, FileDown, LoaderCircle, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import type { CalculatedLineItem, DocumentDetail, DiscountType, RawLineItem } from "@/lib/domain/types";
import { calculateLineItem } from "@/lib/domain/calculations";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Field = "description" | "quantity" | "unitPrice" | "discountValue" | "taxPercent";
type Metadata = Pick<DocumentDetail, "title" | "customer" | "issueDate">;
type FieldErrors = Record<string, string[]>;

const money = (value: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
const rawOf = (line: CalculatedLineItem): RawLineItem => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountType: line.discountType, discountValue: line.discountValue, taxPercent: line.taxPercent });
const errorMessage = (value: unknown, fallback: string) => value instanceof Error ? value.message : fallback;

export function DocumentEditor({ initial }: { initial: DocumentDetail }) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(initial);
  const [metadata, setMetadata] = useState<Metadata>({ title: initial.title, customer: initial.customer, issueDate: initial.issueDate });
  const metadataRef = useRef(metadata);
  const [pendingMeta, setPendingMeta] = useState(false);
  const [savingCount, setSavingCount] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CalculatedLineItem | null>(null);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const metadataSequence = useRef(0);
  const metadataDirty = useRef(false);
  const mutationQueue = useRef(Promise.resolve());
  const addLineButton = useRef<HTMLButtonElement | null>(null);
  const isSaving = savingCount > 0;

  function reportError(message: string) {
    setError(message);
    toast.error(message);
  }

  function reconcile(next: DocumentDetail, preserveMetadata = false) {
    docRef.current = next;
    setDoc(next);
    if (!preserveMetadata) {
      const nextMetadata = { title: next.title, customer: next.customer, issueDate: next.issueDate };
      metadataRef.current = nextMetadata;
      setMetadata(nextMetadata);
    }
  }

  function enqueue<T>(task: (current: DocumentDetail) => Promise<T>, showSaving = true) {
    if (showSaving) setSavingCount((count) => count + 1);
    const queued = mutationQueue.current.then(() => task(docRef.current));
    mutationQueue.current = queued.then(() => undefined, () => undefined);
    if (showSaving) void queued.then(() => setSavingCount((count) => Math.max(0, count - 1)), () => setSavingCount((count) => Math.max(0, count - 1)));
    return queued;
  }

  async function refreshAfterConflict() {
    const latest = await fetch(`/api/documents/${docRef.current.id}`);
    if (latest.ok) reconcile((await latest.json()).data);
  }

  function saveMeta(next: Partial<Metadata>) {
    const values = { ...metadataRef.current, ...next };
    metadataRef.current = values;
    setMetadata(values);
    metadataDirty.current = true;
    setPendingMeta(true);
    setFieldErrors((current) => ({ ...current, title: [], customer: [], issueDate: [] }));
  }

  async function commitMeta() {
    if (!metadataDirty.current) return;
    metadataDirty.current = false;
    const values = metadataRef.current;
    const sequence = ++metadataSequence.current;
    try {
      await enqueue(async (current) => {
        const response = await fetch(`/api/documents/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, version: current.version }) });
        const json = await response.json().catch(() => null) as { data?: DocumentDetail; error?: { message?: string; fields?: FieldErrors } } | null;
        if (!response.ok) {
          if (response.status === 409) await refreshAfterConflict();
          setFieldErrors(json?.error?.fields ?? {});
          throw new Error(json?.error?.message ?? "Could not save this change.");
        }
        if (sequence === metadataSequence.current) {
          setPendingMeta(false);
          setError("");
          if (json?.data) reconcile(json.data);
        } else if (json?.data) reconcile(json.data, true);
      });
    } catch (cause) {
      setPendingMeta(false);
      reportError(errorMessage(cause, "Could not save this change."));
    }
  }

  function focusFirstInvalid(fields: FieldErrors) {
    const first = Object.keys(fields).find((key) => fields[key]?.length);
    if (!first) return;
    window.setTimeout(() => {
      let target: HTMLInputElement | null = null;
      if (first === "title") target = document.querySelector<HTMLInputElement>('[aria-label="Document title"]');
      else if (first === "customer") target = document.querySelector<HTMLInputElement>('[aria-label="Customer"]');
      else if (first === "issueDate") target = document.querySelector<HTMLInputElement>('[aria-label="Issue date"]');
      else {
        const match = first.match(/^lineItems\.(\d+)(?:\.(\w+))?$/);
        if (match) {
          const line = docRef.current.lineItems[Number(match[1])];
          const field = match[2] ?? "description";
          if (line?.id) target = document.querySelector<HTMLInputElement>(`[data-cell="${line.id}:${field}"]`);
        }
      }
      target?.focus();
    }, 0);
  }

  async function saveLine(line: CalculatedLineItem, raw: RawLineItem) {
    if (docRef.current.status === "finalized") return;
    const preview = calculateLineItem(raw);
    setDoc((current) => ({ ...current, lineItems: current.lineItems.map((item) => item.id === line.id ? { ...preview, id: line.id, position: line.position } : item) }));
    await enqueue(async (current) => {
      const currentLine = current.lineItems.find((item) => item.id === line.id);
      if (!currentLine) throw new Error("Line item no longer exists.");
      const response = await fetch(`/api/documents/${current.id}/line-items/${line.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...raw, version: current.version }) });
      const json = await response.json().catch(() => null) as { data?: DocumentDetail; error?: { message?: string; fields?: FieldErrors } } | null;
      if (!response.ok) {
        if (response.status === 409) await refreshAfterConflict();
        setFieldErrors(json?.error?.fields ?? {});
        throw new Error(json?.error?.message ?? "Could not save line item.");
      }
      setError("");
      if (json?.data) reconcile(json.data);
    }).catch((cause) => { reportError(errorMessage(cause, "Could not save line item.")); throw cause; });
  }

  async function addLine(after?: string) {
    if (docRef.current.status === "finalized") return;
    setError("");
    try {
      const next = await enqueue(async (current) => {
        const response = await fetch(`/api/documents/${current.id}/line-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: "", quantity: "1", unitPrice: "0", discountType: "none", discountValue: "0", taxPercent: "0", afterLineItemId: after }) });
        const json = await response.json().catch(() => null) as { data?: DocumentDetail; error?: { message?: string } } | null;
        if (!response.ok || !json?.data) throw new Error(json?.error?.message ?? "Could not add a line item.");
        reconcile(json.data);
        return json.data;
      }, false);
      const position = after ? (next.lineItems.find((item) => item.id === after)?.position ?? next.lineItems.length - 1) + 1 : next.lineItems.length;
      const target = next.lineItems.find((item) => item.position === position);
      window.setTimeout(() => target && document.querySelector<HTMLInputElement>(`[data-cell="${target.id}:description"]`)?.focus(), 80);
    } catch (cause) { reportError(errorMessage(cause, "Could not add a line item.")); }
  }

  async function removeLine(line: CalculatedLineItem) {
    const linePosition = line.position ?? 1;
    const fallbackPosition = linePosition > 1 ? linePosition - 1 : 1;
    setRemoveTarget(null);
    setWorking(true); setError("");
    try {
      const next = await enqueue(async (current) => {
        const response = await fetch(`/api/documents/${current.id}/line-items/${line.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: current.version }) });
        if (!response.ok) { const json = await response.json().catch(() => null); throw new Error(json?.error?.message ?? "Could not remove this line item."); }
        const latest = await fetch(`/api/documents/${current.id}`);
        if (!latest.ok) throw new Error("The document could not be refreshed.");
        const data = (await latest.json()).data as DocumentDetail;
        reconcile(data);
        return data;
      });
      const target = next.lineItems.find((item) => item.position === fallbackPosition) ?? next.lineItems[next.lineItems.length - 1];
      window.setTimeout(() => target ? document.querySelector<HTMLInputElement>(`[data-cell="${target.id}:description"]`)?.focus() : addLineButton.current?.focus(), 80);
    } catch (cause) { reportError(errorMessage(cause, "Could not remove this line item.")); }
    finally { setWorking(false); }
  }

  async function finalize() {
    setWorking(true); setError(""); setFieldErrors({});
    try {
      const next = await enqueue(async (current) => {
        const response = await fetch(`/api/documents/${current.id}/finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: current.version }) });
        const json = await response.json().catch(() => null) as { data?: DocumentDetail; error?: { message?: string; fields?: FieldErrors } } | null;
        if (!response.ok) {
          const fields = json?.error?.fields ?? {};
          setFieldErrors(fields);
          if (response.status === 422) {
            setConfirm(false);
            focusFirstInvalid(fields);
          }
          throw new Error(json?.error?.message ?? "Complete the document before finalizing.");
        }
        if (!json?.data) throw new Error("The document could not be finalized.");
        return json.data;
      });
      reconcile(next); setConfirm(false);
    } catch (cause) { reportError(errorMessage(cause, "Complete the document before finalizing.")); }
    finally { setWorking(false); }
  }

  async function duplicate() {
    setWorking(true); setMenu(false);
    try {
      const response = await fetch(`/api/documents/${docRef.current.id}/duplicate`, { method: "POST" });
      const json = await response.json().catch(() => null) as { data?: { id: string }; error?: { message?: string } } | null;
      if (!response.ok || !json?.data) throw new Error(json?.error?.message ?? "Could not create a template copy.");
      router.push(`/documents/${json.data.id}`);
    } catch (cause) { reportError(errorMessage(cause, "Could not create a template copy.")); }
    finally { setWorking(false); }
  }

  async function revertToDraft() {
    setWorking(true); setMenu(false); setError("");
    try {
      const response = await fetch(`/api/documents/${docRef.current.id}/revert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: docRef.current.version }) });
      const json = await response.json().catch(() => null) as { data?: DocumentDetail; error?: { message?: string } } | null;
      if (!response.ok || !json?.data) throw new Error(json?.error?.message ?? "Could not change the document back to a draft.");
      reconcile(json.data);
      toast.success("Document changed to draft.");
    } catch (cause) { reportError(errorMessage(cause, "Could not change the document back to a draft.")); }
    finally { setWorking(false); }
  }

  async function deleteCurrentDocument() {
    setDeleteRequested(false); setWorking(true); setMenu(false); setError("");
    try {
      const response = await fetch(`/api/documents/${docRef.current.id}`, { method: "DELETE" });
      if (!response.ok) { const json = await response.json().catch(() => null) as { error?: { message?: string } } | null; throw new Error(json?.error?.message ?? "Could not delete this document."); }
      router.push("/documents");
    } catch (cause) { reportError(errorMessage(cause, "Could not delete this document.")); setWorking(false); }
  }

  const saving = isSaving || pendingMeta;
  const saveState = saving ? "Saving" : error ? "Needs attention" : "Saved";
  return <div className="editor-page">
    <div className="editor-header">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="breadcrumbs"><Link href="/documents">Documents</Link> <span>/</span> {doc.title || "Untitled document"}</div>
        {doc.status === "finalized" ? <h1>{doc.title || "Untitled document"}</h1> : <><div className="title-row"><input className={`title-input${fieldErrors.title?.length ? " input-invalid" : ""}`} aria-label="Document title" aria-describedby={fieldErrors.title?.length ? "title-error" : undefined} aria-invalid={Boolean(fieldErrors.title?.length)} value={metadata.title} onChange={(event) => saveMeta({ title: event.target.value })} onBlur={() => void commitMeta()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />{fieldErrors.title?.[0] && <p className="field-error" id="title-error" role="alert">{fieldErrors.title[0]}</p>}</div></>}
        <div className="meta-row">
          <label className="meta-field"><span className="meta-label">Customer <span className="required-marker" aria-hidden="true">*</span></span>{doc.status === "finalized" ? <strong>{doc.customer || "—"}</strong> : <><input className={`meta-input${fieldErrors.customer?.length ? " input-invalid" : ""}`} aria-label="Customer" aria-describedby={fieldErrors.customer?.length ? "customer-error" : undefined} aria-invalid={Boolean(fieldErrors.customer?.length)} value={metadata.customer} onChange={(event) => saveMeta({ customer: event.target.value })} onBlur={() => void commitMeta()} />{fieldErrors.customer?.[0] && <span className="field-error" id="customer-error" role="alert">{fieldErrors.customer[0]}</span>}</>}</label>
          <label className="meta-field"><span className="meta-label">Issue date</span>{doc.status === "finalized" ? <strong>{doc.issueDate}</strong> : <input className="meta-input" type="date" aria-label="Issue date" aria-describedby={fieldErrors.issueDate?.length ? "issue-date-error" : undefined} aria-invalid={Boolean(fieldErrors.issueDate?.length)} value={metadata.issueDate} onChange={(event) => saveMeta({ issueDate: event.target.value })} onBlur={() => void commitMeta()} />}{fieldErrors.issueDate?.[0] && <span className="field-error" id="issue-date-error" role="alert">{fieldErrors.issueDate[0]}</span>}</label>
          <div className="meta-field"><span className="meta-label">Status</span><span className={`status ${doc.status}`}>{doc.status === "finalized" ? "Final" : "Draft"}</span></div>
        </div>
      </div>
      <div className="editor-actions"><span className={`save-state${error ? " needs-attention" : ""}`} aria-live="polite">{saving && <LoaderCircle size={14} className="spin" aria-hidden="true" />}{saveState}</span><div className="menu-wrap"><button className="button actions-button" type="button" onClick={() => setMenu((open) => !open)} aria-expanded={menu} aria-haspopup="menu">Actions <ChevronDown size={14} /></button>{menu && <div className="menu" role="menu">{doc.status === "finalized" && <><Link className="menu-item" role="menuitem" href={`/documents/${doc.id}/print`} onClick={() => setMenu(false)}><Printer size={15} /> Print / PDF</Link><a className="menu-item" role="menuitem" href={`/api/documents/${doc.id}/export/html`} onClick={() => setMenu(false)}><FileDown size={15} /> Export HTML</a><button className="menu-item" role="menuitem" type="button" onClick={revertToDraft}><RotateCcw size={15} /> Change to draft</button></>}{<button className="menu-item" role="menuitem" type="button" onClick={duplicate}><Copy size={15} /> Use as template</button>}<button className="menu-item" role="menuitem" type="button" onClick={() => setDeleteRequested(true)}><Trash2 size={15} /> Delete document</button></div>}</div>{doc.status === "draft" ? <button className="button primary" type="button" disabled={working || isSaving || pendingMeta} onClick={() => setConfirm(true)}>Publish</button> : <span className="status finalized">Final</span>}</div>
    </div>
    <div className="editor-content"><section className="surface editor-surface"><div className="grid-scroll"><table className="editor-table"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Tax</th><th>Subtotal</th><th>Discount</th><th>Tax amount</th><th>Line total</th>{doc.status === "draft" && <th aria-label="Actions" />}</tr></thead><tbody>{doc.lineItems.map((line, index) => <EditorRow key={line.id} line={line} readOnly={doc.status === "finalized"} lineIndex={index} fieldErrors={fieldErrors} onSave={saveLine} onAdd={() => addLine(line.id)} onRemove={() => setRemoveTarget(line)} />)}</tbody></table></div>{doc.status === "draft" && <div className="add-line"><button ref={addLineButton} className="button ghost small" type="button" disabled={working} onClick={() => void addLine()}><Plus size={15} /> Add line item</button></div>}</section>
      <section className="surface totals" aria-label="Document totals"><div className="total-line"><span>Subtotal</span><strong className="numeric">{money(doc.subtotal)}</strong></div><div className="total-line discount"><span>Discount</span><strong className="numeric">−{money(doc.totalDiscount)}</strong></div><div className="total-line"><span>Tax</span><strong className="numeric">{money(doc.totalTax)}</strong></div><div className="total-line total-grand"><span>Grand total</span><strong className="numeric">{money(doc.grandTotal)}</strong></div></section>
    </div>
    <ConfirmDialog open={confirm} title="Publish this document?" description="Publishing makes the document read-only until you change it back to a draft. You can still print it or use it as a template." confirmLabel="Publish document" pending={working || isSaving || pendingMeta} onCancel={() => setConfirm(false)} onConfirm={() => void finalize()} />
    <ConfirmDialog open={Boolean(removeTarget)} title="Remove this line item?" description="This line item and its calculated amounts will be removed from the document." confirmLabel="Remove line item" danger pending={working} onCancel={() => setRemoveTarget(null)} onConfirm={() => { if (removeTarget) void removeLine(removeTarget); }} />
    <ConfirmDialog open={deleteRequested} title="Delete this document?" description="This permanently removes the document and all of its line items. This cannot be undone." confirmLabel="Delete document" danger pending={working} onCancel={() => setDeleteRequested(false)} onConfirm={() => void deleteCurrentDocument()} />
  </div>;
}

function EditorRow({ line, readOnly, lineIndex, fieldErrors, onSave, onAdd, onRemove }: { line: CalculatedLineItem; readOnly: boolean; lineIndex: number; fieldErrors: FieldErrors; onSave: (line: CalculatedLineItem, raw: RawLineItem) => Promise<void>; onAdd: () => Promise<void>; onRemove: () => Promise<void> }) {
  const initialRaw = rawOf(line);
  const [draft, setDraft] = useState(initialRaw);
  const [localError, setLocalError] = useState("");
  const serverKey = JSON.stringify(initialRaw);
  const lastServerKey = useRef(serverKey);
  const dirty = useRef(false);
  const editSequence = useRef(0);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (serverKey !== lastServerKey.current && !dirty.current) setDraft(rawOf(line));
    lastServerKey.current = serverKey;
  }, [line, serverKey]);
  useEffect(() => () => { if (commitTimer.current) clearTimeout(commitTimer.current); }, []);

  function set(field: Field, value: string) {
    dirty.current = true;
    setLocalError("");
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function commit() {
    if (readOnly || !dirty.current) return true;
    const sequence = ++editSequence.current;
    const next = draft;
    dirty.current = false;
    try {
      calculateLineItem(next);
      setLocalError("");
      await onSave(line, next);
      if (sequence === editSequence.current) dirty.current = false;
      return true;
    } catch (cause) {
      if (sequence === editSequence.current) { dirty.current = true; setLocalError(errorMessage(cause, "Check this value before saving.")); }
      return false;
    }
  }

  function scheduleCommit() {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => void commit(), 500);
  }

  function key(event: KeyboardEvent<HTMLInputElement>, field: Field) {
    if (event.key === "Escape") { event.preventDefault(); dirty.current = false; setDraft(rawOf(line)); setLocalError(""); event.currentTarget.blur(); return; }
    if (event.key !== "Enter") return;
    event.preventDefault();
    try { calculateLineItem(draft); setLocalError(""); } catch (cause) { setLocalError(errorMessage(cause, "Check this value before saving.")); return; }
    void commit();
    if (event.shiftKey) { void onAdd(); return; }
    const fields: Field[] = ["description", "quantity", "unitPrice", "discountValue", "taxPercent"];
    const next = fields[fields.indexOf(field) + 1];
    if (next) document.querySelector<HTMLInputElement>(`[data-cell="${line.id}:${next}"]`)?.focus();
  }

  const errorId = `line-${line.id}-error`;
  const errorFor = (field: Field) => fieldErrors[`lineItems.${lineIndex}.${field}`]?.[0] ?? fieldErrors[field]?.[0] ?? "";
  const propsFor = (field: Field) => {
    const message = errorFor(field) || localError;
    return { "aria-invalid": Boolean(message), "aria-describedby": message ? errorId : undefined, className: `cell-input${message ? " input-invalid" : ""}` };
  };
  const focusNumber = (event: React.FocusEvent<HTMLInputElement>) => event.currentTarget.select();
  const descriptionProps = propsFor("description");
  const quantityProps = propsFor("quantity");
  const unitPriceProps = propsFor("unitPrice");
  const discountProps = propsFor("discountValue");
  const taxProps = propsFor("taxPercent");
  const rowError = (["description", "quantity", "unitPrice", "discountValue", "taxPercent"] as Field[]).map(errorFor).find(Boolean) || localError;
  return <>
    <tr><td className="numeric">{line.position}</td><td><input data-cell={`${line.id}:description`} {...descriptionProps} value={draft.description} disabled={readOnly} onChange={(event) => set("description", event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => key(event, "description")} aria-label={`Line ${line.position} description`} />{rowError && <span className="sr-only" id={errorId} role="alert">{rowError}</span>}</td><td><input data-cell={`${line.id}:quantity`} {...quantityProps} className={`${quantityProps.className} numeric`} type="number" min="1" step="0.0001" value={draft.quantity} disabled={readOnly} inputMode="decimal" onFocus={focusNumber} onChange={(event) => set("quantity", event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => key(event, "quantity")} aria-label={`Line ${line.position} quantity`} /></td><td><input data-cell={`${line.id}:unitPrice`} {...unitPriceProps} className={`${unitPriceProps.className} numeric`} type="number" min="0" step="0.0001" value={draft.unitPrice} disabled={readOnly} inputMode="decimal" onFocus={focusNumber} onChange={(event) => set("unitPrice", event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => key(event, "unitPrice")} aria-label={`Line ${line.position} unit price`} /></td><td><div className="discount-editor"><input data-cell={`${line.id}:discountValue`} {...discountProps} className={`${discountProps.className} numeric`} type="number" min="0" step="0.0001" value={draft.discountType === "none" ? "0" : draft.discountValue} disabled={readOnly || draft.discountType === "none"} inputMode="decimal" onFocus={focusNumber} onChange={(event) => set("discountValue", event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => key(event, "discountValue")} aria-label={`Line ${line.position} discount value`} /><select className={`discount-select${errorFor("discountValue") ? " input-invalid" : ""}`} value={draft.discountType} disabled={readOnly} onChange={(event) => { const discountType = event.target.value as DiscountType; dirty.current = true; setDraft((current) => ({ ...current, discountType, discountValue: discountType === "none" ? "0" : current.discountValue })); scheduleCommit(); }} aria-label={`Line ${line.position} discount type`} aria-invalid={Boolean(errorFor("discountValue"))} aria-describedby={errorFor("discountValue") ? errorId : undefined}><option value="none">None</option><option value="percentage">%</option><option value="fixed">Fixed</option></select></div></td><td><input data-cell={`${line.id}:taxPercent`} {...taxProps} className={`${taxProps.className} numeric`} type="number" min="0" max="100" step="0.0001" value={draft.taxPercent} disabled={readOnly} inputMode="decimal" onFocus={focusNumber} onChange={(event) => set("taxPercent", event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => key(event, "taxPercent")} aria-label={`Line ${line.position} tax percent`} /></td><td className="readonly-cell numeric">${line.subtotal}</td><td className="readonly-cell numeric">−${line.discountAmount}</td><td className="readonly-cell numeric">${line.taxAmount}</td><td className="readonly-cell numeric"><strong>${line.lineTotal}</strong></td>{!readOnly && <td><button className="icon-button" type="button" onClick={() => void onRemove()} aria-label={`Remove line ${line.position}`}><Trash2 size={15} /></button></td>}</tr>
  </>;
}
