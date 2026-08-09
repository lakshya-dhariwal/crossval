"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type {
  CalculatedLineItem,
  DocumentDetail,
  RawLineItem,
} from "@/lib/domain/types";
import {
  calculateDocument,
  calculateLineItem,
} from "@/lib/domain/calculations";
import {
  errorMessage,
  rawOf,
  type FieldErrors,
  type Metadata,
} from "@/components/editor/editor-types";

type ApiDocumentResponse = {
  data?: DocumentDetail;
  error?: { message?: string; fields?: FieldErrors };
};

const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export function useEditor(initial: DocumentDetail) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(initial);
  const [metadata, setMetadata] = useState<Metadata>({
    title: initial.title,
    customer: initial.customer,
    issueDate: initial.issueDate,
  });
  const metadataRef = useRef(metadata);
  const metadataDirty = useRef(false);
  const dirtyLines = useRef(new Map<string, RawLineItem>());
  const [metadataDirtyState, setMetadataDirtyState] = useState(false);
  const [dirtyLineCount, setDirtyLineCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const deletedLineIds = useRef(new Set<string>());
  const [deleteRequested, setDeleteRequested] = useState(false);
  const hasUnsavedChanges = metadataDirtyState || dirtyLineCount > 0;

  function reportError(message: string) {
    setError(message);
    toast.error(message);
  }

  function syncDirtyLineCount() {
    setDirtyLineCount(dirtyLines.current.size + deletedLineIds.current.size);
  }

  function mergeDraftLines(serverDocument: DocumentDetail) {
    const existingIds = new Set(
      serverDocument.lineItems
        .filter((line) => !line.id || !deletedLineIds.current.has(line.id))
        .flatMap((line) => (line.id ? [line.id] : [])),
    );
    for (const id of dirtyLines.current.keys()) {
      if (!existingIds.has(id)) dirtyLines.current.delete(id);
    }
    syncDirtyLineCount();

    const lineItems = serverDocument.lineItems
      .filter((line) => !line.id || !deletedLineIds.current.has(line.id))
      .map((line) => {
        if (!line.id) return line;
        const raw = dirtyLines.current.get(line.id);
        if (!raw) return line;
        try {
          return {
            ...calculateLineItem(raw),
            id: line.id,
            position: line.position,
          };
        } catch {
          return { ...line, ...raw };
        }
      });
    return {
      ...serverDocument,
      ...calculateDocument(lineItems),
      lineItems,
    };
  }

  function reconcile(next: DocumentDetail, preserveDrafts = false) {
    docRef.current = next;
    if (preserveDrafts) {
      setDoc(mergeDraftLines(next));
      if (!metadataDirty.current) {
        const nextMetadata = {
          title: next.title,
          customer: next.customer,
          issueDate: next.issueDate,
        };
        metadataRef.current = nextMetadata;
        setMetadata(nextMetadata);
      }
      return;
    }

    dirtyLines.current.clear();
    deletedLineIds.current.clear();
    syncDirtyLineCount();
    metadataDirty.current = false;
    setMetadataDirtyState(false);
    const nextMetadata = {
      title: next.title,
      customer: next.customer,
      issueDate: next.issueDate,
    };
    metadataRef.current = nextMetadata;
    setMetadata(nextMetadata);
    setDoc(next);
  }

  async function readDocumentResponse(response: Response, fallback: string) {
    const json = (await response
      .json()
      .catch(() => null)) as ApiDocumentResponse | null;
    if (!response.ok || !json?.data) {
      const cause = new Error(json?.error?.message ?? fallback) as Error & {
        status?: number;
        fields?: FieldErrors;
      };
      cause.status = response.status;
      cause.fields = json?.error?.fields;
      throw cause;
    }
    return json.data;
  }

  async function refreshAfterConflict(preserveDrafts = true) {
    const latest = await fetch(`/api/documents/${docRef.current.id}`);
    if (latest.ok) reconcile((await latest.json()).data, preserveDrafts);
  }

  function saveMeta(next: Partial<Metadata>) {
    const values = { ...metadataRef.current, ...next };
    metadataRef.current = values;
    setMetadata(values);
    metadataDirty.current = true;
    setMetadataDirtyState(true);
    setFieldErrors((current) => ({
      ...current,
      title: [],
      customer: [],
      issueDate: [],
    }));
  }

  function updateLineDraft(line: CalculatedLineItem, raw: RawLineItem) {
    if (!line.id || docRef.current.status === "finalized") return;
    dirtyLines.current.set(line.id, raw);
    syncDirtyLineCount();
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) =>
            !key.startsWith(
              `lineItems.${line.position ? line.position - 1 : 0}.`,
            ),
        ),
      ),
    );
    setDoc((current) => {
      const lineItems = current.lineItems.map((item) => {
        if (item.id !== line.id) return item;
        try {
          return {
            ...calculateLineItem(raw),
            id: item.id,
            position: item.position,
          };
        } catch {
          return { ...item, ...raw };
        }
      });
      return { ...current, ...calculateDocument(lineItems), lineItems };
    });
  }

  function resetLineDraft(line: CalculatedLineItem, field: keyof RawLineItem) {
    if (!line.id) return;
    const serverLine = docRef.current.lineItems.find(
      (item) => item.id === line.id,
    );
    if (!serverLine) return;
    const raw = { ...rawOf(line), [field]: rawOf(serverLine)[field] };
    if (field === "discountType") raw.discountValue = serverLine.discountValue;
    if (sameValue(raw, rawOf(serverLine))) dirtyLines.current.delete(line.id);
    else dirtyLines.current.set(line.id, raw);
    syncDirtyLineCount();
    setDoc((current) => {
      const lineItems = current.lineItems.map((item) => {
        if (item.id !== line.id) return item;
        try {
          return {
            ...calculateLineItem(raw),
            id: item.id,
            position: item.position,
          };
        } catch {
          return { ...item, ...raw };
        }
      });
      return { ...current, ...calculateDocument(lineItems), lineItems };
    });
  }

  function validateLineDrafts(lineSnapshots: Map<string, RawLineItem>) {
    const fields: FieldErrors = {};
    for (const [id, raw] of lineSnapshots) {
      try {
        calculateLineItem(raw);
      } catch (cause) {
        const index = doc.lineItems.findIndex((line) => line.id === id);
        const field =
          cause instanceof Error && "field" in cause
            ? String((cause as Error & { field: string }).field)
            : "description";
        fields[`lineItems.${Math.max(0, index)}.${field}`] = [
          errorMessage(cause, "Check this value before saving."),
        ];
      }
    }
    return fields;
  }

  function focusFirstInvalid(fields: FieldErrors) {
    const first = Object.keys(fields).find((key) => fields[key]?.length);
    if (!first) return;
    window.setTimeout(() => {
      let target: HTMLInputElement | null = null;
      if (first === "title")
        target = document.querySelector<HTMLInputElement>(
          '[aria-label="Document title"]',
        );
      else if (first === "customer")
        target = document.querySelector<HTMLInputElement>(
          '[aria-label="Customer"]',
        );
      else if (first === "issueDate")
        target = document.querySelector<HTMLInputElement>(
          '[aria-label="Issue date"]',
        );
      else {
        const match = first.match(/^lineItems\.(\d+)(?:\.(\w+))?$/);
        if (match) {
          const line = doc.lineItems[Number(match[1])];
          const field = match[2] ?? "description";
          if (line?.id)
            target = document.querySelector<HTMLInputElement>(
              `[data-cell="${line.id}:${field}"]`,
            );
        }
      }
      target?.focus();
    }, 0);
  }

  async function saveDocument() {
    if (saving || !hasUnsavedChanges || docRef.current.status === "finalized")
      return true;

    const metadataSnapshot = { ...metadataRef.current };
    const lineSnapshots = new Map<string, RawLineItem>();
    for (const line of doc.lineItems) {
      if (line.id) lineSnapshots.set(line.id, rawOf(line));
    }
    const localFields = validateLineDrafts(lineSnapshots);
    if (Object.keys(localFields).length) {
      setFieldErrors(localFields);
      focusFirstInvalid(localFields);
      toast.error("Correct the highlighted values before saving.");
      return false;
    }

    setSaving(true);
    setError("");
    setFieldErrors({});
    let current = docRef.current;
    let committed = false;

    try {
      const response = await fetch(`/api/documents/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...metadataSnapshot,
          version: current.version,
          lineItems: doc.lineItems.map((line) => ({
            id: line.id,
            ...rawOf(line),
          })),
        }),
      });
      current = await readDocumentResponse(
        response,
        "Could not save this document.",
      );
      committed = true;
      toast.success("Document saved.");
      return true;
    } catch (cause) {
      const requestError = cause as Error & {
        status?: number;
        fields?: FieldErrors;
      };
      if (requestError.fields) {
        setFieldErrors(requestError.fields);
        focusFirstInvalid(requestError.fields);
      }
      if (requestError.status === 409) {
        await refreshAfterConflict(true);
        current = docRef.current;
      }
      reportError(errorMessage(cause, "Could not save this document."));
      return false;
    } finally {
      reconcile(current, !committed);
      setSaving(false);
    }
  }

  function requestPublish() {
    setConfirm(true);
  }

  async function addLine(after?: string) {
    if (docRef.current.status === "finalized") return;
    setError("");
    const raw: RawLineItem = {
      description: "",
      quantity: "1",
      unitPrice: "0",
      discountType: "none",
      discountValue: "0",
      taxPercent: "0",
    };
    const id = crypto.randomUUID();
    dirtyLines.current.set(id, raw);
    syncDirtyLineCount();
    setDoc((current) => {
      const index = after
        ? current.lineItems.findIndex((item) => item.id === after) + 1
        : current.lineItems.length;
      const lineItems = [
        ...current.lineItems.slice(0, index),
        { ...calculateLineItem(raw), id },
        ...current.lineItems.slice(index),
      ].map((line, position) => ({ ...line, position: position + 1 }));
      return { ...current, ...calculateDocument(lineItems), lineItems };
    });
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(`[data-cell="${id}:description"]`)
          ?.focus(),
      0,
    );
  }

  function removeLine(line: CalculatedLineItem) {
    const linePosition = line.position ?? 1;
    const fallbackPosition = linePosition > 1 ? linePosition - 1 : 1;
    if (
      line.id &&
      docRef.current.lineItems.some((item) => item.id === line.id)
    ) {
      deletedLineIds.current.add(line.id);
    }
    if (line.id) dirtyLines.current.delete(line.id);
    syncDirtyLineCount();
    setError("");
    const nextLineItems = doc.lineItems
      .filter((item) => item.id !== line.id)
      .map((item, index) => ({ ...item, position: index + 1 }));
    setDoc((current) => {
      const currentLineItems = current.lineItems
        .filter((item) => item.id !== line.id)
        .map((item, index) => ({ ...item, position: index + 1 }));
      return {
        ...current,
        ...calculateDocument(currentLineItems),
        lineItems: currentLineItems,
      };
    });
    const target =
      nextLineItems.find((item) => item.position === fallbackPosition) ??
      nextLineItems[nextLineItems.length - 1];
    window.setTimeout(
      () =>
        target
          ? document
              .querySelector<HTMLInputElement>(
                `[data-cell="${target.id}:description"]`,
              )
              ?.focus()
          : document
              .querySelector<HTMLButtonElement>('[data-action="add-line"]')
              ?.focus(),
      80,
    );
  }

  async function finalize() {
    setWorking(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await fetch(
        `/api/documents/${docRef.current.id}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...metadataRef.current,
            version: docRef.current.version,
            lineItems: doc.lineItems.map((line) => ({
              id: line.id,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountType: line.discountType,
              discountValue: line.discountValue,
              taxPercent: line.taxPercent,
            })),
          }),
        },
      );
      const next = await readDocumentResponse(
        response,
        "Complete the document before publishing.",
      );
      reconcile(next);
      setConfirm(false);
      toast.success("Document published.");
    } catch (cause) {
      const requestError = cause as Error & {
        status?: number;
        fields?: FieldErrors;
      };
      const fields = requestError.fields ?? {};
      if (Object.keys(fields).length) setFieldErrors(fields);
      if (requestError.status === 422) {
        setConfirm(false);
        focusFirstInvalid(fields);
      }
      if (requestError.status === 409) {
        setConfirm(false);
        await refreshAfterConflict(true);
      }
      reportError(
        errorMessage(cause, "Complete the document before publishing."),
      );
    } finally {
      setWorking(false);
    }
  }

  async function duplicate() {
    if (hasUnsavedChanges) {
      toast.info("Save your changes before using this document as a template.");
      setMenu(false);
      return;
    }
    setWorking(true);
    setMenu(false);
    try {
      const response = await fetch(
        `/api/documents/${docRef.current.id}/duplicate`,
        { method: "POST" },
      );
      const json = (await response.json().catch(() => null)) as {
        data?: { id: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.data)
        throw new Error(
          json?.error?.message ?? "Could not create a template copy.",
        );
      router.push(`/documents/${json.data.id}`);
    } catch (cause) {
      reportError(errorMessage(cause, "Could not create a template copy."));
    } finally {
      setWorking(false);
    }
  }

  async function revertToDraft() {
    setWorking(true);
    setMenu(false);
    setError("");
    try {
      const response = await fetch(
        `/api/documents/${docRef.current.id}/revert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: docRef.current.version }),
        },
      );
      const next = await readDocumentResponse(
        response,
        "Could not change the document back to a draft.",
      );
      reconcile(next);
      toast.success("Document changed to draft.");
    } catch (cause) {
      reportError(
        errorMessage(cause, "Could not change the document back to a draft."),
      );
    } finally {
      setWorking(false);
    }
  }

  async function deleteCurrentDocument() {
    setDeleteRequested(false);
    setWorking(true);
    setMenu(false);
    setError("");
    try {
      const response = await fetch(`/api/documents/${docRef.current.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          json?.error?.message ?? "Could not delete this document.",
        );
      }
      router.push("/documents");
    } catch (cause) {
      reportError(errorMessage(cause, "Could not delete this document."));
      setWorking(false);
    }
  }

  return {
    doc,
    metadata,
    fieldErrors,
    menu,
    setMenu,
    confirm,
    setConfirm,
    deleteRequested,
    setDeleteRequested,
    working,
    saving,
    error,
    hasUnsavedChanges,
    saveMeta,
    updateLineDraft,
    resetLineDraft,
    saveDocument,
    requestPublish,
    addLine,
    removeLine,
    finalize,
    duplicate,
    revertToDraft,
    deleteCurrentDocument,
  };
}
