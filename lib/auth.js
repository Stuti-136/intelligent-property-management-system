import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set in .env.local");
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

// Creates a signed JWT and stores it in an httpOnly cookie
// (httpOnly = JavaScript in the browser cannot read it, which protects against XSS theft).
export async function createSession(user) {
  const token = await new SignJWT({
    userId: user.user_id,
    role: user.role,
    name: user.full_name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Returns { userId, role, name } or null if not logged in / token invalid
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { userId: payload.userId, role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

// Use at the top of any protected API route:
//
//   const { session, error } = await requireAuth(["Landlord"]);
//   if (error) return error;
//
// Pass no roles to allow any logged-in user.
export async function requireAuth(allowedRoles = []) {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden for your role" }, { status: 403 }),
    };
  }
  return { session };
}
