import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Lease PDFs are stored on the local server (not in the database).
// The database only keeps the file name and path (FR3.6).
const LEASE_DIR = path.join(process.cwd(), "uploads", "leases");

export const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

export function isPdfBuffer(buffer) {
  return buffer.length > 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

// Saves the PDF under a random name and returns the path stored in lease_documents.file_path
export async function saveLeasePdf(buffer) {
  await fs.mkdir(LEASE_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.pdf`;
  await fs.writeFile(path.join(LEASE_DIR, name), buffer);
  return `uploads/leases/${name}`;
}

// Turns a stored path into an absolute path that is guaranteed to stay inside uploads/leases.
// Only the file name part is used, so a value like "../../.env" cannot escape the folder.
export function resolveLeasePath(stored) {
  const base = path.basename(String(stored).replace(/\\/g, "/"));
  return path.join(LEASE_DIR, base);
}

export async function readLeasePdf(stored) {
  return fs.readFile(resolveLeasePath(stored));
}

export async function removeLeasePdf(stored) {
  try {
    await fs.unlink(resolveLeasePath(stored));
  } catch {
    /* already gone */
  }
}
