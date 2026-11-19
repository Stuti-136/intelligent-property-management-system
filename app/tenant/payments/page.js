"use client";

import { useApi } from "@/lib/hooks";
import { Badge, Empty, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { fmtDate, fmtMonth, money, paymentStatus } from "@/lib/format";

export default function TenantPaymentsPage() {
  // /api/dashboard reads the tenant_payment_history_view for tenants
  const history = useApi("/api/dashboard");
  // the late fee comes from the calculate_tenant_late_fee() stored function
  const summary = useApi("/api/dashboard/tenant");

  const payments = (history.data?.payment_history ?? [])
    .map((p) => ({ ...p, effective: paymentStatus(p) }))
    .sort((a, b) => (a.payment_month < b.payment_month ? 1 : a.payment_month > b.payment_month ? -1 : b.payment_id - a.payment_id));

  const sum = (pred) => payments.filter(pred).reduce((total, p) => total + Number(p.rent_amount), 0);
  const lateFee = summary.data?.late_fee;

  return (
    <>
      <PageHeader title="Payments" sub="Your rent history and what you still owe." />

      <div className="band" style={{ marginBottom: 16 }}>
        <div className="band-item">
          <div className="band-figure">{money(sum((p) => p.effective !== "Paid"))}</div>
          <div className="band-label">Still to pay</div>
        </div>
        <div className="band-item">
          <div className="band-figure">{money(sum((p) => p.effective === "Overdue"))}</div>
          <div className="band-label">Overdue</div>
        </div>
        <div className="band-item">
          <div className="band-figure">{lateFee == null ? "—" : money(lateFee)}</div>
          <div className="band-label">Late fee at 5% of overdue rent</div>
        </div>
        <div className="band-item">
          <div className="band-figure">{money(sum((p) => p.effective === "Paid"))}</div>
          <div className="band-label">Paid so far</div>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        Your landlord records each payment when they receive it, so a payment shows as paid after that.
      </div>

      <div className="panel">
        {history.loading && !history.data ? (
          <Loading />
        ) : history.error ? (
          <ErrorNote
            error={
              history.error.status === 500
                ? { message: "The payment history could not be read. Ask your landlord to check the database views." }
                : history.error
            }
            onRetry={history.reload}
          />
        ) : payments.length === 0 ? (
          <Empty title="No rent bills yet">Your landlord creates a bill for each month, and it appears here.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rent month</th>
                  <th>Property</th>
                  <th className="num">Amount</th>
                  <th>Due</th>
                  <th>Paid on</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.payment_id}>
                    <td className="cell-title nowrap">{fmtMonth(p.payment_month)}</td>
                    <td>{p.property_name}</td>
                    <td className="num">{money(p.rent_amount)}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
