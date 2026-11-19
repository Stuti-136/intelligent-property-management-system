import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleError } from "@/lib/http";

// GET /api/dashboard/tenant   (Tenant only, FR6.2)
// One call for everything the tenant dashboard shows: current property, next rent due,
// active maintenance requests, lease document, and the two stored functions
// calculate_tenant_overdue_rent() and calculate_tenant_late_fee().
export async function GET() {
  const { session, error } = await requireAuth(["Tenant"]);
  if (error) return error;

  try {
    const tenancyRes = await query(
      `SELECT t.tenant_id, t.property_id, t.lease_start_date, t.lease_end_date, t.status,
              p.name, p.address, p.city, p.rent_amt, p.description,
              l.full_name AS landlord_name, l.email AS landlord_email, l.phone AS landlord_phone
       FROM tenants t
       JOIN properties p ON p.property_id = t.property_id
       JOIN users l ON l.user_id = p.landlord_id
       WHERE t.user_id = $1 AND t.status = 'Active'
       ORDER BY t.lease_start_date DESC
       LIMIT 1`,
      [session.userId]
    );
    const tenancy = tenancyRes.rows[0] ?? null;

    if (!tenancy) {
      return NextResponse.json({
        tenancy: null,
        next_payment: null,
        overdue_rent: 0,
        late_fee: 0,
        active_requests: [],
        lease_document: null,
      });
    }

    const tenantId = tenancy.tenant_id;

    const [nextPayment, requests, lease] = await Promise.all([
      query(
        `SELECT payment_id, amount, due_date, payment_month, status
         FROM payments
         WHERE tenant_id = $1 AND status IN ('Pending', 'Overdue')
         ORDER BY due_date ASC
         LIMIT 1`,
        [tenantId]
      ),
      query(
        `SELECT request_id, title, priority, status, created_at
         FROM maintenance_requests
         WHERE tenant_id = $1 AND status <> 'Resolved'
         ORDER BY created_at DESC, request_id DESC`,
        [tenantId]
      ),
      query(
        `SELECT document_id, file_name, uploaded_at
         FROM lease_documents
         WHERE tenant_id = $1
         ORDER BY uploaded_at DESC, document_id DESC
         LIMIT 1`,
        [tenantId]
      ),
    ]);

    // Stored functions. If they have not been created in this database yet, the rest of the
    // dashboard should still load, so a failure here is logged and reported as null.
    let overdueRent = null;
    let lateFee = null;
    try {
      const fn = await query(
        `SELECT calculate_tenant_overdue_rent($1) AS overdue_rent,
                calculate_tenant_late_fee($1) AS late_fee`,
        [tenantId]
      );
      overdueRent = fn.rows[0].overdue_rent;
      lateFee = fn.rows[0].late_fee;
    } catch (err) {
      console.error("Stored function call failed:", err.message);
    }

    return NextResponse.json({
      tenancy,
      next_payment: nextPayment.rows[0] ?? null,
      overdue_rent: overdueRent,
      late_fee: lateFee,
      active_requests: requests.rows,
      lease_document: lease.rows[0] ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
}
