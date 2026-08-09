"use client";
export function PrintButton() {
  return (
    <button className="button primary" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
