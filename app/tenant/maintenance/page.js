"use client";

import { Fragment, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Badge, Empty, ErrorNote, Field, Loading, PageHeader, Segmented, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/format";

const STEPS = [
  { status: "Submitted", label: "Submitted" },
  { status: "In Progress", label: "In progress" },
  { status: "Resolved", label: "Resolved" },
];

function Steps({ status }) {
  const reached = STEPS.findIndex((s) => s.status === status);
  return (
    <div className="steps" aria-label={`Status: ${status}`}>
      {STEPS.map((s, i) => (
        <Fragment key={s.status}>
          {i > 0 && <span className="step-line" />}
          <span className={`step ${i <= reached ? "step-done" : ""}`}>{s.label}</span>
        </Fragment>
      ))}
    </div>
  );
}

export default function TenantMaintenancePage() {
  const toast = useToast();
  const tenancyRes = useApi("/api/tenants?status=Active");
  const requests = useApi("/api/maintenance");

  const tenancy = tenancyRes.data?.tenants?.[0];
  const list = requests.data?.maintenance_requests ?? [];

  const [form, setForm] = useState({ title: "", description: "", priority: "Medium" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api("/api/maintenance", {
        method: "POST",
        body: { ...form, property_id: tenancy.property_id },
      });
      toast(
        res.graph_synced === false
          ? "Request sent. The network graph could not be updated."
          : "Request sent to your landlord",
        res.graph_synced === false ? "warn" : "ok"
      );
      setForm({ title: "", description: "", priority: "Medium" });
      requests.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Maintenance" sub="Tell your landlord what needs fixing and follow its progress." />

      <div className="split-wide">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Report a problem</h2>
          </div>
          <div className="panel-body">
            {tenancyRes.loading && !tenancyRes.data ? (
              <Loading />
            ) : !tenancy ? (
              <div className="notice notice-warn">
                You can report a problem once your landlord has assigned you to a property.
              </div>
            ) : (
              <form onSubmit={submit}>
                {error && <div className="form-error" role="alert">{error}</div>}
                <p className="muted" style={{ marginBottom: 14 }}>
                  For {tenancy.property_name}
                </p>
                <Field label="What is the problem?">
                  <input
                    className="input"
                    required
                    maxLength={150}
                    placeholder="For example, the kitchen tap is leaking"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </Field>
                <Field label="Details">
                  <textarea
                    className="textarea"
                    required
                    placeholder="Where it is, when it started, anything that helps"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </Field>
                <div className="field">
                  <span className="field-label">How urgent is it?</span>
                  <Segmented
                    label="Priority"
                    value={form.priority}
                    onChange={(priority) => setForm((f) => ({ ...f, priority }))}
                    options={[
                      { value: "Low", label: "Low" },
                      { value: "Medium", label: "Medium" },
                      { value: "High", label: "High" },
                    ]}
                  />
                </div>
                <div style={{ marginTop: 18 }}>
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? "Sending…" : "Send request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Your requests</h2>
          </div>
          {requests.loading && !requests.data ? (
            <Loading />
          ) : requests.error ? (
            <ErrorNote error={requests.error} onRetry={requests.reload} />
          ) : list.length === 0 ? (
            <Empty title="No requests yet">Problems you report appear here with their progress.</Empty>
          ) : (
            <div className="rows">
              {list.map((m) => (
                <div className="row" key={m.request_id}>
                  <div className="row-main">
                    <div className="row-title">{m.title}</div>
                    <p className="row-text">{m.description}</p>
                    <div style={{ marginTop: 10 }}>
                      <Steps status={m.status} />
                    </div>
                    <div className="row-meta">
                      <span>Sent {fmtDate(m.created_at)}</span>
                      {m.resolved_at && <span>Resolved {fmtDate(m.resolved_at)}</span>}
                    </div>
                  </div>
                  <div className="row-side">
                    <Badge value={m.priority} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
