"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { downloadLease } from "@/lib/api";

/* ---------- Toasts ---------- */

const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, kind = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, kind }]);
    setTimeout(
      () => setItems((list) => list.filter((t) => t.id !== id)),
      kind === "ok" ? 3500 : 7000
    );
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "ok" ? "" : `toast-${t.kind}`}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Layout pieces ---------- */

export function PageHeader({ title, sub, children }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="toolbar-group">{children}</div>}
    </header>
  );
}

export function Loading({ text = "Loading…" }) {
  return <div className="loading">{text}</div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div className="empty">
      <p className="empty-title">This could not be loaded</p>
      <p>{error?.message || "Something went wrong."}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

const TONES = {
  Available: "moss",
  Occupied: "petrol",
  Paid: "moss",
  Pending: "brass",
  Overdue: "brick",
  Submitted: "brass",
  "In Progress": "petrol",
  Resolved: "moss",
  High: "brick",
  Medium: "brass",
  Low: "slate",
  Active: "moss",
  Ended: "slate",
};

export function Badge({ value }) {
  return <span className={`badge badge-${TONES[value] || "slate"}`}>{value}</span>;
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/* ---------- Modal ---------- */

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, danger, busy, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* ---------- Lease download ---------- */

export function LeaseButton({ doc, label = "Download lease", small }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadLease(doc.document_id, doc.file_name);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-secondary ${small ? "btn-sm" : ""}`}
      onClick={download}
      disabled={busy}
    >
      {busy ? "Preparing…" : label}
    </button>
  );
}
