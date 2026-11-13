import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT user_id, full_name, email, phone, role, password_hash
       FROM users WHERE email = $1`,
      [email]
    );
    const user = rows[0];

    // Same message for "no such user" and "wrong password" so attackers can't probe for emails
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user);
    const { password_hash, ...safeUser } = user; // never send the hash to the client
    return NextResponse.json({ user: safeUser });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
