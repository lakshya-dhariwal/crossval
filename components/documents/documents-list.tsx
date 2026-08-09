"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Copy,
  FileDown,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import type { DocumentSummary } from "@/lib/domain/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
const money = (value: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value),
  );
const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(`${value}T12:00:00`),
  );
export function DocumentsList() {
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<DocumentSummary[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    finalized: boolean;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const search = params.get("search") ?? "";
  const status = (params.get("status") ?? "all") as
    "all" | "draft" | "finalized";
  const requestKey = `${search}:${status}`;
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/documents?search=${encodeURIComponent(search)}&status=${status}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load documents.");
        return r.json();
      })
      .then((json) => {
        setRows(json.data);
        setLoadedKey(requestKey);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoadedKey(requestKey);
        }
      });
    return () => controller.abort();
  }, [requestKey, search, status]);
  useEffect(() => {
    if (!menu) return;
    const closeOnScroll = () => {
      setMenu(null);
      setMenuPosition(null);
    };
    window.addEventListener("scroll", closeOnScroll, true);
    return () => window.removeEventListener("scroll", closeOnScroll, true);
  }, [menu]);
  function update(next: Record<string, string>) {
    const q = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([key, value]) =>
      value ? q.set(key, value) : q.delete(key),
    );
    router.replace(`/documents?${q.toString()}`);
  }
  async function create() {
    try {
      const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await r.json().catch(() => null)) as {
        data?: { id: string };
        error?: { message?: string };
      } | null;
      if (!r.ok || !json?.data)
        throw new Error(
          json?.error?.message ?? "Could not create the document.",
        );
      router.push(`/documents/${json.data.id}`);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not create the document.",
      );
    }
  }
  function closeMenu() {
    setMenu(null);
    setMenuPosition(null);
  }
  function toggleMenu(id: string, event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (menu === id) {
      closeMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu(id);
    setMenuPosition({
      top: rect.bottom + 6,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }
  async function duplicate(id: string) {
    try {
      const r = await fetch(`/api/documents/${id}/duplicate`, {
        method: "POST",
      });
      const json = (await r.json().catch(() => null)) as {
        data?: { id: string };
        error?: { message?: string };
      } | null;
      closeMenu();
      if (r.ok && json?.data) router.push(`/documents/${json.data.id}`);
      else
        toast.error(
          json?.error?.message ?? "Could not create the template copy.",
        );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not create the template copy.",
      );
      closeMenu();
    }
  }
  async function changeToDraft(id: string) {
    const response = await fetch(`/api/documents/${id}/revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = (await response.json().catch(() => null)) as {
      data?: DocumentSummary;
      error?: { message?: string };
    } | null;
    if (!response.ok || !json?.data) {
      toast.error(
        json?.error?.message ??
          "Could not change the document back to a draft.",
      );
      closeMenu();
      return;
    }
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, ...json.data, status: "draft" } : row,
      ),
    );
    toast.success("Document changed to draft.");
    closeMenu();
  }
  async function remove(id: string, finalized: boolean) {
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });
      const json = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        toast.error(json?.error?.message ?? "Could not delete this document.");
        return;
      }
      setRows((current) => current.filter((row) => row.id !== id));
      setDeleteTarget(null);
      toast.success(finalized ? "Document deleted." : "Draft deleted.");
      closeMenu();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not delete this document.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>Documents</h1>
          <p className="supporting">
            Keep working drafts close and finalized pricing ready to reuse.
          </p>
        </div>
        <button className="button primary" onClick={create}>
          <Plus size={16} /> New document
        </button>
      </header>
      {error && (
        <div className="banner" role="alert">
          {error}
        </div>
      )}
      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              color: "var(--muted)",
            }}
          />
          <input
            className="input search"
            style={{ paddingLeft: 31 }}
            placeholder="Search title or customer"
            aria-label="Search documents"
            defaultValue={search}
            onChange={(e) => {
              const value = e.target.value;
              window.clearTimeout(
                (window as unknown as { searchTimer?: number }).searchTimer,
              );
              (window as unknown as { searchTimer?: number }).searchTimer =
                window.setTimeout(() => update({ search: value }), 280);
            }}
          />
        </div>
        <div className="filter-group" aria-label="Filter documents by status">
          {(["all", "draft", "finalized"] as const).map((value) => (
            <button
              key={value}
              className={`filter ${status === value ? "selected" : ""}`}
              onClick={() => update({ status: value === "all" ? "" : value })}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <section className="surface table-wrap documents-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Customer</th>
              <th>Issue date</th>
              <th>Status</th>
              <th>Items</th>
              <th className="right">Total</th>
              <th>Updated</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr className="skeleton-row" key={i}>
                    <td>
                      <span className="skeleton-line medium" />
                    </td>
                    <td>
                      <span className="skeleton-line long" />
                    </td>
                    <td>
                      <span className="skeleton-line short" />
                    </td>
                    <td>
                      <span className="skeleton-pill" />
                    </td>
                    <td>
                      <span className="skeleton-line short" />
                    </td>
                    <td>
                      <span className="skeleton-line amount" />
                    </td>
                    <td>
                      <span className="skeleton-line short" />
                    </td>
                    <td>
                      <span className="skeleton-line short" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/documents/${row.id}`)}
                  >
                    <td className="title-cell">
                      {row.title || "Untitled document"}
                    </td>
                    <td className="muted">{row.customer || "—"}</td>
                    <td className="muted">{date(row.issueDate)}</td>
                    <td>
                      <span className={`status ${row.status}`}>
                        {row.status === "finalized" ? "Final" : "Draft"}
                      </span>
                    </td>
                    <td className="muted">{row.itemCount}</td>
                    <td className="right numeric">{money(row.grandTotal)}</td>
                    <td className="muted">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                      }).format(new Date(row.updatedAt))}
                    </td>
                    <td className="right">
                      <button
                        className="icon-button"
                        aria-label={`Actions for ${row.title || "untitled document"}`}
                        aria-expanded={menu === row.id}
                        onClick={(event) => toggleMenu(row.id, event)}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={8}>
                  <div className="empty">
                    <h2>
                      {search || status !== "all"
                        ? "No matching documents"
                        : "Your workspace is ready"}
                    </h2>
                    <p>
                      {search || status !== "all"
                        ? "Try a different search or clear the filter."
                        : "Create a document to start shaping your next proposal."}
                    </p>
                    <button
                      className="button"
                      onClick={() =>
                        search || status !== "all"
                          ? update({ search: "", status: "" })
                          : create()
                      }
                    >
                      {search || status !== "all"
                        ? "Clear filters"
                        : "Create document"}
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {menu &&
        menuPosition &&
        createPortal(
          <div
            className="menu menu-floating"
            style={{ top: menuPosition.top, right: menuPosition.right }}
            role="menu"
            onClick={(event) => event.stopPropagation()}
          >
            {rows.find((row) => row.id === menu)?.status === "finalized" && (
              <>
                <Link
                  className="menu-item"
                  role="menuitem"
                  href={`/documents/${menu}/print`}
                  onClick={closeMenu}
                >
                  <Printer size={15} /> Print / PDF
                </Link>
                <a
                  className="menu-item"
                  role="menuitem"
                  href={`/api/documents/${menu}/export/html`}
                  onClick={closeMenu}
                >
                  <FileDown size={15} /> Export HTML
                </a>
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => void changeToDraft(menu)}
                >
                  <RotateCcw size={15} /> Change to draft
                </button>
              </>
            )}
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => void duplicate(menu)}
            >
              <Copy size={15} /> Use as template
            </button>
            <button
              className="menu-item"
              role="menuitem"
              onClick={() =>
                setDeleteTarget({
                  id: menu,
                  finalized:
                    rows.find((row) => row.id === menu)?.status === "finalized",
                })
              }
            >
              <Trash2 size={15} /> Delete document
            </button>
          </div>,
          document.body,
        )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this document?"
        description={
          deleteTarget?.finalized
            ? "This permanently removes the finalized document and all of its line items. This cannot be undone."
            : "This permanently removes the draft and all of its line items. This cannot be undone."
        }
        confirmLabel="Delete document"
        danger
        pending={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget)
            void remove(deleteTarget.id, deleteTarget.finalized);
        }}
      />
    </>
  );
}
