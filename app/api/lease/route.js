import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleError } from "@/lib/http";

// GET /api/lease
// Landlord: lease documents for their properties.  Tenant: their own lease documents.
// The server file path is never sent to the browser; files are fetched via /api/lease/:id.
export async function GET() {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  try {
    const where = session.role === "Landlord" ? "p.landlord_id = $1" : "t.user_id = $1";
    const { rows } = await query(
      `SELECT d.document_id, d.tenant_id, d.property_id, d.file_name, d.uploaded_at,
              u.full_name AS tenant_name, p.name AS property_name
       FROM lease_documents d
       JOIN tenants t ON t.tenant_id = d.tenant_id
       JOIN users u ON u.user_id = t.user_id
       JOIN properties p ON p.property_id = d.property_id
       WHERE ${where}
       ORDER BY d.uploaded_at DESC, d.document_id DESC`,
      [session.userId]
    );
    return NextResponse.json({ documents: rows });
  } catch (err) {
    return handleError(err);
  }
}
