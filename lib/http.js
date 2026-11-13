import { NextResponse } from "next/server";

// Throw this anywhere (including inside a transaction) to send a clean error response.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function parseId(value, label = "id") {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${label}`);
  return n;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(value, label) {
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${label} must be a valid date (YYYY-MM-DD)`);
  }
  return value;
}

// Converts any thrown error into a JSON response.
// Postgres error codes: 23503 = foreign key, 23505 = unique, 23514 = CHECK, 23502 = NOT NULL
export function handleError(err) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err.code === "23503") {
    return NextResponse.json(
      { error: "Operation blocked: other records still reference this row" },
      { status: 409 }
    );
  }
  if (err.code === "23505") {
    return NextResponse.json({ error: "Duplicate value violates a unique rule" }, { status: 409 });
  }
  if (err.code === "23514" || err.code === "23502" || err.code === "22001") {
    return NextResponse.json({ error: "Data violates a database constraint" }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
