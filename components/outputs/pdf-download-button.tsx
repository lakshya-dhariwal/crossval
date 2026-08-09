"use client";

import { FileDown, LoaderCircle } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
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
      // Capture the full standalone document so its embedded stylesheet is
      // applied directly, without creating a visible render overlay.
      const target = frameDocument.documentElement;
      if (!target) {
        throw new Error("Could not prepare the document output.");
      }
      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        windowWidth: 900,
        windowHeight: Math.max(
          target.scrollHeight,
          frameDocument.body?.scrollHeight ?? 0,
        ),
      });
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });
      const margin = 12;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const scale = contentWidth / canvas.width;
      const sliceHeight = Math.floor(contentHeight / scale);
      let offset = 0;
      let page = 0;
      while (offset < canvas.height) {
        const height = Math.min(sliceHeight, canvas.height - offset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = height;
        const context = slice.getContext("2d");
        if (!context) throw new Error("Could not prepare the PDF canvas.");
        context.drawImage(
          canvas,
          0,
          offset,
          canvas.width,
          height,
          0,
          0,
          canvas.width,
          height,
        );
        if (page > 0) pdf.addPage();
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.98),
          "JPEG",
          margin,
          margin,
          contentWidth,
          height * scale,
        );
        offset += height;
        page += 1;
      }
      pdf.save(`${safeFilename(filename)}.pdf`);
      toast.success("PDF downloaded.");
    } catch {
      toast.error("Could not create the PDF. Please try again.");
    } finally {
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
