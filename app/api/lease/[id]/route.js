import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { HttpError, handleError, parseId } from "@/lib/http";
import { readLeasePdf } from "@/lib/storage";

// GET /api/lease/:id          downloads the PDF
// GET /api/lease/:id?inline=1 shows it in the browser instead
// Allowed for the landlord who owns the property and the tenant named on the lease.
export async function GET(request, { params }) {
  const { session, error } = await requireAuth(["Landlord", "Tenant"]);
  if (error) return error;

  try {
    const documentId = parseId((await params).id, "document id");

    const { rows } = await query(
      `SELECT d.file_name, d.file_path, t.user_id AS tenant_user_id, p.landlord_id
       FROM lease_documents d
       JOIN tenants t ON t.tenant_id = d.tenant_id
       JOIN properties p ON p.property_id = d.property_id
       WHERE d.document_id = $1`,
      [documentId]
    );
    const doc = rows[0];
    if (!doc) throw new HttpError(404, "Lease document not found");

    const allowed =
      session.role === "Landlord"
        ? doc.landlord_id === session.userId
        : doc.tenant_user_id === session.userId;
    if (!allowed) throw new HttpError(403, "You do not have access to this document");

    let data;
    try {
      data = await readLeasePdf(doc.file_path);
    } catch {
      throw new HttpError(404, "The file for this lease is missing on the server");
    }

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const asciiName = doc.file_name.replace(/[^\w.\- ]+/g, "_");

    return new Response(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(data.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
