"use client";

import Link from "next/link";
import {
  ChevronDown,
  Copy,
  FileDown,
  LoaderCircle,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { DocumentDetail } from "@/lib/domain/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditorRow } from "@/components/editor/editor-row";
import { money } from "@/components/editor/editor-types";
import { useEditor } from "@/components/editor/use-editor";

export function DocumentEditor({ initial }: { initial: DocumentDetail }) {
  const editor = useEditor(initial);
  const { doc, metadata, fieldErrors } = editor;

  return (
    <div className="editor-page">
      <div className="editor-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="breadcrumbs">
            <Link href="/documents">Documents</Link> <span>/</span>{" "}
            {doc.title || "Untitled document"}
          </div>
          {doc.status === "finalized" ? (
            <h1>{doc.title || "Untitled document"}</h1>
          ) : (
            <>
              <div className="title-row">
                <input
                  className={`title-input${fieldErrors.title?.length ? " input-invalid" : ""}`}
                  aria-label="Document title"
                  aria-describedby={
                    fieldErrors.title?.length ? "title-error" : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.title?.length)}
                  value={metadata.title}
                  onChange={(event) =>
                    editor.saveMeta({ title: event.target.value })
                  }
                  onBlur={() => void editor.commitMeta()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </div>
              <p
                className="field-error title-error"
                id="title-error"
                role={fieldErrors.title?.length ? "alert" : undefined}
              >
                {fieldErrors.title?.[0] ?? "\u00a0"}
              </p>
            </>
          )}
          <div className="meta-row">
            <label className="meta-field">
              <span className="meta-label">
                Customer{" "}
                <span className="required-marker" aria-hidden="true">
                  *
                </span>
              </span>
              {doc.status === "finalized" ? (
                <strong>{doc.customer || "—"}</strong>
              ) : (
                <>
                  <input
                    className={`meta-input${fieldErrors.customer?.length ? " input-invalid" : ""}`}
                    aria-label="Customer"
                    aria-describedby="customer-error"
                    aria-invalid={Boolean(fieldErrors.customer?.length)}
                    value={metadata.customer}
                    onChange={(event) =>
                      editor.saveMeta({ customer: event.target.value })
                    }
                    onBlur={() => void editor.commitMeta()}
                  />
                  <span
                    className="field-error"
                    id="customer-error"
                    role={fieldErrors.customer?.length ? "alert" : undefined}
                  >
                    {fieldErrors.customer?.[0] ?? "\u00a0"}
                  </span>
                </>
              )}
            </label>
            <label className="meta-field">
              <span className="meta-label">Issue date</span>
              {doc.status === "finalized" ? (
                <strong>{doc.issueDate}</strong>
              ) : (
                <>
                  <input
                    className="meta-input"
                    type="date"
                    aria-label="Issue date"
                    aria-describedby="issue-date-error"
                    aria-invalid={Boolean(fieldErrors.issueDate?.length)}
                    value={metadata.issueDate}
                    onChange={(event) =>
                      editor.saveMeta({ issueDate: event.target.value })
                    }
                    onBlur={() => void editor.commitMeta()}
                  />
                  <span
                    className="field-error"
                    id="issue-date-error"
                    role={fieldErrors.issueDate?.length ? "alert" : undefined}
                  >
                    {fieldErrors.issueDate?.[0] ?? "\u00a0"}
                  </span>
                </>
              )}
            </label>
            <div className="meta-field">
              <span className="meta-label">Status</span>
              <span className={`status ${doc.status}`}>
                {doc.status === "finalized" ? "Final" : "Draft"}
              </span>
            </div>
          </div>
        </div>
        <div className="editor-actions">
          <span
            className={`save-state${editor.error ? " needs-attention" : ""}`}
            aria-live="polite"
          >
            {editor.saving && (
              <LoaderCircle size={14} className="spin" aria-hidden="true" />
            )}
            {editor.saveState}
          </span>
          <div className="menu-wrap">
            <button
              className="button actions-button"
              type="button"
              onClick={() => editor.setMenu((open) => !open)}
              aria-expanded={editor.menu}
              aria-haspopup="menu"
            >
              Actions <ChevronDown size={14} />
            </button>
            {editor.menu && (
              <div className="menu" role="menu">
                {doc.status === "finalized" && (
                  <>
                    <Link
                      className="menu-item"
                      role="menuitem"
                      href={`/documents/${doc.id}/print`}
                      onClick={() => editor.setMenu(false)}
                    >
                      <Printer size={15} /> Print / PDF
                    </Link>
                    <a
                      className="menu-item"
                      role="menuitem"
                      href={`/api/documents/${doc.id}/export/html`}
                      onClick={() => editor.setMenu(false)}
                    >
                      <FileDown size={15} /> Export HTML
                    </a>
                    <button
                      className="menu-item"
                      role="menuitem"
                      type="button"
                      onClick={editor.revertToDraft}
                    >
                      <RotateCcw size={15} /> Change to draft
                    </button>
                  </>
                )}
                <button
                  className="menu-item"
                  role="menuitem"
                  type="button"
                  onClick={editor.duplicate}
                >
                  <Copy size={15} /> Use as template
                </button>
                <button
                  className="menu-item"
                  role="menuitem"
                  type="button"
                  onClick={() => editor.setDeleteRequested(true)}
                >
                  <Trash2 size={15} /> Delete document
                </button>
              </div>
            )}
          </div>
          {doc.status === "draft" ? (
            <button
              className="button primary"
              type="button"
              disabled={editor.working || editor.isSaving || editor.pendingMeta}
              onClick={() => editor.setConfirm(true)}
            >
              Publish
            </button>
          ) : (
            <span className="status finalized">Final</span>
          )}
        </div>
      </div>

      <div className="editor-content">
        <section className="surface editor-surface">
          <div className="grid-scroll">
            <table className="editor-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Discount</th>
                  <th>Tax</th>
                  <th>Subtotal</th>
                  <th>Discount</th>
                  <th>Tax amount</th>
                  <th>Line total</th>
                  {doc.status === "draft" && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {doc.lineItems.map((line, index) => (
                  <EditorRow
                    key={line.id}
                    line={line}
                    readOnly={doc.status === "finalized"}
                    lineIndex={index}
                    fieldErrors={fieldErrors}
                    onSave={editor.saveLine}
                    onAdd={() => editor.addLine(line.id)}
                    onRemove={() => editor.setRemoveTarget(line)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {doc.status === "draft" && (
            <div className="add-line">
              <button
                data-action="add-line"
                className="button ghost small"
                type="button"
                disabled={editor.working}
                onClick={() => void editor.addLine()}
              >
                <Plus size={15} /> Add line item
              </button>
            </div>
          )}
        </section>
        <section className="surface totals" aria-label="Document totals">
          <div className="total-line">
            <span>Subtotal</span>
            <strong className="numeric">{money(doc.subtotal)}</strong>
          </div>
          <div className="total-line discount">
            <span>Discount</span>
            <strong className="numeric">−{money(doc.totalDiscount)}</strong>
          </div>
          <div className="total-line">
            <span>Tax</span>
            <strong className="numeric">{money(doc.totalTax)}</strong>
          </div>
          <div className="total-line total-grand">
            <span>Grand total</span>
            <strong className="numeric">{money(doc.grandTotal)}</strong>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={editor.confirm}
        title="Publish this document?"
        description="Publishing makes the document read-only until you change it back to a draft. You can still print it or use it as a template."
        confirmLabel="Publish document"
        pending={editor.working || editor.isSaving || editor.pendingMeta}
        onCancel={() => editor.setConfirm(false)}
        onConfirm={() => void editor.finalize()}
      />
      <ConfirmDialog
        open={Boolean(editor.removeTarget)}
        title="Remove this line item?"
        description="This line item and its calculated amounts will be removed from the document."
        confirmLabel="Remove line item"
        danger
        pending={editor.working}
        onCancel={() => editor.setRemoveTarget(null)}
        onConfirm={() => {
          if (editor.removeTarget) void editor.removeLine(editor.removeTarget);
        }}
      />
      <ConfirmDialog
        open={editor.deleteRequested}
        title="Delete this document?"
        description="This permanently removes the document and all of its line items. This cannot be undone."
        confirmLabel="Delete document"
        danger
        pending={editor.working}
        onCancel={() => editor.setDeleteRequested(false)}
        onConfirm={() => void editor.deleteCurrentDocument()}
      />
    </div>
  );
}
