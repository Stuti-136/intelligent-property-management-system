
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { safely, syncMaintenanceRequest } from "@/lib/graph";
import { HttpError, handleError, readJson } from "@/lib/http";

// GET /api/maintenance
// Tenant: views their own maintenance requests.
// Landlord: views requests for their properties.

export async function GET(request) {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const allowedStatuses = ["Submitted", "In Progress", "Resolved"];

    if (status && !allowedStatuses.includes(status)) {
      throw new HttpError(400, "Invalid maintenance status filter");
    }

    const params = [session.userId];

    let where =
      session.role === "Landlord"
        ? "p.landlord_id = $1"
        : "t.user_id = $1";

    if (status) {
      params.push(status);
      where += ` AND mr.status = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT
          mr.request_id,
          mr.tenant_id,
          u.full_name AS tenant_name,
          mr.property_id,
          p.name AS property_name,
          mr.title,
          mr.description,
          mr.status,
          mr.priority,
          mr.created_at,
          mr.resolved_at
       FROM maintenance_requests mr
       JOIN tenants t ON t.tenant_id = mr.tenant_id
       JOIN users u ON u.user_id = t.user_id
       JOIN properties p ON p.property_id = mr.property_id
       WHERE ${where}
       ORDER BY mr.created_at DESC, mr.request_id DESC`,
      params
    );

    return NextResponse.json({ maintenance_requests: rows });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/maintenance
// Tenant submits a maintenance request for their active tenancy.

export async function POST(request) {
  const { session, error } = await requireAuth(["Tenant"]);
  if (error) return error;

  try {
    const body = await readJson(request);

    const propertyId = Number(body.property_id);
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const priority = String(body.priority ?? "").trim();

    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new HttpError(400, "Invalid property_id");
    }

    if (!title || title.length > 150) {
      throw new HttpError(400, "Valid title is required (max 150 characters)");
    }

    if (!description) {
      throw new HttpError(400, "Description is required");
    }

    if (!priority || priority.length > 20) {
      throw new HttpError(400, "Valid priority is required (max 20 characters)");
    }

    const { rows } = await query(
      `INSERT INTO maintenance_requests (
          tenant_id,
          property_id,
          title,
          description,
          priority,
          status
       )
       SELECT
          t.tenant_id,
          t.property_id,
          $3,
          $4,
          $5,
          'Submitted'
       FROM tenants t
       WHERE t.user_id = $1
         AND t.property_id = $2
         AND t.status = 'Active'
       RETURNING *`,
      [session.userId, propertyId, title, description, priority]
    );

    if (rows.length === 0) {
      throw new HttpError(
        403,
        "No active tenancy found for this property"
      );
    }

    const { rows: userRows } = await query(
      `SELECT full_name FROM users WHERE user_id = $1`,
      [session.userId]
    );

    const graphSynced = await safely(() =>
      syncMaintenanceRequest({
        requestId: rows[0].request_id,
        userId: session.userId,
        fullName: userRows[0]?.full_name ?? "Tenant",
        propertyId: rows[0].property_id,
        title: rows[0].title,
        description: rows[0].description,
        status: rows[0].status,
        priority: rows[0].priority,
      })
    );

    return NextResponse.json(
      {
        message: "Maintenance request submitted successfully",
        maintenance_request: rows[0],
        graph_synced: graphSynced
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}
