
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleError } from "@/lib/http";

// GET /api/dashboard
// Landlord: receives summary from landlord_dashboard_summary_view.
// Tenant: receives payment history from tenant_payment_history_view.

export async function GET() {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  try {
    if (session.role === "Landlord") {
      const { rows } = await query(
        `SELECT *
         FROM landlord_dashboard_summary_view
         WHERE landlord_id = $1`,
        [session.userId]
      );

      return NextResponse.json({
        role: "Landlord",
        dashboard: rows[0] ?? null
      });
    }

    const { rows } = await query(
      `SELECT *
       FROM tenant_payment_history_view
       WHERE tenant_id IN (
         SELECT tenant_id
         FROM tenants
         WHERE user_id = $1
       )
       ORDER BY payment_id DESC`,
      [session.userId]
    );

    return NextResponse.json({
      role: "Tenant",
      payment_history: rows
    });
  } catch (err) {
    return handleError(err);
  }
}
