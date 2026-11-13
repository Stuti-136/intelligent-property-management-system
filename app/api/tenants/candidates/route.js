import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleError } from "@/lib/http";

// GET /api/tenants/candidates
// Registered Tenant-role users who have no active lease: the people a landlord can assign.
export async function GET() {
  const { error } = await requireAuth(["Landlord"]);
  if (error) return error;
  try {
    const { rows } = await query(
      `SELECT u.user_id, u.full_name, u.email, u.phone
       FROM users u
       WHERE u.role = 'Tenant'
         AND NOT EXISTS (
           SELECT 1 FROM tenants t WHERE t.user_id = u.user_id AND t.status = 'Active'
         )
       ORDER BY u.full_name`
    );
    return NextResponse.json({ candidates: rows });
  } catch (err) {
    return handleError(err);
  }
}
