// One-off backfill: copies the EXISTING PostgreSQL data (seed rows etc.) into Neo4j.
// Safe to run repeatedly (uses MERGE).
// Run from the project folder with:   node --env-file=.env.local scripts/sync-graph.mjs
import pg from "pg";
import neo4j from "neo4j-driver";

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);
const int = (n) => neo4j.int(n);
const fmt = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null);

try {
  await driver.verifyConnectivity();
  console.log("Connected to Neo4j and PostgreSQL");
  const sessionConfig = process.env.NEO4J_DATABASE ? { database: process.env.NEO4J_DATABASE } : {};
  const session = driver.session(sessionConfig);

  const props = await pool.query(
    `SELECT p.property_id, p.name, p.address, p.city, p.rent_amt, p.status, p.landlord_id, u.full_name AS landlord_name
     FROM properties p JOIN users u ON u.user_id = p.landlord_id`
  );
  for (const p of props.rows) {
    await session.run(
      `MERGE (u:User {user_id: $landlordId}) ON CREATE SET u.full_name = $landlordName, u.role = 'Landlord'
       MERGE (p:Property {property_id: $propertyId})
       SET p.name = $name, p.address = $address, p.city = $city, p.rent_amt = $rent, p.status = $status
       MERGE (u)-[:OWNS]->(p)`,
      {
        landlordId: int(p.landlord_id), landlordName: p.landlord_name, propertyId: int(p.property_id),
        name: p.name, address: p.address, city: p.city, rent: Number(p.rent_amt), status: p.status,
      }
    );
  }
  console.log(`Synced ${props.rowCount} properties`);

  const tenants = await pool.query(
    `SELECT t.tenant_id, t.user_id, t.property_id, t.lease_start_date, t.lease_end_date, t.status, u.full_name
     FROM tenants t JOIN users u ON u.user_id = t.user_id`
  );
  for (const t of tenants.rows) {
    await session.run(
      `MERGE (u:User {user_id: $userId}) ON CREATE SET u.full_name = $fullName, u.role = 'Tenant'
       MERGE (p:Property {property_id: $propertyId})
       MERGE (u)-[r:RENTS {tenant_id: $tenantId}]->(p)
       SET r.lease_start = $start, r.lease_end = $end, r.status = $status`,
      {
        userId: int(t.user_id), fullName: t.full_name, propertyId: int(t.property_id), tenantId: int(t.tenant_id),
        start: fmt(t.lease_start_date), end: fmt(t.lease_end_date), status: t.status,
      }
    );
  }
  console.log(`Synced ${tenants.rowCount} tenancies`);
  await session.close();
} catch (err) {
  console.error("Sync failed:", err.message);
  process.exitCode = 1;
} finally {
  await driver.close();
  await pool.end();
}
