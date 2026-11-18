
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, readJson } from "@/lib/http";

// GET /api/payments
// Tenant: views their own payment history.
// Landlord: views payments for their properties.
// Optional filter: ?status=Paid or Pending or Overdue.

export async function GET(request) {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const allowedStatuses = ["Paid", "Pending", "Overdue"];

    if (status && !allowedStatuses.includes(status)) {
      throw new HttpError(400, "Invalid payment status filter");
    }

    const params = [session.userId];

    let where =
      session.role === "Landlord"
        ? "p.landlord_id = $1"
        : "t.user_id = $1";

    if (status) {
      params.push(status);
      where += ` AND pay.status = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT
          pay.payment_id,
          t.tenant_id,
          u.full_name AS tenant_name,
          p.property_id,
          p.name AS property_name,
          pay.amount,
          pay.due_date,
          pay.payment_date,
          pay.payment_month,
          pay.payment_method,
          pay.status AS payment_status
       FROM payments pay
       JOIN tenants t ON t.tenant_id = pay.tenant_id
       JOIN users u ON u.user_id = t.user_id
       JOIN properties p ON p.property_id = pay.property_id
       WHERE ${where}
       ORDER BY pay.payment_month DESC, pay.payment_id DESC`,
      params
    );

    return NextResponse.json({ payments: rows });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/payments
// Tenant records a rent payment.
// This is a demonstration, not a real payment gateway.

export async function POST(request) {
  const { session, error } = await requireAuth(["Tenant"]);
  if (error) return error;

  try {
    const body = await readJson(request);

    const paymentId = Number(body.payment_id);
    const paymentMethod = String(body.payment_method ?? "").trim();

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new HttpError(400, "Invalid payment_id");
    }

    if (!paymentMethod || paymentMethod.length > 50) {
      throw new HttpError(
        400,
        "Valid payment_method is required (max 50 characters)"
      );
    }

    const { rows } = await query(
      `UPDATE payments pay
       SET status = 'Paid',
           payment_date = CURRENT_DATE,
           payment_method = $3
       FROM tenants t
       WHERE pay.payment_id = $1
         AND pay.tenant_id = t.tenant_id
         AND t.user_id = $2
         AND pay.status IN ('Pending', 'Overdue')
       RETURNING
         pay.payment_id,
         pay.tenant_id,
         pay.property_id,
         pay.amount,
         pay.due_date,
         pay.payment_date,
         pay.payment_month,
         pay.payment_method,
         pay.status`,
      [paymentId, session.userId, paymentMethod]
    );

    if (rows.length === 0) {
      throw new HttpError(404, "Payment not found or already paid");
    }

    return NextResponse.json(
      {
        message: "Payment recorded successfully",
        payment: rows[0],
      },
      { status: 200 }
    );
  } catch (err) {
    return handleError(err);
  }
}
