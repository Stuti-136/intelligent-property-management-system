"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Badge, Empty, ErrorNote, Loading, PageHeader, Segmented, useToast } from "@/components/ui";
import { PRIORITY_WEIGHT, fmtDate } from "@/lib/format";

export default function MaintenancePage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi("/api/maintenance");
  const [filter, setFilter] = useState("Open");
  const [busyId, setBusyId] = useState(null);

  const all = [...(data?.maintenance_requests ?? [])].sort((a, b) => {
    const done = Number(a.status === "Resolved") - Number(b.status === "Resolved");
    if (done) return done;
    const priority = (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3);
    if (priority) return priority;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const count = (fn) => all.filter(fn).length;
  const shown = all.filter((m) => {
    if (filter === "Open") return m.status !== "Resolved";
    if (filter === "All") return true;
    return m.status === filter;
  });

  async function setStatus(request, status) {
    setBusyId(request.request_id);
    try {
      const res = await api(`/api/maintenance/${request.request_id}`, { method: "PATCH", body: { status } });
      toast(
        res.graph_synced === false ? `Marked ${status.toLowerCase()}. The network graph could not be updated.` : `Marked ${status.toLowerCase()}`,
        res.graph_synced === false ? "warn" : "ok"
      );
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Maintenance" sub="Repair requests from tenants in your properties. The most urgent come first." />

      <div className="toolbar">
        <Segmented
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "Open", label: "Open", count: count((m) => m.status !== "Resolved") },
            { value: "Submitted", label: "Submitted", count: count((m) => m.status === "Submitted") },
            { value: "In Progress", label: "In progress", count: count((m) => m.status === "In Progress") },
            { value: "Resolved", label: "Resolved", count: count((m) => m.status === "Resolved") },
            { value: "All", label: "All", count: all.length },
          ]}
        />
      </div>

      <div className="panel">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorNote error={error} onRetry={reload} />
        ) : shown.length === 0 ? (
          all.length === 0 ? (
            <Empty title="No repair requests">When a tenant reports a problem, it shows up here.</Empty>
          ) : (
            <Empty title="Nothing in this view">Pick another filter to see the rest.</Empty>
          )
        ) : (
          <div className="rows">
            {shown.map((m) => {
              const busy = busyId === m.request_id;
              return (
                <div className="row" key={m.request_id}>
                  <div className="row-main">
                    <div className="row-title">{m.title}</div>
                    <p className="row-text">{m.description}</p>
                    <div className="row-meta">
                      <span>{m.tenant_name}</span>
                      <span>{m.property_name}</span>
                      <span>Sent {fmtDate(m.created_at)}</span>
                      {m.resolved_at && <span>Resolved {fmtDate(m.resolved_at)}</span>}
                    </div>
                  </div>
                  <div className="row-side">
                    <div className="toolbar-group">
                      <Badge value={m.priority} />
                      <Badge value={m.status} />
                    </div>
                    <div className="actions">
                      {m.status === "Submitted" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => setStatus(m, "In Progress")}
                        >
                          Start work
                        </button>
                      )}
                      {m.status !== "Resolved" && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => setStatus(m, "Resolved")}
                        >
                          Mark resolved
                        </button>
                      )}
                      {m.status === "Resolved" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => setStatus(m, "In Progress")}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
