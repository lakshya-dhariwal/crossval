"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState } from "react";
import {
  BadgePercent,
  CircleDollarSign,
  FileText,
  ReceiptText,
  RotateCw,
} from "lucide-react";
import Link from "next/link";

type Report = {
  from: string;
  to: string;
  documentCount: number;
  totalDiscount: string;
  totalTax: string;
  grandTotal: string;
  rows: {
    id: string;
    title: string;
    customer: string;
    issueDate: string;
    status: "draft" | "finalized";
    totalDiscount: string;
    totalTax: string;
    grandTotal: string;
  }[];
};
const money = (value: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value),
  );
function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function defaultRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29);
  return { from: localIso(start), to: localIso(today) };
}

export function Reports() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(
    () => params.get("from") ?? defaultRange().from,
  );
  const [to, setTo] = useState(() => params.get("to") ?? defaultRange().to);
  const [includeDrafts, setIncludeDrafts] = useState(
    () => params.get("includeDrafts") === "1",
  );
  const [report, setReport] = useState<Report | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const requestKey = `${from}:${to}:${includeDrafts ? "drafts" : "finalized"}`;
  const loading = loadedKey !== requestKey;

  function updateRange(next: { from?: string; to?: string }) {
    const values = { from: next.from ?? from, to: next.to ?? to };
    setFrom(values.from);
    setTo(values.to);
    const query = new URLSearchParams({ from: values.from, to: values.to });
    if (includeDrafts) query.set("includeDrafts", "1");
    router.replace(`${pathname}?${query.toString()}` as Route);
  }

  function updateIncludeDrafts(value: boolean) {
    setIncludeDrafts(value);
    const query = new URLSearchParams({ from, to });
    if (value) query.set("includeDrafts", "1");
    router.replace(`${pathname}?${query.toString()}` as Route);
  }

  async function load() {
    setError("");
    setReport(null);
    setLoadedKey("");
    const response = await fetch(
      `/api/reports/summary?from=${from}&to=${to}${includeDrafts ? "&includeDrafts=1" : ""}`,
    );
    const json = (await response.json().catch(() => null)) as {
      data?: Report;
      error?: { message?: string };
    } | null;
    if (!response.ok || !json?.data) {
      setError(json?.error?.message ?? "Could not load this report.");
      setLoadedKey(requestKey);
      return;
    }
    setReport(json.data);
    setLoadedKey(requestKey);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/reports/summary?from=${from}&to=${to}${includeDrafts ? "&includeDrafts=1" : ""}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as {
          data?: Report;
          error?: { message?: string };
        } | null;
        if (!response.ok || !json?.data)
          throw new Error(
            json?.error?.message ?? "Could not load this report.",
          );
        return json.data;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setReport(data);
          setLoadedKey(requestKey);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setReport(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load this report.",
          );
          setLoadedKey(requestKey);
        }
      });
    return () => controller.abort();
  }, [from, includeDrafts, requestKey, to]);

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>Reports</h1>
          <p className="supporting">
            A reconciled view of pricing activity by issue date.
          </p>
        </div>
      </header>
      <div className="date-controls">
        <label>
          <span className="field-label">From</span>
          <input
            className="input"
            type="date"
            value={from}
            onChange={(event) => updateRange({ from: event.target.value })}
            aria-label="From"
          />
        </label>
        <label>
          <span className="field-label">To</span>
          <input
            className="input"
            type="date"
            value={to}
            onChange={(event) => updateRange({ to: event.target.value })}
            aria-label="To"
          />
        </label>
        <button
          className="button"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RotateCw size={14} className={loading ? "spin" : undefined} />{" "}
          Refresh
        </button>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={includeDrafts}
            onChange={(event) => updateIncludeDrafts(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true">
            <span />
          </span>
          <span>Include drafts</span>
        </label>
      </div>
      {error && (
        <div className="banner" role="alert">
          {error}
        </div>
      )}
      <div className="metrics">
        {[
          ["Documents", String(report?.documentCount ?? 0), FileText],
          [
            "Grand total",
            money(report?.grandTotal ?? "0.00"),
            CircleDollarSign,
          ],
          ["Tax", money(report?.totalTax ?? "0.00"), ReceiptText],
          ["Discount", money(report?.totalDiscount ?? "0.00"), BadgePercent],
        ].map(([label, value, Icon]) => (
          <div className="metric" key={label as string}>
            <div className="metric-heading">
              <span className="metric-icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="metric-label">{label as string}</div>
            </div>
            <div className="metric-value numeric">
              {loading ? (
                <span
                  className="skeleton skeleton-metric"
                  aria-label="Loading"
                />
              ) : (
                (value as string)
              )}
            </div>
          </div>
        ))}
      </div>
      <section className="surface table-wrap">
        <table className="data-table report-table">
          <thead>
            <tr>
              <th>Issue date</th>
              <th>Title</th>
              <th>Customer</th>
              <th>Status</th>
              <th className="right">Discount</th>
              <th className="right">Tax</th>
              <th className="right">Grand total</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr className="skeleton-row" key={index}>
                    <td>
                      <span className="skeleton-line short" />
                    </td>
                    <td>
                      <span className="skeleton-line medium" />
                    </td>
                    <td>
                      <span className="skeleton-line long" />
                    </td>
                    <td>
                      <span className="skeleton-pill" />
                    </td>
                    <td>
                      <span className="skeleton-line amount" />
                    </td>
                    <td>
                      <span className="skeleton-line amount" />
                    </td>
                    <td>
                      <span className="skeleton-line amount" />
                    </td>
                  </tr>
                ))
              : report?.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="muted">{row.issueDate}</td>
                    <td className="title-cell">
                      <Link
                        className="table-link"
                        href={`/documents/${row.id}`}
                      >
                        {row.title || "Untitled document"}
                      </Link>
                    </td>
                    <td className="muted">{row.customer || "—"}</td>
                    <td>
                      <span className={`status ${row.status}`}>
                        {row.status === "finalized" ? "Final" : "Draft"}
                      </span>
                    </td>
                    <td className="right numeric">
                      {money(row.totalDiscount)}
                    </td>
                    <td className="right numeric">{money(row.totalTax)}</td>
                    <td className="right numeric">{money(row.grandTotal)}</td>
                  </tr>
                ))}
            {!loading && !report?.rows.length && (
              <tr>
                <td colSpan={7}>
                  <div className="empty">
                    <h2>
                      {error
                        ? "Report unavailable"
                        : "No finalized documents in this range"}
                    </h2>
                    <p>
                      {error
                        ? "Check the dates or try again."
                        : includeDrafts
                          ? "Try widening the issue-date range to include more activity."
                          : "Only finalized documents are included. Turn on Include drafts to see working documents."}
                    </p>
                    {error && (
                      <button
                        className="button"
                        type="button"
                        onClick={() => void load()}
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
