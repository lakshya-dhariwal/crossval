"use client";

import { FileDown, LoaderCircle } from "lucide-react";
import html2pdf from "html2pdf.js";
import { useState } from "react";
import { toast } from "sonner";

export function PdfDownloadButton({
  documentId,
  filename,
  className = "button primary",
  onClick,
}: {
  documentId: string;
  filename: string;
  className?: string;
  onClick?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    let frame: HTMLIFrameElement | null = null;
    let renderStyle: HTMLStyleElement | null = null;
    try {
      const response = await fetch(`/api/documents/${documentId}/export/html`);
      if (!response.ok) {
        throw new Error("Could not load the document output.");
      }
      const html = await response.text();
      frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.position = "fixed";
      frame.style.left = "-10000px";
      frame.style.top = "0";
      frame.style.width = "860px";
      frame.style.height = "1px";
      frame.style.border = "0";
      frame.style.visibility = "hidden";
      frame.style.pointerEvents = "none";
      document.body.appendChild(frame);
      const frameDocument = frame.contentDocument;
      if (!frameDocument) {
        throw new Error("Could not prepare the document output.");
      }
      frameDocument.open();
      frameDocument.write(html);
      frameDocument.close();
      await frameDocument.fonts.ready;
      // Capture the full standalone document so html2pdf preserves its
      // embedded stylesheet when it clones the source into its render layer.
      const target = frameDocument.documentElement;
      if (!target) {
        throw new Error("Could not prepare the document output.");
      }
      renderStyle = document.createElement("style");
      renderStyle.textContent =
        ".html2pdf__overlay{z-index:-1!important;pointer-events:none!important;}";
      document.head.appendChild(renderStyle);
      await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          filename: `${safeFilename(filename)}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(target)
        .save();
      toast.success("PDF downloaded.");
    } catch {
      toast.error("Could not create the PDF. Please try again.");
    } finally {
      renderStyle?.remove();
      frame?.remove();
      setBusy(false);
    }
  }

  return (
    <button
      className={className}
      type="button"
      role={className === "menu-item" ? "menuitem" : undefined}
      aria-busy={busy}
      onClick={() => {
        onClick?.();
        void download();
      }}
      disabled={busy}
    >
      {busy ? (
        <LoaderCircle size={15} className="spin" aria-hidden="true" />
      ) : (
        <FileDown size={15} aria-hidden="true" />
      )}
      {busy ? "Creating PDF…" : "Save PDF"}
    </button>
  );
}

function safeFilename(title: string) {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pricing-document"
  ).slice(0, 80);
}
