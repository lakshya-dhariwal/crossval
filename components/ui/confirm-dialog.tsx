"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel, pending = false, danger = false, onCancel, onConfirm }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      previousFocus.current?.focus();
      previousFocus.current = null;
      return;
    }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !pending) { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(document.querySelectorAll<HTMLElement>("[data-confirm-dialog] button:not(:disabled)"));
      if (items.length < 2) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && current <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && current === items.length - 1) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open, pending]);

  if (!open) return null;
  return <div className="modal-backdrop" role="presentation"><div className="dialog" data-confirm-dialog role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-copy"><h2 id="confirm-dialog-title">{title}</h2><p id="confirm-dialog-copy">{description}</p><div className="dialog-actions"><button ref={cancelRef} className="button" type="button" disabled={pending} onClick={onCancel}>Cancel</button><button className={`button ${danger ? "danger" : "primary"}`} type="button" disabled={pending} onClick={onConfirm}>{pending ? "Working…" : confirmLabel}</button></div></div></div>;
}
