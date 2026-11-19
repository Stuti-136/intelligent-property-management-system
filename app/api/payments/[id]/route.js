import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, parseId, readJson } from "@/lib/http";

// PATCH /api/payments/:id   (Landlord only, FR4.2)
// body: { payment_method }
// Marks a Pending or Overdue payment as 'Paid' today and records how it was paid.
export async function PATCH(request, { params }) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;

  try {
    const paymentId = parseId((await params).id, "payment id");
    const body = await readJson(request);

    const method = String(body.payment_method ?? "").trim();
    if (!method || method.length > 50) {
      throw new HttpError(400, "payment_method is required (max 50 characters)");
    }

    const { rows } = await query(
      `UPDATE payments pay
       SET status = 'Paid',
           payment_date = CURRENT_DATE,
           payment_method = $3
       FROM properties p
       WHERE pay.payment_id = $1
         AND p.property_id = pay.property_id
         AND p.landlord_id = $2
         AND pay.status IN ('Pending', 'Overdue')
       RETURNING pay.payment_id, pay.tenant_id, pay.property_id, pay.amount, pay.due_date,
                 pay.payment_date, pay.payment_month, pay.payment_method, pay.status`,
      [paymentId, session.userId, method]
    );

    if (rows.length === 0) {
      throw new HttpError(404, "Payment not found on your properties, or it is already paid");
    }
    return NextResponse.json({ payment: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
