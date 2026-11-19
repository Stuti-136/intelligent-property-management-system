import { Pool, types } from "pg";

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects
// (OID 1082 is the internal Postgres ID for the DATE type)
types.setTypeParser(1082, (value) => value);

// COUNT(*) is a bigint (OID 20), which pg returns as a string by default.
// Our counts are small, so return real numbers (the dashboard view uses COUNT).
types.setTypeParser(20, (value) => parseInt(value, 10));

// Reuse one pool across hot reloads in development so we don't
// open a new set of connections every time a file changes.
const globalForPg = globalThis;

export const pool =
  globalForPg.pgPool ??
  new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

// Simple parameterised query (always pass values via $1, $2... to avoid SQL injection)
export function query(text, params) {
  return pool.query(text, params);
}

// Runs fn(client) inside BEGIN ... COMMIT, and ROLLBACK if anything throws.
// Use this for the "assign tenant" transaction:
//
//   await withTransaction(async (client) => {
//     const t = await client.query("INSERT ... RETURNING tenant_id", [...]);
//     await client.query("UPDATE properties SET status='Occupied' WHERE property_id=$1", [...]);
//   });
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
