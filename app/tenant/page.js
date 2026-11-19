"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks";
import { Badge, Empty, ErrorNote, LeaseButton, Loading, PageHeader } from "@/components/ui";
import { fmtDate, money, paymentStatus } from "@/lib/format";

export default function TenantOverview() {
  const { data, error, loading, reload } = useApi("/api/dashboard/tenant");

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Overview" />
        <div className="panel">
          <Loading />
        </div>
      </>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader title="Overview" />
        <div className="panel">
          <ErrorNote error={error} onRetry={reload} />
        </div>
      </>
    );
  }

  const { tenancy, next_payment, overdue_rent, late_fee, active_requests, lease_document } = data;

  if (!tenancy) {
    return (
      <>
        <PageHeader title="Overview" />
        <div className="panel">
          <Empty title="You are not assigned to a property yet">
            Once your landlord assigns you to a property, your rent, repairs and lease appear here. Share the email you
            registered with so they can find you.
          </Empty>
        </div>
      </>
    );
  }

  const next = next_payment ? { ...next_payment, effective: paymentStatus(next_payment) } : null;

  return (
    <>
      <PageHeader title={tenancy.name} sub={`${tenancy.address}, ${tenancy.city}`}>
        <Link href="/tenant/maintenance" className="btn btn-primary">
          Report a problem
        </Link>
      </PageHeader>

      <div className="band" style={{ marginBottom: 20 }}>
        <div className="band-item">
          <div className="band-figure">{next ? money(next.amount) : "Nothing due"}</div>
          <div className="band-label">Next rent payment</div>
          {next && (
            <div className="band-note">
              <Badge value={next.effective} /> <span className="muted">due {fmtDate(next.due_date)}</span>
            </div>
          )}
        </div>
        <div className="band-item">
          <div className="band-figure">{overdue_rent == null ? "—" : money(overdue_rent)}</div>
          <div className="band-label">Overdue rent</div>
        </div>
        <div className="band-item">
          <div className="band-figure">{late_fee == null ? "—" : money(late_fee)}</div>
          <div className="band-label">Late fee at 5% of overdue rent</div>
        </div>
        <div className="band-item">
          <div className="band-figure">{active_requests.length}</div>
          <div className="band-label">Open repair requests</div>
        </div>
      </div>

      <section className="split">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Your home</h2>
            <Badge value={tenancy.status} />
          </div>
          <div className="panel-body">
            <dl className="facts">
              <dt>Rent</dt>
              <dd>{money(tenancy.rent_amt)} per month</dd>
              <dt>Lease period</dt>
              <dd>
                {fmtDate(tenancy.lease_start_date)} to {fmtDate(tenancy.lease_end_date)}
              </dd>
              <dt>Landlord</dt>
              <dd>{tenancy.landlord_name}</dd>
              <dt>Contact</dt>
              <dd>
                {tenancy.landlord_email}
                {tenancy.landlord_phone ? `, ${tenancy.landlord_phone}` : ""}
              </dd>
              {tenancy.description && (
                <>
                  <dt>About</dt>
                  <dd>{tenancy.description}</dd>
                </>
              )}
            </dl>
          </div>
          <div className="panel-head" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
            <div>
              <div className="cell-title">Lease agreement</div>
              <div className="cell-sub">
                {lease_document
                  ? `${lease_document.file_name}, added ${fmtDate(lease_document.uploaded_at)}`
                  : "Your landlord has not uploaded a lease yet."}
              </div>
            </div>
            {lease_document && <LeaseButton doc={lease_document} label="Download lease" />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Open repair requests</h2>
            <Link href="/tenant/maintenance" className="btn btn-link">
              See all
            </Link>
          </div>
          {active_requests.length === 0 ? (
            <Empty title="No open requests">If something needs fixing, report it and your landlord will see it.</Empty>
          ) : (
            <div className="rows">
              {active_requests.slice(0, 5).map((r) => (
                <div className="row" key={r.request_id}>
                  <div className="row-main">
                    <div className="row-title">{r.title}</div>
                    <div className="row-meta">
                      <span>Sent {fmtDate(r.created_at)}</span>
                    </div>
                  </div>
                  <div className="row-side">
                    <Badge value={r.status} />
                    <Badge value={r.priority} />
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
