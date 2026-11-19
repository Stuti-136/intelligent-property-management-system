"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import {
  Badge,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  LeaseButton,
  Loading,
  Modal,
  PageHeader,
  Segmented,
  useToast,
} from "@/components/ui";
import { addYears, fmtDate, money, today } from "@/lib/format";

const MAX_PDF = 5 * 1024 * 1024;

function AssignModal({ onClose, onDone }) {
  const toast = useToast();
  const candidatesRes = useApi("/api/tenants/candidates");
  const propertiesRes = useApi("/api/properties?status=Available");

  const [form, setForm] = useState({
    user_id: "",
    property_id: "",
    lease_start_date: today(),
    lease_end_date: addYears(today(), 1),
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const loading = candidatesRes.loading || propertiesRes.loading;
  const candidates = candidatesRes.data?.candidates ?? [];
  const properties = propertiesRes.data?.properties ?? [];
  const loadError = candidatesRes.error || propertiesRes.error;
  const blocked = !loading && !loadError && (candidates.length === 0 || properties.length === 0);

  function pickFile(e) {
    const chosen = e.target.files?.[0] ?? null;
    setError("");
    if (chosen && chosen.size > MAX_PDF) {
      setError("The lease PDF must be 5 MB or smaller.");
      e.target.value = "";
      setFile(null);
      return;
    }
    if (chosen && !/\.pdf$/i.test(chosen.name)) {
      setError("The lease must be a PDF file.");
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(chosen);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.lease_end_date < form.lease_start_date) {
      setError("The lease end date cannot be before the start date.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("user_id", form.user_id);
      fd.append("property_id", form.property_id);
      fd.append("lease_start_date", form.lease_start_date);
      fd.append("lease_end_date", form.lease_end_date);
      if (file) fd.append("lease_pdf", file);

      const res = await api("/api/tenants/assign", { method: "POST", formData: fd });
      if (res.graph_synced === false) {
        toast("Tenant assigned, but the network graph could not be updated.", "warn");
      } else {
        toast("Tenant assigned");
      }
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Assign a tenant"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="assign-form"
            className="btn btn-primary"
            disabled={busy || loading || blocked || !!loadError}
          >
            {busy ? "Assigning…" : "Assign tenant"}
          </button>
        </>
      }
    >
      {loading ? (
        <Loading />
      ) : loadError ? (
        <div className="form-error">{loadError.message}</div>
      ) : blocked ? (
        <div className="stack">
          {candidates.length === 0 && (
            <div className="notice notice-warn">
              No tenants are waiting for a property. A tenant has to create an account first, then they appear here.
            </div>
          )}
          {properties.length === 0 && (
            <div className="notice notice-warn">
              No properties are available. Add a property, or end an existing lease, then try again.
            </div>
          )}
        </div>
      ) : (
        <form id="assign-form" onSubmit={submit}>
          {error && <div className="form-error" role="alert">{error}</div>}
          <Field label="Tenant">
            <select className="select" required value={form.user_id} onChange={set("user_id")}>
              <option value="">Choose a tenant</option>
              {candidates.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.full_name} ({c.email})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Property">
            <select className="select" required value={form.property_id} onChange={set("property_id")}>
              <option value="">Choose a property</option>
              {properties.map((p) => (
                <option key={p.property_id} value={p.property_id}>
                  {p.name}, {p.city} ({money(p.rent_amt)} per month)
                </option>
              ))}
            </select>
          </Field>
          <div className="field-row">
            <Field label="Lease starts">
              <input className="input" type="date" required value={form.lease_start_date} onChange={set("lease_start_date")} />
            </Field>
            <Field label="Lease ends">
              <input
                className="input"
                type="date"
                required
                min={form.lease_start_date}
                value={form.lease_end_date}
                onChange={set("lease_end_date")}
              />
            </Field>
          </div>
          <Field label="Lease agreement" hint="Optional. A PDF up to 5 MB. The tenant can download it from their portal.">
            <input className="input" type="file" accept="application/pdf,.pdf" onChange={pickFile} />
          </Field>
        </form>
      )}
      {blocked && error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}

export default function TenantsPage() {
  const toast = useToast();
  const [tab, setTab] = useState("Active");
  const [assigning, setAssigning] = useState(false);
  const [ending, setEnding] = useState(null);
  const [busy, setBusy] = useState(false);

  const tenants = useApi(tab === "Registered" ? null : `/api/tenants?status=${tab}`);
  const registered = useApi(tab === "Registered" ? "/api/tenants/candidates?all=true" : null);
  const leases = useApi("/api/lease");

  const leaseByTenant = new Map();
  for (const doc of leases.data?.documents ?? []) {
    if (!leaseByTenant.has(doc.tenant_id)) leaseByTenant.set(doc.tenant_id, doc);
  }

  const current = tab === "Registered" ? registered : tenants;
  const rows = tab === "Registered" ? registered.data?.candidates ?? [] : tenants.data?.tenants ?? [];

  function refresh() {
    tenants.reload();
    registered.reload();
    leases.reload();
  }

  async function endLease() {
    setBusy(true);
    try {
      const res = await api(`/api/tenants/${ending.tenant_id}/end`, { method: "POST" });
      toast(
        res.graph_synced === false
          ? "Lease ended. The network graph could not be updated."
          : "Lease ended and the property is available again",
        res.graph_synced === false ? "warn" : "ok"
      );
      setEnding(null);
      refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Tenants" sub="Who lives where, for how long, and the lease on file.">
        <button type="button" className="btn btn-primary" onClick={() => setAssigning(true)}>
          Assign a tenant
        </button>
      </PageHeader>

      <div className="toolbar">
        <Segmented
          label="Tenant list"
          value={tab}
          onChange={setTab}
          options={[
            { value: "Active", label: "Current leases" },
            { value: "Ended", label: "Lease history" },
            { value: "Registered", label: "Registered tenants" },
          ]}
        />
      </div>

      <div className="panel">
        {current.loading && !current.data ? (
          <Loading />
        ) : current.error ? (
          <ErrorNote error={current.error} onRetry={current.reload} />
        ) : rows.length === 0 ? (
          tab === "Active" ? (
            <Empty
              title="No current leases"
              action={
                <button type="button" className="btn btn-primary" onClick={() => setAssigning(true)}>
                  Assign a tenant
                </button>
              }
            >
              Assign a registered tenant to one of your available properties.
            </Empty>
          ) : tab === "Ended" ? (
            <Empty title="No lease history">Leases you end are kept here.</Empty>
          ) : (
            <Empty title="No tenants have registered">People who sign up as tenants appear here.</Empty>
          )
        ) : tab === "Registered" ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Registered</th>
                  <th>Lease</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="cell-title">{r.full_name}</td>
                    <td>{r.email}</td>
                    <td>{r.phone ?? <span className="muted">Not given</span>}</td>
                    <td className="nowrap">{fmtDate(r.created_at)}</td>
                    <td>
                      <Badge value={r.has_active_lease ? "Active" : "Unassigned"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Lease period</th>
                  <th>Status</th>
                  <th>Lease agreement</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const doc = leaseByTenant.get(t.tenant_id);
                  return (
                    <tr key={t.tenant_id}>
                      <td>
                        <div className="cell-title">{t.full_name}</div>
                        <div className="cell-sub">{t.email}</div>
                      </td>
                      <td>
                        <div>{t.property_name}</div>
                        <div className="cell-sub">{money(t.rent_amt)} per month</div>
                      </td>
                      <td className="nowrap">
                        {fmtDate(t.lease_start_date)} to {fmtDate(t.lease_end_date)}
                      </td>
                      <td>
                        <Badge value={t.status} />
                      </td>
                      <td>{doc ? <LeaseButton doc={doc} label="Download" small /> : <span className="muted">None uploaded</span>}</td>
                      <td>
                        {t.status === "Active" && (
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-link btn-link-danger"
                              onClick={() => setEnding(t)}
                            >
                              End lease
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assigning && (
        <AssignModal
          onClose={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            setTab("Active");
            refresh();
          }}
        />
      )}

      {ending && (
        <ConfirmDialog
          title="End this lease?"
          confirmLabel="End lease"
          danger
          busy={busy}
          onConfirm={endLease}
          onClose={() => setEnding(null)}
        >
          <p>
            <strong>{ending.full_name}</strong> moves to lease history and <strong>{ending.property_name}</strong> becomes
            available again.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
