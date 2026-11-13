import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError } from "@/lib/http";

// GET /api/tenants?status=Active
// Landlord: all tenancies on their properties.  Tenant: their own tenancies.
export async function GET(request) {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  try {
    const status = new URL(request.url).searchParams.get("status");
    const params = [session.userId];
    let where = session.role === "Landlord" ? "p.landlord_id = $1" : "t.user_id = $1";
    if (status) {
      if (!["Active", "Ended"].includes(status)) throw new HttpError(400, "Invalid status filter");
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT t.tenant_id, t.user_id, u.full_name, u.email, u.phone,
              t.property_id, p.name AS property_name, p.rent_amt,
              t.lease_start_date, t.lease_end_date, t.status
       FROM tenants t
       JOIN users u ON u.user_id = t.user_id
       JOIN properties p ON p.property_id = t.property_id
       WHERE ${where}
       ORDER BY t.lease_start_date DESC`,
      params
    );
    return NextResponse.json({ tenants: rows });
  } catch (err) {
    return handleError(err);
  }
}
