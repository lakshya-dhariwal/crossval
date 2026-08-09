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
  type FieldErrors,
  type Metadata,
} from "@/components/editor/editor-types";

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
  const [pendingMeta, setPendingMeta] = useState(false);
  const [metadataDirtyState, setMetadataDirtyState] = useState(false);
  const [savingCount, setSavingCount] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CalculatedLineItem | null>(
    null,
  );
  const [deleteRequested, setDeleteRequested] = useState(false);
  const metadataSequence = useRef(0);
  const metadataDirty = useRef(false);
  const mutationQueue = useRef(Promise.resolve());
  const isSaving = savingCount > 0;

  function reportError(message: string) {
    setError(message);
    toast.error(message);
  }

  function reconcile(next: DocumentDetail, preserveMetadata = false) {
    docRef.current = next;
    setDoc(next);
    if (!preserveMetadata) {
      const nextMetadata = {
        title: next.title,
        customer: next.customer,
        issueDate: next.issueDate,
      };
      metadataRef.current = nextMetadata;
      setMetadata(nextMetadata);
      setMetadataDirtyState(false);
    }
  }

  function enqueue<T>(
    task: (current: DocumentDetail) => Promise<T>,
    showSaving = true,
  ) {
    if (showSaving) setSavingCount((count) => count + 1);
    const queued = mutationQueue.current.then(() => task(docRef.current));
    mutationQueue.current = queued.then(
      () => undefined,
      () => undefined,
    );
    if (showSaving) {
      void queued.then(
        () => setSavingCount((count) => Math.max(0, count - 1)),
        () => setSavingCount((count) => Math.max(0, count - 1)),
      );
    }
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
    setMetadataDirtyState(true);
    setFieldErrors((current) => ({
      ...current,
      title: [],
      customer: [],
      issueDate: [],
    }));
  }

  async function commitMeta() {
    if (!metadataDirty.current) return;
    metadataDirty.current = false;
    setMetadataDirtyState(false);
    const values = metadataRef.current;
    const sequence = ++metadataSequence.current;
    setPendingMeta(true);
    try {
      await enqueue(async (current) => {
        const response = await fetch(`/api/documents/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, version: current.version }),
        });
        const json = (await response.json().catch(() => null)) as {
          data?: DocumentDetail;
          error?: { message?: string; fields?: FieldErrors };
        } | null;
        if (!response.ok) {
          if (response.status === 409) await refreshAfterConflict();
          setFieldErrors(json?.error?.fields ?? {});
          throw new Error(
            json?.error?.message ?? "Could not save this change.",
          );
        }
        if (sequence === metadataSequence.current) {
          setPendingMeta(false);
          setError("");
          if (json?.data) reconcile(json.data);
        } else if (json?.data) {
          reconcile(json.data, true);
        }
      });
    } catch (cause) {
      metadataDirty.current = true;
      setMetadataDirtyState(true);
      setPendingMeta(false);
      reportError(errorMessage(cause, "Could not save this change."));
    }
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
          const line = docRef.current.lineItems[Number(match[1])];
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

  async function saveLine(line: CalculatedLineItem, raw: RawLineItem) {
    if (docRef.current.status === "finalized") return;
    const preview = calculateLineItem(raw);
    setDoc((current) => {
      const lineItems = current.lineItems.map((item) =>
        item.id === line.id
          ? { ...preview, id: line.id, position: line.position }
          : item,
      );
      return { ...current, ...calculateDocument(lineItems), lineItems };
    });
    await enqueue(async (current) => {
      const currentLine = current.lineItems.find((item) => item.id === line.id);
      if (!currentLine) throw new Error("Line item no longer exists.");
      const response = await fetch(
        `/api/documents/${current.id}/line-items/${line.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...raw, version: current.version }),
        },
      );
      const json = (await response.json().catch(() => null)) as {
        data?: DocumentDetail;
        error?: { message?: string; fields?: FieldErrors };
      } | null;
      if (!response.ok) {
        if (response.status === 409) await refreshAfterConflict();
        setFieldErrors(json?.error?.fields ?? {});
        throw new Error(json?.error?.message ?? "Could not save line item.");
      }
      setError("");
      if (json?.data) reconcile(json.data);
    }).catch((cause) => {
      reportError(errorMessage(cause, "Could not save line item."));
      throw cause;
    });
  }

  async function addLine(after?: string) {
    if (docRef.current.status === "finalized") return;
    setError("");
    try {
      const next = await enqueue(async (current) => {
        const response = await fetch(
          `/api/documents/${current.id}/line-items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: "",
              quantity: "1",
              unitPrice: "0",
              discountType: "none",
              discountValue: "0",
              taxPercent: "0",
              afterLineItemId: after,
            }),
          },
        );
        const json = (await response.json().catch(() => null)) as {
          data?: DocumentDetail;
          error?: { message?: string };
        } | null;
        if (!response.ok || !json?.data)
          throw new Error(json?.error?.message ?? "Could not add a line item.");
        reconcile(json.data);
        return json.data;
      }, false);
      const position = after
        ? (next.lineItems.find((item) => item.id === after)?.position ??
            next.lineItems.length - 1) + 1
        : next.lineItems.length;
      const target = next.lineItems.find((item) => item.position === position);
      window.setTimeout(
        () =>
          target &&
          document
            .querySelector<HTMLInputElement>(
              `[data-cell="${target.id}:description"]`,
            )
            ?.focus(),
        80,
      );
    } catch (cause) {
      reportError(errorMessage(cause, "Could not add a line item."));
    }
  }

  async function removeLine(line: CalculatedLineItem) {
    const linePosition = line.position ?? 1;
    const fallbackPosition = linePosition > 1 ? linePosition - 1 : 1;
    setRemoveTarget(null);
    setWorking(true);
    setError("");
    try {
      const next = await enqueue(async (current) => {
        const response = await fetch(
          `/api/documents/${current.id}/line-items/${line.id}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: current.version }),
          },
        );
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(
            json?.error?.message ?? "Could not remove this line item.",
          );
        }
        const latest = await fetch(`/api/documents/${current.id}`);
        if (!latest.ok) throw new Error("The document could not be refreshed.");
        const data = (await latest.json()).data as DocumentDetail;
        reconcile(data);
        return data;
      });
      const target =
        next.lineItems.find((item) => item.position === fallbackPosition) ??
        next.lineItems[next.lineItems.length - 1];
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
    } catch (cause) {
      reportError(errorMessage(cause, "Could not remove this line item."));
    } finally {
      setWorking(false);
    }
  }

  async function finalize() {
    setWorking(true);
    setError("");
    setFieldErrors({});
    try {
      const next = await enqueue(async (current) => {
        const response = await fetch(`/api/documents/${current.id}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: current.version }),
        });
        const json = (await response.json().catch(() => null)) as {
          data?: DocumentDetail;
          error?: { message?: string; fields?: FieldErrors };
        } | null;
        if (!response.ok) {
          const fields = json?.error?.fields ?? {};
          setFieldErrors(fields);
          if (response.status === 422) {
            setConfirm(false);
            focusFirstInvalid(fields);
          }
          throw new Error(
            json?.error?.message ?? "Complete the document before finalizing.",
          );
        }
        if (!json?.data)
          throw new Error("The document could not be finalized.");
        return json.data;
      });
      reconcile(next);
      setConfirm(false);
    } catch (cause) {
      reportError(
        errorMessage(cause, "Complete the document before finalizing."),
      );
    } finally {
      setWorking(false);
    }
  }

  async function duplicate() {
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
      const json = (await response.json().catch(() => null)) as {
        data?: DocumentDetail;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.data)
        throw new Error(
          json?.error?.message ??
            "Could not change the document back to a draft.",
        );
      reconcile(json.data);
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

  const saving = isSaving || pendingMeta;
  const saveState = saving
    ? "Saving"
    : metadataDirtyState
      ? "Unsaved changes"
      : error
        ? "Needs attention"
        : "Saved";

  return {
    doc,
    metadata,
    fieldErrors,
    menu,
    setMenu,
    confirm,
    setConfirm,
    removeTarget,
    setRemoveTarget,
    deleteRequested,
    setDeleteRequested,
    working,
    isSaving,
    pendingMeta,
    error,
    saveState,
    saving,
    saveMeta,
    commitMeta,
    saveLine,
    addLine,
    removeLine,
    finalize,
    duplicate,
    revertToDraft,
    deleteCurrentDocument,
  };
}
