import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, parseId, readJson } from "@/lib/http";
import { deleteProperty, safely, syncProperty } from "@/lib/graph";

// Loads a property and checks the caller is allowed to see it.
async function loadAuthorised(session, propertyId) {
  const { rows } = await query(
    `SELECT property_id, landlord_id, name, address, city, rent_amt, status, description, created_at
     FROM properties WHERE property_id = $1`,
    [propertyId]
  );
  const property = rows[0];
  if (!property) throw new HttpError(404, "Property not found");

  if (session.role === "Landlord") {
    if (property.landlord_id !== session.userId) throw new HttpError(403, "Not your property");
  } else {
    const t = await query(
      `SELECT 1 FROM tenants WHERE user_id = $1 AND property_id = $2 AND status = 'Active'`,
      [session.userId, propertyId]
    );
    if (t.rowCount === 0) throw new HttpError(403, "You do not rent this property");
  }
  return property;
}

export async function GET(request, { params }) {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;
  try {
    const propertyId = parseId((await params).id, "property id");
    const property = await loadAuthorised(session, propertyId);
    return NextResponse.json({ property });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH: landlord edits details. Status is NOT editable here, it is controlled by assigning/ending leases.
export async function PATCH(request, { params }) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;
  try {
    const propertyId = parseId((await params).id, "property id");
    await loadAuthorised(session, propertyId);
    const body = await readJson(request);

    const fields = [];
    const values = [];
    const add = (col, val) => {
      values.push(val);
      fields.push(`${col} = $${values.length}`);
    };

    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (!v || v.length > 100) throw new HttpError(400, "Invalid name");
      add("name", v);
    }
    if (body.address !== undefined) {
      const v = String(body.address).trim();
      if (!v || v.length > 255) throw new HttpError(400, "Invalid address");
      add("address", v);
    }
    if (body.city !== undefined) {
      const v = String(body.city).trim();
      if (!v || v.length > 100) throw new HttpError(400, "Invalid city");
      add("city", v);
    }
    if (body.rent_amt !== undefined) {
      const v = Number(body.rent_amt);
      if (!Number.isFinite(v) || v < 0) throw new HttpError(400, "rent_amt must be a number >= 0");
      add("rent_amt", v);
    }
    if (body.description !== undefined) {
      add("description", body.description ? String(body.description).trim() : null);
    }
    if (fields.length === 0) throw new HttpError(400, "No valid fields to update");

    values.push(propertyId);
    const { rows } = await query(
      `UPDATE properties SET ${fields.join(", ")}
       WHERE property_id = $${values.length}
       RETURNING property_id, landlord_id, name, address, city, rent_amt, status, description, created_at`,
      values
    );
    const property = rows[0];
    const graphSynced = await safely(() =>
      syncProperty({ landlordId: session.userId, landlordName: session.name, property })
    );
    return NextResponse.json({ property, graph_synced: graphSynced });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE: blocked by foreign keys (409) if the property has tenants, payments, requests or documents.
export async function DELETE(request, { params }) {
  const { session, error } = await requireAuth(["Landlord"]);
  if (error) return error;
  try {
    const propertyId = parseId((await params).id, "property id");
    await loadAuthorised(session, propertyId);
    await query(`DELETE FROM properties WHERE property_id = $1`, [propertyId]);
    const graphSynced = await safely(() => deleteProperty(propertyId));
    return NextResponse.json({ ok: true, graph_synced: graphSynced });
  } catch (err) {
    return handleError(err);
  }
}
