
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { safely, syncMaintenanceStatus } from "@/lib/graph";
import {
  HttpError,
  handleError,
  readJson,
  parseId
} from "@/lib/http";

// PATCH /api/maintenance/:id
// Landlord updates the status of a maintenance request.

export async function PATCH(request, { params }) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;

  try {
    const { id } = await params;
    const requestId = parseId(id, "maintenance request ID");

    const body = await readJson(request);
    const status = String(body.status ?? "").trim();

    const allowedStatuses = ["Submitted", "In Progress", "Resolved"];

    if (!allowedStatuses.includes(status)) {
      throw new HttpError(
        400,
        "Status must be Submitted, In Progress, or Resolved"
      );
    }

    const { rows } = await query(
      `UPDATE maintenance_requests mr
       SET status = $3::text,
           resolved_at = CASE
             WHEN $3 = 'Resolved' THEN CURRENT_TIMESTAMP
             ELSE NULL
           END
       FROM properties p
       WHERE mr.request_id = $1
         AND mr.property_id = p.property_id
         AND p.landlord_id = $2
       RETURNING mr.*`,
      [requestId, session.userId, status]
    );

    if (rows.length === 0) {
      throw new HttpError(
        404,
        "Maintenance request not found for this landlord"
      );
    }

    const graphSynced = await safely(() =>
      syncMaintenanceStatus({
        requestId,
        status
      })
    );

    return NextResponse.json({
      message: "Maintenance status updated successfully",
      maintenance_request: rows[0],
      graph_synced: graphSynced
    });
  } catch (err) {
    return handleError(err);
  }
}
