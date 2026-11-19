import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, parseDate, parseId, readJson } from "@/lib/http";

// POST /api/payments/generate   (Landlord only, FR4.1)
// body: { tenant_id, payment_month: "YYYY-MM", due_date: "YYYY-MM-DD", amount? }
// Creates a 'Pending' rent record for the tenant's active lease. amount defaults to the property's rent.
// The trg_auto_overdue trigger marks it 'Overdue' straight away if the due date is already past.
export async function POST(request) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;

  try {
    const body = await readJson(request);
    const tenantId = parseId(body.tenant_id, "tenant_id");

    const monthRaw = String(body.payment_month ?? "");
    const monthDate = /^\d{4}-\d{2}$/.test(monthRaw) ? `${monthRaw}-01` : monthRaw;
    parseDate(monthDate, "payment_month");
    const paymentMonth = `${monthDate.slice(0, 7)}-01`;

    const dueDate = parseDate(body.due_date, "due_date");

    let amount = null;
    if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
      amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, "amount must be a number >= 0");
    }

    let rows;
    try {
      ({ rows } = await query(
        `INSERT INTO payments (tenant_id, property_id, amount, due_date, payment_month, status)
         SELECT t.tenant_id, t.property_id, COALESCE($3::numeric, p.rent_amt), $4::date, $5::date, 'Pending'
         FROM tenants t
         JOIN properties p ON p.property_id = t.property_id
         WHERE t.tenant_id = $1 AND p.landlord_id = $2 AND t.status = 'Active'
         RETURNING payment_id, tenant_id, property_id, amount, due_date, payment_month, payment_date, payment_method, status`,
        [tenantId, session.userId, amount, dueDate, paymentMonth]
      ));
    } catch (err) {
      if (err.code === "23505") {
        throw new HttpError(409, "A rent record for this tenant and month already exists");
      }
      throw err;
    }

    if (rows.length === 0) throw new HttpError(404, "No active tenant with that id on your properties");

    return NextResponse.json({ payment: rows[0] }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
