import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, readJson } from "@/lib/http";
import { safely, syncProperty } from "@/lib/graph";

// GET /api/properties?status=Available&city=Gotham&q=loft
// Landlord: their own properties (with current tenant name).
// Tenant:   the property they currently rent.
export async function GET(request) {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const city = searchParams.get("city");
    const q = searchParams.get("q");

    if (session.role === "Tenant") {
      const { rows } = await query(
        `SELECT p.property_id, p.name, p.address, p.city, p.rent_amt, p.status, p.description,
                u.full_name AS landlord_name, u.phone AS landlord_phone, u.email AS landlord_email
         FROM tenants t
         JOIN properties p ON p.property_id = t.property_id
         JOIN users u ON u.user_id = p.landlord_id
         WHERE t.user_id = $1 AND t.status = 'Active'`,
        [session.userId]
      );
      return NextResponse.json({ properties: rows });
    }

    // Landlord: build the WHERE clause dynamically but always with parameters ($n), never string concatenation of values
    const params = [session.userId];
    let where = "p.landlord_id = $1";
    if (status) {
      if (!["Available", "Occupied"].includes(status)) throw new HttpError(400, "Invalid status filter");
      params.push(status);
      where += ` AND p.status = $${params.length}`;
    }
    if (city) {
      params.push(`%${city}%`);
      where += ` AND p.city ILIKE $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.address ILIKE $${params.length})`;
    }

    const { rows } = await query(
      `SELECT p.property_id, p.name, p.address, p.city, p.rent_amt, p.status, p.description, p.created_at,
              t.tenant_id, u.full_name AS tenant_name
       FROM properties p
       LEFT JOIN tenants t ON t.property_id = p.property_id AND t.status = 'Active'
       LEFT JOIN users u ON u.user_id = t.user_id
       WHERE ${where}
       ORDER BY p.created_at DESC`,
      params
    );
    return NextResponse.json({ properties: rows });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/properties  (Landlord only)
export async function POST(request) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;

  try {
    const body = await readJson(request);
    const name = String(body.name ?? "").trim();
    const address = String(body.address ?? "").trim();
    const city = String(body.city ?? "").trim();
    const description = body.description ? String(body.description).trim() : null;
    const rent = Number(body.rent_amt);

    if (!name || name.length > 100) throw new HttpError(400, "Name is required (max 100 chars)");
    if (!address || address.length > 255) throw new HttpError(400, "Address is required (max 255 chars)");
    if (!city || city.length > 100) throw new HttpError(400, "City is required (max 100 chars)");
    if (!Number.isFinite(rent) || rent < 0) throw new HttpError(400, "rent_amt must be a number >= 0");

    // New properties always start as 'Available'. Status changes happen through tenant assignment.
    const { rows } = await query(
      `INSERT INTO properties (landlord_id, name, address, city, rent_amt, status, description)
       VALUES ($1, $2, $3, $4, $5, 'Available', $6)
       RETURNING property_id, landlord_id, name, address, city, rent_amt, status, description, created_at`,
      [session.userId, name, address, city, rent, description]
    );
    const property = rows[0];

    // Mirror into Neo4j AFTER the SQL insert succeeded. A Neo4j failure does not undo the SQL data.
    const graphSynced = await safely(() =>
      syncProperty({ landlordId: session.userId, landlordName: session.name, property })
    );

    return NextResponse.json({ property, graph_synced: graphSynced }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
