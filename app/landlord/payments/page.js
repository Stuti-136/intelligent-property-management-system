"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import {
  Badge,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  Segmented,
  useToast,
} from "@/components/ui";
import { currentMonth, fmtDate, fmtMonth, money, paymentStatus } from "@/lib/format";

const METHODS = ["Cash", "Bank transfer", "UPI", "Cheque", "Card", "Other"];

function GenerateModal({ onClose, onDone }) {
  const toast = useToast();
  const tenantsRes = useApi("/api/tenants?status=Active");
  const tenants = tenantsRes.data?.tenants ?? [];

  const [form, setForm] = useState({
    tenant_id: "",
    month: currentMonth(),
    due_date: `${currentMonth()}-05`,
    amount: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function chooseTenant(e) {
    const id = e.target.value;
    const tenant = tenants.find((t) => String(t.tenant_id) === id);
    setForm((f) => ({ ...f, tenant_id: id, amount: tenant ? String(tenant.rent_amt) : "" }));
  }

  function chooseMonth(e) {
    const month = e.target.value;
    setForm((f) => ({ ...f, month, due_date: month ? `${month}-05` : f.due_date }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/payments/generate", {
        method: "POST",
        body: {
          tenant_id: Number(form.tenant_id),
          payment_month: form.month,
          due_date: form.due_date,
          amount: form.amount === "" ? undefined : Number(form.amount),
        },
      });
      toast("Rent bill created");
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Generate a rent bill"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="bill-form"
            className="btn btn-primary"
            disabled={busy || tenantsRes.loading || tenants.length === 0}
          >
            {busy ? "Creating…" : "Create bill"}
          </button>
        </>
      }
    >
      {tenantsRes.loading ? (
        <Loading />
      ) : tenantsRes.error ? (
        <div className="form-error">{tenantsRes.error.message}</div>
      ) : tenants.length === 0 ? (
        <div className="notice notice-warn">
          There are no current tenants to bill. Assign a tenant to a property first.
        </div>
      ) : (
        <form id="bill-form" onSubmit={submit}>
          {error && <div className="form-error" role="alert">{error}</div>}
          <Field label="Tenant">
            <select className="select" required value={form.tenant_id} onChange={chooseTenant}>
              <option value="">Choose a tenant</option>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.full_name}, {t.property_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="field-row">
            <Field label="Rent month">
              <input className="input" type="month" required value={form.month} onChange={chooseMonth} />
            </Field>
            <Field label="Due date">
              <input
                className="input"
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Amount" hint="Filled in from the property's rent. Change it for a different amount.">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}

function MarkPaidModal({ payment, onClose, onDone }) {
  const toast = useToast();
  const [method, setMethod] = useState("Bank transfer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/payments/${payment.payment_id}`, { method: "PATCH", body: { payment_method: method } });
      toast("Payment recorded");
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record a payment"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="paid-form" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Mark as paid"}
          </button>
        </>
      }
    >
      <form id="paid-form" onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <p style={{ marginBottom: 14 }}>
          <strong>{payment.tenant_name}</strong> paid <strong>{money(payment.amount)}</strong> for{" "}
          {fmtMonth(payment.payment_month)}. Today's date is recorded as the payment date.
        </p>
        <Field label="How was it paid?">
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

export default function PaymentsPage() {
  const { data, error, loading, reload } = useApi("/api/payments");
  const [filter, setFilter] = useState("All");
  const [generating, setGenerating] = useState(false);
  const [paying, setPaying] = useState(null);

  const all = (data?.payments ?? []).map((p) => ({ ...p, effective: paymentStatus(p) }));
  const count = (s) => all.filter((p) => p.effective === s).length;
  const sum = (pred) => all.filter(pred).reduce((total, p) => total + Number(p.amount), 0);
  const list = filter === "All" ? all : all.filter((p) => p.effective === filter);

  return (
    <>
      <PageHeader title="Payments" sub="Rent bills for your tenants and what has been paid.">
        <button type="button" className="btn btn-primary" onClick={() => setGenerating(true)}>
          Generate a rent bill
        </button>
      </PageHeader>

      <div className="band" style={{ marginBottom: 16 }}>
        <div className="band-item">
          <div className="band-figure">{money(sum((p) => p.effective !== "Paid"))}</div>
          <div className="band-label">Still to collect</div>
        </div>
        <div className="band-item">
          <div className="band-figure">{money(sum((p) => p.effective === "Overdue"))}</div>
          <div className="band-label">Overdue</div>
        </div>
        <div className="band-item">
          <div className="band-figure">{money(sum((p) => p.effective === "Paid"))}</div>
          <div className="band-label">Collected so far</div>
        </div>
      </div>

      <div className="toolbar">
        <Segmented
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "All", label: "All", count: all.length },
            { value: "Pending", label: "Pending", count: count("Pending") },
            { value: "Overdue", label: "Overdue", count: count("Overdue") },
            { value: "Paid", label: "Paid", count: count("Paid") },
          ]}
        />
      </div>

      <div className="panel">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorNote error={error} onRetry={reload} />
        ) : list.length === 0 ? (
          all.length === 0 ? (
            <Empty
              title="No rent bills yet"
              action={
                <button type="button" className="btn btn-primary" onClick={() => setGenerating(true)}>
                  Generate a rent bill
                </button>
              }
            >
              Create a bill for a tenant and it will be tracked here.
            </Empty>
          ) : (
            <Empty title={`No ${filter.toLowerCase()} payments`}>Pick another filter to see the rest.</Empty>
          )
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Rent month</th>
                  <th className="num">Amount</th>
                  <th>Due</th>
                  <th>Paid on</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.payment_id}>
                    <td>
                      <div className="cell-title">{p.tenant_name}</div>
                      <div className="cell-sub">{p.property_name}</div>
                    </td>
                    <td className="nowrap">{fmtMonth(p.payment_month)}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td className="nowrap">{fmtDate(p.due_date)}</td>
                    <td>
                      {p.payment_date ? (
                        <>
                          <div className="nowrap">{fmtDate(p.payment_date)}</div>
                          <div className="cell-sub">{p.payment_method}</div>
                        </>
                      ) : (
                        <span className="muted">Not yet</span>
                      )}
                    </td>
                    <td>
                      <Badge value={p.effective} />
                    </td>
                    <td>
                      {p.effective !== "Paid" && (
                        <div className="actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaying(p)}>
                            Mark as paid
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {generating && (
        <GenerateModal
          onClose={() => setGenerating(false)}
          onDone={() => {
            setGenerating(false);
            reload();
          }}
        />
      )}
      {paying && (
        <MarkPaidModal
          payment={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            reload();
          }}
        />
      )}
    </>
  );
}
