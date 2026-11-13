import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, parseId } from "@/lib/http";
import { safely, syncLeaseEnded } from "@/lib/graph";

// POST /api/tenants/:id/end   (Landlord only)
// Ends a lease: tenant -> 'Ended', property -> 'Available', in one transaction.
export async function POST(request, { params }) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;

  try {
    const tenantId = parseId((await params).id, "tenant id");

    const tenant = await withTransaction(async (client) => {
      const found = await client.query(
        `SELECT t.tenant_id, t.property_id, t.status, p.landlord_id
         FROM tenants t
         JOIN properties p ON p.property_id = t.property_id
         WHERE t.tenant_id = $1
         FOR UPDATE OF t`,
        [tenantId]
      );
      if (found.rowCount === 0) throw new HttpError(404, "Tenancy not found");
      const row = found.rows[0];
      if (row.landlord_id !== session.userId) throw new HttpError(403, "Not your property");
      if (row.status !== "Active") throw new HttpError(409, "Lease is already ended");

      // End date = today (or the start date if the lease hasn't started yet, to satisfy chk_lease_dates)
      const upd = await client.query(
        `UPDATE tenants
         SET status = 'Ended',
             lease_end_date = GREATEST(CURRENT_DATE, lease_start_date)
         WHERE tenant_id = $1
         RETURNING tenant_id, user_id, property_id, lease_start_date, lease_end_date, status`,
        [tenantId]
      );
      await client.query(`UPDATE properties SET status = 'Available' WHERE property_id = $1`, [row.property_id]);
      return upd.rows[0];
    });

    const graphSynced = await safely(() =>
      syncLeaseEnded({ tenantId: tenant.tenant_id, propertyId: tenant.property_id })
    );
    return NextResponse.json({ tenant, graph_synced: graphSynced });
  } catch (err) {
    return handleError(err);
  }
}
