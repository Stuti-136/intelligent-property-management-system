import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";

const ROLES = ["Landlord", "Tenant"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const phone = body.phone ? String(body.phone).trim() : null;
  const role = body.role;

  // Basic input validation (the database CHECK/NOT NULL constraints are the second line of defence)
  if (!fullName || fullName.length > 100) {
    return NextResponse.json({ error: "Full name is required (max 100 chars)" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 100) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Role must be Landlord or Tenant" }, { status: 400 });
  }
  if (phone && phone.length > 15) {
    return NextResponse.json({ error: "Phone must be at most 15 characters" }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await query(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, full_name, email, phone, role, created_at`,
      [fullName, email, phone, passwordHash, role]
    );

    const user = rows[0];
    await createSession(user); // log the new user in straight away
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err.code === "23505") {
      // unique_violation on users.email
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
