MERGE (alice:User {user_id: 1})   SET alice.full_name = 'Alice Smith',   alice.role = 'Landlord'
MERGE (bob:User {user_id: 2})     SET bob.full_name = 'Bob Jones',       bob.role = 'Landlord'
MERGE (charlie:User {user_id: 3}) SET charlie.full_name = 'Charlie Brown', charlie.role = 'Tenant'
MERGE (diana:User {user_id: 4})   SET diana.full_name = 'Diana Prince',  diana.role = 'Tenant'

MERGE (p1:Property {property_id: 1}) SET p1.name = 'Sunset Apartments', p1.address = '123 Main St',    p1.city = 'Metropolis',    p1.rent_amt = 1500.0, p1.status = 'Occupied'
MERGE (p2:Property {property_id: 2}) SET p2.name = 'Ocean View Villa',  p2.address = '456 Beach Rd',   p2.city = 'Coastal City',  p2.rent_amt = 3000.0, p2.status = 'Available'
MERGE (p3:Property {property_id: 3}) SET p3.name = 'Downtown Loft',     p3.address = '789 Center Blvd', p3.city = 'Gotham',       p3.rent_amt = 2000.0, p3.status = 'Occupied'

MERGE (alice)-[:OWNS]->(p1)
MERGE (alice)-[:OWNS]->(p2)
MERGE (bob)-[:OWNS]->(p3)

MERGE (charlie)-[r1:RENTS {tenant_id: 1}]->(p1) SET r1.lease_start = '2026-01-01', r1.lease_end = '2026-12-31', r1.status = 'Active'
MERGE (diana)-[r2:RENTS {tenant_id: 2}]->(p3)   SET r2.lease_start = '2026-02-01', r2.lease_end = '2027-01-31', r2.status = 'Active'

MATCH (charlie:User {user_id: 3}), (diana:User {user_id: 4}),
      (p1:Property {property_id: 1}), (p3:Property {property_id: 3})
MERGE (mr1:MaintenanceRequest {request_id: 1})
  SET mr1.title = 'Leaking Kitchen Tap', mr1.priority = 'High', mr1.status = 'Submitted'
MERGE (mr2:MaintenanceRequest {request_id: 2})
  SET mr2.title = 'AC Not Cooling', mr2.priority = 'Medium', mr2.status = 'In Progress'
MERGE (charlie)-[:SUBMITTED]->(mr1)
MERGE (mr1)-[:FOR_PROPERTY]->(p1)
MERGE (diana)-[:SUBMITTED]->(mr2)
MERGE (mr2)-[:FOR_PROPERTY]->(p3)