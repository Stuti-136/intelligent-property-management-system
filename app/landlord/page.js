"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks";
import { Badge, Empty, ErrorNote, Loading, PageHeader } from "@/components/ui";
import Facade from "@/components/Facade";
import { fmtDate, money, paymentStatus } from "@/lib/format";

export default function LandlordOverview() {
  const dash = useApi("/api/dashboard");
  const properties = useApi("/api/properties");
  const maintenance = useApi("/api/maintenance");
  const payments = useApi("/api/payments");

  const summary = dash.data?.dashboard;
  const units = (properties.data?.properties ?? []).map((p) => ({
    id: p.property_id,
    label: p.name,
    occupied: p.status === "Occupied",
  }));

  const openRequests = (maintenance.data?.maintenance_requests ?? [])
    .filter((m) => m.status !== "Resolved")
    .slice(0, 5);

  const toCollect = (payments.data?.payments ?? [])
    .map((p) => ({ ...p, effective: paymentStatus(p) }))
    .filter((p) => p.effective !== "Paid")
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    .slice(0, 5);

  const dashError = dash.error
    ? { message: "The dashboard figures could not be read. Run database/views_and_functions.sql in pgAdmin, then reload this page." }
    : null;

  return (
    <>
      <PageHeader title="Overview" sub="Where your properties, rent and repairs stand today.">
        <Link href="/landlord/properties" className="btn btn-primary">
          Add a property
        </Link>
      </PageHeader>

      <section className="hero">
        {properties.loading && !properties.data ? (
          <div className="panel">
            <Loading />
          </div>
        ) : (
          <Facade units={units} emptyText="Add your first property and it appears here as a window." />
        )}

        <div className="panel ledger">
          {dash.loading && !dash.data ? (
            <Loading />
          ) : dashError ? (
            <ErrorNote error={dashError} onRetry={dash.reload} />
          ) : (
            <>
              <div className="ledger-row">
                <span className="ledger-label">Properties</span>
                <span className="ledger-figure">{Number(summary?.total_properties ?? 0)}</span>
              </div>
              <div className="ledger-row">
                <span className="ledger-label">Occupied</span>
                <span className="ledger-figure">{Number(summary?.occupied_properties ?? 0)}</span>
              </div>
              <div className="ledger-row">
                <span className="ledger-label">Open repair requests</span>
                <span className="ledger-figure">{Number(summary?.pending_maintenance_requests ?? 0)}</span>
              </div>
              <div className="ledger-row">
                <span className="ledger-label">Rent collected this month</span>
                <span className="ledger-figure">{money(summary?.total_rent_collected)}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="split">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Open repair requests</h2>
            <Link href="/landlord/maintenance" className="btn btn-link">
              Manage requests
            </Link>
          </div>
          {maintenance.loading && !maintenance.data ? (
            <Loading />
          ) : maintenance.error ? (
            <ErrorNote error={maintenance.error} onRetry={maintenance.reload} />
          ) : openRequests.length === 0 ? (
            <Empty title="Nothing waiting">Repairs your tenants report will show up here.</Empty>
          ) : (
            <div className="rows">
              {openRequests.map((m) => (
                <div className="row" key={m.request_id}>
                  <div className="row-main">
                    <div className="row-title">{m.title}</div>
                    <div className="row-meta">
                      <span>{m.tenant_name}</span>
                      <span>{m.property_name}</span>
                      <span>Sent {fmtDate(m.created_at)}</span>
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

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Rent still to collect</h2>
            <Link href="/landlord/payments" className="btn btn-link">
              Open payments
            </Link>
          </div>
          {payments.loading && !payments.data ? (
            <Loading />
          ) : payments.error ? (
            <ErrorNote error={payments.error} onRetry={payments.reload} />
          ) : toCollect.length === 0 ? (
            <Empty title="All rent is collected">Bills you generate and leave unpaid will show up here.</Empty>
          ) : (
            <div className="rows">
              {toCollect.map((p) => (
                <div className="row" key={p.payment_id}>
                  <div className="row-main">
                    <div className="row-title">{p.tenant_name}</div>
                    <div className="row-meta">
                      <span>{p.property_name}</span>
                      <span>Due {fmtDate(p.due_date)}</span>
                    </div>
                  </div>
                  <div className="row-side">
                    <strong>{money(p.amount)}</strong>
                    <Badge value={p.effective} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
