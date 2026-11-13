import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// Returns the logged-in user's session info. Handy for the frontend and for testing role checks.
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;
  return NextResponse.json({ user: session });
}
