import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleError } from "@/lib/http";

// GET /api/tenants/candidates
//   default:    registered Tenant users with no active lease (the people a landlord can assign)
//   ?all=true:  every registered Tenant user, with has_active_lease (FR3.1)
export async function GET(request) {
  const { error } = await requireAuth(["Landlord"]);
  if (error) return error;
  try {
    const all = new URL(request.url).searchParams.get("all") === "true";
    const { rows } = await query(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.created_at,
              EXISTS (
                SELECT 1 FROM tenants t WHERE t.user_id = u.user_id AND t.status = 'Active'
              ) AS has_active_lease
       FROM users u
       WHERE u.role = 'Tenant'
         ${all ? "" : "AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.user_id = u.user_id AND t.status = 'Active')"}
       ORDER BY u.full_name`
    );
    return NextResponse.json({ candidates: rows });
  } catch (err) {
    return handleError(err);
  }
}
