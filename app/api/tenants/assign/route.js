import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, parseDate, parseId, readJson } from "@/lib/http";
import { safely, syncTenancy } from "@/lib/graph";

// POST /api/tenants/assign   (Landlord only)
// body: { user_id, property_id, lease_start_date, lease_end_date?, file_name?, file_path? }
//
// ONE TRANSACTION, three steps (all succeed or none do):
//   1. insert the tenant row
//   2. mark the property 'Occupied'
//   3. insert the lease document metadata (if provided)
export async function POST(request) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;

  try {
    const body = await readJson(request);
    const userId = parseId(body.user_id, "user_id");
    const propertyId = parseId(body.property_id, "property_id");
    const start = parseDate(body.lease_start_date, "lease_start_date");
    const end = body.lease_end_date ? parseDate(body.lease_end_date, "lease_end_date") : null;
    if (end && end < start) throw new HttpError(400, "lease_end_date cannot be before lease_start_date");

    const fileName = body.file_name ? String(body.file_name).trim() : null;
    const filePath = body.file_path ? String(body.file_path).trim() : null;
    if (fileName && !filePath) throw new HttpError(400, "file_path is required when file_name is given");
    if (filePath && !fileName) throw new HttpError(400, "file_name is required when file_path is given");

    const result = await withTransaction(async (client) => {
      // Lock the property row so two requests can't assign it at the same time.
      const prop = await client.query(
        `SELECT property_id, landlord_id, status FROM properties WHERE property_id = $1 FOR UPDATE`,
        [propertyId]
      );
      if (prop.rowCount === 0) throw new HttpError(404, "Property not found");
      if (prop.rows[0].landlord_id !== session.userId) throw new HttpError(403, "Not your property");
      if (prop.rows[0].status !== "Available") throw new HttpError(409, "Property is not available");

      const usr = await client.query(`SELECT role, full_name FROM users WHERE user_id = $1`, [userId]);
      if (usr.rowCount === 0) throw new HttpError(404, "User not found");
      if (usr.rows[0].role !== "Tenant") throw new HttpError(400, "That user is not a Tenant");

      // Step 1
      const t = await client.query(
        `INSERT INTO tenants (user_id, property_id, lease_start_date, lease_end_date, status)
         VALUES ($1, $2, $3, $4, 'Active')
         RETURNING tenant_id, user_id, property_id, lease_start_date, lease_end_date, status`,
        [userId, propertyId, start, end]
      );
      const tenant = t.rows[0];

      // Step 2
      await client.query(`UPDATE properties SET status = 'Occupied' WHERE property_id = $1`, [propertyId]);

      // Step 3
      let document = null;
      if (fileName) {
        const d = await client.query(
          `INSERT INTO lease_documents (tenant_id, property_id, file_name, file_path)
           VALUES ($1, $2, $3, $4)
           RETURNING document_id, file_name, file_path, uploaded_at`,
          [tenant.tenant_id, propertyId, fileName, filePath]
        );
        document = d.rows[0];
      }
      return { tenant, document, tenantName: usr.rows[0].full_name };
    });

    // Mirror into Neo4j only AFTER the SQL transaction has committed.
    const graphSynced = await safely(() =>
      syncTenancy({
        tenantId: result.tenant.tenant_id,
        userId,
        fullName: result.tenantName,
        propertyId,
        start,
        end,
      })
    );

    return NextResponse.json(
      { tenant: result.tenant, document: result.document, graph_synced: graphSynced },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}
