import neo4j from "neo4j-driver";
import { runWrite } from "@/lib/neo4j";

// Graph model (PostgreSQL stays the source of truth, Neo4j mirrors the relationships):
//   (:User {user_id, full_name, role})-[:OWNS]->(:Property {property_id, name, city, address, rent_amt, status})
//   (:User)-[:RENTS {tenant_id, lease_start, lease_end, status}]->(:Property)
//
// IMPORTANT: JS numbers are sent to Neo4j as FLOATS unless wrapped in neo4j.int().
// Always wrap ids with int() so MERGE matches the same node every time.
const int = (n) => neo4j.int(n);

// Runs a sync function and never throws: if Neo4j is down the SQL data is still saved.
// Returns true/false so the API can report graph_synced.
export async function safely(fn) {
  try {
    await fn();
    return true;
  } catch (err) {
    console.error("Neo4j sync failed:", err.message);
    return false;
  }
}

// Landlord adds or edits a property
export function syncProperty({ landlordId, landlordName, property }) {
  return runWrite(
    `MERGE (u:User {user_id: $landlordId})
       ON CREATE SET u.full_name = $landlordName, u.role = 'Landlord'
     MERGE (p:Property {property_id: $propertyId})
     SET p.name = $name, p.address = $address, p.city = $city,
         p.rent_amt = $rent, p.status = $status
     MERGE (u)-[:OWNS]->(p)`,
    {
      landlordId: int(landlordId),
      landlordName,
      propertyId: int(property.property_id),
      name: property.name,
      address: property.address,
      city: property.city,
      rent: Number(property.rent_amt),
      status: property.status,
    }
  );
}

// Landlord deletes a property
export function deleteProperty(propertyId) {
  return runWrite(`MATCH (p:Property {property_id: $propertyId}) DETACH DELETE p`, {
    propertyId: int(propertyId),
  });
}

// Landlord assigns a tenant
export function syncTenancy({ tenantId, userId, fullName, propertyId, start, end }) {
  return runWrite(
    `MERGE (u:User {user_id: $userId})
       ON CREATE SET u.full_name = $fullName, u.role = 'Tenant'
     MERGE (p:Property {property_id: $propertyId})
     SET p.status = 'Occupied'
     MERGE (u)-[r:RENTS {tenant_id: $tenantId}]->(p)
     SET r.lease_start = $start, r.lease_end = $end, r.status = 'Active'`,
    {
      tenantId: int(tenantId),
      userId: int(userId),
      fullName,
      propertyId: int(propertyId),
      start,
      end: end ?? null,
    }
  );
}

// Landlord ends a lease. The RENTS relationship is kept as history with status 'Ended'.
export function syncLeaseEnded({ tenantId, propertyId }) {
  return runWrite(
    `MATCH (:User)-[r:RENTS {tenant_id: $tenantId}]->(p:Property {property_id: $propertyId})
     SET r.status = 'Ended', p.status = 'Available'`,
    { tenantId: int(tenantId), propertyId: int(propertyId) }
  );
}
// Sync a maintenance request to Neo4j
export function syncMaintenanceRequest({
  requestId,
  userId,
  fullName,
  propertyId,
  title,
  description,
  status,
  priority,
}) {
  return runWrite(
    `MERGE (u:User {user_id: $userId})
       ON CREATE SET u.full_name = $fullName, u.role = 'Tenant'
     MERGE (p:Property {property_id: $propertyId})
     MERGE (m:MaintenanceRequest {request_id: $requestId})
     SET m.title = $title,
         m.description = $description,
         m.status = $status,
         m.priority = $priority
     MERGE (u)-[:SUBMITTED]->(m)
     MERGE (m)-[:FOR_PROPERTY]->(p)`,
    {
      requestId: int(requestId),
      userId: int(userId),
      fullName,
      propertyId: int(propertyId),
      title,
      description,
      status,
      priority,
    }
  );
}

// Update maintenance status in Neo4j
export function syncMaintenanceStatus({ requestId, status }) {
  return runWrite(
    `MATCH (m:MaintenanceRequest {request_id: $requestId})
     SET m.status = $status`,
    {
      requestId: int(requestId),
      status,
    }
  );
}
